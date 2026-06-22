import { ShieldCheck, UserRound } from "lucide-react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const roleLabel = {
  employee: "Сотрудник",
  shift_lead: "Модератор",
  admin: "Администратор"
};

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <PortalShell
      profileName={user.full_name}
      role={user.role}
      subtitle="Данные учетной записи и роль доступа."
      title="Профиль"
    >
      <section className="rounded-md border border-line bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-mint/10 text-mint">
            <UserRound size={30} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-ink">{user.full_name}</h2>
            <p className="mt-1 text-sm text-steel">Логин: {user.username}</p>
          </div>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Роль</dt>
            <dd className="mt-2 flex items-center gap-2 text-base font-bold text-ink">
              <ShieldCheck size={18} className="text-mint" />
              {roleLabel[user.role]}
            </dd>
          </div>
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Отдел</dt>
            <dd className="mt-2 text-base font-bold text-ink">{user.department || "Не указан"}</dd>
          </div>
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Должность</dt>
            <dd className="mt-2 text-base font-bold text-ink">{user.position || "Не указана"}</dd>
          </div>
          <div className="rounded-md border border-line p-4">
            <dt className="text-sm font-semibold text-steel">Телефон</dt>
            <dd className="mt-2 text-base font-bold text-ink">{user.phone || "Не указан"}</dd>
          </div>
        </dl>
      </section>
    </PortalShell>
  );
}
