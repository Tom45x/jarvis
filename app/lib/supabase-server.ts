import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase-Umgebungsvariablen fehlen')
    _client = createClient(url, key, { auth: { persistSession: false } })
  }
  return _client
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_, prop: string) {
    const c = getClient()
    const val = (c as never)[prop]
    return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(c) : val
  },
})
