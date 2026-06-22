import { createHash, randomBytes } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { query } from "@/lib/db";
import type { UserRole, UserStatus } from "@/lib/database.types";

const SESSION_COOKIE = "warehouse_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

export type CurrentUser = {
  id: string;
  username: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: Date;
  updated_at: Date;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);

  await query("delete from sessions where expires_at <= now()");
  await query(
    "insert into sessions (token_hash, user_id, expires_at) values ($1, $2, now() + ($3 * interval '1 second'))",
    [tokenHash, userId, SESSION_MAX_AGE]
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const result = await query<CurrentUser>(
    `select u.id, u.username, u.full_name, u.role, u.status, u.department, u.position,
            u.phone, u.avatar_url, u.created_at, u.updated_at
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now() and u.status = 'active'
      limit 1`,
    [hashToken(token)]
  );

  return result.rows[0] || null;
});

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  try {
    if (token) {
      await query("delete from sessions where token_hash = $1", [hashToken(token)]);
    }
  } finally {
    cookieStore.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0
    });
  }
}

export async function revokeUserSessions(userId: string) {
  await query("delete from sessions where user_id = $1", [userId]);
}
