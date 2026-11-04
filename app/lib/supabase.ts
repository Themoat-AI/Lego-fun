export function getSupabaseStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return { label: 'Demo mode: Supabase not connected', enabled: false };
  }

  return { label: 'Supabase connected', enabled: true };
}
