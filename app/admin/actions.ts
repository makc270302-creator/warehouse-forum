"use server";

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser, revokeUserSessions } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { normalizeLogin } from "@/lib/auth/login";
import { writeAuditLog } from "@/lib/audit";
import { query } from "@/lib/db";
import { fetchUsersFromGoogleSheet, parseTabularUsers, syncUsers, syncUsersFromGoogleSheet, validateUserRows } from "@/lib/users/sync";
import type { PostType, Priority, UserRole, UserStatus } from "@/lib/database.types";

async function requireAdmin() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    throw new Error("Admin role required");
  }

  return user;
}

async function setSyncReport(report: {
  mode: "check" | "import" | "sync";
  ok: boolean;
  totalRows: number;
  created?: number;
  updated?: number;
  deactivated?: number;
  skipped?: number;
  passwordUpdated?: number;
  errors?: string[];
  warnings?: string[];
}) {
  const cookieStore = await cookies();
  cookieStore.set(
    "admin_user_sync_report",
    JSON.stringify({
      ...report,
      errors: (report.errors || []).slice(0, 12),
      warnings: (report.warnings || []).slice(0, 12)
    }),
    { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/admin", sameSite: "lax", maxAge: 60 * 10 }
  );
}

export async function updateUserRole(formData: FormData) {
  const actor = await requireAdmin();
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "employee") as UserRole;
  const status = String(formData.get("status") || "active") as UserStatus;
  const newPassword = String(formData.get("new_password") || "");

  if (!userId || !["employee", "shift_lead", "admin"].includes(role) || !["active", "inactive"].includes(status)) {
    throw new Error("Invalid user update");
  }

  if (actor.id === userId && (role !== "admin" || status !== "active")) {
    throw new Error("Administrator cannot disable their own account");
  }

  if (newPassword) {
    const passwordHash = await hashPassword(newPassword);
    await query("update users set role=$1, status=$2, password_hash=$3 where id=$4", [role, status, passwordHash, userId]);
    await revokeUserSessions(userId);
  } else {
    await query("update users set role=$1, status=$2 where id=$3", [role, status, userId]);
    if (status === "inactive") await revokeUserSessions(userId);
  }
  await writeAuditLog("user.access_update", actor.id, "user", userId, { role, status, passwordChanged: Boolean(newPassword) });
  revalidatePath("/admin");
}

export async function createUser(formData: FormData) {
  const actor = await requireAdmin();
  const username = normalizeLogin(String(formData.get("username") || ""));
  const fullName = String(formData.get("full_name") || "").trim();
  const position = String(formData.get("position") || "").trim() || null;
  const role = String(formData.get("role") || "employee") as UserRole;
  const password = String(formData.get("password") || "");

  if (!/^[a-z0-9._-]{3,64}$/.test(username) || fullName.length < 3 || fullName.length > 160 || !["employee", "shift_lead", "admin"].includes(role)) {
    throw new Error("Invalid user data");
  }

  const passwordHash = await hashPassword(password);
  const created = await query<{ id: string }>(
    `insert into users (username,full_name,position,role,status,password_hash)
     values ($1,$2,$3,$4,'active',$5) returning id`,
    [username, fullName, position, role, passwordHash]
  );
  await writeAuditLog("user.create", actor.id, "user", created.rows[0]?.id, { username, role });
  revalidatePath("/admin");
}

export async function importUsersFromTable(formData: FormData) {
  const user = await requireAdmin();
  const rows = parseTabularUsers(String(formData.get("users_table") || ""));
  const updateExistingPasswords = formData.get("update_passwords") === "on";

  if (!rows.length) redirect("/admin?import=empty");

  let result: Awaited<ReturnType<typeof syncUsers>>;
  try {
    result = await syncUsers(rows, { source: "manual", triggeredBy: user.username, updateExistingPasswords });
  } catch {
    redirect("/admin?import=error");
  }

  const count = result.created + result.updated;
  await setSyncReport({ mode: "import", ok: !result.errors.length, ...result });
  await writeAuditLog("users.import", user.id, "user", null, { count, errors: result.errors.length });
  revalidatePath("/admin");
  if (result.errors.length) redirect(`/admin?import=partial&count=${count}&errors=${result.errors.length}`);
  redirect(`/admin?import=success&count=${count}`);
}

export async function syncUsersFromGoogle() {
  const user = await requireAdmin();
  return runGoogleSync(user.id, user.username, false, false);
}

export async function syncUsersFromGoogleWithOptions(formData: FormData) {
  const user = await requireAdmin();
  return runGoogleSync(
    user.id,
    user.username,
    formData.get("update_passwords") === "on",
    formData.get("deactivate_missing") === "on"
  );
}

async function runGoogleSync(actorId: string, username: string, updateExistingPasswords: boolean, deactivateMissing: boolean) {
  let result: Awaited<ReturnType<typeof syncUsersFromGoogleSheet>>;
  try {
    result = await syncUsersFromGoogleSheet({ triggeredBy: username, updateExistingPasswords, deactivateMissing });
  } catch {
    redirect("/admin?sync=error");
  }

  const count = result.created + result.updated;
  await setSyncReport({ mode: "sync", ok: !result.errors.length, ...result });
  await writeAuditLog("users.sync", actorId, "user", null, { count, errors: result.errors.length });
  revalidatePath("/admin");
  if (result.errors.length) redirect(`/admin?sync=partial&count=${count}&errors=${result.errors.length}`);
  redirect(`/admin?sync=success&count=${count}`);
}

export async function checkGoogleUsers() {
  await requireAdmin();
  try {
    const rows = await fetchUsersFromGoogleSheet();
    const warnings = validateUserRows(rows);
    await setSyncReport({ mode: "check", ok: rows.length > 0, totalRows: rows.length, skipped: 0, errors: rows.length ? [] : ["Таблица прочитана, но подходящие строки не найдены."], warnings });
  } catch (error) {
    await setSyncReport({ mode: "check", ok: false, totalRows: 0, errors: [error instanceof Error ? error.message : "Не удалось прочитать Google Sheets."], warnings: [] });
  }
  revalidatePath("/admin");
  redirect("/admin?check=done");
}

export async function createAdminPost(formData: FormData) {
  const user = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const type = String(formData.get("type") || "announcement") as PostType;
  const priority = String(formData.get("priority") || "important") as Priority;
  const isPinned = formData.get("is_pinned") === "on";

  if (title.length < 3 || title.length > 120 || body.length < 3 || body.length > 8000) throw new Error("Invalid post");
  if (!["announcement", "discussion", "instruction"].includes(type) || !["normal", "important", "critical"].includes(priority)) throw new Error("Invalid post options");

  const created = await query<{ id: string }>(
    "insert into posts (author_id,title,body,type,priority,is_pinned) values ($1,$2,$3,$4,$5,$6) returning id",
    [user.id, title, body, type, priority, isPinned]
  );
  await writeAuditLog("post.create_admin", user.id, "post", created.rows[0]?.id, { type, priority, isPinned });
  revalidatePath("/admin"); revalidatePath("/dashboard"); revalidatePath("/forum");
}

export async function togglePostPin(formData: FormData) {
  const user = await requireAdmin();
  const postId = String(formData.get("post_id") || "");
  const nextPinned = formData.get("next_pinned") === "true";
  if (!postId) throw new Error("Post id is required");
  await query("update posts set is_pinned=$1 where id=$2", [nextPinned, postId]);
  await writeAuditLog("post.pin", user.id, "post", postId, { isPinned: nextPinned });
  revalidatePath("/admin"); revalidatePath("/dashboard"); revalidatePath("/forum");
}

export async function deletePost(formData: FormData) {
  const user = await requireAdmin();
  const postId = String(formData.get("post_id") || "");
  if (!postId) throw new Error("Post id is required");
  await query("delete from posts where id=$1", [postId]);
  await writeAuditLog("post.delete", user.id, "post", postId);
  revalidatePath("/admin"); revalidatePath("/dashboard"); revalidatePath("/forum");
}

const allowedDocumentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png"
]);

export async function uploadDocument(formData: FormData) {
  const user = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const file = formData.get("file");

  if (title.length < 3 || title.length > 160 || !(file instanceof File) || !file.size || file.size > 20 * 1024 * 1024) {
    throw new Error("Invalid document");
  }
  if (!allowedDocumentTypes.has(file.type)) throw new Error("Unsupported document type");

  const extension = (file.name.toLowerCase().match(/\.[a-z0-9]{1,9}$/)?.[0] || "").slice(0, 10);
  const storedName = `${randomUUID()}${extension}`;
  const uploadsRoot = process.env.UPLOADS_DIR || "/data/uploads";
  await mkdir(uploadsRoot, { recursive: true });
  await writeFile(`${uploadsRoot}/${storedName}`, new Uint8Array(await file.arrayBuffer()), { flag: "wx" });

  try {
    const created = await query<{ id: string }>(
      `insert into documents (title,description,file_path,original_name,mime_type,size_bytes,uploaded_by)
       values ($1,$2,$3,$4,$5,$6,$7) returning id`,
      [title, description, storedName, file.name.slice(0, 255), file.type, file.size, user.id]
    );
    await writeAuditLog("document.upload", user.id, "document", created.rows[0]?.id, { name: file.name, size: file.size });
  } catch (error) {
    await unlink(`${uploadsRoot}/${storedName}`).catch(() => undefined);
    throw error;
  }

  revalidatePath("/admin"); revalidatePath("/documents"); revalidatePath("/dashboard");
}

export async function deleteDocument(formData: FormData) {
  const user = await requireAdmin();
  const documentId = String(formData.get("document_id") || "");
  const result = await query<{ file_path: string }>("delete from documents where id=$1 returning file_path", [documentId]);
  const stored = result.rows[0];

  if (stored) {
    const uploadsRoot = process.env.UPLOADS_DIR || "/data/uploads";
    if (/^[0-9a-f-]{36}\.[a-z0-9]{1,9}$/i.test(stored.file_path)) await unlink(`${uploadsRoot}/${stored.file_path}`).catch(() => undefined);
    await writeAuditLog("document.delete", user.id, "document", documentId);
  }

  revalidatePath("/admin"); revalidatePath("/documents"); revalidatePath("/dashboard");
}
