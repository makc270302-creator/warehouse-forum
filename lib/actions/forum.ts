"use server";

import type { PostType, Priority, UserRole } from "@/lib/database.types";
import { createServerActionSupabaseClient } from "@/lib/supabase/server";

type CreatePostInput = {
  title: string;
  body: string;
  type: PostType;
  priority: Priority;
};

export type CreatePostResult = { ok: true } | { ok: false; error: string };

export async function createPostAction(input: CreatePostInput): Promise<CreatePostResult> {
  try {
    const supabase = createServerActionSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Сессия истекла. Войдите в систему снова." };
    }

    const { data: profile } = await supabase.from("profiles").select("role,status").eq("id", user.id).single();

    if (!profile || profile.status !== "active") {
      return { ok: false, error: "Учетная запись неактивна или не найдена." };
    }

    const role = profile.role as UserRole;
    const canPublishOperations = role === "shift_lead" || role === "admin";
    const title = input.title.trim();
    const body = input.body.trim();
    const allowedTypes: PostType[] = canPublishOperations
      ? ["discussion", "announcement", "instruction"]
      : ["discussion"];
    const allowedPriorities: Priority[] = canPublishOperations
      ? ["normal", "important", "critical"]
      : ["normal", "important"];

    if (!title || title.length > 120 || !body || !allowedTypes.includes(input.type) || !allowedPriorities.includes(input.priority)) {
      return { ok: false, error: "Проверьте заполнение темы и права на выбранный тип публикации." };
    }

    const { error } = await supabase.from("posts").insert({
      author_id: user.id,
      title,
      body,
      type: input.type,
      priority: input.priority,
      is_pinned: false
    });

    if (error) {
      return { ok: false, error: "Не удалось создать тему. Попробуйте ещё раз." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Сервер временно недоступен. Попробуйте ещё раз." };
  }
}
