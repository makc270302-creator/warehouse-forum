"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createBrowserSupabaseClient() {
  return createClientComponentClient(getSupabaseConfig());
}
