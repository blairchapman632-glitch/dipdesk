import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import type { NextRequest } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Server-only helpers for the Google Sheets connect flow and API auth.

export const GOOGLE_STATE_COOKIE = 'g_oauth_state'
export const GOOGLE_STATE_MAX_AGE = 10 * 60 // seconds

type StatePayload = { s: string; u: string; d: string | null; e: number }

function sign(data: string): string {
  // GOOGLE_CLIENT_SECRET is server-only, so it doubles as the signing key.
  return createHmac('sha256', process.env.GOOGLE_CLIENT_SECRET!).update(data).digest('base64url')
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

export function createStateCookie(userId: string, dipId: string | null) {
  const state = randomBytes(32).toString('base64url')
  const payload: StatePayload = { s: state, u: userId, d: dipId, e: Date.now() + GOOGLE_STATE_MAX_AGE * 1000 }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { state, cookieValue: `${data}.${sign(data)}` }
}

// Returns the verified payload only if the cookie is signed by us, unexpired,
// and its state matches the state Google sent back.
export function verifyStateCookie(cookieValue: string | undefined, stateParam: string | null): StatePayload | null {
  if (!cookieValue || !stateParam) return null
  const [data, sig] = cookieValue.split('.')
  if (!data || !sig || !safeEqual(sig, sign(data))) return null
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString()) as StatePayload
    if (!payload.u || !payload.s || Date.now() > payload.e) return null
    if (!safeEqual(payload.s, stateParam)) return null
    return payload
  } catch {
    return null
  }
}

// Reads "Authorization: Bearer <supabase access token>" and returns the verified user id.
export async function getUserIdFromRequest(request: NextRequest, supabase: SupabaseClient): Promise<string | null> {
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return null
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return null
  return data.user.id
}
