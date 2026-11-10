import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { RESERVED_USERNAMES, USERNAME_PATTERN } from '@/lib/usernames'
import { sortWrapImages } from '@/lib/wrapCover'
import PublicCollection, { type PublicDip, type PublicProfile, type PublicWrap } from './PublicCollection'

// Public, logged-out collection page: wrapapp.com.au/[username]
// Rendered on the server (so Facebook can read the preview tags) and cached for 60s.
export const revalidate = 60

const SITE = 'https://wrapapp.com.au'

type PageData =
  | { kind: 'public'; profile: PublicProfile; wraps: PublicWrap[]; dips: PublicDip[] }
  | { kind: 'private' }

// Server-only client. Only safe, public columns are ever selected below —
// never emails, Google tokens, purchase/sold prices, loans or dibs.
const admin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })

const loadPage = cache(async (rawUsername: string): Promise<PageData | null> => {
  const username = decodeURIComponent(rawUsername).trim().toLowerCase()
  if (!USERNAME_PATTERN.test(username) || RESERVED_USERNAMES.has(username)) return null

  const db = admin()
  const { data: profile } = await db
    .from('profiles')
    .select('id, full_name, username, avatar_url, bio, city, country, is_private')
    .eq('username', username)
    .maybeSingle()

  if (!profile) return null
  if ((profile as any).is_private) return { kind: 'private' }

  const [{ data: wraps }, { data: dips }, { count: followers }, { count: following }] = await Promise.all([
    db
      .from('wraps')
      .select('id, name, brand, colour, size, material, wrap_type, description, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, is_favourite, created_at, wrap_images(id, image_url, sort_order)')
      .eq('user_id', profile.id)
      .eq('is_private', false)
      .in('status', ['active', 'holiday'])
      .order('is_favourite', { ascending: false })
      .order('created_at', { ascending: false })
      .order('sort_order', { referencedTable: 'wrap_images' }),
    db
      .from('dips')
      .select('id, title, wrap_id, total_spots, price_per_spot, stage')
      .eq('user_id', profile.id)
      .eq('archived', false)
      .in('stage', ['interest', 'queue', 'live', 'payments', 'closed']),
    // Counts only (numbers, no names) — same as the profile header
    db.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', profile.id).eq('status', 'accepted'),
    db.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', profile.id).eq('status', 'accepted'),
  ])

  return {
    kind: 'public',
    profile: {
      id: profile.id,
      name: (profile as any).full_name || (profile as any).username,
      username: (profile as any).username,
      avatarUrl: (profile as any).avatar_url || null,
      bio: (profile as any).bio || null,
      location: [(profile as any).city, (profile as any).country].filter(Boolean).join(', ') || null,
      followers: followers || 0,
      following: following || 0,
    },
    wraps: ((wraps as any[]) || []).map(w => ({
      id: w.id,
      name: w.name,
      brand: w.brand,
      colour: w.colour,
      size: w.size,
      material: w.material,
      wrapType: w.wrap_type,
      description: w.description,
      forSale: !!w.for_sale,
      forSalePrice: w.for_sale_price,
      forSaleCurrency: w.for_sale_currency,
      forSalePm: !!w.for_sale_price_is_pm,
      // Same photo order as the rest of the app (first photo = cover)
      images: sortWrapImages((w.wrap_images as { id: string; sort_order: number; image_url: string }[]) || [])
        .map(i => i.image_url),
    })),
    dips: ((dips as any[]) || []).map(d => ({
      id: d.id,
      title: d.title,
      wrapId: d.wrap_id,
      totalSpots: d.total_spots,
      pricePerSpot: d.price_per_spot,
      stage: d.stage,
    })),
  }
})

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params
  const data = await loadPage(username)

  if (!data) {
    return { title: 'Not found | WrapApp', robots: { index: false } }
  }
  if (data.kind === 'private') {
    return { title: 'Private collection | WrapApp', robots: { index: false } }
  }

  const { profile, wraps } = data
  const title = `${profile.name}’s wrap collection | WrapApp`
  const description = profile.bio
    ? profile.bio.slice(0, 180)
    : `See ${profile.name}’s babywearing wrap collection${wraps.length ? ` (${wraps.length} wraps)` : ''} on WrapApp — the free social home for wrap collectors.`
  // Cover photo: first wrap's first photo, else the avatar
  const firstImage = wraps.find(w => w.images.length > 0)?.images[0] || profile.avatarUrl
  const url = `${SITE}/${profile.username}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'profile',
      url,
      siteName: 'WrapApp',
      title,
      description,
      images: firstImage ? [{ url: firstImage, alt: `${profile.name}’s wrap collection` }] : undefined,
    },
    twitter: {
      card: firstImage ? 'summary_large_image' : 'summary',
      title,
      description,
      images: firstImage ? [firstImage] : undefined,
    },
  }
}

export default async function PublicCollectionPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const data = await loadPage(username)
  if (!data) notFound()

  if (data.kind === 'private') {
    return (
      <main className="min-h-dvh bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-md rounded-3xl border bg-white p-6 text-center shadow-sm space-y-3">
          <p className="text-4xl">🔒</p>
          <h1 className="text-xl font-bold text-gray-900">This collection is private</h1>
          <p className="text-sm text-gray-600">WrapApp is the free social home for babywearing wrap collectors.</p>
          <Link
            href="/?signup=1"
            className="flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-base font-bold text-white"
          >
            Join WrapApp — it’s free
          </Link>
        </div>
      </main>
    )
  }

  return <PublicCollection profile={data.profile} wraps={data.wraps} dips={data.dips} />
}
