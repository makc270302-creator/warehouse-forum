import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FileText, Pin, Search, ShieldCheck, TableProperties, Trash2, Upload, UsersRound } from "lucide-react";
import {
  checkGoogleUsers,
  createAdminPost,
  createUser,
  deleteDocument,
  deletePost,
  importUsersFromTable,
  syncUsersFromGoogleWithOptions,
  togglePostPin,
  updateUserRole,
  uploadDocument
} from "@/app/admin/actions";
import { PortalShell } from "@/components/portal-shell";
import { StatusPill } from "@/components/status-pill";
import { getCurrentUser } from "@/lib/auth/session";
import { query } from "@/lib/db";
import type { Priority, UserRole } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const roleLabel: Record<UserRole, string> = {
  employee: "Сотрудник",
  shift_lead: "Модератор",
  admin: "Администратор"
};

type AdminProfile = {
  id: string;
  username: string | null;
  full_name: string;
  role: UserRole;
  status: "active" | "inactive";
  department: string | null;
  position: string | null;
};

type AdminPost = {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: Priority;
  is_pinned: boolean;
};

type SyncLog = {
  id: string;
  source: string;
  triggered_by: string | null;
  created_count: number;
  updated_count: number;
  deactivated_count: number;
  skipped_count: number;
  password_updated_count: number;
  error_count: number;
  created_at: string;
};

type AdminDocument = {
  id: string;
  title: string;
  original_name: string | null;
  size_bytes: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  actor_name: string | null;
  created_at: string;
};

type SyncReport = {
  mode: "check" | "import" | "sync";
  ok: boolean;
  totalRows: number;
  created?: number;
  updated?: number;
  deactivated?: number;
  skipped?: number;
  passwordUpdated?: number;
  errors?: string[];
  warnings?: string[];
};

type SearchParams = {
  import?: string;
  sync?: string;
  check?: string;
  count?: string;
  errors?: string;
  user?: string;
  q?: string;
  role_filter?: string;
  status_filter?: string;
};

async function getSyncReport() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("admin_user_sync_report")?.value;

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as SyncReport;
  } catch {
    return null;
  }
}

function matchesFilter(profile: AdminProfile, searchParams?: SearchParams) {
  const query = (searchParams?.q || "").trim().toLowerCase();
  const roleFilter = searchParams?.role_filter || "all";
  const statusFilter = searchParams?.status_filter || "all";
  const haystack = [profile.username, profile.full_name, profile.department, profile.position].filter(Boolean).join(" ").toLowerCase();

  return (!query || haystack.includes(query)) && (roleFilter === "all" || profile.role === roleFilter) && (statusFilter === "all" || profile.status === statusFilter);
}

export default async function AdminPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?next=/admin");
  }

  if (user.role !== "admin") {
    redirect("/dashboard");
  }

  const [profilesResult, postsResult, syncLogsResult, documentsResult, auditLogsResult] = await Promise.all([
    query<AdminProfile>("select id,username,full_name,role,status,department,position from users order by created_at desc"),
    query<AdminPost>("select id,title,body,type,priority,is_pinned from posts order by is_pinned desc, created_at desc limit 20"),
    query<SyncLog>(`select id,source,triggered_by,created_count,updated_count,deactivated_count,skipped_count,
                           password_updated_count,error_count,created_at
                      from sync_logs order by created_at desc limit 5`),
    query<AdminDocument>("select id,title,original_name,size_bytes::text from documents order by created_at desc limit 10"),
    query<AuditLog>(`select a.id::text, a.action, u.full_name as actor_name, a.created_at
                       from audit_logs a left join users u on u.id=a.actor_id
                      order by a.created_at desc limit 20`)
  ]);
  const allProfiles = profilesResult.rows;
  const posts = postsResult.rows;
  const syncLogs = syncLogsResult.rows;
  const documents = documentsResult.rows;
  const auditLogs = auditLogsResult.rows;
  const visibleProfiles = allProfiles.filter((profile) => matchesFilter(profile, searchParams));
  const activeCount = allProfiles.filter((profile) => profile.status === "active").length;
  const adminCount = allProfiles.filter((profile) => profile.role === "admin").length;
  const report = await getSyncReport();

  return (
    <PortalShell
      profileName={user.full_name}
      role="admin"
      subtitle="Пользователи, роли, синхронизация, объявления и модерация форума."
      title="Админ-панель"
    >
      <SyncReportCard report={report} searchParams={searchParams} />

      <section className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Всего пользователей" value={allProfiles.length} />
        <Metric label="Активных" value={activeCount} />
        <Metric label="Администраторов" value={adminCount} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_390px]">
        <div className="rounded-md border border-line bg-white p-4 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <UsersRound className="text-mint" size={20} />
              <h2 className="text-lg font-bold text-ink">Пользователи</h2>
            </div>

            <form className="grid gap-2 sm:grid-cols-[1fr_150px_140px_44px]" method="get">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-steel" size={16} />
                <input
                  className="focus-ring h-10 w-full rounded-md border border-line pl-9 pr-3 text-sm"
                  defaultValue={searchParams?.q || ""}
                  name="q"
                  placeholder="ФИО, логин, должность"
                />
              </label>
              <select className="focus-ring h-10 rounded-md border border-line px-3 text-sm" defaultValue={searchParams?.role_filter || "all"} name="role_filter">
                <option value="all">Все роли</option>
                <option value="employee">Сотрудники</option>
                <option value="shift_lead">Модераторы</option>
                <option value="admin">Админы</option>
              </select>
              <select className="focus-ring h-10 rounded-md border border-line px-3 text-sm" defaultValue={searchParams?.status_filter || "all"} name="status_filter">
                <option value="all">Все статусы</option>
                <option value="active">Активные</option>
                <option value="inactive">Отключенные</option>
              </select>
              <button className="focus-ring h-10 rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-steel" type="submit">
                Найти
              </button>
            </form>
          </div>

          <div className="grid gap-3">
            {visibleProfiles.map((profile) => (
              <form
                action={updateUserRole}
                className="grid gap-3 rounded-md border border-line p-3 sm:grid-cols-[1fr_140px_120px_170px_110px] sm:items-center"
                key={profile.id}
              >
                <input name="user_id" type="hidden" value={profile.id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{profile.full_name}</p>
                  <p className="mt-1 truncate text-xs font-semibold text-mint">{profile.username || "login не задан"}</p>
                  <p className="mt-1 truncate text-xs text-steel">
                    {[profile.department, profile.position].filter(Boolean).join(" · ") || "Профиль не заполнен"}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-steel">Пароль хранится только в защищённом виде</p>
                </div>
                <select className="focus-ring h-10 rounded-md border border-line px-3 text-sm" defaultValue={profile.role} name="role">
                  <option value="employee">{roleLabel.employee}</option>
                  <option value="shift_lead">{roleLabel.shift_lead}</option>
                  <option value="admin">{roleLabel.admin}</option>
                </select>
                <select className="focus-ring h-10 rounded-md border border-line px-3 text-sm" defaultValue={profile.status} name="status">
                  <option value="active">Активен</option>
                  <option value="inactive">Отключен</option>
                </select>
                <input
                  autoComplete="new-password"
                  className="focus-ring h-10 rounded-md border border-line px-3 text-sm"
                  minLength={8}
                  name="new_password"
                  placeholder="Новый пароль"
                  type="password"
                />
                <button className="focus-ring h-10 rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-steel" type="submit">
                  Сохранить
                </button>
              </form>
            ))}

            {!visibleProfiles.length ? (
              <div className="rounded-md border border-dashed border-line p-8 text-center text-sm font-semibold text-steel">Пользователи не найдены</div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4">
          <form action={createUser} className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <UsersRound className="text-mint" size={20} />
              <h2 className="text-lg font-bold text-ink">Новый сотрудник</h2>
            </div>
            <div className="grid gap-3">
              <input className="focus-ring h-10 rounded-md border border-line px-3 text-sm" name="username" pattern="[a-z0-9._-]{3,64}" placeholder="Логин" required />
              <input className="focus-ring h-10 rounded-md border border-line px-3 text-sm" name="full_name" placeholder="ФИО" required />
              <input className="focus-ring h-10 rounded-md border border-line px-3 text-sm" name="position" placeholder="Должность" />
              <select className="focus-ring h-10 rounded-md border border-line px-3 text-sm" defaultValue="employee" name="role">
                <option value="employee">Сотрудник</option>
                <option value="shift_lead">Модератор</option>
                <option value="admin">Администратор</option>
              </select>
              <input autoComplete="new-password" className="focus-ring h-10 rounded-md border border-line px-3 text-sm" minLength={8} name="password" placeholder="Временный пароль" required type="password" />
              <button className="focus-ring h-10 rounded-md bg-mint px-3 text-sm font-bold text-white hover:bg-coral" type="submit">Создать сотрудника</button>
            </div>
          </form>

          <form action={syncUsersFromGoogleWithOptions} className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TableProperties className="text-mint" size={20} />
              <h2 className="text-lg font-bold text-ink">Google Sheets</h2>
            </div>
            <p className="text-sm leading-6 text-steel">Синхронизация читает опубликованный CSV или подключенную Google таблицу и обновляет пользователей портала.</p>

            <div className="mt-4 grid gap-2">
              <label className="flex items-start gap-2 text-sm font-semibold text-ink">
                <input className="mt-0.5 h-4 w-4 accent-mint" name="update_passwords" type="checkbox" />
                <span>Обновлять пароли существующим пользователям</span>
              </label>
              <label className="flex items-start gap-2 text-sm font-semibold text-ink">
                <input className="mt-0.5 h-4 w-4 accent-mint" name="deactivate_missing" type="checkbox" />
                <span>Отключить активных сотрудников, которых нет в таблице</span>
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button className="focus-ring h-10 rounded-md border border-line px-3 text-sm font-bold text-ink hover:border-mint" formAction={checkGoogleUsers} type="submit">
                Проверить
              </button>
              <button className="focus-ring h-10 rounded-md bg-mint px-3 text-sm font-bold text-white hover:bg-coral" type="submit">
                Синхронизировать
              </button>
            </div>
          </form>

          <form action={importUsersFromTable} className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <TableProperties className="text-mint" size={20} />
              <h2 className="text-lg font-bold text-ink">Ручной импорт</h2>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">Строки из Google Sheets</span>
              <textarea
                className="focus-ring min-h-36 w-full resize-y rounded-md border border-line p-3 text-sm"
                name="users_table"
                placeholder="Логин	ФИО	Должность	Роль	Состояние	Пароль"
                required
              />
            </label>
            <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-ink">
              <input className="mt-0.5 h-4 w-4 accent-mint" name="update_passwords" type="checkbox" />
              <span>Обновлять пароли существующим пользователям</span>
            </label>

            <button className="focus-ring mt-4 h-10 w-full rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-steel" type="submit">
              Импортировать
            </button>
          </form>

          <form action={createAdminPost} className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="text-mint" size={20} />
              <h2 className="text-lg font-bold text-ink">Объявление</h2>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink">Заголовок</span>
              <input className="focus-ring h-10 w-full rounded-md border border-line px-3 text-sm" maxLength={120} name="title" required />
            </label>

            <label className="mt-3 block">
              <span className="mb-1 block text-sm font-semibold text-ink">Текст</span>
              <textarea className="focus-ring min-h-28 w-full resize-y rounded-md border border-line p-3 text-sm" name="body" required />
            </label>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">Тип</span>
                <select className="focus-ring h-10 w-full rounded-md border border-line px-3 text-sm" defaultValue="announcement" name="type">
                  <option value="announcement">Объявление</option>
                  <option value="instruction">Инструкция</option>
                  <option value="discussion">Обсуждение</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-ink">Приоритет</span>
                <select className="focus-ring h-10 w-full rounded-md border border-line px-3 text-sm" defaultValue="important" name="priority">
                  <option value="normal">Обычный</option>
                  <option value="important">Важный</option>
                  <option value="critical">Критичный</option>
                </select>
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-ink">
              <input className="h-4 w-4 accent-mint" defaultChecked name="is_pinned" type="checkbox" />
              Закрепить
            </label>

            <button className="focus-ring mt-4 h-10 w-full rounded-md bg-mint px-3 text-sm font-bold text-white hover:bg-coral" type="submit">
              Опубликовать
            </button>
          </form>

          <section className="rounded-md border border-line bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="text-mint" size={20} />
              <h2 className="text-lg font-bold text-ink">Документы</h2>
            </div>

            <form action={uploadDocument} className="grid gap-3">
              <input className="focus-ring h-10 rounded-md border border-line px-3 text-sm" maxLength={160} name="title" placeholder="Название документа" required />
              <textarea className="focus-ring min-h-20 rounded-md border border-line p-3 text-sm" name="description" placeholder="Краткое описание" />
              <input
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                className="focus-ring rounded-md border border-line p-2 text-sm"
                name="file"
                required
                type="file"
              />
              <p className="text-xs text-steel">PDF, Word, Excel или изображение, не более 20 МБ.</p>
              <button className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink px-3 text-sm font-bold text-white hover:bg-steel" type="submit">
                <Upload size={16} /> Загрузить
              </button>
            </form>

            {documents.length ? (
              <div className="mt-4 grid gap-2 border-t border-line pt-4">
                {documents.map((document) => (
                  <div className="flex items-center justify-between gap-3 rounded-md border border-line p-3" key={document.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-ink">{document.title}</p>
                      <p className="truncate text-xs text-steel">{document.original_name || "Файл"}</p>
                    </div>
                    <form action={deleteDocument}>
                      <input name="document_id" type="hidden" value={document.id} />
                      <button className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border border-coral/40 text-coral hover:bg-coral/10" title="Удалить документ" type="submit">
                        <Trash2 size={15} />
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {syncLogs.length ? <SyncLogList logs={syncLogs} /> : null}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-line bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Pin className="text-mint" size={20} />
          <h2 className="text-lg font-bold text-ink">Модерация тем</h2>
        </div>

        <div className="grid gap-3">
          {posts.map((post) => (
            <article className="rounded-md border border-line p-3" key={post.id}>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill priority={post.priority} />
                <span className="rounded-full border border-line px-2.5 py-1 text-xs font-bold text-steel">{post.type}</span>
                {post.is_pinned ? <span className="rounded-full border border-mint/40 bg-mint/10 px-2.5 py-1 text-xs font-bold text-mint">Закреплено</span> : null}
              </div>
              <h3 className="mt-3 text-base font-bold text-ink">{post.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-steel">{post.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={togglePostPin}>
                  <input name="post_id" type="hidden" value={post.id} />
                  <input name="next_pinned" type="hidden" value={String(!post.is_pinned)} />
                  <button className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-line px-3 text-sm font-bold text-ink hover:border-mint" type="submit">
                    <Pin size={15} />
                    {post.is_pinned ? "Открепить" : "Закрепить"}
                  </button>
                </form>
                <form action={deletePost}>
                  <input name="post_id" type="hidden" value={post.id} />
                  <button className="focus-ring inline-flex h-9 items-center gap-2 rounded-md border border-coral/40 px-3 text-sm font-bold text-coral hover:bg-coral/10" type="submit">
                    <Trash2 size={15} />
                    Удалить
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-6 rounded-md border border-line bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="text-mint" size={20} />
          <h2 className="text-lg font-bold text-ink">Журнал действий</h2>
        </div>
        <div className="grid gap-2">
          {auditLogs.length ? auditLogs.map((log) => (
            <article className="flex flex-col justify-between gap-1 rounded-md border border-line p-3 sm:flex-row sm:items-center" key={log.id}>
              <div>
                <p className="text-sm font-bold text-ink">{log.action}</p>
                <p className="text-xs text-steel">{log.actor_name || "Система"}</p>
              </div>
              <time className="text-xs font-semibold text-steel">{new Date(log.created_at).toLocaleString("ru-RU")}</time>
            </article>
          )) : <p className="text-sm text-steel">Записей пока нет.</p>}
        </div>
      </section>
    </PortalShell>
  );
}

function SyncLogList({ logs }: { logs: SyncLog[] }) {
  return (
    <section className="rounded-md border border-line bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <ShieldCheck className="text-mint" size={20} />
        <h2 className="text-lg font-bold text-ink">Последние синхронизации</h2>
      </div>
      <div className="grid gap-2">
        {logs.map((log) => (
          <article className="rounded-md border border-line p-3" key={log.id}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-ink">{new Date(log.created_at).toLocaleString("ru-RU")}</p>
              <span className={`rounded-full border px-2 py-1 text-xs font-bold ${log.error_count ? "border-coral/40 bg-coral/10 text-coral" : "border-mint/40 bg-mint/10 text-mint"}`}>
                {log.error_count ? `${log.error_count} ошибок` : "OK"}
              </span>
            </div>
            <p className="mt-1 text-xs text-steel">{log.triggered_by || log.source}</p>
            <p className="mt-2 text-xs font-semibold text-steel">
              Создано: {log.created_count} · Обновлено: {log.updated_count} · Отключено: {log.deactivated_count} · Пароли: {log.password_updated_count}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-line bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-steel">{label}</p>
      <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

function SyncReportCard({ report, searchParams }: { report: SyncReport | null; searchParams?: SearchParams }) {
  if (!report && !searchParams?.import && !searchParams?.sync && !searchParams?.check) {
    return null;
  }

  const title =
    report?.mode === "check"
      ? "Проверка таблицы"
      : report?.mode === "import"
        ? "Ручной импорт"
        : "Синхронизация Google Sheets";
  const ok = report?.ok && !(report.errors || []).length;

  return (
    <section className={`mb-4 rounded-md border bg-white p-4 text-sm shadow-sm ${ok ? "border-mint/30" : "border-coral/30"}`}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-base font-bold text-ink">{title}</h2>
          <p className="mt-1 text-steel">
            {ok ? "Операция завершена без ошибок." : "Есть предупреждения или ошибки. Проверьте детали ниже."}
          </p>
        </div>
        {report ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <SmallStat label="Строк" value={report.totalRows} />
            <SmallStat label="Создано" value={report.created || 0} />
            <SmallStat label="Обновлено" value={report.updated || 0} />
            <SmallStat label="Отключено" value={report.deactivated || 0} />
            <SmallStat label="Пароли" value={report.passwordUpdated || 0} />
            <SmallStat label="Ошибки" value={(report.errors || []).length} />
          </div>
        ) : null}
      </div>

      {report?.warnings?.length ? <MessageList title="Предупреждения" items={report.warnings} tone="warning" /> : null}
      {report?.errors?.length ? <MessageList title="Ошибки" items={report.errors} tone="error" /> : null}
    </section>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-20 rounded-md border border-line px-3 py-2">
      <p className="text-xs font-semibold text-steel">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink">{value}</p>
    </div>
  );
}

function MessageList({ title, items, tone }: { title: string; items: string[]; tone: "warning" | "error" }) {
  const color = tone === "error" ? "text-coral" : "text-amber";

  return (
    <div className="mt-3">
      <p className={`text-sm font-bold ${color}`}>{title}</p>
      <ul className="mt-2 grid gap-1 text-sm text-steel">
        {items.map((item) => (
          <li className="rounded-md bg-cloud px-3 py-2" key={item}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
