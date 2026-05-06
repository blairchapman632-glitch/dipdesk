import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { user_ids, title, body, url } = await request.json()

    if (!user_ids || !title || !body) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .in('user_id', user_ids)

    if (!subs || subs.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const payload = JSON.stringify({
      title,
      body,
      url: url || '/dashboard',
    })

    const results = await Promise.allSettled(
      subs.map((row) =>
        webpush.sendNotification(row.subscription, payload)
      )
    )

    const sent = results.filter((r) => r.status === 'fulfilled').length

    return NextResponse.json({ sent })
  } catch (error) {
    console.error('Push error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}