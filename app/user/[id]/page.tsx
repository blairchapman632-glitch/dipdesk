'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/app/components/AppLayout'

type WrapImage = {
  id: string
  image_url: string
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
  purchase_date: string | null
  purchased_from: string | null
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

type WDYWTPost = {
  id: string
  user_id: string
  photo_url: string
  caption: string | null
  created_at: string
  wdywt_likes: { id: string }[]
  wdywt_comments: { id: string }[]
}

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: { full_name: string | null, username: string | null, avatar_url: string | null } | null
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
  if (!wrap?.wrap_images?.length) return WRAP_PLACEHOLDER
  const primary = wrap.wrap_images.find((image) => image.is_primary) || [...wrap.wrap_images].sort((a, b) => a.sort_order - b.sort_order)[0]
  return primary?.image_url || WRAP_PLACEHOLDER
}

function timeAgo(dateString: string) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000))
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
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
  const [toastMessage, setToastMessage] = useState('')
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null)
  const [selectedWrap, setSelectedWrap] = useState<Wrap | null>(null)
  const [selectedViewImage, setSelectedViewImage] = useState<string | null>(null)
  const [isViewWrapModalOpen, setIsViewWrapModalOpen] = useState(false)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
  const [selectedWrapCounts, setSelectedWrapCounts] = useState<SocialCounts>({ likes: 0, wishlists: 0 })
  const [activeTab, setActiveTab] = useState<'collection' | 'wdywt'>('collection')
  const [wdywtPosts, setWdywtPosts] = useState<WDYWTPost[]>([])
  const [wdywtLoaded, setWdywtLoaded] = useState(false)
  const [stats, setStats] = useState<{ followers: number, following: number, wraps: number, bio: string | null }>({ followers: 0, following: 0, wraps: 0, bio: null })
  const [hasLikedSelectedWrap, setHasLikedSelectedWrap] = useState(false)
  const [hasWishlistedSelectedWrap, setHasWishlistedSelectedWrap] = useState(false)
  const [socialLoading, setSocialLoading] = useState(false)
  const [activeDips, setActiveDips] = useState<{id: string, title: string, wrap_id: string | null, total_spots: number, price_per_spot: number, stage: string | null, wrap_name: string | null, brand: string | null}[]>([])

  // WDYWT post modal
  const [selectedPost, setSelectedPost] = useState<WDYWTPost | null>(null)
  const [postComments, setPostComments] = useState<Comment[]>([])
  const [postCommentsLoading, setPostCommentsLoading] = useState(false)
  const [postCommentText, setPostCommentText] = useState('')
  const [postCommentSending, setPostCommentSending] = useState(false)
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!userId) return

    // Load all caches instantly
    const cachedWraps = localStorage.getItem(getUserCollectionWrapsKey(userId))
    if (cachedWraps) { try { setWraps(JSON.parse(cachedWraps)); setLoading(false) } catch {} }

    const cachedProfile = localStorage.getItem(getUserCollectionProfileKey(userId))
    if (cachedProfile) { try { setProfile(JSON.parse(cachedProfile)) } catch {} }

    const cachedFollow = localStorage.getItem(getUserCollectionFollowKey(userId))
    if (cachedFollow) { try { setIsFollowing(JSON.parse(cachedFollow)) } catch {} }

    const cachedAvatar = localStorage.getItem(getUserCollectionAvatarKey(userId))
    if (cachedAvatar) { try { setProfileAvatar(JSON.parse(cachedAvatar)) } catch {} }

    const cachedStats = localStorage.getItem(getUserCollectionStatsKey(userId))
    if (cachedStats) { try { setStats(JSON.parse(cachedStats)) } catch {} }

    const cachedWdywt = localStorage.getItem(`dipdesk_user_wdywt_${userId}`)
    if (cachedWdywt) { try { setWdywtPosts(JSON.parse(cachedWdywt)); setWdywtLoaded(true) } catch {} }

    const savedTab = sessionStorage.getItem(`profile_tab_${userId}`)
    if (savedTab === 'wdywt' || savedTab === 'collection') setActiveTab(savedTab)

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const loggedInUserId = user?.id || null
      setCurrentUserId(loggedInUserId)

      const [{ data: profileData }, { data: wrapData }] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', userId).single(),
        supabase.from('wraps').select('id, name, brand, size, material, colour, purchase_date, purchased_from, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, wrap_images(id, image_url, is_primary, sort_order)').eq('user_id', userId).order('is_favourite', { ascending: false }).order('purchase_date', { ascending: false }),
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
        supabase.from('wraps').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'active'),
        supabase.from('profiles').select('bio').eq('id', userId).single(),
      ])
      const nextStats = { followers: followerCount || 0, following: followingCount || 0, wraps: wrapCount || 0, bio: (bioData as any)?.bio || null }
      setStats(nextStats)
      localStorage.setItem(getUserCollectionStatsKey(userId), JSON.stringify(nextStats))

      const { data: wdywtData } = await supabase.from('wdywt_posts').select('id, photo_url, caption, created_at, wdywt_likes(id), wdywt_comments(id)').eq('user_id', userId).order('created_at', { ascending: false })
      if (wdywtData) {
        setWdywtPosts(wdywtData as WDYWTPost[])
        setWdywtLoaded(true)
        localStorage.setItem(`dipdesk_user_wdywt_${userId}`, JSON.stringify(wdywtData))
      }
const { data: dipData } = await supabase
        .from('dips')
        .select('id, title, wrap_id, total_spots, price_per_spot, stage, wrap_name, brand')
        .eq('user_id', userId)
        .not('stage', 'in', '("drawn")')
        .eq('archived', false)
      setActiveDips((dipData as any[]) || [])
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

  async function openPostModal(post: WDYWTPost) {
    setSelectedPost(post)
    setPostCommentText('')
    setPostCommentsLoading(true)

    const cached = sessionStorage.getItem(`wdywt_comments_${post.id}`)
    if (cached) { try { setPostComments(JSON.parse(cached)); setPostCommentsLoading(false) } catch {} }

    const { data } = await supabase.from('wdywt_comments').select('id, user_id, content, created_at').eq('post_id', post.id).order('created_at', { ascending: true })
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map((c: any) => c.user_id))]
      const { data: profileData } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
      const profileMap: Record<string, any> = {}
      ;(profileData || []).forEach((p: any) => { profileMap[p.id] = p })
      const normalized = data.map((c: any) => ({ ...c, profiles: profileMap[c.user_id] || null }))
      setPostComments(normalized)
      sessionStorage.setItem(`wdywt_comments_${post.id}`, JSON.stringify(normalized))
    } else {
      setPostComments([])
    }
    setPostCommentsLoading(false)
  }

  async function handlePostComment() {
    if (!postCommentText.trim() || !currentUserId || !selectedPost || postCommentSending) return
    setPostCommentSending(true)

    const { data, error } = await supabase.from('wdywt_comments').insert({ post_id: selectedPost.id, user_id: currentUserId, content: postCommentText.trim() }).select('id, user_id, content, created_at').single()
    if (!error && data) {
      const { data: pd } = await supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', currentUserId).single()
      const newComments = [...postComments, { ...data, profiles: pd || null }]
      setPostComments(newComments)
      sessionStorage.setItem(`wdywt_comments_${selectedPost.id}`, JSON.stringify(newComments))
      setPostCommentText('')
      setWdywtPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, wdywt_comments: [...p.wdywt_comments, { id: data.id }] } : p))
      if (selectedPost.user_id !== currentUserId) {
        await supabase.from('notifications').insert({ recipient_user_id: userId, actor_user_id: currentUserId, type: 'comment' })
      }
    }
    setPostCommentSending(false)
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
    const sortedImages = [...(wrap.wrap_images || [])].sort((a, b) => a.sort_order - b.sort_order)
    const primaryImage = sortedImages.find(i => i.is_primary)?.image_url || sortedImages[0]?.image_url || getPrimaryImage(wrap)
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
            url: '/dashboard',
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
            url: '/dashboard',
          }),
        }).catch(() => {})
      }
    }
    setSocialLoading(false)
  }

  if (loading && wraps.length === 0 && !profile) {
    return <AppLayout><div className="space-y-6"><section className="rounded-3xl border bg-white p-5 shadow-sm"><p className="text-sm text-gray-500">Loading collection...</p></section></div></AppLayout>
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-2 shadow-sm xl:p-5">

          {/* Profile header */}
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex items-center gap-3">
                {profileAvatar ? (
                  <img src={profileAvatar} alt={collectionTitle} className="h-14 w-14 rounded-full object-cover ring-2 ring-pink-200 shrink-0" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-lg font-bold text-white ring-2 ring-pink-200">
                    {profile?.full_name?.[0]?.toUpperCase() || profile?.username?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{collectionTitle}</h1>
                  {stats.bio && <p className="text-sm text-gray-600 mt-0.5">{stats.bio}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-500"><span className="font-bold text-gray-900">{stats.wraps}</span> wraps</span>
                    <span className="text-xs text-gray-500"><span className="font-bold text-gray-900">{stats.followers}</span> followers</span>
                    <span className="text-xs text-gray-500"><span className="font-bold text-gray-900">{stats.following}</span> following</span>
                  </div>
                </div>
              </div>
            </div>

            {currentUserId !== userId && (
              <div className="flex gap-2 xl:shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentUserId) return
                    const { data: existing } = await supabase.from('conversations').select('id').or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${userId}),and(participant_1_id.eq.${userId},participant_2_id.eq.${currentUserId})`).maybeSingle()
                    if (existing) { router.push(`/messages/${existing.id}`); return }
                    const { data: newConv } = await supabase.from('conversations').insert({ participant_1_id: currentUserId, participant_2_id: userId, last_message: null, last_message_at: new Date().toISOString() }).select('id').single()
                    if (newConv) router.push(`/messages/${newConv.id}`)
                  }}
                  className="flex-1 xl:flex-none cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm bg-gray-800 hover:bg-gray-900"
                >
                  💬 Message
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!currentUserId) return
                    if (isFollowing) {
                      await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', userId)
                      setIsFollowing(false)
                      setToastMessage(`Unfollowed ${profile?.full_name?.split(' ')[0] || 'user'}`)
                    } else {
                      await supabase.from('follows').insert({ follower_id: currentUserId, following_id: userId, status: 'accepted' })
                      setIsFollowing(true)
                      setToastMessage(`Following ${profile?.full_name?.split(' ')[0] || 'user'}`)
                    }
                    setTimeout(() => setToastMessage(''), 2000)
                  }}
                  className={`flex-1 xl:flex-none cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm ${isFollowing ? 'bg-gray-600' : 'bg-pink-600 hover:bg-pink-700'}`}
                >
                  {isFollowing ? 'Following ✓' : 'Follow'}
                </button>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 rounded-xl border bg-white p-1 shadow-sm mb-5">
            <button type="button" onClick={() => { setActiveTab('collection'); sessionStorage.setItem(`profile_tab_${userId}`, 'collection') }} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'collection' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm' : 'text-gray-600'}`}>Collection</button>
            <button type="button" onClick={() => { setActiveTab('wdywt'); sessionStorage.setItem(`profile_tab_${userId}`, 'wdywt') }} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${activeTab === 'wdywt' ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm' : 'text-gray-600'}`}>WDYWT</button>
          </div>

          {/* WDYWT tab */}
          {activeTab === 'wdywt' && (
            <div>
              {!wdywtLoaded ? (
                <div className="grid grid-cols-3 gap-1.5">{[1,2,3,4,5,6].map(i => <div key={i} className="animate-pulse aspect-square rounded-xl bg-gray-200" />)}</div>
              ) : wdywtPosts.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center"><p className="text-gray-500">No WDYWT posts yet</p></div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {wdywtPosts.map(post => (
                    <button key={post.id} type="button" onClick={() => openPostModal(post)} className="relative aspect-square overflow-hidden rounded-xl bg-gray-100">
                      <img src={post.photo_url} alt={post.caption || 'WDYWT'} loading="lazy" className="h-full w-full object-cover object-top" />
                      <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">♥ {post.wdywt_likes?.length || 0}</span>
                        <span className="flex items-center gap-0.5 rounded-full bg-black/50 px-1.5 py-0.5 text-[10px] text-white">💬 {post.wdywt_comments?.length || 0}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Collection tab */}
          {activeTab === 'collection' && (
            <div>
              {collectionWraps.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center"><p className="text-gray-600">No wraps yet</p></div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
                  {collectionWraps.map((wrap) => (
                    <button key={wrap.id} type="button" onClick={() => openViewWrapModal(wrap)} className="group flex h-auto cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-0 text-left shadow-none transition duration-200 hover:-translate-y-1 hover:shadow-md xl:rounded-2xl xl:shadow-sm">
                      <div className="relative aspect-[3/4] w-full bg-gray-100 pointer-events-none">
                        <img src={getPrimaryImage(wrap)} alt={wrap.name} className="h-full w-full object-cover object-[center_20%] transition duration-300 group-hover:scale-[1.03]" />
                        {wrap.for_sale && <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow"><div>🪓 For Sale</div><div className="text-[10px] font-medium text-gray-700">{wrap.for_sale_price_is_pm ? 'PM' : wrap.for_sale_price !== null ? formatCurrency(wrap.for_sale_price, wrap.for_sale_currency || 'AUD') : ''}</div></div>}
                        {wrap.is_favourite && <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-pink-600 shadow">★ Perma</div>}
                      </div>
                      <div className="space-y-0.5 p-2 pointer-events-none xl:space-y-1 xl:p-5">
                        <h3 className="text-sm font-bold leading-tight text-gray-900 xl:text-base xl:leading-normal">{wrap.name}</h3>
                        <p className="text-xs leading-tight text-gray-600 xl:text-sm xl:leading-normal">{wrap.brand || 'No brand added'}</p>
                        {wrap.status === 'holiday' && wrap.on_loan_to && <div className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 xl:px-2 xl:py-1 xl:text-xs">On loan to {wrap.on_loan_to}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8">
                <h3 className="mb-3 text-lg font-bold text-gray-900">Departed Wraps</h3>
                {departedWraps.length === 0 ? (
                  <p className="text-sm text-gray-500">No departed wraps yet</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                    {departedWraps.map((wrap) => (
                      <button key={wrap.id} type="button" onClick={() => openViewWrapModal(wrap)} className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-gray-50 p-0 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="relative aspect-[4/5] w-full bg-gray-100 pointer-events-none">
                          <img src={getPrimaryImage(wrap)} alt={wrap.name} className="h-full w-full object-cover object-[center_20%] opacity-90 transition duration-300 group-hover:scale-[1.03]" />
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

        {/* WDYWT post modal */}
        {selectedPost && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-0 sm:p-4" onClick={() => setSelectedPost(null)}>
            <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
                <h3 className="font-bold text-gray-900">Post</h3>
                <div className="flex items-center gap-3">
                  {selectedPost && currentUserId === userId && (
                    <button
                      type="button"
                      onClick={async () => {
                        const id = selectedPost.id
                        setSelectedPost(null)
                        await supabase.from('wdywt_posts').delete().eq('id', id)
                        setWdywtPosts(prev => prev.filter(p => p.id !== id))
                        localStorage.setItem(`dipdesk_user_wdywt_${userId}`, JSON.stringify(wdywtPosts.filter(p => p.id !== id)))
                      }}
                      className="text-sm font-semibold text-red-500"
                    >
                      Delete
                    </button>
                  )}
                  <button type="button" onClick={() => setSelectedPost(null)} className="text-sm text-gray-500">Close</button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                <img src={selectedPost.photo_url} alt={selectedPost.caption || 'WDYWT'} className="w-full aspect-square object-cover object-top" />
                <div className="px-5 py-3">
                  <div className="flex items-center gap-4 mb-3">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!currentUserId) return
                        const isLiked = likedPosts.has(selectedPost.id)
                        if (isLiked) {
                          await supabase.from('wdywt_likes').delete().eq('post_id', selectedPost.id).eq('user_id', currentUserId)
                          setLikedPosts(prev => { const n = new Set(prev); n.delete(selectedPost.id); return n })
                          setWdywtPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, wdywt_likes: p.wdywt_likes.slice(1) } : p))
                        } else {
                          const { data } = await supabase.from('wdywt_likes').insert({ post_id: selectedPost.id, user_id: currentUserId }).select('id').single()
                          if (data) {
                            setLikedPosts(prev => new Set(prev).add(selectedPost.id))
                            setWdywtPosts(prev => prev.map(p => p.id === selectedPost.id ? { ...p, wdywt_likes: [...p.wdywt_likes, { id: data.id }] } : p))
                            if (userId !== currentUserId) await supabase.from('notifications').insert({ recipient_user_id: userId, actor_user_id: currentUserId, type: 'like' })
                          }
                        }
                      }}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <svg viewBox="0 0 24 24" fill={likedPosts.has(selectedPost.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={`h-5 w-5 ${likedPosts.has(selectedPost.id) ? 'text-pink-500' : 'text-gray-600'}`}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      <span className={likedPosts.has(selectedPost.id) ? 'text-pink-500 font-semibold' : 'text-gray-600'}>{wdywtPosts.find(p => p.id === selectedPost.id)?.wdywt_likes?.length || 0}</span>
                    </button>
                    <span className="flex items-center gap-1.5 text-sm text-gray-600">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      {wdywtPosts.find(p => p.id === selectedPost.id)?.wdywt_comments?.length || 0}
                    </span>
                  </div>
                  {selectedPost.caption && (
                    <p className="text-sm text-gray-700 mb-3">
                      <span className="font-semibold text-gray-900 mr-1">{profile?.full_name?.split(' ')[0] || profile?.username || 'User'}</span>
                      {selectedPost.caption}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mb-4">{timeAgo(selectedPost.created_at)}</p>
                  <div className="border-t pt-3 space-y-3">
                    {postCommentsLoading ? (
                      <p className="text-sm text-gray-400 text-center py-2">Loading comments...</p>
                    ) : postComments.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-2">No comments yet</p>
                    ) : (
                      postComments.map(comment => {
                        const name = comment.profiles?.full_name?.split(' ')[0] || comment.profiles?.username || 'Someone'
                        return (
                          <div key={comment.id} className="flex items-start gap-2">
                            {comment.profiles?.avatar_url ? (
                              <img src={comment.profiles.avatar_url} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0" />
                            ) : (
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xs font-bold text-white">{name[0]?.toUpperCase() || '?'}</div>
                            )}
                            <div>
                              <p className="text-sm text-gray-900"><span className="font-semibold mr-1">{name}</span>{comment.content}</p>
                              <p className="text-xs text-gray-400">{timeAgo(comment.created_at)}</p>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              </div>
              {currentUserId && (
                <div className="border-t px-4 py-3 flex items-center gap-3 shrink-0">
                  <input type="text" value={postCommentText} onChange={e => setPostCommentText(e.target.value)} placeholder="Add a comment..." className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-pink-300" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment() } }} />
                  <button type="button" disabled={!postCommentText.trim() || postCommentSending} onClick={handlePostComment} className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Post</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Wrap modal */}
        {isViewWrapModalOpen && selectedWrap && (() => {
          const sortedImages = [...(selectedWrap.wrap_images || [])].sort((a, b) => a.sort_order - b.sort_order)
          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeViewWrapModal}>
              <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
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
                          await supabase.from('messages').insert({ conversation_id: existing.id, sender_id: currentUserId, content: enquiryMessage })
                          await supabase.from('conversations').update({ last_message: enquiryMessage, last_message_at: new Date().toISOString() }).eq('id', existing.id)
                          closeViewWrapModal()
                          router.push(`/messages/${existing.id}`)
                          return
                        }
                        const { data: newConv } = await supabase.from('conversations').insert({ participant_1_id: currentUserId, participant_2_id: userId, last_message: enquiryMessage, last_message_at: new Date().toISOString() }).select('id').single()
                        if (newConv) { await supabase.from('messages').insert({ conversation_id: newConv.id, sender_id: currentUserId, content: enquiryMessage }); closeViewWrapModal(); router.push(`/messages/${newConv.id}`) }
                      }} className="cursor-pointer rounded-xl bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition">🪓 Contact Seller</button>
                    )}
                    <button type="button" onClick={closeViewWrapModal} className="cursor-pointer rounded-full border px-3 py-1 text-sm text-gray-600">Close</button>
                  </div>
                </div>

                <div className="mb-4 overflow-hidden rounded-3xl bg-gray-100 shadow-sm">
                  <button type="button" onClick={() => setIsImagePreviewOpen(true)} className="block w-full cursor-zoom-in bg-black">
                    <img src={selectedViewImage || getPrimaryImage(selectedWrap)} alt={selectedWrap.name} className="h-[440px] w-full object-cover transition duration-300 hover:scale-[1.01]" />
                  </button>
                </div>
                <p className="mb-4 text-xs text-gray-500">Click the main image to view larger</p>

                {sortedImages.length > 0 && (
                  <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                    {sortedImages.map(image => (
                      <button key={image.id} type="button" onClick={() => setSelectedViewImage(image.image_url)} className={`overflow-hidden rounded-xl border transition duration-200 ${selectedViewImage === image.image_url ? 'border-pink-500 ring-2 ring-pink-200 shadow-sm' : 'border-gray-200 hover:border-pink-300 hover:shadow-sm'}`}>
                        <img src={image.image_url} alt={selectedWrap.name} className="h-20 w-full object-cover transition duration-200 hover:scale-[1.02]" />
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
                      <p className="text-sm font-bold text-purple-700">🎲 Currently being dipped on Chasing Unicorns!</p>
                      <p className="text-xs text-purple-600">{dip.total_spots} spots @ ${dip.price_per_spot} USD each</p>
                      <p className="text-xs text-purple-600">Stage: {stageLabel[dip.stage || ''] || dip.stage}</p>
                      <p className="text-xs text-gray-600 mt-1">Head to the <span className="font-semibold">Chasing Unicorns Facebook page</span> to claim your spot!</p>
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
                      <p><span className="font-semibold text-gray-900">Purchased From:</span> {selectedWrap.purchased_from || '—'}</p>
                    </div>
                  </div>
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Extra Info</h3>
                    <div className="space-y-2 text-sm text-gray-700">
                      <p><span className="font-semibold text-gray-900">Favourite:</span> {selectedWrap.is_favourite ? 'Yes' : 'No'}</p>
                      {selectedWrap.for_sale && <p><span className="font-semibold text-gray-900">For Sale:</span> {selectedWrap.for_sale_price_is_pm ? 'PM' : selectedWrap.for_sale_price !== null ? formatCurrency(selectedWrap.for_sale_price, selectedWrap.for_sale_currency || 'AUD') : 'Yes'}</p>}
                      {selectedWrap.status === 'holiday' && <p><span className="font-semibold text-gray-900">On Holiday With:</span> {selectedWrap.on_loan_to || '—'}</p>}
                      {selectedWrap.status === 'departed' && <>
                        <p><span className="font-semibold text-gray-900">Sold To:</span> {selectedWrap.sold_to || '—'}</p>
                        <p><span className="font-semibold text-gray-900">Sold Date:</span> {selectedWrap.sold_date || '—'}</p>
                        <p><span className="font-semibold text-gray-900">Sold Price:</span> {selectedWrap.sold_price !== null ? formatCurrency(selectedWrap.sold_price, selectedWrap.sold_currency || 'AUD') : '—'}</p>
                      </>}
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
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
            <div className="relative w-full max-w-6xl">
              <button type="button" onClick={() => setIsImagePreviewOpen(false)} className="absolute right-0 top-0 z-10 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold text-gray-800 shadow">Close</button>
              <img src={selectedViewImage || getPrimaryImage(selectedWrap)} alt={selectedWrap.name} className="max-h-[90vh] w-full rounded-2xl bg-black object-contain" />
            </div>
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-2xl border border-white/20 bg-gray-900/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur">{toastMessage}</div>
        </div>
      )}
    </AppLayout>
  )
}