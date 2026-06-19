import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createServerSupabaseClient() {
  return createServerComponentClient({ cookies }, getSupabaseConfig());
}
