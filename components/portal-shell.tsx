import { Archive, Home, MessageSquareText, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { AuthButton } from "@/components/auth-button";
import type { UserRole } from "@/lib/database.types";

const navItems = [
  { href: "/dashboard", label: "Сводка", icon: Home },
  { href: "/forum", label: "Форум", icon: MessageSquareText },
  { href: "/documents", label: "Документы", icon: Archive },
  { href: "/profile", label: "Профиль", icon: UserRound }
];

const adminNavItem = { href: "/admin", label: "Админ", icon: ShieldCheck };

export function PortalShell({
  children,
  title,
  subtitle,
  profileName,
  role
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  profileName?: string;
  role?: UserRole;
}) {
  const visibleNavItems = role === "admin" ? [...navItems, adminNavItem] : navItems;

  return (
    <div className="min-h-screen bg-cloud">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link className="flex min-w-0 items-center gap-3" href="/dashboard">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-ink text-sm font-bold text-white">РГ</span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold text-ink">ООО &quot;Разгуляй&quot;</span>
              <span className="block truncate text-xs text-steel">Корпоративный портал склада</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-48 truncate text-sm text-steel sm:block">{profileName}</span>
            <AuthButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[220px_1fr]">
        <nav className="grid grid-cols-4 gap-2 sm:grid-cols-5 lg:sticky lg:top-20 lg:block lg:h-fit lg:space-y-2">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="flex h-12 items-center justify-center gap-2 rounded-md border border-line bg-white px-3 text-sm font-semibold text-steel shadow-sm hover:border-mint hover:text-ink lg:justify-start"
                href={item.href}
                key={item.href}
              >
                <Icon size={18} />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <main className="min-w-0">
          <div className="mb-5">
            <h1 className="text-2xl font-bold tracking-normal text-ink sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-steel">{subtitle}</p> : null}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
