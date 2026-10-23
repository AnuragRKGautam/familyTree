import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export function isSupabaseConfigured(): boolean {
  return Boolean(url && anonKey && !url.includes('YOUR_PROJECT'))
}

function createSupabaseClient(): SupabaseClient {
  if (!url || !anonKey) {
    // Placeholder client so the app can boot and show configuration errors.
    return createClient('https://placeholder.supabase.co', 'public-anon-key')
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

/** Browser client with the anon key only — never use the service role here. */
export const supabase: SupabaseClient = createSupabaseClient()
