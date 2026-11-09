import { createClient } from '@supabase/supabase-js'

// SERVER ONLY. Google tokens live in public.google_connections, which has RLS
// enabled and no policies — only the service role (server) can read or write it.
// Never import this file from a client component.

const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export type GoogleConnection = {
  user_id: string
  access_token: string | null
  refresh_token: string | null
  token_expiry: number | null
}

export async function getGoogleConnection(userId: string): Promise<GoogleConnection | null> {
  const { data } = await admin()
    .from('google_connections')
    .select('user_id, access_token, refresh_token, token_expiry')
    .eq('user_id', userId)
    .maybeSingle()
  return (data as GoogleConnection | null) || null
}

// Saves new tokens. refresh_token is only overwritten when Google sends a new one.
export async function saveGoogleTokens(
  userId: string,
  tokens: { access_token: string; token_expiry: number | null; refresh_token?: string | null }
) {
  const row: Record<string, unknown> = {
    user_id: userId,
    access_token: tokens.access_token,
    token_expiry: tokens.token_expiry,
    updated_at: new Date().toISOString(),
  }
  if (tokens.refresh_token) row.refresh_token = tokens.refresh_token
  return admin().from('google_connections').upsert(row, { onConflict: 'user_id' })
}

// "Connected" = we can get a working access token (valid now, or refreshable)
export function connectionIsUsable(c: GoogleConnection | null): boolean {
  if (!c) return false
  if (c.refresh_token) return true
  return !!(c.access_token && c.token_expiry && Date.now() < c.token_expiry - 60000)
}
