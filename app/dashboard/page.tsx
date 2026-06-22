import { AlertTriangle, FileText, MessageCircle, Pin } from "lucide-react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import type { Priority } from "@/lib/database.types";

export const dynamic = "force-dynamic";

type DashboardPost = {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  is_pinned: boolean;
};

const demoPosts = [
  {
    id: "demo-1",
    title: "Проверка зон отгрузки перед началом смены",
    body: "РС фиксируют состояние зон и отмечают замечания в обсуждении.",
    priority: "important" as Priority,
    is_pinned: true
  },
  {
    id: "demo-2",
    title: "Обновлены инструкции по маркировке",
    body: "Новая версия доступна в разделе документов.",
    priority: "normal" as Priority,
    is_pinned: false
  }
];

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [postsResult, documentsResult] = await Promise.all([
    query<DashboardPost>("select id,title,body,priority,is_pinned from posts order by is_pinned desc, created_at desc limit 6"),
    query<{ count: string }>("select count(*)::text as count from documents")
  ]);
  const posts = postsResult.rows;
  const visiblePosts: DashboardPost[] = posts.length ? posts : demoPosts;
  const documentCount = Number(documentsResult.rows[0]?.count || 0);

  return (
    <PortalShell
      profileName={user.full_name}
      role={user.role}
      subtitle="Главные объявления, быстрый доступ к обсуждениям и документам."
      title="Сводка склада"
    >
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-steel">Закреплено</span>
            <Pin size={18} className="text-mint" />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{visiblePosts.filter((post) => post.is_pinned).length}</p>
        </div>
        <div className="rounded-md border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-steel">Обсуждения</span>
            <MessageCircle size={18} className="text-mint" />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{visiblePosts.length}</p>
        </div>
        <div className="rounded-md border border-line bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-steel">Документы</span>
            <FileText size={18} className="text-mint" />
          </div>
          <p className="mt-3 text-3xl font-bold text-ink">{documentCount}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4">
        {visiblePosts.map((post) => (
          <article className="rounded-md border border-line bg-white p-4 shadow-sm" key={post.id}>
            <div className="flex flex-wrap items-center gap-2">
              {post.is_pinned ? <Pin size={16} className="text-mint" /> : null}
              <StatusPill priority={post.priority} />
            </div>
            <h2 className="mt-3 text-lg font-bold text-ink">{post.title}</h2>
            <p className="mt-2 text-sm leading-6 text-steel">{post.body}</p>
          </article>
        ))}
      </section>

      {!posts.length ? (
        <div className="mt-5 flex items-start gap-3 rounded-md border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-steel">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber" size={18} />
          Пока используются демонстрационные объявления. Опубликуйте первую запись в форуме.
        </div>
      ) : null}
    </PortalShell>
  );
}
