"use server";

import { loginToEmail } from "@/lib/auth/login";
import { createServerActionSupabaseClient } from "@/lib/supabase/server";

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function loginAction(login: string, password: string): Promise<LoginResult> {
  try {
    const supabase = createServerActionSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginToEmail(login),
      password
    });

    if (error || !data.user) {
      return { ok: false, error: "Не удалось войти. Проверьте логин и пароль." };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .single();

    if (profileError) {
      await supabase.auth.signOut();
      return { ok: false, error: "Не удалось проверить учетную запись. Попробуйте ещё раз." };
    }

    if (profile?.status === "inactive") {
      await supabase.auth.signOut();
      return { ok: false, error: "Учетная запись отключена. Обратитесь к администратору." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Сервер авторизации временно недоступен. Попробуйте ещё раз." };
  }
}

export async function logoutAction() {
  try {
    const supabase = createServerActionSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // Navigation to /login still clears access to protected pages for this visit.
  }
}
