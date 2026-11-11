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
  followers: number
  following: number
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
  images: string[] // full photos (detail sheet)
  thumbs: string[] // small copies, same order (tiles)
}

export type PublicDip = {
  id: string
  title: string
  wrapId: string | null
  totalSpots: number
  pricePerSpot: number
  stage: string
}

// Tile image: the small copy when the wrap has one, else the full photo
const tileImage = (wrap: PublicWrap) => wrap.thumbs?.[0] || wrap.images[0]

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
  const [tab, setTab] = useState<'collection' | 'forsale'>('collection')

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

  const forSaleWraps = wraps.filter(w => w.forSale)
  const shownWraps = tab === 'forsale' ? forSaleWraps : wraps
  const stat = (value: number, label: string) => (
    <div className="text-center md:flex md:items-baseline md:gap-1 md:text-left">
      <p className="text-base font-bold text-gray-900 md:text-lg">{value}</p>
      <p className="text-xs text-gray-500 md:text-sm">{label}</p>
    </div>
  )

  return (
    <main className="min-h-dvh bg-white pb-28 md:pb-10">
      {/* Top bar: WrapApp + Join (logged out) or your profile (logged in) */}
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-12 max-w-[960px] items-center justify-between px-3 md:h-16 md:px-6">
          <Link href={loggedIn ? '/explore' : '/'} className="text-xl font-extrabold tracking-tight text-pink-600">WrapApp</Link>
          {loggedIn ? (
            <Link href="/dashboard" className="inline-flex min-h-[36px] items-center rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800">My profile</Link>
          ) : loggedIn === false ? (
            <div className="flex items-center gap-1">
              <Link href="/" className="inline-flex min-h-[36px] items-center px-2 text-sm font-semibold text-gray-600">Log in</Link>
              <Link href="/?signup=1" className="inline-flex min-h-[36px] items-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-3 text-sm font-bold text-white shadow-sm">Join WrapApp</Link>
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-[960px] space-y-4 px-3 pt-4 md:px-6">

        {/* Profile header — same layout as a WrapApp profile */}
        <section className="px-1 md:px-2">
          <div className="flex items-center gap-4 md:gap-10">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name} className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-pink-100 md:h-32 md:w-32" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-2xl font-bold text-white md:h-32 md:w-32 md:text-4xl">{initials || '?'}</div>
            )}
            <div className="min-w-0 flex-1 space-y-2 md:space-y-3">
              <div className="md:flex md:items-baseline md:gap-3">
                <h1 className="truncate text-lg font-bold text-gray-900 md:text-2xl">{profile.name}</h1>
                <p className="truncate text-sm text-gray-500">@{profile.username}</p>
              </div>
              <div className="grid grid-cols-3 gap-1 md:flex md:gap-8">
                {stat(wraps.length, wraps.length === 1 ? 'Wrap' : 'Wraps')}
                {stat(profile.followers, 'Followers')}
                {stat(profile.following, 'Following')}
              </div>
            </div>
          </div>

          {(profile.bio || profile.location) && (
            <div className="mt-3 space-y-0.5 md:ml-[10.5rem] md:mt-0">
              {profile.bio && <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{profile.bio}</p>}
              {profile.location && <p className="text-sm text-gray-500">📍 {profile.location}</p>}
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 md:ml-[10.5rem] md:max-w-md">
            <button type="button" onClick={requireAccount} className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 text-sm font-semibold text-white shadow-sm">
              Follow
            </button>
            <button type="button" onClick={requireAccount} className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800">
              Message
            </button>
          </div>
        </section>

        {/* Active dips */}
        {dips.length > 0 && (
          <section className="space-y-2">
            {dips.map(d => {
              const wrap = d.wrapId ? wrapsById[d.wrapId] : undefined
              const img = wrap ? tileImage(wrap) : undefined
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50/60 p-2.5">
                  {img ? (
                    <img src={img} alt={d.title} loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover object-[center_30%]" />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white text-2xl">🎲</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-fuchsia-700">🎲 Dipping now</p>
                    <p className="truncate font-bold text-gray-900">{d.title}</p>
                    <p className="text-xs text-gray-600">{d.totalSpots} spots · ${d.pricePerSpot} each · {getDipStageLabel(d.stage)}</p>
                  </div>
                </div>
              )
            })}
          </section>
        )}

        {/* Tabs: Collection · For Sale (segmented, like the profile) */}
        <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
          {([
            { key: 'collection', label: 'Collection' },
            { key: 'forsale', label: `For Sale${forSaleWraps.length ? ` (${forSaleWraps.length})` : ''}` },
          ] as const).map(t => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              aria-current={tab === t.key ? 'page' : undefined}
              className={`flex min-h-[40px] flex-1 items-center justify-center rounded-lg px-2.5 text-sm transition ${tab === t.key ? 'bg-white font-bold text-gray-900 shadow-sm' : 'font-semibold text-gray-500'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Wrap grid */}
        <section className="min-w-0">
          {shownWraps.length === 0 ? (
            <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">{tab === 'forsale' ? 'Nothing for sale' : 'No wraps to show yet'}</p>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 xl:grid-cols-4 xl:gap-4">
              {shownWraps.map(w => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setOpenWrap(w)}
                  className="flex flex-col overflow-hidden rounded-xl border bg-white text-left xl:rounded-2xl xl:shadow-sm"
                >
                  <div className="relative aspect-[3/4] w-full bg-gray-100">
                    {w.images[0] ? (
                      <img src={tileImage(w)} alt={w.name} loading="lazy" className="h-full w-full object-cover object-[center_20%]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-pink-50 text-3xl">🧣</div>
                    )}
                    {w.forSale && (
                      <div className="absolute left-2 top-2 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow">
                        🪓 For Sale{w.forSalePm ? ' · PM' : ''}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5 p-2">
                    <p className="line-clamp-2 text-sm font-bold leading-tight text-gray-900">{w.name}</p>
                    {w.brand && <p className="line-clamp-1 text-xs text-gray-600">{w.brand}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Desktop: inline join prompt (phone gets the bottom banner) */}
        {loggedIn === false && (
          <div className="hidden rounded-2xl border bg-white p-5 text-center md:block">
            <p className="mb-3 text-sm text-gray-600">See more collections — join WrapApp, the free social home for wrap collectors.</p>
            <Link href="/?signup=1" className="inline-flex min-h-[44px] items-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-6 text-sm font-bold text-white">
              Join WrapApp
            </Link>
          </div>
        )}
      </div>

      {/* Small bottom banner — phone, logged out */}
      {loggedIn === false && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-3 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
          <Link href="/?signup=1" className="flex items-center justify-between gap-3">
            <span className="min-w-0 text-sm font-semibold text-gray-800">See more collections, join WrapApp</span>
            <span className="inline-flex min-h-[36px] shrink-0 items-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-3 text-sm font-bold text-white">Join</span>
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
