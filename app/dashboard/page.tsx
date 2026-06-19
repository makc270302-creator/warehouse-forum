import { AlertTriangle, FileText, MessageCircle, Pin } from "lucide-react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { StatusPill } from "@/components/status-pill";
import { createServerSupabaseClient } from "@/lib/supabase/server";
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
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: { full_name: string; role: string; status: string; department: string | null } | null = null;

  if (user) {
    const { data } = await supabase.from("profiles").select("full_name, role, status, department").eq("id", user.id).single();
    profile = data;
  }

  if (profile?.status === "inactive") {
    redirect("/login");
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id,title,body,priority,is_pinned,created_at")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(6);

  const visiblePosts: DashboardPost[] = posts?.length ? (posts as DashboardPost[]) : demoPosts;
  const profileName = (profile as { full_name: string } | null)?.full_name || user?.email || "";

  return (
    <PortalShell
      profileName={profileName}
      role={profile?.role === "admin" ? "admin" : undefined}
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
          <p className="mt-3 text-3xl font-bold text-ink">0</p>
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

      {!posts?.length ? (
        <div className="mt-5 flex items-start gap-3 rounded-md border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-steel">
          <AlertTriangle className="mt-0.5 shrink-0 text-amber" size={18} />
          После подключения Supabase здесь появятся реальные объявления из базы.
        </div>
      ) : null}
    </PortalShell>
  );
}
