"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { logoutAction } from "@/lib/actions/auth";

export function AuthButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await logoutAction();
    } finally {
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <button
      className="focus-ring inline-flex h-10 w-10 items-center justify-center rounded-md border border-line bg-white text-steel hover:border-coral hover:text-coral"
      disabled={loading}
      onClick={signOut}
      title="Выйти"
      type="button"
    >
      <LogOut size={18} />
    </button>
  );
}
