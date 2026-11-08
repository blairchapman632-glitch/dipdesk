import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createStateCookie, getUserIdFromRequest, GOOGLE_STATE_COOKIE, GOOGLE_STATE_MAX_AGE } from '@/lib/googleOAuthState'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Starts the Google Sheets connect flow.
// The client calls this with its Supabase access token; we return the Google URL
// and set a signed, short-lived state cookie tied to the verified user.
export async function POST(request: NextRequest) {
  const userId = await getUserIdFromRequest(request, supabase)
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized', message: 'Please log in again.' }, { status: 401 })
  }

  let dipId: string | null = null
  try {
    const body = await request.json()
    if (typeof body?.dipId === 'string' && body.dipId) dipId = body.dipId
  } catch {
    // no body is fine
  }

  const { state, cookieValue } = createStateCookie(userId, dipId)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_URL}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/drive.file',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const res = NextResponse.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` })
  res.cookies.set(GOOGLE_STATE_COOKIE, cookieValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // must survive the top-level redirect back from Google
    path: '/api/auth/google',
    maxAge: GOOGLE_STATE_MAX_AGE,
  })
  return res
}
