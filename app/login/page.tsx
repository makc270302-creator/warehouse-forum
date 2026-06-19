import { Suspense } from "react";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-cloud px-4 py-10 sm:px-6 lg:grid-cols-[1fr_420px]">
      <section className="flex min-h-[42vh] items-end rounded-md bg-[linear-gradient(135deg,#3a0712_0%,#7f1024_52%,#b11226_100%)] p-6 text-white lg:min-h-full lg:p-10">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-[0.18em] text-white/75">ООО &quot;Разгуляй&quot;</p>
          <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">Корпоративный портал</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-white/85">
            Новости, обсуждения, инструкции и важные объявления в одном защищенном рабочем пространстве.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center py-8 lg:py-0">
        <div className="w-full max-w-md rounded-md border border-line bg-white p-6 shadow-panel">
          <h2 className="text-2xl font-bold text-ink">Вход</h2>
          <p className="mt-1 text-sm leading-6 text-steel">Используйте учетную запись, выданную администратором.</p>
          <div className="mt-6">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </section>
    </main>
  );
}
