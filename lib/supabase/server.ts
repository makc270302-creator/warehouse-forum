import { cookies } from "next/headers";
import { createServerActionClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function createServerSupabaseClient() {
  return createServerComponentClient({ cookies }, getSupabaseConfig());
}

export function createServerActionSupabaseClient() {
  return createServerActionClient({ cookies }, getSupabaseConfig());
}
