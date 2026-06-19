"use client";

import { Loader2, LogIn } from "lucide-react";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { loginToEmail } from "@/lib/auth/login";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabaseClient();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password });

    if (signInError) {
      setLoading(false);
      setError("Не удалось войти. Проверьте логин и пароль.");
      return;
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("status").eq("id", user.id).single();

      if (profile?.status === "inactive") {
        await supabase.auth.signOut();
        setLoading(false);
        setError("Учетная запись отключена. Обратитесь к администратору.");
        return;
      }
    }

    setLoading(false);
    router.replace(searchParams.get("next") || "/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Логин</span>
        <input
          autoComplete="username"
          className="focus-ring h-11 w-full rounded-md border border-line bg-white px-3 text-ink"
          onChange={(event) => setLogin(event.target.value)}
          required
          type="text"
          value={login}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-ink">Пароль</span>
        <input
          autoComplete="current-password"
          className="focus-ring h-11 w-full rounded-md border border-line bg-white px-3 text-ink"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error ? <p className="rounded-md border border-coral/30 bg-coral/10 px-3 py-2 text-sm text-coral">{error}</p> : null}

      <button
        className="focus-ring inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-mint px-4 text-sm font-bold text-white hover:bg-coral disabled:cursor-not-allowed disabled:opacity-70"
        disabled={loading}
        type="submit"
      >
        {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
        Войти
      </button>
    </form>
  );
}
