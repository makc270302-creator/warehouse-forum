import { Download, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DocumentItem = {
  id: string;
  title: string;
  description: string | null;
  file_path: string;
  created_at: string;
};

export default async function DocumentsPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  let profile: { full_name: string; role: "employee" | "shift_lead" | "admin"; status: string } | null = null;

  if (user) {
    const { data } = await supabase.from("profiles").select("full_name, role, status").eq("id", user.id).single();
    profile = data;
  }

  if (profile?.status === "inactive") {
    redirect("/login");
  }

  const { data: documents } = await supabase.from("documents").select("id,title,description,file_path,created_at").order("created_at", {
    ascending: false
  });

  const documentsWithUrls = await Promise.all(
    ((documents || []) as DocumentItem[]).map(async (document) => {
      const { data } = await supabase.storage.from("warehouse-documents").createSignedUrl(document.file_path, 60 * 10);
      return { ...document, signedUrl: data?.signedUrl || "" };
    })
  );
  const profileName = (profile as { full_name: string } | null)?.full_name || user?.email || "";

  return (
    <PortalShell
      profileName={profileName}
      role={profile?.role}
      subtitle="Инструкции, регламенты, шаблоны и файлы для работы склада."
      title="Документы"
    >
      <section className="grid gap-4">
        {documentsWithUrls.length ? (
          documentsWithUrls.map((document) => (
              <article className="flex flex-col gap-4 rounded-md border border-line bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between" key={document.id}>
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-1 shrink-0 text-mint" size={22} />
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-ink">{document.title}</h2>
                    {document.description ? <p className="mt-1 text-sm leading-6 text-steel">{document.description}</p> : null}
                  </div>
                </div>
                <a
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-line px-3 text-sm font-bold text-ink hover:border-mint"
                  href={document.signedUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <Download size={16} />
                  Открыть
                </a>
              </article>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-line bg-white p-8 text-center">
            <FileText className="mx-auto text-mint" size={34} />
            <h2 className="mt-3 text-lg font-bold text-ink">Файлы не добавлены</h2>
            <p className="mt-1 text-sm text-steel">После настройки Storage документы появятся в этом разделе.</p>
          </div>
        )}
      </section>
    </PortalShell>
  );
}
