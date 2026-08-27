'use client'

import AppLayout from '@/app/components/AppLayout'
import { supabase } from '@/lib/supabase'
import React, { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type WrapImage = {
  id: string
  image_url: string
  is_primary: boolean
  sort_order: number
}

type Wrap = {
  id: string
  user_id: string
  name: string
  brand: string | null
  description: string | null
  purchase_date: string | null
  purchased_from: string | null
  purchase_country: string | null
  status: 'active' | 'holiday' | 'departed'
  on_loan_to: string | null
  sold_to: string | null
  sold_price: number | null
  sold_currency: 'AUD' | 'USD' | 'EUR' | null
  sold_date: string | null
  is_favourite: boolean
  for_sale: boolean
  for_sale_price: number | null
  for_sale_currency: 'AUD' | 'USD' | 'EUR' | null
  for_sale_price_is_pm: boolean
  created_at: string
  wrap_images?: WrapImage[]
}

type Profile = {
  id: string
  full_name: string | null
  username: string | null
}

type FollowingUser = {
  id: string
  name: string
  image_url: string
  wrap_count: number
}

type ExploreUser = {
  id: string
  name: string
  image_url: string
  wrap_count: number
}

type SocialCounts = {
  likes: number
  wishlists: number
}

const WRAP_PLACEHOLDER =
  'https://placehold.co/800x800/fdf2f8/be185d?text=Wrap'

const EXPLORE_WRAPS_KEY = 'dipdesk_explore_wraps'
const EXPLORE_USERS_KEY = 'dipdesk_explore_users'
const EXPLORE_FOLLOWING_KEY = 'dipdesk_explore_following'
const EXPLORE_PROFILES_KEY = 'dipdesk_explore_profiles'
const EXPLORE_AVATARS_KEY = 'dipdesk_explore_avatars'

function getPrimaryImage(wrap?: Wrap) {
  if (!wrap?.wrap_images?.length) return WRAP_PLACEHOLDER

  const primary =
    wrap.wrap_images.find((image) => image.is_primary) ||
    [...wrap.wrap_images].sort((a, b) => a.sort_order - b.sort_order)[0]

  return primary?.image_url
  ? `${primary.image_url}?width=400&quality=60`
  : WRAP_PLACEHOLDER
}

function getDisplayName(profile?: Profile) {
  if (profile?.full_name?.trim()) {
    return profile.full_name.split(' ')[0]
  }

  if (profile?.username?.trim()) {
    return profile.username
  }

  return 'User'
}

export default function Page() {
  const router = useRouter()
    async function loadWrapSocialData(wrapId: string) {
    const [
      { count: likeCount },
      { count: wishlistCount },
      likedRowResult,
      wishlistedRowResult,
    ] = await Promise.all([
      supabase
        .from('wrap_likes')
        .select('*', { count: 'exact', head: true })
        .eq('wrap_id', wrapId),
      supabase
        .from('wishlists')
        .select('*', { count: 'exact', head: true })
        .eq('wrap_id', wrapId),
      currentUserId
        ? supabase
            .from('wrap_likes')
            .select('id')
            .eq('wrap_id', wrapId)
            .eq('user_id', currentUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      currentUserId
        ? supabase
            .from('wishlists')
            .select('id')
            .eq('wrap_id', wrapId)
            .eq('user_id', currentUserId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ])

    const counts = {
      likes: likeCount || 0,
      wishlists: wishlistCount || 0,
      hasLiked: !!likedRowResult.data,
      hasWishlisted: !!wishlistedRowResult.data,
    }
    setSelectedWrapCounts({ likes: counts.likes, wishlists: counts.wishlists })
    setHasLikedSelectedWrap(counts.hasLiked)
    setHasWishlistedSelectedWrap(counts.hasWishlisted)
    localStorage.setItem(`dipdesk_social_${wrapId}`, JSON.stringify(counts))
  }

  async function openViewWrapModal(wrap: Wrap) {
    const sortedImages = [...(wrap.wrap_images || [])].sort(
      (a, b) => a.sort_order - b.sort_order
    )

    const primaryImage =
      sortedImages.find((image) => image.is_primary)?.image_url ||
      sortedImages[0]?.image_url ||
      getPrimaryImage(wrap)

    setSelectedWrap(wrap)
    setSelectedViewImage(primaryImage)
    setIsViewWrapModalOpen(true)

    const { data: dipData, error: dipError } = await supabase
      .from('dips')
      .select('id, wrap_id, total_spots, price_per_spot, stage, facebook_group')
      .eq('user_id', wrap.user_id)
      .eq('wrap_id', wrap.id)
      .not('stage', 'in', '("drawn")')
      .eq('archived', false)
    
    setActiveDips((dipData as any[]) || [])

    // Show cached social counts instantly
    const cachedSocial = localStorage.getItem(`dipdesk_social_${wrap.id}`)
    if (cachedSocial) {
      try {
        const parsed = JSON.parse(cachedSocial)
        setSelectedWrapCounts({ likes: parsed.likes, wishlists: parsed.wishlists })
        setHasLikedSelectedWrap(parsed.hasLiked)
        setHasWishlistedSelectedWrap(parsed.hasWishlisted)
      } catch {}
    }

    // Fetch fresh in background
    await loadWrapSocialData(wrap.id)
  }

  function closeViewWrapModal() {
    setIsViewWrapModalOpen(false)
    setSelectedWrap(null)
    setSelectedViewImage(null)
    setIsImagePreviewOpen(false)
    setSelectedWrapCounts({ likes: 0, wishlists: 0 })
    setHasLikedSelectedWrap(false)
    setHasWishlistedSelectedWrap(false)
    setSocialLoading(false)
  }

  async function handleToggleLike() {
    if (!selectedWrap || !currentUserId || currentUserId === selectedWrap.user_id || socialLoading) return

    setSocialLoading(true)

    if (hasLikedSelectedWrap) {
      const { error } = await supabase
        .from('wrap_likes')
        .delete()
        .eq('wrap_id', selectedWrap.id)
        .eq('user_id', currentUserId)

      if (!error) {
        setHasLikedSelectedWrap(false)
        setSelectedWrapCounts((prev) => ({
          ...prev,
          likes: Math.max(0, prev.likes - 1),
        }))
      }

      setSocialLoading(false)
      return
    }

    const { error } = await supabase
      .from('wrap_likes')
      .insert({
        wrap_id: selectedWrap.id,
        user_id: currentUserId,
      })

    if (!error) {
      setHasLikedSelectedWrap(true)
      setSelectedWrapCounts((prev) => ({
        ...prev,
        likes: prev.likes + 1,
      }))

            const { data: existingLikeNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_user_id', selectedWrap.user_id)
        .eq('actor_user_id', currentUserId)
        .eq('wrap_id', selectedWrap.id)
        .eq('type', 'like')
        .maybeSingle()

      if (!existingLikeNotification) {
        await supabase.from('notifications').insert({
          recipient_user_id: selectedWrap.user_id,
          actor_user_id: currentUserId,
          wrap_id: selectedWrap.id,
          type: 'like',
          read_at: null,
        })

        const myProfileLike = localStorage.getItem('dipdesk_dashboard_profile')
        const myNameLike = myProfileLike ? JSON.parse(myProfileLike)?.full_name?.split(' ')[0] || 'Someone' : 'Someone'
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: [selectedWrap.user_id],
            title: `❤️ ${myNameLike} liked your wrap`,
            body: selectedWrap.name,
            url: '/dashboard',
          }),
        }).catch(() => {})
      }
    }

    setSocialLoading(false)
  }

  async function handleToggleWishlist() {
    if (!selectedWrap || !currentUserId || currentUserId === selectedWrap.user_id || socialLoading) return

    setSocialLoading(true)

    if (hasWishlistedSelectedWrap) {
      const { error } = await supabase
        .from('wishlists')
        .delete()
        .eq('wrap_id', selectedWrap.id)
        .eq('user_id', currentUserId)

      if (!error) {
        setHasWishlistedSelectedWrap(false)
        setSelectedWrapCounts((prev) => ({
          ...prev,
          wishlists: Math.max(0, prev.wishlists - 1),
        }))
      }

      setSocialLoading(false)
      return
    }

    const { error } = await supabase
      .from('wishlists')
      .insert({
        wrap_id: selectedWrap.id,
        user_id: currentUserId,
      })

    if (!error) {
      setHasWishlistedSelectedWrap(true)
      setSelectedWrapCounts((prev) => ({
        ...prev,
        wishlists: prev.wishlists + 1,
      }))

      const { data: existingWishlistNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('recipient_user_id', selectedWrap.user_id)
        .eq('actor_user_id', currentUserId)
        .eq('wrap_id', selectedWrap.id)
        .eq('type', 'wishlist')
        .maybeSingle()

      if (!existingWishlistNotification) {
        await supabase.from('notifications').insert({
          recipient_user_id: selectedWrap.user_id,
          actor_user_id: currentUserId,
          wrap_id: selectedWrap.id,
          type: 'wishlist',
          read_at: null,
        })

        const myProfileWishlist = localStorage.getItem('dipdesk_dashboard_profile')
        const myNameWishlist = myProfileWishlist ? JSON.parse(myProfileWishlist)?.full_name?.split(' ')[0] || 'Someone' : 'Someone'
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: [selectedWrap.user_id],
            title: `⭐ ${myNameWishlist} wishlisted your wrap`,
            body: selectedWrap.name,
            url: '/dashboard',
          }),
        }).catch(() => {})
      }
    }

    setSocialLoading(false)
  }

  function formatCurrency(
    value: number | null | undefined,
    currency: 'AUD' | 'USD' | 'EUR' = 'AUD'
  ) {
    if (value === null || value === undefined || Number.isNaN(value)) return ''
    const formatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value)
    return `${formatted} ${currency}`
  }
  const [avatarMap, setAvatarMap] = useState<Record<string, string | null>>({})
    const [searchTerm, setSearchTerm] = useState('')
  const [resultType, setResultType] = useState<'all' | 'wraps' | 'users' | 'for-sale'>('all')
  const [forSaleOnly, setForSaleOnly] = useState(false)
  const [filterBrand, setFilterBrand] = useState('')
  const [filterSize, setFilterSize] = useState('')
  const [filterColour, setFilterColour] = useState('')
const [showColourFilter, setShowColourFilter] = useState(false)
const [showBrandFilter, setShowBrandFilter] = useState(false)
const [showSizeFilter, setShowSizeFilter] = useState(false)
const [showBlendFilter, setShowBlendFilter] = useState(false)
const [showFilterSheet, setShowFilterSheet] = useState(false)
const [selectedBlends, setSelectedBlends] = useState<string[]>([])
const BLEND_TAGS = [
  'Cotton', 'Linen', 'Silk', 'Hemp', 'Wool/Merino', 'Seacell', 'Tencel', 'Chenille', 'Camel', 'Bamboo', 'Cashmere'
]
const [sizeMin, setSizeMin] = useState('')
const [sizeMax, setSizeMax] = useState('')
const [sizeRingSling, setSizeRingSling] = useState(false)
const [selectedTypes, setSelectedTypes] = useState<string[]>([])
const [showTypeFilter, setShowTypeFilter] = useState(false)
const TYPE_TAGS = ['Hand Woven', 'Machine Woven', 'Ring Sling', 'Carrier']
const [brandSearch, setBrandSearch] = useState('')
const [brandSearchResults, setBrandSearchResults] = useState<string[]>([])
const [selectedBrands, setSelectedBrands] = useState<string[]>([])
const EXPLORE_COLOUR_TAGS = [
  'White/Cream', 'Grey', 'Black', 'Brown/Tan', 'Pink/Blush',
  'Red/Burgundy', 'Orange/Rust', 'Yellow/Mustard', 'Green', 'Teal/Petrol',
  'Blue', 'Navy', 'Purple', 'Rainbow', 'Multi/Variegated', 'Natural/Undyed'
]
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterOptions, setFilterOptions] = useState<{
    brands: string[]
    sizes: string[]
    colours: string[]
    materials: string[]
  }>({ brands: [], sizes: [], colours: [], materials: [] })
const [loading, setLoading] = useState(false)
const [searchLoading, setSearchLoading] = useState(false)
const [latestWraps, setLatestWraps] = useState<Wrap[]>([])
const [searchWraps, setSearchWraps] = useState<Wrap[]>([])
const [users, setUsers] = useState<ExploreUser[]>([])
const [searchUsers, setSearchUsers] = useState<ExploreUser[]>([])
const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([])
const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({})
const [selectedWrap, setSelectedWrap] = useState<Wrap | null>(null)
const [selectedViewImage, setSelectedViewImage] = useState<string | null>(null)
const [isViewWrapModalOpen, setIsViewWrapModalOpen] = useState(false)
const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
const [selectedWrapCounts, setSelectedWrapCounts] = useState<SocialCounts>({
  likes: 0,
  wishlists: 0,
})
const [hasLikedSelectedWrap, setHasLikedSelectedWrap] = useState(false)
const [hasWishlistedSelectedWrap, setHasWishlistedSelectedWrap] = useState(false)
const [socialLoading, setSocialLoading] = useState(false)
const [currentUserId, setCurrentUserId] = useState<string | null>(null)
const [toastMessage, setToastMessage] = useState('')
const [activeDips, setActiveDips] = useState<{id: string, wrap_id: string | null, total_spots: number, price_per_spot: number, stage: string | null, facebook_group: string | null}[]>([])
const [allActiveDips, setAllActiveDips] = useState<{id: string, wrap_id: string | null, total_spots: number, price_per_spot: number, stage: string | null, facebook_group: string | null}[]>([])
const allActiveDipsRef = React.useRef<string[]>([])

  useEffect(() => {
  const cachedWraps = localStorage.getItem(EXPLORE_WRAPS_KEY)
  const cachedProfiles = localStorage.getItem(EXPLORE_PROFILES_KEY)
  const cachedUsers = localStorage.getItem(EXPLORE_USERS_KEY)
  const cachedFollowing = localStorage.getItem(EXPLORE_FOLLOWING_KEY)

  if (cachedWraps) {
    try {
      setLatestWraps(JSON.parse(cachedWraps))
      setLoading(false)
    } catch {}
  }

  if (cachedProfiles) {
    try {
      setProfilesMap(JSON.parse(cachedProfiles))
    } catch {}
  }

  if (cachedFollowing) {
    try {
      const following = JSON.parse(cachedFollowing)
      setFollowingUsers(following)
      if (cachedUsers) {
        try {
          const cachedUsersList = JSON.parse(cachedUsers)
          const cachedFollowedIds = new Set(following.map((u: FollowingUser) => u.id))
          const merged = [
            ...following,
            ...cachedUsersList.filter((u: ExploreUser) => !cachedFollowedIds.has(u.id)),
          ]
          setUsers(merged)
        } catch {}
      }
    } catch {}
  } else if (cachedUsers) {
    try {
      setUsers(JSON.parse(cachedUsers))
    } catch {}
  }

  const cachedAvatars = localStorage.getItem(EXPLORE_AVATARS_KEY)
  if (cachedAvatars) {
    try {
      setAvatarMap(JSON.parse(cachedAvatars))
    } catch {}
  }
async function loadActiveDips() {
      const { data } = await supabase
        .from('dips')
        .select('id, wrap_id, total_spots, price_per_spot, stage, facebook_group')
        .in('stage', ['interest', 'queue', 'live'])
        .eq('archived', false)
      const dips = (data as any[]) || []
      setAllActiveDips(dips)
      const dipWrapIds = dips.map((d: any) => d.wrap_id).filter(Boolean)
      allActiveDipsRef.current = dipWrapIds

      const dipSet = new Set(dipWrapIds)
      setLatestWraps((prev) => {
        if (prev.length === 0) return prev
        return [...prev].sort((a, b) => {
          const aDip = dipSet.has(a.id) ? 1 : 0
          const bDip = dipSet.has(b.id) ? 1 : 0
          return bDip - aDip
        })
      })
    }
    loadActiveDips()
    async function loadExploreData() {
  const {
    data: { user },
  } = await supabase.auth.getUser()

    const currentUserId = user?.id || null
  setCurrentUserId(currentUserId)

      const { data: wrapData, error: wrapError } = await supabase
        .from('wraps')
                .select(
          'id, user_id, name, brand, colour, size, material, wrap_type, description, purchase_date, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, wrap_images(id, image_url, is_primary, sort_order)'
        )
        .order('created_at', { ascending: false })

      if (wrapError) {
        console.error(wrapError)
        setLoading(false)
        return
      }

      const wraps = ((wrapData as Wrap[]) || []).filter(w => w.user_id !== currentUserId && w.status !== 'departed')

      // Initial unranked set — will be replaced with ranked version below
      const uniqueUserIds = [...new Set(wraps.map((wrap) => wrap.user_id))]

      if (uniqueUserIds.length === 0) {
  setUsers([])
  setFollowingUsers([])
  setProfilesMap({})
  setLoading(false)
  return
}

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', uniqueUserIds)

      if (profileError) {
        console.error(profileError)
        setUsers([])
        setProfilesMap({})
        setLoading(false)
        return
      }

      const profiles = (profileData as Profile[]) || []

      const profileMap = profiles.reduce<Record<string, Profile>>(
        (accumulator, profile) => {
          accumulator[profile.id] = profile
          return accumulator
        },
        {}
      )

      setProfilesMap(profileMap)
      localStorage.setItem(EXPLORE_PROFILES_KEY, JSON.stringify(profileMap))
localStorage.setItem(EXPLORE_PROFILES_KEY, JSON.stringify(profileMap))
const nextAvatarMap: Record<string, string | null> = {}
      profiles.forEach((p: any) => {
        nextAvatarMap[p.id] = p.avatar_url || null
      })
      setAvatarMap(nextAvatarMap)
      localStorage.setItem(EXPLORE_AVATARS_KEY, JSON.stringify(nextAvatarMap))
      const [{ data: wrapCountData }, { data: followsDataEarly }, { data: likesData }, { data: wishlistsData }] = await Promise.all([
  supabase.from('wraps').select('user_id').in('user_id', uniqueUserIds),
  currentUserId
    ? supabase.from('follows').select('following_id').eq('follower_id', currentUserId).eq('status', 'accepted')
    : Promise.resolve({ data: [] }),
  supabase.from('wrap_likes').select('wrap_id'),
  supabase.from('wishlists').select('wrap_id'),
])

// Build like + wishlist count maps
const likeCounts: Record<string, number> = {}
;(likesData || []).forEach((r: any) => {
  likeCounts[r.wrap_id] = (likeCounts[r.wrap_id] || 0) + 1
})
const wishlistCounts: Record<string, number> = {}
;(wishlistsData || []).forEach((r: any) => {
  wishlistCounts[r.wrap_id] = (wishlistCounts[r.wrap_id] || 0) + 1
})

const realWrapCounts: Record<string, number> = {}
;(wrapCountData || []).forEach((w: any) => {
  realWrapCounts[w.user_id] = (realWrapCounts[w.user_id] || 0) + 1
})

const earlyFollowingIds = new Set((followsDataEarly || []).map((f: any) => f.following_id))

const followingIdsSet = earlyFollowingIds

// Score and rank wraps
function scoreWrap(wrap: Wrap): number {
  const likes = likeCounts[wrap.id] || 0
  const wishlists = wishlistCounts[wrap.id] || 0
  const isForSale = wrap.for_sale ? 5 : 0
  const isDipping = allActiveDipsRef.current.includes(wrap.id) ? 1000 : 0
  const ageMs = Date.now() - new Date(wrap.created_at).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  const recency = Math.max(0, 10 - (ageDays / 3))
  const purchasePrice = (wrap as any).purchase_price || 0
  const priceScore = Math.min(10, purchasePrice / 300)
  return isDipping + (likes * 3) + (wishlists * 2) + isForSale + priceScore + recency
}

const rankedWraps = [...wraps].sort((a, b) => scoreWrap(b) - scoreWrap(a))
setLatestWraps(rankedWraps)
localStorage.setItem(EXPLORE_WRAPS_KEY, JSON.stringify(rankedWraps))

const usersFromWraps: ExploreUser[] = uniqueUserIds
  .map((userId) => {
    const userWraps = wraps.filter((wrap) => wrap.user_id === userId)
    const latestUserWrap = userWraps[0]
    const wrapCount = realWrapCounts[userId] || userWraps.length

    // Score each user
    const isFollowing = followingIdsSet.has(userId) ? 100 : 0
    const wrapScore = Math.min(wrapCount * 2, 40)
    const latestWrapDate = userWraps[0]?.created_at
    const ageDays = latestWrapDate ? (Date.now() - new Date(latestWrapDate).getTime()) / (1000 * 60 * 60 * 24) : 999
    const recency = Math.max(0, 10 - (ageDays / 7))
    const score = isFollowing + wrapScore + recency

    return {
      id: userId,
      name: getDisplayName(profileMap[userId]),
      image_url: getPrimaryImage(latestUserWrap),
      wrap_count: wrapCount,
      score,
    }
  })
  .sort((a, b) => b.score - a.score)
  .slice(0, 20)

      // 🔽 LOAD FOLLOWING USERS
if (currentUserId) {
  const { data: followsData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .eq('status', 'accepted')

  const followingIds = (followsData || []).map((f) => f.following_id)

  if (followingIds.length > 0) {
    const [{ data: followingProfiles }, { data: followingWrapData }, { data: followingCounts }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', followingIds),
      supabase.from('wraps').select('id, user_id, wrap_images(id, image_url, is_primary, sort_order)').in('user_id', followingIds).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('wraps').select('user_id').in('user_id', followingIds),
    ])

    const followingProfileMap: Record<string, any> = {}
    ;(followingProfiles || []).forEach((p: any) => { followingProfileMap[p.id] = p })

    const followingWrapsByUser: Record<string, any[]> = {}
    ;(followingWrapData || []).forEach((w: any) => {
      if (!followingWrapsByUser[w.user_id]) followingWrapsByUser[w.user_id] = []
      followingWrapsByUser[w.user_id].push(w)
    })

    const followingRealCounts: Record<string, number> = {}
    ;(followingCounts || []).forEach((w: any) => {
      followingRealCounts[w.user_id] = (followingRealCounts[w.user_id] || 0) + 1
    })

    const followingAvatarMap: Record<string, string | null> = {}
    ;(followingProfiles || []).forEach((p: any) => {
      followingAvatarMap[p.id] = p.avatar_url || null
    })
    setAvatarMap((prev) => ({ ...prev, ...followingAvatarMap }))

    const followingUsersData: FollowingUser[] = followingIds.map((id) => {
      const userWraps = followingWrapsByUser[id] || []
      return {
        id,
        name: getDisplayName(followingProfileMap[id]),
        image_url: getPrimaryImage(userWraps[0]),
        wrap_count: followingRealCounts[id] || 0,
      }
    }).filter((u) => followingProfileMap[u.id])

    setFollowingUsers(followingUsersData)
    localStorage.setItem(EXPLORE_FOLLOWING_KEY, JSON.stringify(followingUsersData))

    const followedIds = new Set(followingUsersData.map((u: FollowingUser) => u.id))
    const mergedUsers: ExploreUser[] = [
      ...followingUsersData,
      ...usersFromWraps.filter((u: ExploreUser) => !followedIds.has(u.id)),
    ]
    setUsers(mergedUsers)
    localStorage.setItem(EXPLORE_USERS_KEY, JSON.stringify(mergedUsers))
  } else {
    setFollowingUsers([])
    setUsers(usersFromWraps)
    localStorage.setItem(EXPLORE_USERS_KEY, JSON.stringify(usersFromWraps))
  }
} else {
  setFollowingUsers([])
  setUsers(usersFromWraps)
  localStorage.setItem(EXPLORE_USERS_KEY, JSON.stringify(usersFromWraps))
}

setLoading(false)
    }

    loadExploreData()
async function loadFilterOptions() {
  const { data } = await supabase
    .from('wraps')
    .select('size, colour, material')

  const wraps = (data as any[]) || []

  const unique = (key: string) => {
    const seen = new Map<string, string>()
    wraps.forEach((w) => {
      const val = w[key]
      if (val && !seen.has(val.toLowerCase())) {
        seen.set(val.toLowerCase(), val)
      }
    })
    return [...seen.values()].sort()
  }

  setFilterOptions({
    brands: [],
    sizes: unique('size'),
    colours: unique('colour'),
    materials: unique('material'),
  })
}

loadFilterOptions()
const handleFocus = () => {
  loadExploreData()
}

window.addEventListener('focus', handleFocus)

return () => {
  window.removeEventListener('focus', handleFocus)
}
  }, [])

      useEffect(() => {
    const term = searchTerm.trim()

    if (!term) {
      setSearchUsers([])
      setSearchWraps([])
      setSearchLoading(false)
      return
    }

            setSearchLoading(true)

    const timeout = setTimeout(async () => {

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(20)

      if (profileError) {
        console.error(profileError)
        setSearchUsers([])
      } else {
                const matchedProfiles = (profileData as Profile[]) || []
        const matchedUserIds = matchedProfiles.map((profile) => profile.id)

        let matchedUsers: ExploreUser[] = matchedProfiles
          .filter((profile) => profile.id !== currentUserId && profile.id !== null)
          .map((profile) => ({
            id: profile.id,
            name: getDisplayName(profile),
            image_url: WRAP_PLACEHOLDER,
            wrap_count: 0,
          }))

        if (matchedUserIds.length > 0) {
          const { data: searchUserWrapData } = await supabase
            .from('wraps')
            .select(
              'id, user_id, name, brand, description, colour, wrap_type, purchase_date, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, wrap_images(id, image_url, is_primary, sort_order)'
            )
            .in('user_id', matchedUserIds)
            .order('created_at', { ascending: false })

          const searchUserWraps = (searchUserWrapData as Wrap[]) || []

          const searchUserIds = matchedProfiles.map((p) => p.id)
const { data: searchCountData } = await supabase
  .from('wraps')
  .select('user_id')
  .in('user_id', searchUserIds)

const searchRealCounts: Record<string, number> = {}
;(searchCountData || []).forEach((w: any) => {
  searchRealCounts[w.user_id] = (searchRealCounts[w.user_id] || 0) + 1
})

matchedUsers = matchedProfiles.map((profile) => {
  const userWraps = searchUserWraps.filter((wrap) => wrap.user_id === profile.id)
  const latestUserWrap = userWraps[0]

  return {
    id: profile.id,
    name: getDisplayName(profile),
    image_url: getPrimaryImage(latestUserWrap),
    wrap_count: searchRealCounts[profile.id] || userWraps.length,
  }
})
        }

        setSearchUsers(matchedUsers)
      }

      const { data: wrapData, error: wrapError } = await supabase
        .from('wraps')
        .select(
          'id, user_id, name, brand, description, colour, wrap_type, purchase_date, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, wrap_images(id, image_url, is_primary, sort_order)'
        )
        .or(`name.ilike.%${term}%,brand.ilike.%${term}%,colour.ilike.%${term}%,description.ilike.%${term}%`)
        .order('created_at', { ascending: false })

      if (wrapError) {
        console.error(wrapError)
        setSearchWraps([])
        setSearchLoading(false)
        return
      }

      const wraps = (wrapData as Wrap[]) || []
      const wrapUserIds = [...new Set(wraps.map((wrap) => wrap.user_id))]

      let wrapProfilesMap: Record<string, Profile> = { ...profilesMap }

      if (wrapUserIds.length > 0) {
        const { data: ownerProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, username')
          .in('id', wrapUserIds)

        const ownerMap = ((ownerProfiles as Profile[]) || []).reduce<Record<string, Profile>>(
          (accumulator, profile) => {
            accumulator[profile.id] = profile
            return accumulator
          },
          {}
        )

        wrapProfilesMap = { ...wrapProfilesMap, ...ownerMap }
        setProfilesMap(wrapProfilesMap)
      }

      const lowerTerm = term.toLowerCase()

      const wrapsWithOwnerMatch = wraps.filter((wrap) => {
  if (wrap.user_id === currentUserId) return false
  if (forSaleOnly && !wrap.for_sale) return false
        const ownerName = getDisplayName(wrapProfilesMap[wrap.user_id]).toLowerCase()

        return (
          wrap.name.toLowerCase().includes(lowerTerm) ||
          (wrap.brand || '').toLowerCase().includes(lowerTerm) ||
                    (wrap.description || '').toLowerCase().includes(lowerTerm) ||
          ((wrap as any).colour || '').toLowerCase().includes(lowerTerm) ||
          ownerName.includes(lowerTerm)
        )
      })

            const sortedSearchWraps = [...wrapsWithOwnerMatch].sort((a, b) => {
        if (a.for_sale === b.for_sale) return 0
        return a.for_sale ? -1 : 1
      })

      setSearchWraps(sortedSearchWraps)
      setSearchLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
    }, [searchTerm, profilesMap, forSaleOnly])

  const baseUsers = searchTerm.trim() ? searchUsers : users
const baseWraps = searchTerm.trim() ? searchWraps : latestWraps

const filteredUsers =
  resultType === 'wraps' || resultType === 'for-sale'
    ? []
    : baseUsers

const activeDipWrapIds = new Set(allActiveDips.map(d => d.wrap_id).filter(Boolean))
const filteredWraps = (
  resultType === 'users'
    ? []
    : resultType === 'for-sale'
    ? baseWraps.filter((wrap) => wrap.for_sale || activeDipWrapIds.has(wrap.id))
    : (resultType as any) === 'dipping'
    ? baseWraps.filter((wrap) => activeDipWrapIds.has(wrap.id))
    : baseWraps
).filter((wrap) => {
  if (filterBrand) {
    const selectedBrandList = filterBrand.split(',').map(b => b.trim().toLowerCase()).filter(Boolean)
    const wrapBrand = (wrap.brand || '').toLowerCase()
    if (!selectedBrandList.some(b => wrapBrand.includes(b))) return false
  }
  if (sizeMin || sizeMax || sizeRingSling) {
    const wrapSize = ((wrap as any).size || '').trim()
    if (wrapSize === 'Ring Sling') {
      if (!sizeRingSling) return false
    } else {
      const wrapSizeNum = parseFloat(wrapSize)
      if (isNaN(wrapSizeNum)) return false
      if (sizeMin && wrapSizeNum < parseFloat(sizeMin)) return false
      if (sizeMax && wrapSizeNum > parseFloat(sizeMax)) return false
    }
  }
  if (filterColour) {
    const selectedColours = filterColour.split(',').map(c => c.trim().toLowerCase()).filter(Boolean)
    const wrapColour = ((wrap as any).colour || '').toLowerCase()
    const matches = selectedColours.some(c => {
      const baseColour = c.split('/')[0].trim()
      return wrapColour.includes(baseColour)
    })
    if (!matches) return false
  }
  if (selectedBlends.length > 0) {
    const wrapMaterial = ((wrap as any).material || '').toLowerCase()
    const matches = selectedBlends.some(b => wrapMaterial.includes(b.toLowerCase().split('/')[0].trim()))
    if (!matches) return false
  }
  if (selectedTypes.length > 0) {
    const wrapType = ((wrap as any).wrap_type || '').toLowerCase()
    if (!selectedTypes.some(t => wrapType === t.toLowerCase())) return false
  }
  return true
})
  const hasSearch = searchTerm.trim().length > 0
  const noResults =
    !loading &&
    !searchLoading &&
    hasSearch &&
    filteredUsers.length === 0 &&
    filteredWraps.length === 0
  return (
    <AppLayout>
      <div className="space-y-2">
        <section className="sticky top-0 z-40 rounded-xl bg-white px-3 pt-1.5 pb-1.5 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 leading-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <circle cx="11" cy="11" r="8"></circle>
                  <path d="m21 21-4.3-4.3"></path>
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search wraps or collectors"
                className="w-full rounded-lg border pl-9 pr-3 py-1.5 text-[16px] text-gray-900 outline-none focus:border-pink-500"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilterSheet(true)}
              className={`relative shrink-0 rounded-xl border px-3 py-1.5 text-sm font-semibold transition ${
                (filterBrand || sizeMin || sizeMax || sizeRingSling || filterColour || selectedBlends.length > 0 || selectedTypes.length > 0 || resultType !== 'all')
                  ? 'border-pink-500 bg-pink-500 text-white'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
                <line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
            </button>
          </div>
        </section>

        {/* Filter bottom sheet */}
        {showFilterSheet && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setShowFilterSheet(false)}>
            <div className="w-full max-w-lg rounded-t-3xl bg-white px-4 pt-4 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
              {/* Handle */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">Filter</h3>
                <button type="button" onClick={() => setShowFilterSheet(false)} className="text-sm text-gray-500">Done</button>
              </div>

              {/* View tabs row 1 */}
              <div className="flex gap-1.5 mb-2">
                {(['all', 'wraps', 'users', 'for-sale'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setResultType(type)}
                    className={`flex-1 rounded-full border py-1.5 text-xs font-semibold ${resultType === type ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-200 bg-white text-gray-600'}`}
                  >
                    {type === 'all' ? 'All' : type === 'wraps' ? 'Wraps' : type === 'users' ? 'Users' : 'Available'}
                  </button>
                ))}
              </div>

              {/* Filter row 2 */}
              <div className="flex gap-1.5 mb-4">
                {[
                  { label: selectedTypes.length > 0 ? `Type (${selectedTypes.length})` : 'Type', key: 'type' },
                  { label: selectedBrands.length > 0 ? `Brands (${selectedBrands.length})` : 'Brands', key: 'brand' },
                  { label: sizeMin || sizeMax ? 'Length ✓' : 'Length', key: 'size' },
                  { label: filterColour ? `Colours (${filterColour.split(',').filter(Boolean).length})` : 'Colours', key: 'colour' },
                  { label: selectedBlends.length > 0 ? `Blends (${selectedBlends.length})` : 'Blends', key: 'blend' },
                ].map(({ label, key }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setShowBrandFilter(key === 'brand' ? !showBrandFilter : false)
                      setShowSizeFilter(key === 'size' ? !showSizeFilter : false)
                      setShowColourFilter(key === 'colour' ? !showColourFilter : false)
                      setShowBlendFilter(key === 'blend' ? !showBlendFilter : false)
                      setShowTypeFilter(key === 'type' ? !showTypeFilter : false)
                    }}
                    className={`flex-1 rounded-full border py-1.5 text-[10px] font-semibold ${
                      (() => {
                        if (key === 'brand' && selectedBrands.length > 0) return 'border-pink-500 bg-pink-50 text-pink-700'
                        if (key === 'size' && (sizeMin || sizeMax)) return 'border-pink-500 bg-pink-50 text-pink-700'
                        if (key === 'colour' && filterColour) return 'border-pink-500 bg-pink-50 text-pink-700'
                        if (key === 'blend' && selectedBlends.length > 0) return 'border-pink-500 bg-pink-50 text-pink-700'
                        if (key === 'type' && selectedTypes.length > 0) return 'border-pink-500 bg-pink-50 text-pink-700'
                        return 'border-gray-200 bg-white text-gray-600'
                      })()
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Expanded filters */}
              <div className="space-y-3">
                {showBrandFilter && (
                  <div className="space-y-2">
                    {selectedBrands.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedBrands.map((brand) => (
                          <button key={brand} type="button" onClick={() => { const updated = selectedBrands.filter(b => b !== brand); setSelectedBrands(updated); setFilterBrand(updated.join(',')) }} className="rounded-full border border-pink-500 bg-pink-500 px-2.5 py-1 text-xs font-semibold text-white">{brand} ×</button>
                        ))}
                      </div>
                    )}
                    <input type="text" value={brandSearch} onChange={async (e) => { setBrandSearch(e.target.value); const term = e.target.value.trim(); if (!term) { setBrandSearchResults([]); return } const { data } = await supabase.from('wraps').select('brand').ilike('brand', `%${term}%`).limit(20); const seen = new Map<string, string>(); ((data as any[]) || []).forEach((w) => { if (w.brand && !seen.has(w.brand.toLowerCase())) seen.set(w.brand.toLowerCase(), w.brand) }); setBrandSearchResults([...seen.values()].sort().filter(b => !selectedBrands.includes(b))) }} placeholder="Search brands..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:border-pink-300" />
                    {brandSearchResults.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {brandSearchResults.map((brand) => (
                          <button key={brand} type="button" onClick={() => { const updated = [...selectedBrands, brand]; setSelectedBrands(updated); setFilterBrand(updated.join(',')); setBrandSearch(''); setBrandSearchResults([]) }} className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-600">{brand}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showSizeFilter && (
                  <div className="flex items-center gap-2">
                    <input type="number" step="0.1" min="2" max="6" value={sizeMin} onChange={(e) => setSizeMin(e.target.value)} placeholder="Min m" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:border-pink-300" />
                    <span className="text-xs text-gray-400">to</span>
                    <input type="number" step="0.1" min="2" max="6" value={sizeMax} onChange={(e) => setSizeMax(e.target.value)} placeholder="Max m" className="w-24 rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:border-pink-300" />
                    <span className="text-xs text-gray-400">meters</span>
                  </div>
                )}

                {showTypeFilter && (
                  <div className="flex flex-wrap gap-1.5">
                    {TYPE_TAGS.map((tag) => {
                      const selected = selectedTypes.includes(tag)
                      return <button key={tag} type="button" onClick={() => { const updated = selected ? selectedTypes.filter(t => t !== tag) : [...selectedTypes, tag]; setSelectedTypes(updated) }} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{tag}</button>
                    })}
                  </div>
                )}

                {showBlendFilter && (
                  <div className="flex flex-wrap gap-1.5">
                    {BLEND_TAGS.map((tag) => {
                      const selected = selectedBlends.includes(tag)
                      return <button key={tag} type="button" onClick={() => { const updated = selected ? selectedBlends.filter(b => b !== tag) : [...selectedBlends, tag]; setSelectedBlends(updated); setFilterMaterial(updated.join(',')) }} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{tag}</button>
                    })}
                  </div>
                )}

                {showColourFilter && (
                  <div className="flex flex-wrap gap-1.5">
                    {EXPLORE_COLOUR_TAGS.map((tag) => {
                      const selected = filterColour.split(',').map(c => c.trim()).filter(Boolean).includes(tag)
                      return <button key={tag} type="button" onClick={() => { const current = filterColour.split(',').map(c => c.trim()).filter(Boolean); const updated = selected ? current.filter(c => c !== tag) : [...current, tag]; setFilterColour(updated.join(', ')) }} className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selected ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-200 bg-white text-gray-600'}`}>{tag}</button>
                    })}
                  </div>
                )}

                {(filterBrand || sizeMin || sizeMax || sizeRingSling || filterColour || selectedBlends.length > 0 || selectedTypes.length > 0) && (
                  <button type="button" onClick={() => { setFilterBrand(''); setSelectedBrands([]); setBrandSearch(''); setBrandSearchResults([]); setFilterSize(''); setSizeMin(''); setSizeMax(''); setSizeRingSling(false); setFilterColour(''); setFilterMaterial(''); setSelectedBlends([]); setSelectedTypes([]) }} className="w-full rounded-full border border-red-200 px-3 py-2 text-xs font-semibold text-red-500">
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
                        {hasSearch && filteredUsers.length === 0 && filteredWraps.length === 0 && (
          <section className="rounded-xl border bg-white px-3 py-4 shadow-sm">
            <p className="text-center text-sm text-gray-500">
              {searchLoading ? 'Searching...' : 'No results found'}
            </p>
          </section>
        )}
        

        <section className="px-0 py-1">
          <div className="mb-2 px-0">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Collections</h2>
          </div>

          {loading && latestWraps.length === 0 ? (
            <p className="text-sm text-gray-500">Loading collections...</p>
                    ) : filteredUsers.length === 0 ? (
            !hasSearch && (
              <div className="rounded-lg border border-dashed px-3 py-4 text-center">
                <p className="text-sm text-gray-500">No collections found</p>
              </div>
            )
                    ) : (
            <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
              <div className="flex gap-2 sm:flex-wrap">
  {filteredUsers.map((user) => (
  <div key={user.id} className="relative">
    <button
                    type="button"
                    onClick={() => router.push(`/user/${user.id}`)}
                    className="flex w-[88px] shrink-0 cursor-pointer flex-col items-center rounded-xl border bg-white px-1.5 py-1.5 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    {avatarMap[user.id] ? (
                      <img
                        src={avatarMap[user.id]!}
                        loading="lazy"
                        alt={user.name}
                        className="mb-1 h-9 w-9 rounded-full object-cover pointer-events-none"
                      />
                    ) : (
                      <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-bold text-white pointer-events-none">
                        {user.name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}

                    <p className="line-clamp-1 text-xs font-semibold text-gray-900 pointer-events-none">
                      {user.name}
                    </p>

                    <p className="mt-0.5 text-[10px] text-gray-500 pointer-events-none">
  {user.wrap_count} wrap{user.wrap_count === 1 ? '' : 's'}
</p>
                  </button>

                  <button
  type="button"
  onClick={async (event) => {
    event.stopPropagation()

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()

    if (!currentUser || currentUser.id === user.id) return

    const isAlreadyFollowing = followingUsers.some(
      (followingUser) => followingUser.id === user.id
    )

    if (isAlreadyFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUser.id)
        .eq('following_id', user.id)

      if (error) {
  setToastMessage('Could not unfollow user')
  setTimeout(() => setToastMessage(''), 2000)
  return
}

setFollowingUsers((previous) =>
  previous.filter((followingUser) => followingUser.id !== user.id)
)

setToastMessage(`Unfollowed ${user.name}`)
setTimeout(() => setToastMessage(''), 2000)
return
    }

    const { error } = await supabase.from('follows').insert({
      follower_id: currentUser.id,
      following_id: user.id,
      status: 'accepted',
    })

    if (error) {
  setToastMessage('Could not follow user')
  setTimeout(() => setToastMessage(''), 2000)
  return
}

setFollowingUsers((previous) => [
  ...previous,
  {
    id: user.id,
    name: user.name,
    image_url: user.image_url,
    wrap_count: user.wrap_count,
  },
])

setToastMessage(`Following ${user.name}`)
setTimeout(() => setToastMessage(''), 2000)
  }}
  className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-semibold text-white shadow ${
    followingUsers.some((followingUser) => followingUser.id === user.id)
      ? 'bg-gray-500'
      : 'bg-pink-600'
  }`}
>
  {followingUsers.some((followingUser) => followingUser.id === user.id)
    ? 'Following'
    : 'Follow'}
</button>
                </div>
              ))}
              </div>
            </div>
          )}
        </section>

        <section className="px-0 py-1">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Featured Wraps</h2>
          </div>

          {loading && latestWraps.length === 0 ? (
            <p className="text-sm text-gray-500">Loading wraps...</p>
                    ) : filteredWraps.length === 0 ? (
            !hasSearch && (
              <div className="rounded-lg border border-dashed px-3 py-4 text-center">
                <p className="text-sm text-gray-500">No wraps found</p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
              {filteredWraps.map((wrap) => (
                <button
                  key={wrap.id}
                  type="button"
                                    onClick={() => openViewWrapModal(wrap)}
                  className="group flex cursor-pointer flex-col overflow-hidden rounded-lg border bg-white text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md hover:cursor-pointer"
                  style={{ cursor: 'pointer' }}
                  title="Open wrap"
                >
                  <div className="relative aspect-[3/4] w-full bg-gray-100" style={{ cursor: 'pointer' }}>
                    <img style={{ cursor: 'pointer' }}
  src={getPrimaryImage(wrap)}
  loading="lazy"
                      alt={wrap.name}
                      className="h-full w-full object-cover object-[center_20%] transition duration-300 group-hover:scale-[1.03] pointer-events-none"
                    />

                    {wrap.for_sale && (
                      <div className="absolute left-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-semibold text-amber-700 shadow pointer-events-none">
                        🪓 For Sale
                      </div>
                    )}
                    {activeDipWrapIds.has(wrap.id) && (() => {
                      const wrapDip = allActiveDips.find((d) => d.wrap_id === wrap.id)
                      const groupName = wrapDip?.facebook_group
                      return (
                        <div className="absolute inset-x-0 top-0 bg-purple-600/95 px-2 py-1.5 text-center text-xs font-bold text-white shadow pointer-events-none">
                          🎲 {groupName ? `Dipping on ${groupName}` : 'Being Dipped'}
                        </div>
                      )
                    })()}

                    
                  </div>

                  <div className="px-2 py-1.5">
                    <h3 className="line-clamp-1 text-sm font-bold text-gray-900 pointer-events-none">
                      {wrap.name}
                    </h3>
                    <p className="line-clamp-1 text-xs text-gray-500 pointer-events-none">
                      {wrap.brand || ''}
                    </p>
                    <span
                      onClick={(event) => {
                        event.stopPropagation()
                        router.push(`/user/${wrap.user_id}`)
                      }}
                      className="mt-1 inline-flex cursor-pointer items-center rounded-full bg-pink-50 px-2 py-0.5 text-xs font-semibold text-pink-600 hover:bg-pink-100"
                    >
                      {getDisplayName(profilesMap[wrap.user_id])}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
                {isViewWrapModalOpen && selectedWrap && (() => {
          const sortedImages = [...(selectedWrap.wrap_images || [])].sort(
            (a, b) => a.sort_order - b.sort_order
          )

          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={closeViewWrapModal}
            >
              <div
                className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                               <div className="mb-6 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-gray-900">
                        {selectedWrap.name}
                      </h2>

                      {currentUserId && currentUserId !== selectedWrap.user_id && (
                        <>
                          <button
                            type="button"
                            onClick={handleToggleLike}
                            disabled={socialLoading}
                            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                              hasLikedSelectedWrap
                                ? 'border-pink-200 bg-pink-50 text-pink-600'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-pink-200 hover:text-pink-600'
                            }`}
                          >
                            ❤️ {selectedWrapCounts.likes}
                          </button>

                          <button
                            type="button"
                            onClick={handleToggleWishlist}
                            disabled={socialLoading}
                            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                              hasWishlistedSelectedWrap
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-amber-200 hover:text-amber-700'
                            }`}
                          >
                            ⭐ {selectedWrapCounts.wishlists}
                          </button>
                        </>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          closeViewWrapModal()
                          router.push(`/user/${selectedWrap.user_id}`)
                        }}
                        className="inline-flex items-center rounded-full bg-pink-50 px-2 py-1 text-xs font-semibold text-pink-600 hover:bg-pink-100"
                      >
                        {getDisplayName(profilesMap[selectedWrap.user_id])}
                      </button>
                      <span className="text-gray-300">·</span>
                      <p className="text-sm text-gray-500">
                        {selectedWrap.brand || 'No brand added'}
                      </p>

                      {selectedWrap.is_favourite && (
                        <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-semibold text-pink-600">
                          ★ Perma
                        </span>
                      )}

                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {selectedWrap.status}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedWrap.for_sale && currentUserId && currentUserId !== selectedWrap.user_id && (
                      <button
                        type="button"
                        onClick={async () => {
                          const enquiryMessage = `Hi! I'm interested in your ${selectedWrap.name}${selectedWrap.brand ? ` by ${selectedWrap.brand}` : ''} — is it still available?`
                          const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${selectedWrap.user_id}),and(participant_1_id.eq.${selectedWrap.user_id},participant_2_id.eq.${currentUserId})`).maybeSingle()
                          if (existing) {
                            closeViewWrapModal()
                            router.push(`/messages/${existing.id}?prefill=${encodeURIComponent(enquiryMessage)}`)
                            return
                          }
                          const { data: newConv } = await supabase.from('conversations').insert({ participant_1_id: currentUserId, participant_2_id: selectedWrap.user_id, last_message: null, last_message_at: new Date().toISOString() }).select('id').single()
                          if (newConv) { closeViewWrapModal(); router.push(`/messages/${newConv.id}?prefill=${encodeURIComponent(enquiryMessage)}`) }
                        }}
                        className="cursor-pointer rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition whitespace-nowrap"
                      >
                        Contact Seller
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={closeViewWrapModal}
                      className="cursor-pointer rounded-full border px-3 py-1 text-sm text-gray-600"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="mb-4 overflow-hidden rounded-3xl bg-gray-100 shadow-sm">
                  <button
                    type="button"
                    onClick={() => setIsImagePreviewOpen(true)}
                    className="block w-full cursor-zoom-in bg-black"
                  >
                    <img
  src={selectedViewImage || getPrimaryImage(selectedWrap)}
  loading="lazy"
                      alt={selectedWrap.name}
                      className="h-[440px] w-full object-cover transition duration-300 hover:scale-[1.01]"
                    />
                  </button>
                </div>

                <p className="mb-4 text-xs text-gray-500">
                  Click the main image to view larger
                </p>

                {sortedImages.length > 0 && (
                  <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {sortedImages.map((image) => (
                      <button
                        key={image.id}
                        type="button"
                        onClick={() => setSelectedViewImage(image.image_url)}
                        className={`overflow-hidden rounded-xl border transition duration-200 ${
                          selectedViewImage === image.image_url
                            ? 'border-pink-500 ring-2 ring-pink-200 shadow-sm'
                            : 'border-gray-200 hover:border-pink-300 hover:shadow-sm'
                        }`}
                      >
                        <img
                          src={image.image_url}
                          alt={selectedWrap.name}
                          className="h-20 w-full object-cover transition duration-200 hover:scale-[1.02]"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {(() => {
                  const dip = activeDips.find(d => d.wrap_id === selectedWrap.id)
                  if (!dip) return null
                  const stageLabel: Record<string, string> = { interest: 'Interest', queue: 'In Queue', live: 'Live 🔥', payments: 'Collecting Payments', closed: 'Closed' }
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
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Wrap Details
                    </h3>

                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold text-gray-900">Brand:</span>{' '}
                        {selectedWrap.brand || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">STIH (length):</span>{' '}
                        {(selectedWrap as any).size || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">Blend:</span>{' '}
                        {(selectedWrap as any).material || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">Colour:</span>{' '}
                        {(selectedWrap as any).colour || '—'}
                      </p>
                      
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Extra Info
                    </h3>

                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold text-gray-900">Favourite:</span>{' '}
                        {selectedWrap.is_favourite ? 'Yes' : 'No'}
                      </p>

                      {selectedWrap.for_sale && (
                        <p>
                          <span className="font-semibold text-gray-900">For Sale:</span>{' '}
                          {selectedWrap.for_sale_price_is_pm
                            ? 'PM'
                            : selectedWrap.for_sale_price !== null
                            ? formatCurrency(
                                selectedWrap.for_sale_price,
                                selectedWrap.for_sale_currency || 'AUD'
                              )
                            : 'Yes'}
                        </p>
                      )}

                      {selectedWrap.status === 'holiday' && (
                        <p>
                          <span className="font-semibold text-gray-900">On Holiday With:</span>{' '}
                          {selectedWrap.on_loan_to || '—'}
                        </p>
                      )}

                      {selectedWrap.status === 'departed' && (
                        <>
                          <p>
                            <span className="font-semibold text-gray-900">Sold To:</span>{' '}
                            {selectedWrap.sold_to || '—'}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">Sold Date:</span>{' '}
                            {selectedWrap.sold_date || '—'}
                          </p>
                          <p>
                            <span className="font-semibold text-gray-900">Sold Price:</span>{' '}
                            {selectedWrap.sold_price !== null
                              ? formatCurrency(
                                  selectedWrap.sold_price,
                                  selectedWrap.sold_currency || 'AUD'
                                )
                              : '—'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  {selectedWrap.description && (
                    <div className="md:col-span-2 rounded-2xl border bg-white p-5 shadow-sm">
                      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                        Description
                      </h3>
                      <p className="whitespace-pre-wrap text-sm text-gray-700">
                        {selectedWrap.description}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {isImagePreviewOpen && selectedWrap && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-6xl">
              <button
                type="button"
                onClick={() => setIsImagePreviewOpen(false)}
                className="absolute right-0 top-0 z-10 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-800 shadow"
              >
                Close
              </button>

              <img
  src={selectedViewImage || getPrimaryImage(selectedWrap)}
  loading="lazy"
                alt={selectedWrap.name}
                className="max-h-[90vh] w-full rounded-2xl bg-black object-contain"
              />
            </div>
          </div>
        )}
      </div>
    {toastMessage && (
  <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
    <div className="rounded-2xl border border-white/20 bg-gray-900/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur">
      {toastMessage}
    </div>
  </div>
)}
</AppLayout>
  )
}