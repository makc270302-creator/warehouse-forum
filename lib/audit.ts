import { headers } from "next/headers";
import { query } from "@/lib/db";

export async function writeAuditLog(action: string, actorId: string | null, entityType?: string, entityId?: string | null, details: Record<string, unknown> = {}) {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    const userAgent = requestHeaders.get("user-agent") || null;

    await query(
      `insert into audit_logs (actor_id, action, entity_type, entity_id, ip_address, user_agent, details)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [actorId, action, entityType || null, entityId || null, forwardedFor, userAgent, JSON.stringify(details)]
    );
  } catch {
    // Audit logging must not make the requested operation unavailable.
  }
}
