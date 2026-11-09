import { NextRequest, NextResponse } from 'next/server'
import { GOOGLE_STATE_COOKIE, verifyStateCookie } from '@/lib/googleOAuthState'
import { saveGoogleTokens } from '@/lib/googleConnections'

function redirectAndClear(url: string) {
  const res = NextResponse.redirect(url)
  res.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth/google', maxAge: 0 })
  return res
}

export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_URL
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  const verified = verifyStateCookie(
    request.cookies.get(GOOGLE_STATE_COOKIE)?.value,
    searchParams.get('state')
  )
  if (!verified) {
    return redirectAndClear(`${base}/dashboard?error=google_state`)
  }

  const backTo = (flag: string) =>
    verified.d
      ? `${base}/dips/${encodeURIComponent(verified.d)}?google=${flag}`
      : `${base}/dashboard?google=${flag}`

  if (!code) {
    // User cancelled on Google's screen, or Google returned an error
    return redirectAndClear(backTo('cancelled'))
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${base}/api/auth/google/callback`,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json().catch(() => ({}))

  if (!tokenRes.ok || !tokenData.access_token) {
    return redirectAndClear(backTo('error'))
  }

  // Tokens go in the server-only google_connections table (never on profiles).
  // An existing refresh token is kept if Google didn't send a new one.
  const { error: saveError } = await saveGoogleTokens(verified.u, {
    access_token: tokenData.access_token,
    token_expiry: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    refresh_token: tokenData.refresh_token || null,
  })
  if (saveError) {
    return redirectAndClear(backTo('error'))
  }

  return redirectAndClear(backTo('connected'))
}
