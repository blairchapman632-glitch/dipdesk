import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUserIdFromRequest } from '@/lib/googleOAuthState'
import { connectionIsUsable, getGoogleConnection } from '@/lib/googleConnections'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Tells the logged-in user whether their Google Sheets connection works.
// Never returns the tokens themselves.
export async function GET(request: NextRequest) {
  const userId = await getUserIdFromRequest(request, supabase)
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const connection = await getGoogleConnection(userId)
  return NextResponse.json(
    { connected: connectionIsUsable(connection) },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}
