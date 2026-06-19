"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function AuthButton() {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-steel hover:border-coral hover:text-coral"
      onClick={signOut}
      title="Выйти"
      type="button"
    >
      <LogOut size={18} />
    </button>
  );
}
