import { NextResponse } from "next/server";
import { syncUsersFromGoogleSheet } from "@/lib/users/sync";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.USER_SYNC_SECRET || process.env.CRON_SECRET;
  const cronSecret = process.env.CRON_SECRET;

  if (!secret && !cronSecret) {
    return false;
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer === secret || bearer === cronSecret;
}

async function sync(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const result = await syncUsersFromGoogleSheet({
      source: "api",
      updateExistingPasswords: url.searchParams.get("update_passwords") === "true",
      deactivateMissing: url.searchParams.get("deactivate_missing") === "true"
    });
    const status = result.errors.length ? 207 : 200;

    return NextResponse.json({ ok: !result.errors.length, ...result }, { status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "User sync failed" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return sync(request);
}

export async function POST(request: Request) {
  return sync(request);
}
