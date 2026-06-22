"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { writeAuditLog } from "@/lib/audit";
import { query } from "@/lib/db";
import type { PostType, Priority } from "@/lib/database.types";

type CreatePostInput = {
  title: string;
  body: string;
  type: PostType;
  priority: Priority;
};

export type CreatePostResult = { ok: true } | { ok: false; error: string };

export async function createPostAction(input: CreatePostInput): Promise<CreatePostResult> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return { ok: false, error: "Сессия истекла. Войдите в систему снова." };
    }

    const canPublishOperations = user.role === "shift_lead" || user.role === "admin";
    const title = input.title.trim();
    const body = input.body.trim();
    const allowedTypes: PostType[] = canPublishOperations
      ? ["discussion", "announcement", "instruction"]
      : ["discussion"];
    const allowedPriorities: Priority[] = canPublishOperations
      ? ["normal", "important", "critical"]
      : ["normal", "important"];

    if (title.length < 3 || title.length > 120 || body.length < 3 || body.length > 8000 || !allowedTypes.includes(input.type) || !allowedPriorities.includes(input.priority)) {
      return { ok: false, error: "Проверьте заполнение темы и права на выбранный тип публикации." };
    }

    const created = await query<{ id: string }>(
      `insert into posts (author_id, title, body, type, priority, is_pinned)
       values ($1, $2, $3, $4, $5, false) returning id`,
      [user.id, title, body, input.type, input.priority]
    );

    await writeAuditLog("post.create", user.id, "post", created.rows[0]?.id, { type: input.type, priority: input.priority });
    revalidatePath("/forum");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    console.error("Create post failed", error);
    return { ok: false, error: "Сервер временно недоступен. Попробуйте ещё раз." };
  }
}
