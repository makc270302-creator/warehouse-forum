import { MessageSquareText, Pin } from "lucide-react";
import { redirect } from "next/navigation";
import { NewPostForm } from "@/app/forum/new-post-form";
import { PortalShell } from "@/components/portal-shell";
import { StatusPill } from "@/components/status-pill";
import type { UserRole } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: { full_name: string; role: UserRole; status: string } | null = null;

  if (user) {
    const { data } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).single();
    profile = data;
  }

  if (profile?.status === "inactive") {
    redirect("/login");
  }

  const { data: posts } = await supabase
    .from("posts")
    .select("id,title,body,type,priority,is_pinned,created_at")
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const profileName = (profile as { full_name: string } | null)?.full_name || user?.email || "";
  const role = (profile as { role: UserRole } | null)?.role || "employee";

  return (
    <PortalShell
      profileName={profileName}
      role={role}
      subtitle="Темы для модераторов, сотрудников и администраторов склада."
      title="Форум"
    >
      {user ? <NewPostForm role={role} userId={user.id} /> : null}

      <section className="mt-6 grid gap-4">
        {posts?.length ? (
          (posts as ForumPost[]).map((post) => (
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
