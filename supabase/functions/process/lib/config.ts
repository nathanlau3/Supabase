
import type { Config } from "../types/index.ts";

export function loadConfig(): Config {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing required environment variables: SUPABASE_URL or SUPABASE_ANON_KEY");
  }

  return {
    supabaseUrl,
    supabaseAnonKey,
  };
}
