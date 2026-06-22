"use server";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { normalizeLogin } from "@/lib/auth/login";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, deleteCurrentSession } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { query } from "@/lib/db";
import type { UserRole, UserStatus } from "@/lib/database.types";

type LoginUser = {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
};

async function getAttemptKey(username: string) {
  const requestHeaders = await headers();
  const ip = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHash("sha256").update(`${username}|${ip}`).digest("hex");
}

async function isLoginBlocked(attemptKey: string) {
  const result = await query<{ blocked: boolean }>(
    "select coalesce(blocked_until > now(), false) as blocked from login_attempts where attempt_key=$1",
    [attemptKey]
  );
  return result.rows[0]?.blocked || false;
}

async function registerFailedLogin(attemptKey: string) {
  await query(
    `insert into login_attempts (attempt_key, attempts, window_started_at, blocked_until)
     values ($1, 1, now(), null)
     on conflict (attempt_key) do update set
       attempts = case when login_attempts.window_started_at < now() - interval '15 minutes' then 1 else login_attempts.attempts + 1 end,
       window_started_at = case when login_attempts.window_started_at < now() - interval '15 minutes' then now() else login_attempts.window_started_at end,
       blocked_until = case
         when (case when login_attempts.window_started_at < now() - interval '15 minutes' then 1 else login_attempts.attempts + 1 end) >= 5
         then now() + interval '15 minutes'
         else null
       end`,
    [attemptKey]
  );
}

export type LoginResult = { ok: true } | { ok: false; error: string };

async function findOrBootstrapUser(login: string, password: string) {
  const existing = await query<LoginUser>(
    "select id, username, password_hash, role, status from users where lower(username) = lower($1) limit 1",
    [login]
  );

  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const bootstrapLogin = normalizeLogin(process.env.BOOTSTRAP_ADMIN_LOGIN || "");
  const bootstrapPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";

  if (!bootstrapLogin || login !== bootstrapLogin || !bootstrapPassword || password !== bootstrapPassword) {
    return null;
  }

  const passwordHash = await hashPassword(password);
  const created = await query<LoginUser>(
    `insert into users (username, full_name, password_hash, role, status)
     values ($1, $2, $3, 'admin', 'active')
     returning id, username, password_hash, role, status`,
    [login, process.env.BOOTSTRAP_ADMIN_NAME || "Администратор", passwordHash]
  );

  return created.rows[0] || null;
}

export async function loginAction(login: string, password: string): Promise<LoginResult> {
  const normalizedLogin = normalizeLogin(login);
  const attemptKey = await getAttemptKey(normalizedLogin);

  try {
    if (await isLoginBlocked(attemptKey)) {
      return { ok: false, error: "Слишком много попыток входа. Повторите через 15 минут." };
    }

    const user = await findOrBootstrapUser(normalizedLogin, password);
    const passwordIsValid = user ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !passwordIsValid) {
      await registerFailedLogin(attemptKey);
      await writeAuditLog("auth.login_failed", user?.id || null, "user", user?.id || null, { username: normalizedLogin });
      return { ok: false, error: "Не удалось войти. Проверьте логин и пароль." };
    }

    if (user.status !== "active") {
      await writeAuditLog("auth.login_inactive", user.id, "user", user.id);
      return { ok: false, error: "Учетная запись отключена. Обратитесь к администратору." };
    }

    await createSession(user.id);
    await query("delete from login_attempts where attempt_key=$1", [attemptKey]);
    await writeAuditLog("auth.login", user.id, "user", user.id);
    return { ok: true };
  } catch (error) {
    console.error("Login failed", error);
    return { ok: false, error: "Сервер авторизации временно недоступен. Попробуйте ещё раз." };
  }
}

export async function logoutAction() {
  try {
    await deleteCurrentSession();
  } catch (error) {
    console.error("Logout failed", error);
  }
}
