import { MessageSquareText, Pin } from "lucide-react";
import { redirect } from "next/navigation";
import { NewPostForm } from "@/app/forum/new-post-form";
import { PortalShell } from "@/components/portal-shell";
import { StatusPill } from "@/components/status-pill";
import type { UserRole } from "@/lib/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type ForumPost = {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: "normal" | "important" | "critical";
  is_pinned: boolean;
};

export default async function ForumPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const posts = (await query<ForumPost>("select id,title,body,type,priority,is_pinned from posts order by is_pinned desc, created_at desc")).rows;
  const role = user.role as UserRole;

  return (
    <PortalShell
      profileName={user.full_name}
      role={role}
      subtitle="Темы для модераторов, сотрудников и администраторов склада."
      title="Форум"
    >
      <NewPostForm role={role} />

      <section className="mt-6 grid gap-4">
        {posts.length ? (
          posts.map((post) => (
            <article className="rounded-md border border-line bg-white p-4 shadow-sm" key={post.id}>
              <div className="flex flex-wrap items-center gap-2">
                {post.is_pinned ? <Pin size={16} className="text-mint" /> : null}
                <StatusPill priority={post.priority} />
                <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-steel">{post.type}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-ink">{post.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-steel">{post.body}</p>
            </article>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-line bg-white p-8 text-center">
            <MessageSquareText className="mx-auto text-mint" size={34} />
            <h2 className="mt-3 text-lg font-bold text-ink">Тем пока нет</h2>
            <p className="mt-1 text-sm text-steel">Первая публикация появится здесь.</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
