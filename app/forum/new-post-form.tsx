"use client";

import { Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { PostType, Priority, UserRole } from "@/lib/database.types";

export function NewPostForm({ userId, role }: { userId: string; role: UserRole }) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();
  const canPublishOperations = role === "shift_lead" || role === "admin";
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<PostType>("discussion");
  const [priority, setPriority] = useState<Priority>("normal");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: insertError } = await supabase.from("posts").insert({
      author_id: userId,
      title,
      body,
      type,
      priority,
      is_pinned: false
    });

    setLoading(false);

    if (insertError) {
      setError("Не удалось создать тему. Проверьте права доступа в Supabase.");
      return;
    }

    setTitle("");
    setBody("");
    setType("discussion");
    setPriority("normal");
    router.refresh();
  }

  return (
    <form className="rounded-md border border-line bg-white p-4 shadow-sm" onSubmit={submitPost}>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-sm font-semibold text-ink">Тема</span>
          <input
            className="focus-ring h-11 w-full rounded-md border border-line px-3"
            maxLength={120}
            onChange={(event) => setTitle(event.target.value)}
            required
            value={title}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Тип</span>
          <select
            className="focus-ring h-11 w-full rounded-md border border-line px-3"
            onChange={(event) => setType(event.target.value as PostType)}
            value={type}
          >
            <option value="discussion">Обсуждение</option>
            {canPublishOperations ? <option value="announcement">Объявление</option> : null}
            {canPublishOperations ? <option value="instruction">Инструкция</option> : null}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-ink">Приоритет</span>
          <select
            className="focus-ring h-11 w-full rounded-md border border-line px-3"
            onChange={(event) => setPriority(event.target.value as Priority)}
            value={priority}
          >
            <option value="normal">Обычный</option>
            <option value="important">Важный</option>
            {canPublishOperations ? <option value="critical">Критичный</option> : null}
          </select>
        </label>
      </div>
      <label className="mt-3 block">
        <span className="mb-1 block text-sm font-semibold text-ink">Сообщение</span>
        <textarea
          className="focus-ring min-h-28 w-full resize-y rounded-md border border-line p-3"
          onChange={(event) => setBody(event.target.value)}
          required
          value={body}
        />
      </label>
      {error ? <p className="mt-3 rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}
      <button
        className="focus-ring mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-4 text-sm font-bold text-white hover:bg-steel disabled:opacity-70"
        disabled={loading}
        type="submit"
      >
        <Send size={16} />
        Опубликовать
      </button>
    </form>
  );
}
