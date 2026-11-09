'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getDipStageLabel } from '@/lib/dipStages'

export type PublicProfile = {
  id: string
  name: string
  username: string
  avatarUrl: string | null
  bio: string | null
  location: string | null
}

export type PublicWrap = {
  id: string
  name: string
  brand: string | null
  colour: string | null
  size: string | null
  material: string | null
  wrapType: string | null
  description: string | null
  forSale: boolean
  forSalePrice: number | null
  forSaleCurrency: string | null
  forSalePm: boolean
  images: string[]
}

export type PublicDip = {
  id: string
  title: string
  wrapId: string | null
  totalSpots: number
  pricePerSpot: number
  stage: string
}

// Smaller images for tiles (same approach as the Dashboard)
const thumb = (url: string) => `${url}?width=400&quality=60`

export default function PublicCollection({
  profile,
  wraps,
  dips,
}: {
  profile: PublicProfile
  wraps: PublicWrap[]
  dips: PublicDip[]
}) {
  const router = useRouter()
  // null = still checking. Logged-out visitors get the join prompts.
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [openWrap, setOpenWrap] = useState<PublicWrap | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setLoggedIn(!!data.session))
  }, [])

  // Like / follow / message: logged out -> sign up; logged in -> the full profile
  function requireAccount() {
    if (loggedIn) router.push(`/user/${profile.id}`)
    else router.push('/?signup=1')
  }

  const wrapsById = Object.fromEntries(wraps.map(w => [w.id, w]))
  const initials = profile.name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()

  return (
    <main className="min-h-dvh bg-gray-50 pb-32 md:pb-10">
      <div className="mx-auto max-w-3xl px-4 pt-4 space-y-4">

        {/* Brand bar */}
        <div className="flex items-center justify-between">
          <Link href="/" className="flex min-h-[44px] items-center text-lg font-extrabold text-pink-600">WrapApp</Link>
          {loggedIn ? (
            <Link href="/dashboard" className="flex min-h-[44px] items-center rounded-xl border bg-white px-3 text-sm font-semibold text-gray-700">My dashboard</Link>
          ) : (
            <Link href="/" className="flex min-h-[44px] items-center rounded-xl border bg-white px-3 text-sm font-semibold text-gray-700">Log in</Link>
          )}
        </div>

        {/* Profile */}
        <section className="rounded-3xl border bg-white p-4 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="h-16 w-16 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-pink-100 text-xl font-bold text-pink-700">{initials}</div>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 break-words">{profile.name}</h1>
              <p className="text-sm text-gray-500">@{profile.username}{profile.location ? ` · ${profile.location}` : ''}</p>
              <p className="text-sm font-semibold text-gray-700">{wraps.length} {wraps.length === 1 ? 'wrap' : 'wraps'}</p>
            </div>
          </div>
          {profile.bio && <p className="text-[15px] text-gray-700 whitespace-pre-wrap break-words">{profile.bio}</p>}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={requireAccount} className="min-h-[44px] rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-bold text-white">
              + Follow
            </button>
            <button type="button" onClick={requireAccount} className="min-h-[44px] rounded-xl border text-sm font-semibold text-gray-700">
              💬 Message
            </button>
          </div>
        </section>

        {/* What is WrapApp — logged-out visitors only */}
        {loggedIn === false && (
          <p className="text-center text-sm text-gray-600">
            WrapApp is the free social home for babywearing wrap collectors — share your collection, find wraps and run dips.
          </p>
        )}

        {/* Active dips */}
        {dips.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-base font-bold text-gray-900">🎲 Dipping now</h2>
            {dips.map(d => {
              const wrap = d.wrapId ? wrapsById[d.wrapId] : undefined
              const img = wrap?.images[0]
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-3">
                  {img ? (
                    <img src={thumb(img)} alt={d.title} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover object-[center_30%]" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-2xl">🎲</div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-gray-900 break-words">{d.title}</p>
                    <p className="text-sm text-gray-600">{d.totalSpots} spots · ${d.pricePerSpot} each · {getDipStageLabel(d.stage)}</p>
                    <p className="text-xs text-gray-500">Running in Chasing Unicorns on Facebook</p>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Collection */}
        <section className="space-y-2">
          <h2 className="text-base font-bold text-gray-900">🧣 Collection</h2>
          {wraps.length === 0 ? (
            <p className="rounded-2xl border bg-white p-6 text-center text-sm text-gray-500">No wraps to show yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {wraps.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setOpenWrap(w)}
                  className="overflow-hidden rounded-2xl border bg-white text-left shadow-sm"
                >
                  {w.images[0] ? (
                    <img src={thumb(w.images[0])} alt={w.name} loading="lazy" className="aspect-square w-full object-cover object-[center_30%]" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-pink-50 text-3xl">🧣</div>
                  )}
                  <div className="p-2">
                    <p className="line-clamp-2 text-sm font-semibold text-gray-900">{w.name}</p>
                    {w.brand && <p className="line-clamp-1 text-xs text-gray-500">{w.brand}</p>}
                    {w.forSale && <p className="mt-0.5 text-xs font-bold text-green-700">For sale</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Join — desktop (inline). Phone gets the sticky bar below. */}
        {loggedIn === false && (
          <div className="hidden rounded-3xl border bg-white p-5 text-center shadow-sm md:block">
            <p className="mb-3 text-sm text-gray-600">Share your own collection and follow other collectors.</p>
            <Link href="/?signup=1" className="inline-flex min-h-[48px] items-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 text-base font-bold text-white">
              Join WrapApp — it’s free
            </Link>
          </div>
        )}
      </div>

      {/* Sticky join bar — phone, logged out */}
      {loggedIn === false && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <Link href="/?signup=1" className="flex min-h-[52px] items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-base font-bold text-white">
            Join WrapApp — it’s free
          </Link>
        </div>
      )}

      {/* Wrap details (read-only) */}
      {openWrap && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setOpenWrap(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={openWrap.name}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 px-4 py-2 backdrop-blur">
              <p className="min-w-0 truncate font-bold text-gray-900">{openWrap.name}</p>
              <button type="button" onClick={() => setOpenWrap(null)} aria-label="Close" className="min-h-[44px] min-w-[44px] text-lg font-bold text-gray-500">✕</button>
            </div>

            {openWrap.images.length > 0 && (
              // Swipe between photos
              <div className="flex snap-x snap-mandatory overflow-x-auto">
                {openWrap.images.map((src, i) => (
                  <img key={src + i} src={src} alt={`${openWrap.name} photo ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} className="aspect-square w-full shrink-0 snap-center object-cover" />
                ))}
              </div>
            )}
            {openWrap.images.length > 1 && (
              <p className="mt-1 text-center text-xs text-gray-500">{openWrap.images.length} photos — swipe to see more</p>
            )}

            <div className="space-y-3 p-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 break-words">{openWrap.name}</h3>
                {openWrap.brand && <p className="text-sm text-gray-600">{openWrap.brand}</p>}
              </div>

              <dl className="grid grid-cols-2 gap-2 text-sm">
                {([
                  ['Size', openWrap.size],
                  ['Blend', openWrap.material],
                  ['Colour', openWrap.colour],
                  ['Type', openWrap.wrapType],
                ] as [string, string | null][]).filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-gray-50 p-2">
                    <dt className="text-xs text-gray-500">{label}</dt>
                    <dd className="font-semibold text-gray-900 break-words">{value}</dd>
                  </div>
                ))}
              </dl>

              {openWrap.forSale && (
                <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-800">
                  For sale{openWrap.forSalePm ? ' — PM for price' : openWrap.forSalePrice != null ? ` — ${openWrap.forSaleCurrency || ''} $${openWrap.forSalePrice}` : ''}
                </p>
              )}

              {openWrap.description && <p className="text-[15px] text-gray-700 whitespace-pre-wrap break-words">{openWrap.description}</p>}

              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={requireAccount} className="min-h-[44px] rounded-xl border text-sm font-semibold text-gray-700">♡ Like</button>
                <button type="button" onClick={requireAccount} className="min-h-[44px] rounded-xl border text-sm font-semibold text-gray-700">⭐ Add to ISO</button>
              </div>
              {loggedIn === false && (
                <Link href="/?signup=1" className="flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-base font-bold text-white">
                  Join WrapApp — it’s free
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
