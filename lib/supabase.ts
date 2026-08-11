"use client";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase credentials missing. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
    );
  }
  if (!cached) {
    cached = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return cached;
}