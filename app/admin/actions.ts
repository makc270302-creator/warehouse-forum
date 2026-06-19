"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fetchUsersFromGoogleSheet, parseTabularUsers, syncUsers, syncUsersFromGoogleSheet, validateUserRows } from "@/lib/users/sync";
import type { PostType, Priority, UserRole, UserStatus } from "@/lib/database.types";

async function requireAdmin() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Not authenticated");
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (profile?.role !== "admin") {
    throw new Error("Admin role required");
  }

  return { supabase, user };
}

function setSyncReport(report: {
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
  cookies().set(
    "admin_user_sync_report",
    JSON.stringify({
      ...report,
      errors: (report.errors || []).slice(0, 12),
      warnings: (report.warnings || []).slice(0, 12)
    }),
    {
      httpOnly: true,
      path: "/admin",
      sameSite: "lax",
      maxAge: 60 * 10
    }
  );
}

export async function updateUserRole(formData: FormData) {
  const { supabase } = await requireAdmin();
  const userId = String(formData.get("user_id") || "");
  const role = String(formData.get("role") || "employee") as UserRole;
  const status = String(formData.get("status") || "active") as UserStatus;

  if (!userId || !["employee", "shift_lead", "admin"].includes(role) || !["active", "inactive"].includes(status)) {
    throw new Error("Invalid user profile update");
  }

  await supabase.from("profiles").update({ role, status }).eq("id", userId).throwOnError();
  revalidatePath("/admin");
}

export async function importUsersFromTable(formData: FormData) {
  const { user } = await requireAdmin();

  const raw = String(formData.get("users_table") || "");
  const rows = parseTabularUsers(raw);
  const updateExistingPasswords = formData.get("update_passwords") === "on";

  if (!rows.length) {
    redirect("/admin?import=empty");
  }

  let result: Awaited<ReturnType<typeof syncUsers>>;

  try {
    result = await syncUsers(rows, {
      source: "manual",
      triggeredBy: user.email,
      updateExistingPasswords
    });
  } catch {
    redirect("/admin?import=service_key");
  }

  const count = result.created + result.updated;

  setSyncReport({ mode: "import", ok: !result.errors.length, ...result });
  revalidatePath("/admin");

  if (result.errors.length) {
    redirect(`/admin?import=partial&count=${count}&errors=${result.errors.length}`);
  }

  redirect(`/admin?import=success&count=${count}`);
}

export async function syncUsersFromGoogle() {
  const { user } = await requireAdmin();
  const updateExistingPasswords = false;
  const deactivateMissing = false;

  let result: Awaited<ReturnType<typeof syncUsersFromGoogleSheet>>;

  try {
    result = await syncUsersFromGoogleSheet({
      triggeredBy: user.email,
      updateExistingPasswords,
      deactivateMissing
    });
  } catch {
    redirect("/admin?sync=error");
  }

  const count = result.created + result.updated;

  setSyncReport({ mode: "sync", ok: !result.errors.length, ...result });
  revalidatePath("/admin");

  if (result.errors.length) {
    redirect(`/admin?sync=partial&count=${count}&errors=${result.errors.length}`);
  }

  redirect(`/admin?sync=success&count=${count}`);
}

export async function syncUsersFromGoogleWithOptions(formData: FormData) {
  const { user } = await requireAdmin();
  const updateExistingPasswords = formData.get("update_passwords") === "on";
  const deactivateMissing = formData.get("deactivate_missing") === "on";

  let result: Awaited<ReturnType<typeof syncUsersFromGoogleSheet>>;

  try {
    result = await syncUsersFromGoogleSheet({
      triggeredBy: user.email,
      updateExistingPasswords,
      deactivateMissing
    });
  } catch {
    redirect("/admin?sync=error");
  }

  const count = result.created + result.updated;

  setSyncReport({ mode: "sync", ok: !result.errors.length, ...result });
  revalidatePath("/admin");

  if (result.errors.length) {
    redirect(`/admin?sync=partial&count=${count}&errors=${result.errors.length}`);
  }

  redirect(`/admin?sync=success&count=${count}`);
}

export async function checkGoogleUsers() {
  await requireAdmin();

  try {
    const rows = await fetchUsersFromGoogleSheet();
    const warnings = validateUserRows(rows);

    setSyncReport({
      mode: "check",
      ok: rows.length > 0,
      totalRows: rows.length,
      skipped: 0,
      errors: rows.length ? [] : ["Таблица прочитана, но подходящие строки не найдены."],
      warnings
    });
  } catch (error) {
    setSyncReport({
      mode: "check",
      ok: false,
      totalRows: 0,
      errors: [error instanceof Error ? error.message : "Не удалось прочитать Google Sheets."],
      warnings: []
    });
  }

  revalidatePath("/admin");
  redirect("/admin?check=done");
}

export async function createAdminPost(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const title = String(formData.get("title") || "").trim();
  const body = String(formData.get("body") || "").trim();
  const type = String(formData.get("type") || "announcement") as PostType;
  const priority = String(formData.get("priority") || "important") as Priority;
  const isPinned = formData.get("is_pinned") === "on";

  if (!title || !body) {
    throw new Error("Post title and body are required");
  }

  await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      title,
      body,
      type,
      priority,
      is_pinned: isPinned
    })
    .throwOnError();

  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/forum");
}

export async function togglePostPin(formData: FormData) {
  const { supabase } = await requireAdmin();
  const postId = String(formData.get("post_id") || "");
  const nextPinned = formData.get("next_pinned") === "true";

  if (!postId) {
    throw new Error("Post id is required");
  }

  await supabase.from("posts").update({ is_pinned: nextPinned }).eq("id", postId).throwOnError();
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/forum");
}

export async function deletePost(formData: FormData) {
  const { supabase } = await requireAdmin();
  const postId = String(formData.get("post_id") || "");

  if (!postId) {
    throw new Error("Post id is required");
  }

  await supabase.from("posts").delete().eq("id", postId).throwOnError();
  revalidatePath("/admin");
}
