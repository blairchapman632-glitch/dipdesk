'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/app/components/AppLayout'
import { getCoverImage, getCoverThumb, getImageThumb, sortWrapImages } from '@/lib/wrapCover'
import { fullSheetOverlay, fullSheetPanel, SheetTopBar } from '@/app/components/Sheet'
import { useLockBodyScroll } from '@/app/components/useLockBodyScroll'
import { showToast } from '@/app/components/Toast'
import WdywtGrid from '@/app/components/WdywtGrid'
import DoubleTapLike from '@/app/components/DoubleTapLike'
import ProfileTabs, { TAB_ICONS } from '@/app/components/ProfileTabs'
import { CollectionFilterBar, CollectionFilterSheet, useCollectionFilters } from '@/app/components/CollectionFilters'

type WrapImage = {
  id: string
  image_url: string
  thumbnail_url?: string | null
  is_primary: boolean
  sort_order: number
}

type Wrap = {
  id: string
  name: string
  brand: string | null
  description: string | null
  size: string | null
  material: string | null
  colour: string | null
  wrap_type?: string | null
  // Private: only loaded on your own profile (from my_wraps)
  purchase_date?: string | null
  purchased_from?: string | null
  status: 'active' | 'holiday' | 'departed'
  on_loan_to?: string | null
  sold_to?: string | null
  sold_price?: number | null
  sold_currency?: 'AUD' | 'USD' | 'EUR' | null
  sold_date: string | null
  is_favourite: boolean
  for_sale: boolean
  for_sale_price: number | null
  for_sale_currency: 'AUD' | 'USD' | 'EUR' | null
  for_sale_price_is_pm: boolean
  wrap_images?: WrapImage[]
}

type Profile = {
  id: string
  full_name: string | null
  username: string | null
}

type SocialCounts = {
  likes: number
  wishlists: number
}

const WRAP_PLACEHOLDER = 'https://placehold.co/800x800/fdf2f8/be185d?text=Wrap'

const getUserCollectionWrapsKey = (userId: string) => `dipdesk_user_collection_wraps_${userId}`
const getUserCollectionProfileKey = (userId: string) => `dipdesk_user_collection_profile_${userId}`
const getUserCollectionFollowKey = (userId: string) => `dipdesk_user_collection_follow_${userId}`
const getUserCollectionAvatarKey = (userId: string) => `dipdesk_user_collection_avatar_${userId}`
const getUserCollectionStatsKey = (userId: string) => `dipdesk_user_collection_stats_${userId}`

function formatCurrency(value: number | null | undefined, currency: 'AUD' | 'USD' | 'EUR' = 'AUD') {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

function getPrimaryImage(wrap?: Wrap) {
  return getCoverImage(wrap?.wrap_images)?.image_url || WRAP_PLACEHOLDER
}

// Grids and tiles use the small copy when there is one
function getPrimaryThumb(wrap?: Wrap) {
  return getCoverThumb(wrap?.wrap_images) || WRAP_PLACEHOLDER
}

export default function UserCollectionPage() {
  const params = useParams()
  const userId = params.id as string
  const router = useRouter()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [wraps, setWraps] = useState<Wrap[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null)
  const [selectedWrap, setSelectedWrap] = useState<Wrap | null>(null)
  const [selectedViewImage, setSelectedViewImage] = useState<string | null>(null)
  const [isViewWrapModalOpen, setIsViewWrapModalOpen] = useState(false)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [selectedWrapCounts, setSelectedWrapCounts] = useState<SocialCounts>({ likes: 0, wishlists: 0 })
  const [activeTab, setActiveTab] = useState<'collection' | 'forsale' | 'dips' | 'wdywt'>('collection')
  const [stats, setStats] = useState<{ followers: number, following: number, wraps: number, bio: string | null, city: string | null, country: string | null }>({ followers: 0, following: 0, wraps: 0, bio: null, city: null, country: null })
  const [hasLikedSelectedWrap, setHasLikedSelectedWrap] = useState(false)
  const [hasWishlistedSelectedWrap, setHasWishlistedSelectedWrap] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [activeDips, setActiveDips] = useState<{id: string, title: string, wrap_id: string | null, total_spots: number, price_per_spot: number, stage: string | null, wrap_name: string | null, brand: string | null, facebook_group: string | null}[]>([])
  const [authChecked, setAuthChecked] = useState(false)

  // Lock the page behind any open sheet/modal (the WDYWT post sheet locks itself)
  useLockBodyScroll(isViewWrapModalOpen || isImagePreviewOpen)

  useEffect(() => {
    if (!userId) return

    // Load all caches instantly
    const cachedWraps = localStorage.getItem(getUserCollectionWrapsKey(userId))
    if (cachedWraps) { try { setWraps(JSON.parse(cachedWraps)); setLoading(false) } catch {} }

    // Read current user id synchronously from Supabase session cache
    try {
      const supabaseKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'))
      if (supabaseKey) {
        const parsed = JSON.parse(localStorage.getItem(supabaseKey) || '')
        const uid = parsed?.user?.id || null
        if (uid) {
          // Your own /user/[id] → your profile
          if (String(uid) === String(userId)) { router.replace('/dashboard'); return }
          setCurrentUserId(uid)
          setAuthChecked(true)
        }
      }
    } catch {}

    const cachedProfile = localStorage.getItem(getUserCollectionProfileKey(userId))
    if (cachedProfile) { try { setProfile(JSON.parse(cachedProfile)) } catch {} }

    const cachedFollow = localStorage.getItem(getUserCollectionFollowKey(userId))
    if (cachedFollow) { try { setIsFollowing(JSON.parse(cachedFollow)) } catch {} }

    const cachedAvatar = localStorage.getItem(getUserCollectionAvatarKey(userId))
    if (cachedAvatar) { try { setProfileAvatar(JSON.parse(cachedAvatar)) } catch {} }

    const cachedStats = localStorage.getItem(getUserCollectionStatsKey(userId))
    if (cachedStats) { try { setStats(JSON.parse(cachedStats)) } catch {} }

    const cachedDips = localStorage.getItem(`dipdesk_user_dips_${userId}`)
    if (cachedDips) { try { setActiveDips(JSON.parse(cachedDips)) } catch {} }

    const savedTab = sessionStorage.getItem(`profile_tab_${userId}`)
    if (savedTab === 'collection' || savedTab === 'forsale' || savedTab === 'dips' || savedTab === 'wdywt') setActiveTab(savedTab)

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const loggedInUserId = user?.id || null
      if (loggedInUserId && String(loggedInUserId) === String(userId)) { router.replace('/dashboard'); return }
      setCurrentUserId(loggedInUserId)
      setAuthChecked(true)

      const [{ data: profileData }, { data: wrapData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', userId).single(),
        // Own profile: all fields from the owner-only my_wraps view.
        // Other people: public columns only (purchase, loan and sale details are private).
        loggedInUserId && String(loggedInUserId) === String(userId)
          ? supabase.from('my_wraps').select('id, name, brand, size, material, colour, wrap_type, purchase_date, purchased_from, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, wrap_images(id, image_url, thumbnail_url, is_primary, sort_order)').eq('user_id', userId).order('is_favourite', { ascending: false }).order('purchase_date', { ascending: false }).order('sort_order', { referencedTable: 'wrap_images' })
          : supabase.from('wraps').select('id, name, brand, size, material, colour, wrap_type, status, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, wrap_images(id, image_url, thumbnail_url, is_primary, sort_order)').eq('user_id', userId).order('is_favourite', { ascending: false }).order('created_at', { ascending: false }).order('sort_order', { referencedTable: 'wrap_images' }),
      ])

      let nextIsFollowing = false
      if (loggedInUserId && loggedInUserId !== userId) {
        const { data: followData } = await supabase.from('follows').select('id').eq('follower_id', loggedInUserId).eq('following_id', userId).eq('status', 'accepted').maybeSingle()
        nextIsFollowing = !!followData
      }
      setIsFollowing(nextIsFollowing)
      localStorage.setItem(getUserCollectionFollowKey(userId), JSON.stringify(nextIsFollowing))

      const [{ count: followerCount }, { count: followingCount }, { count: wrapCount }, { data: bioData }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId).eq('status', 'accepted'),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId).eq('status', 'accepted'),
        supabase.from('wraps').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('profiles').select('bio, city, country').eq('id', userId).single(),
      ])
      const nextStats = { followers: followerCount || 0, following: followingCount || 0, wraps: wrapCount || 0, bio: (bioData as any)?.bio || null, city: (bioData as any)?.city || null, country: (bioData as any)?.country || null }
      setStats(nextStats)
      localStorage.setItem(getUserCollectionStatsKey(userId), JSON.stringify(nextStats))

      // WDYWT posts load in <WdywtGrid> (same cache key, mounted with the page)
      const { data: dipData } = await supabase
        .from('dips')
        .select('id, title, wrap_id, total_spots, price_per_spot, stage, wrap_name, brand, facebook_group')
        .eq('user_id', userId)
        .not('stage', 'in', '("drawn")')
        .eq('archived', false)
      setActiveDips((dipData as any[]) || [])
      try { localStorage.setItem(`dipdesk_user_dips_${userId}`, JSON.stringify(dipData || [])) } catch {}
      setProfile(profileData || null)
      const avatarUrl = (profileData as any)?.avatar_url || null
      setProfileAvatar(avatarUrl)
      localStorage.setItem(getUserCollectionAvatarKey(userId), JSON.stringify(avatarUrl))
      localStorage.setItem(getUserCollectionProfileKey(userId), JSON.stringify(profileData || null))
      setWraps((wrapData as Wrap[]) || [])
      localStorage.setItem(getUserCollectionWrapsKey(userId), JSON.stringify((wrapData as Wrap[]) || []))
      setLoading(false)
    }

    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [userId])

  const collectionTitle = useMemo(() => {
    if (profile?.full_name?.trim()) return `${profile.full_name.split(' ')[0]}'s Collection`
    if (profile?.username?.trim()) return `${profile.username}'s Collection`
    return 'Collection'
  }, [profile])

  const collectionWraps = useMemo(() => wraps.filter(w => w.status === 'active' || w.status === 'holiday').sort((a, b) => { if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1; return a.name.localeCompare(b.name) }), [wraps])
  const departedWraps = useMemo(() => wraps.filter(w => w.status === 'departed').sort((a, b) => { if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1; return a.name.localeCompare(b.name) }), [wraps])

  // Collection filters (same sheet and rules as your own profile; also apply to Departed)
  const collectionFilters = useCollectionFilters()
  const filteredCollectionWraps = collectionWraps.filter((wrap) => collectionFilters.matches(wrap))
  const filteredDepartedWraps = departedWraps.filter((wrap) => collectionFilters.matches(wrap))

  const forSaleWraps = useMemo(() => wraps.filter(w => w.for_sale && w.status !== 'departed').sort((a, b) => a.name.localeCompare(b.name)), [wraps])

  function renderWrapTile(wrap: Wrap) {
    return (
      <button key={wrap.id} type="button" onClick={() => openViewWrapModal(wrap)} className="group flex h-auto cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-0 text-left shadow-none transition duration-200 hover:-translate-y-1 hover:shadow-md xl:rounded-2xl xl:shadow-sm">
        <div className="relative aspect-[3/4] w-full bg-gray-100 pointer-events-none">
          <img src={getPrimaryThumb(wrap)} alt={wrap.name} loading="lazy" className="h-full w-full object-cover object-[center_20%] transition duration-300 group-hover:scale-[1.03]" />
          {wrap.for_sale && <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow"><div>🪓 For Sale</div><div className="text-[10px] font-medium text-gray-700">{wrap.for_sale_price_is_pm ? 'PM' : wrap.for_sale_price !== null ? formatCurrency(wrap.for_sale_price, wrap.for_sale_currency || 'AUD') : ''}</div></div>}
          {wrap.is_favourite && <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-pink-600 shadow">★ Perma</div>}
          {activeDips.some(d => String(d.wrap_id) === String(wrap.id)) && <div className="absolute bottom-2 left-2 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-fuchsia-700 shadow">🎲 In a dip</div>}
        </div>
        <div className="space-y-0.5 p-2 pointer-events-none xl:space-y-1 xl:p-5">
          <h3 className="text-sm font-bold leading-tight text-gray-900 xl:text-base xl:leading-normal">{wrap.name}</h3>
          <p className="text-xs leading-tight text-gray-600 xl:text-sm xl:leading-normal">{wrap.brand || 'No brand added'}</p>
          {wrap.status === 'holiday' && wrap.on_loan_to && <div className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 xl:px-2 xl:py-1 xl:text-xs">On loan to {wrap.on_loan_to}</div>}
        </div>
      </button>
    )
  }

  // Message: open the existing conversation or start one
  async function openConversation() {
    if (!currentUserId) return
    const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${userId}),and(participant_1_id.eq.${userId},participant_2_id.eq.${currentUserId})`).maybeSingle()
    if (existing) { router.push(`/messages/${existing.id}`); return }
    const { data: newConv } = await supabase.from('conversations').insert({ participant_1_id: currentUserId, participant_2_id: userId, last_message: null, last_message_at: new Date().toISOString() }).select('id').single()
    if (newConv) router.push(`/messages/${newConv.id}`)
  }

  async function toggleFollow() {
    if (!currentUserId) return
    const firstName = profile?.full_name?.split(' ')[0] || profile?.username || 'user'
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', userId)
      setIsFollowing(false)
      setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }))
      localStorage.setItem(getUserCollectionFollowKey(userId), 'false')
      showToast(`Unfollowed ${firstName}`)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId, status: 'accepted' })
      setIsFollowing(true)
      setStats(s => ({ ...s, followers: s.followers + 1 }))
      localStorage.setItem(getUserCollectionFollowKey(userId), 'true')
      showToast(`Following ${firstName}`)
    }
  }

  async function loadWrapSocialData(wrapId: string) {
    const [{ count: likeCount }, { count: wishlistCount }, likedRowResult, wishlistedRowResult] = await Promise.all([
      supabase.from('wrap_likes').select('*', { count: 'exact', head: true }).eq('wrap_id', wrapId),
      supabase.from('wishlists').select('*', { count: 'exact', head: true }).eq('wrap_id', wrapId),
      currentUserId ? supabase.from('wrap_likes').select('id').eq('wrap_id', wrapId).eq('user_id', currentUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
      currentUserId ? supabase.from('wishlists').select('id').eq('wrap_id', wrapId).eq('user_id', currentUserId).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ])
    const counts = { likes: likeCount || 0, wishlists: wishlistCount || 0, hasLiked: !!likedRowResult.data, hasWishlisted: !!wishlistedRowResult.data }
    setSelectedWrapCounts({ likes: counts.likes, wishlists: counts.wishlists })
    setHasLikedSelectedWrap(counts.hasLiked)
    setHasWishlistedSelectedWrap(counts.hasWishlisted)
    localStorage.setItem(`dipdesk_social_${wrapId}`, JSON.stringify(counts))
  }

  async function openViewWrapModal(wrap: Wrap) {
    const primaryImage = getPrimaryImage(wrap)
    setSelectedWrap(wrap)
    setSelectedViewImage(primaryImage)
    setIsViewWrapModalOpen(true)
    const cachedSocial = localStorage.getItem(`dipdesk_social_${wrap.id}`)
    if (cachedSocial) { try { const p = JSON.parse(cachedSocial); setSelectedWrapCounts({ likes: p.likes, wishlists: p.wishlists }); setHasLikedSelectedWrap(p.hasLiked); setHasWishlistedSelectedWrap(p.hasWishlisted) } catch {} }
    await loadWrapSocialData(wrap.id)
  }

  function closeViewWrapModal() {
    setIsViewWrapModalOpen(false); setSelectedWrap(null); setSelectedViewImage(null); setIsImagePreviewOpen(false)
    setSelectedWrapCounts({ likes: 0, wishlists: 0 }); setHasLikedSelectedWrap(false); setHasWishlistedSelectedWrap(false); setSocialLoading(false)
  }

  async function handleToggleLike() {
    if (!selectedWrap || !currentUserId || currentUserId === userId || socialLoading) return
    setSocialLoading(true)
    if (hasLikedSelectedWrap) {
      const { error } = await supabase.from('wrap_likes').delete().eq('wrap_id', selectedWrap.id).eq('user_id', currentUserId)
      if (!error) { setHasLikedSelectedWrap(false); setSelectedWrapCounts(prev => ({ ...prev, likes: Math.max(0, prev.likes - 1) })) }
    } else {
      const { error } = await supabase.from('wrap_likes').insert({ wrap_id: selectedWrap.id, user_id: currentUserId })
      if (!error) {
        setHasLikedSelectedWrap(true)
        setSelectedWrapCounts(prev => ({ ...prev, likes: prev.likes + 1 }))
        await supabase.from('notifications').insert({ recipient_user_id: userId, actor_user_id: currentUserId, wrap_id: selectedWrap.id, type: 'like' })
        const myProfile = localStorage.getItem('dipdesk_dashboard_profile')
        const myName = myProfile ? JSON.parse(myProfile)?.full_name?.split(' ')[0] || 'Someone' : 'Someone'
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: [userId],
            title: `❤️ ${myName} liked your wrap`,
            body: selectedWrap.name,
            url: '/activity',
          }),
        }).catch(() => {})
      }
    }
    setSocialLoading(false)
  }

  async function handleToggleWishlist() {
    if (!selectedWrap || !currentUserId || currentUserId === userId || socialLoading) return
    setSocialLoading(true)
    if (hasWishlistedSelectedWrap) {
      const { error } = await supabase.from('wishlists').delete().eq('wrap_id', selectedWrap.id).eq('user_id', currentUserId)
      if (!error) { setHasWishlistedSelectedWrap(false); setSelectedWrapCounts(prev => ({ ...prev, wishlists: Math.max(0, prev.wishlists - 1) })) }
    } else {
      const { error } = await supabase.from('wishlists').insert({ wrap_id: selectedWrap.id, user_id: currentUserId })
      if (!error) {
        setHasWishlistedSelectedWrap(true)
        setSelectedWrapCounts(prev => ({ ...prev, wishlists: prev.wishlists + 1 }))
        await supabase.from('notifications').insert({ recipient_user_id: userId, actor_user_id: currentUserId, wrap_id: selectedWrap.id, type: 'wishlist' })
        const myProfile = localStorage.getItem('dipdesk_dashboard_profile')
        const myName = myProfile ? JSON.parse(myProfile)?.full_name?.split(' ')[0] || 'Someone' : 'Someone'
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: [userId],
            title: `⭐ ${myName} wishlisted your wrap`,
            body: selectedWrap.name,
            url: '/activity',
          }),
        }).catch(() => {})
      }
    }
    setSocialLoading(false)
  }

  if (loading && wraps.length === 0 && !profile) {
    return <AppLayout hideHeader={authChecked && !currentUserId}><div className="space-y-6"><section className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Loading collection...</p></section></div></AppLayout>
  }

  return (
    <AppLayout hideHeader={authChecked && !currentUserId}>
      {/* Same max width as Explore so pages feel consistent */}
      <div className="mx-auto max-w-[960px]">
      {authChecked && !currentUserId && (
        <div className="mb-4 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-white">👋 You're viewing a wrap collection on WrapApp — the home for wrap collectors.</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="shrink-0 rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-pink-600 shadow-sm"
          >
            Join free →
          </button>
        </div>
      )}
      <div className="space-y-4">
        {/* Profile header — same layout as your own profile (Instagram-style) */}
        {(() => {
          const displayName = profile?.full_name || profile?.username || 'Collection'
          const initials = displayName.trim().split(' ').filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
          const location = [stats.city, stats.country].filter(Boolean).join(', ')
          const stat = (value: number, label: string) => (
            <div className="text-center md:flex md:items-baseline md:gap-1 md:text-left">
              <p className="text-base font-bold text-gray-900 md:text-lg">{value}</p>
              <p className="text-xs text-gray-500 md:text-sm">{label}</p>
            </div>
          )
          return (
            <section className="px-1 pt-1 md:px-2">
              <div className="flex items-center gap-4 md:gap-10">
                {profileAvatar ? (
                  <img src={profileAvatar} alt={displayName} className="h-20 w-20 shrink-0 rounded-full object-cover ring-2 ring-pink-100 md:h-32 md:w-32" />
                ) : (
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-2xl font-bold text-white md:h-32 md:w-32 md:text-4xl">
                    {initials || '?'}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-2 md:space-y-3">
                  <div className="md:flex md:items-baseline md:gap-3">
                    <h1 className="truncate text-lg font-bold text-gray-900 md:text-2xl">{displayName}</h1>
                    {profile?.username && <p className="truncate text-sm text-gray-500">@{profile.username}</p>}
                  </div>
                  <div className="grid grid-cols-3 gap-1 md:flex md:gap-8">
                    {stat(stats.wraps, stats.wraps === 1 ? 'Wrap' : 'Wraps')}
                    {stat(stats.followers, 'Followers')}
                    {stat(stats.following, 'Following')}
                  </div>
                </div>
              </div>

              {(stats.bio || location) && (
                <div className="mt-3 space-y-0.5 md:ml-[10.5rem] md:mt-0">
                  {stats.bio && <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{stats.bio}</p>}
                  {location && <p className="text-sm text-gray-500">📍 {location}</p>}
                </div>
              )}

              {/* Follow + Message (no Edit / Settings on other people's profiles) */}
              {!authChecked && (
                <div className="mt-3 grid grid-cols-2 gap-2 md:ml-[10.5rem] md:max-w-md">
                  <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
                  <div className="h-11 animate-pulse rounded-xl bg-gray-100" />
                </div>
              )}
              {authChecked && currentUserId && String(currentUserId) !== String(userId) && (
                <div className="mt-3 grid grid-cols-2 gap-2 md:ml-[10.5rem] md:max-w-md">
                  <button
                    type="button"
                    onClick={() => void toggleFollow()}
                    className={isFollowing
                      ? 'inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50'
                      : 'inline-flex min-h-[44px] items-center justify-center rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 text-sm font-semibold text-white shadow-sm hover:opacity-90'}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openConversation()}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                  >
                    Message
                  </button>
                </div>
              )}
            </section>
          )
        })()}

        {/* Tabs: equal-width, icon over label, same as your own profile (no ISO here) */}
        <ProfileTabs
          className="mt-2!"
          active={activeTab}
          onChange={(key) => { setActiveTab(key); try { sessionStorage.setItem(`profile_tab_${userId}`, key) } catch {} }}
          tabs={[
            { key: 'collection', label: 'Collection', icon: TAB_ICONS.collection },
            { key: 'forsale', label: 'For Sale', icon: TAB_ICONS.forsale },
            { key: 'dips', label: 'Dips', icon: TAB_ICONS.dips, badge: activeDips.length },
            { key: 'wdywt', label: 'WDYWT', icon: TAB_ICONS.wdywt },
          ]}
        />

        {/* For Sale: their wraps marked for sale */}
        {activeTab === 'forsale' && (
          <section className="min-w-0">
            {forSaleWraps.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">Nothing for sale</div>
            ) : (
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
                {forSaleWraps.map((wrap) => renderWrapTile(wrap))}
              </div>
            )}
          </section>
        )}

        {/* WDYWT: 3-column photo grid; tap opens the post. Mounted with the page so it loads
            alongside everything else (as before), shown only on its tab. */}
        <section className={`min-w-0 ${activeTab === 'wdywt' ? '' : 'hidden'}`}>
          <WdywtGrid
            userId={userId}
            currentUserId={currentUserId}
            ownerName={profile?.full_name?.split(' ')[0] || profile?.username || 'User'}
          />
        </section>

        {/* Dips: their active dips only (the same dips shown as "Currently being dipped") */}
        {activeTab === 'dips' && (
          <section className="min-w-0 space-y-2">
            {activeDips.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-gray-500">No active dips</div>
            ) : (
              activeDips.map((dip) => {
                const stageLabel: Record<string, string> = { interest: 'Interest', queue: 'In queue', live: 'Live 🔥', payments: 'Full – collecting payments', closed: 'Ready to draw' }
                const dipWrap = wraps.find(w => String(w.id) === String(dip.wrap_id))
                const title = dip.wrap_name || dipWrap?.name || dip.title
                const brand = dip.brand || dipWrap?.brand || null
                return (
                  <button
                    key={dip.id}
                    type="button"
                    onClick={() => { if (dipWrap) openViewWrapModal(dipWrap) }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-purple-200 bg-purple-50/60 p-2.5 text-left"
                  >
                    {dipWrap ? (
                      <img src={getPrimaryThumb(dipWrap)} alt={title} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-2xl">🎲</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-gray-900">{title}</p>
                      {brand && <p className="truncate text-xs text-gray-600">{brand}</p>}
                      <p className="mt-0.5 text-xs text-purple-700">
                        {stageLabel[dip.stage || ''] || dip.stage || 'Active'} · {dip.total_spots} spots @ ${dip.price_per_spot}
                      </p>
                      {dip.facebook_group && <p className="truncate text-xs text-gray-500">On {dip.facebook_group}</p>}
                    </div>
                  </button>
                )
              })
            )}
          </section>
        )}

        <section className="min-w-0">
          {/* Collection tab */}
          {activeTab === 'collection' && (
            <div>
              {collectionWraps.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center"><p className="text-gray-600">No wraps yet</p></div>
              ) : (
                <>
                  {/* Wrap count + filter button (filters open in a bottom sheet) */}
                  <CollectionFilterBar filters={collectionFilters} shown={filteredCollectionWraps.length} total={collectionWraps.length} />
                  {filteredCollectionWraps.length === 0 ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center">
                      <p className="text-sm text-gray-500">No wraps match these filters</p>
                      <button type="button" onClick={collectionFilters.clear} className="mt-2 min-h-[36px] text-sm font-semibold text-pink-600">Clear filters</button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
                      {filteredCollectionWraps.map((wrap) => renderWrapTile(wrap))}
                    </div>
                  )}
                </>
              )}
              <CollectionFilterSheet filters={collectionFilters} />

              <div className="mt-8">
                <h3 className="mb-3 text-lg font-bold text-gray-900">Departed Wraps</h3>
                {filteredDepartedWraps.length === 0 ? (
                  <p className="text-sm text-gray-500">{departedWraps.length === 0 ? 'No departed wraps yet' : 'No departed wraps match these filters'}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {filteredDepartedWraps.map((wrap) => (
                      <button key={wrap.id} type="button" onClick={() => openViewWrapModal(wrap)} className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-gray-50 p-0 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="relative aspect-[4/5] w-full bg-gray-100 pointer-events-none">
                          <img src={getPrimaryThumb(wrap)} alt={wrap.name} loading="lazy" className="h-full w-full object-cover object-[center_20%] opacity-90 transition duration-300 group-hover:scale-[1.03]" />
                          {wrap.for_sale && <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow"><div>🪓 For Sale</div><div className="text-[10px] font-medium text-gray-700">{wrap.for_sale_price_is_pm ? 'PM' : wrap.for_sale_price !== null ? formatCurrency(wrap.for_sale_price, wrap.for_sale_currency || 'AUD') : ''}</div></div>}
                          {wrap.is_favourite && <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-pink-600 shadow">★ Perma</div>}
                        </div>
                        <div className="space-y-1 p-3">
                          <h4 className="line-clamp-1 text-sm font-bold text-gray-900">{wrap.name}</h4>
                          <p className="line-clamp-1 text-xs text-gray-600">{wrap.brand || 'No brand added'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Wrap modal */}
        {isViewWrapModalOpen && selectedWrap && (() => {
          const sortedImages = sortWrapImages(selectedWrap.wrap_images)
          return (
            <div className={fullSheetOverlay} onClick={closeViewWrapModal}>
              <div className={fullSheetPanel('md:max-w-4xl')} onClick={e => e.stopPropagation()}>
                <SheetTopBar onClose={closeViewWrapModal} title={selectedWrap.name} />
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-gray-900">{selectedWrap.name}</h2>
                      {currentUserId && currentUserId !== userId && (
                        <>
                          <button type="button" onClick={handleToggleLike} disabled={socialLoading} className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${hasLikedSelectedWrap ? 'border-pink-200 bg-pink-50 text-pink-600' : 'border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:text-pink-600'}`}>❤️ {selectedWrapCounts.likes}</button>
                          <button type="button" onClick={handleToggleWishlist} disabled={socialLoading} className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${hasWishlistedSelectedWrap ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-gray-200 bg-white text-gray-700 hover:border-amber-200 hover:text-amber-700'}`}>⭐ {selectedWrapCounts.wishlists}</button>
                        </>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-500">{selectedWrap.brand || 'No brand added'}</p>
                      {selectedWrap.is_favourite && <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-600">★ Perma</span>}
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{selectedWrap.status}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedWrap.for_sale && currentUserId && currentUserId !== userId && (
                      <button type="button" onClick={async () => {
                        const enquiryMessage = `Hi! I'm interested in your ${selectedWrap.name}${selectedWrap.brand ? ` by ${selectedWrap.brand}` : ''} — is it still available?`
                        const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${userId}),and(participant_1_id.eq.${userId},participant_2_id.eq.${currentUserId})`).maybeSingle()
                        if (existing) {
                          closeViewWrapModal()
                          router.push(`/messages/${existing.id}?prefill=${encodeURIComponent(enquiryMessage)}`)
                          return
                        }
                        const { data: newConv } = await supabase.from('conversations').insert({ participant_1_id: currentUserId, participant_2_id: userId, last_message: null, last_message_at: new Date().toISOString() }).select('id').single()
                        if (newConv) { closeViewWrapModal(); router.push(`/messages/${newConv.id}?prefill=${encodeURIComponent(enquiryMessage)}`) }
                      }} className="cursor-pointer rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition">🪓 Contact Seller</button>
                    )}
                    <button type="button" onClick={closeViewWrapModal} className="cursor-pointer rounded-full border px-3 py-1 text-sm text-gray-600">Close</button>
                  </div>
                </div>

                <div className="mb-4 overflow-hidden rounded-3xl bg-gray-100 shadow-sm">
                  {/* Tap = view larger; double-tap = like (never unlikes) */}
                  <DoubleTapLike
                    enabled={!!currentUserId && String(currentUserId) !== String(userId)}
                    onSingleTap={() => setIsImagePreviewOpen(true)}
                    onDoubleTap={() => { if (!hasLikedSelectedWrap) void handleToggleLike() }}
                    className="block w-full cursor-zoom-in bg-black"
                  >
                    <img src={selectedViewImage || getPrimaryImage(selectedWrap)} alt={selectedWrap.name} className="h-[440px] w-full object-cover transition duration-300 hover:scale-[1.01]" />
                  </DoubleTapLike>
                </div>
                <p className="mb-4 text-xs text-gray-500">Tap the photo to view larger{currentUserId && String(currentUserId) !== String(userId) ? ' · double-tap to like' : ''}</p>

                {sortedImages.length > 0 && (
                  <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {sortedImages.map(image => (
                      <button key={image.id} type="button" onClick={() => setSelectedViewImage(image.image_url)} className={`overflow-hidden rounded-xl border transition duration-200 ${selectedViewImage === image.image_url ? 'border-pink-500 ring-2 ring-pink-200 shadow-sm' : 'border-gray-200 hover:border-pink-300 hover:shadow-sm'}`}>
                        <img src={getImageThumb(image) || image.image_url} alt={selectedWrap.name} loading="lazy" className="h-20 w-full object-cover transition duration-200 hover:scale-[1.02]" />
                      </button>
                    ))}
                  </div>
                )}
{(() => {
                  const dip = activeDips.find(d => d.wrap_id === selectedWrap.id)
                  if (!dip) return null
                  const stageLabel: Record<string, string> = { interest: 'Interest', queue: 'In Queue', live: 'Live 🔥', payments: 'Full – collecting payments', closed: 'Ready to draw' }
                  return (
                    <div className="mb-5 rounded-2xl bg-purple-50 border border-purple-200 p-4 space-y-2">
                      <p className="text-sm font-bold text-purple-700">🎲 Currently being dipped{dip.facebook_group ? ` on ${dip.facebook_group}` : ''}!</p>
                      <p className="text-xs text-purple-600">{dip.total_spots} spots @ ${dip.price_per_spot} USD each</p>
                      <p className="text-xs text-purple-600">Stage: {stageLabel[dip.stage || ''] || dip.stage}</p>
                      {dip.facebook_group && <p className="text-xs text-gray-600 mt-1">Head to the <span className="font-semibold">{dip.facebook_group} Facebook page</span> to claim your spot!</p>}
                    </div>
                  )
                })()}
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Wrap Details</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><span className="font-semibold text-gray-900">Brand:</span> {selectedWrap.brand || '—'}</p>
                      <p><span className="font-semibold text-gray-900">Size / STIH:</span> {selectedWrap.size || '—'}</p>
                      <p><span className="font-semibold text-gray-900">Blend:</span> {selectedWrap.material || '—'}</p>
                      <p><span className="font-semibold text-gray-900">Colour:</span> {selectedWrap.colour || '—'}</p>
                      
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Extra Info</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><span className="font-semibold text-gray-900">Favourite:</span> {selectedWrap.is_favourite ? 'Yes' : 'No'}</p>
                      {selectedWrap.for_sale && <p><span className="font-semibold text-gray-900">For Sale:</span> {selectedWrap.for_sale_price_is_pm ? 'PM' : selectedWrap.for_sale_price !== null ? formatCurrency(selectedWrap.for_sale_price, selectedWrap.for_sale_currency || 'AUD') : 'Yes'}</p>}
                      {/* Who has it on loan is private: own profile only */}
                      {selectedWrap.status === 'holiday' && currentUserId && String(currentUserId) === String(userId) && <p><span className="font-semibold text-gray-900">On Holiday With:</span> {selectedWrap.on_loan_to || '—'}</p>}
                      
                    </div>
                  </div>
                  {selectedWrap.description && (
                    <div className="md:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Description</h3>
                      <p className="whitespace-pre-wrap text-sm text-gray-700">{selectedWrap.description}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {isImagePreviewOpen && selectedWrap && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-0 pt-[env(safe-area-inset-top)] md:p-4">
            <div className="relative w-full max-w-6xl">
              <button type="button" onClick={() => setIsImagePreviewOpen(false)} className="absolute right-2 top-2 z-10 min-h-[44px] rounded-full bg-white/90 px-4 text-sm font-semibold text-gray-800 shadow md:right-0 md:top-0">Close</button>
              <img src={selectedViewImage || getPrimaryImage(selectedWrap)} alt={selectedWrap.name} className="max-h-[90vh] w-full rounded-2xl bg-black object-contain" />
            </div>
          </div>
        )}
      </div>
      </div>

    </AppLayout>
  )
}