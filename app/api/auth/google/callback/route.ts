import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state') || ''

  if (!code) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard?error=no_code`)
  }

  const [dipId, userId] = state.split('__')

  const redirectUri = `${process.env.NEXT_PUBLIC_URL}/api/auth/google/callback`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_URL}/dashboard?error=no_token`)
  }

  if (userId) {
    await supabase.from('profiles').update({
      google_access_token: tokenData.access_token,
      google_refresh_token: tokenData.refresh_token || null,
      google_token_expiry: tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : null,
    } as any).eq('id', userId)
  }

  const redirectTo = dipId
    ? `${process.env.NEXT_PUBLIC_URL}/dips/${dipId}?google=connected`
    : `${process.env.NEXT_PUBLIC_URL}/dashboard?google=connected`

  return NextResponse.redirect(redirectTo)
}