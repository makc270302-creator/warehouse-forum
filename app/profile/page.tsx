import { ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import type { Database } from "@/lib/database.types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const roleLabel = {
  employee: "Сотрудник",
  shift_lead: "Модератор",
  admin: "Администратор"
};

export default async function ProfilePage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: Database["public"]["Tables"]["profiles"]["Row"] | null = null;

  if (user) {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    profile = data;
  }

  if (profile?.status === "inactive") {
    redirect("/login");
  }
  const profileName = (profile as { full_name: string } | null)?.full_name || user?.email || "";

  return (
    <PortalShell
      profileName={profileName}
      role={profile?.role}
      subtitle="Данные учетной записи и роль доступа."
      title="Профиль"
    >
      <section className="rounded-md border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-mint/10 text-mint">
            <UserRound size={30} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-ink">{profile?.full_name || user?.email}</h2>
            <p className="mt-1 text-sm text-steel">{user?.email}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Роль</dt>
            <dd className="mt-2 flex items-center gap-2 text-base font-bold text-ink">
              <ShieldCheck size={18} className="text-mint" />
              {profile?.role ? roleLabel[profile.role] : "Не назначена"}
            </dd>
          </div>
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Отдел</dt>
            <dd className="mt-2 text-base font-bold text-ink">{profile?.department || "Не указан"}</dd>
          </div>
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Должность</dt>
            <dd className="mt-2 text-base font-bold text-ink">{profile?.position || "Не указана"}</dd>
          </div>
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Телефон</dt>
            <dd className="mt-2 text-base font-bold text-ink">{profile?.phone || "Не указан"}</dd>
          </div>
        </dl>
      </section>
    </PortalShell>
  );
}
