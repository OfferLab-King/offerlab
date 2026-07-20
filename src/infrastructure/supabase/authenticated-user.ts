import "server-only";

import { createSupabaseServerClient } from "./server";

export async function getAuthenticatedSupabaseUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    return error ? null : (data?.claims.sub ?? null);
  } catch {
    return null;
  }
}
