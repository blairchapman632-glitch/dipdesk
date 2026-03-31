'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
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

const WRAP_PLACEHOLDER =
  'https://placehold.co/800x800/fdf2f8/be185d?text=Wrap'

const getUserCollectionWrapsKey = (userId: string) => `dipdesk_user_collection_wraps_${userId}`
const getUserCollectionProfileKey = (userId: string) => `dipdesk_user_collection_profile_${userId}`
const getUserCollectionFollowKey = (userId: string) => `dipdesk_user_collection_follow_${userId}`

function formatCurrency(
  value: number | null | undefined,
  currency: 'AUD' | 'USD' | 'EUR' = 'AUD'
) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function getPrimaryImage(wrap?: Wrap) {
  if (!wrap?.wrap_images?.length) return WRAP_PLACEHOLDER

  const primary =
    wrap.wrap_images.find((image) => image.is_primary) ||
    [...wrap.wrap_images].sort((a, b) => a.sort_order - b.sort_order)[0]

  return primary?.image_url || WRAP_PLACEHOLDER
}

export default function UserCollectionPage() {
  const params = useParams()
  const userId = params.id as string

  const [profile, setProfile] = useState<Profile | null>(null)
const [wraps, setWraps] = useState<Wrap[]>([])
const [loading, setLoading] = useState(true)
const [currentUserId, setCurrentUserId] = useState<string | null>(null)
const [isFollowing, setIsFollowing] = useState(false)
const [toastMessage, setToastMessage] = useState('')

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
    useEffect(() => {
    if (!userId) return

    const cachedWraps = localStorage.getItem(getUserCollectionWrapsKey(userId))
    const cachedProfile = localStorage.getItem(getUserCollectionProfileKey(userId))
    const cachedFollow = localStorage.getItem(getUserCollectionFollowKey(userId))

    if (cachedWraps) {
      try {
        setWraps(JSON.parse(cachedWraps))
        setLoading(false)
      } catch {}
    }

    if (cachedProfile) {
      try {
        setProfile(JSON.parse(cachedProfile))
      } catch {}
    }

    if (cachedFollow) {
      try {
        setIsFollowing(JSON.parse(cachedFollow))
      } catch {}
    }

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const loggedInUserId = user?.id || null
      setCurrentUserId(loggedInUserId)

      const [{ data: profileData }, { data: wrapData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, username')
          .eq('id', userId)
          .single(),
        supabase
          .from('wraps')
          .select(
            'id, name, brand, description, purchase_date, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, wrap_images(id, image_url, is_primary, sort_order)'
          )
          .eq('user_id', userId)
          .order('is_favourite', { ascending: false })
          .order('purchase_date', { ascending: false }),
      ])

      let nextIsFollowing = false

      if (loggedInUserId && loggedInUserId !== userId) {
        const { data: followData } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', loggedInUserId)
          .eq('following_id', userId)
          .eq('status', 'accepted')
          .maybeSingle()

        nextIsFollowing = !!followData
      }

      setIsFollowing(nextIsFollowing)
      localStorage.setItem(
        getUserCollectionFollowKey(userId),
        JSON.stringify(nextIsFollowing)
      )

      setProfile(profileData || null)
      localStorage.setItem(
        getUserCollectionProfileKey(userId),
        JSON.stringify(profileData || null)
      )

      setWraps((wrapData as Wrap[]) || [])
      localStorage.setItem(
        getUserCollectionWrapsKey(userId),
        JSON.stringify((wrapData as Wrap[]) || [])
      )

      setLoading(false)
    }

    load()

    const handleFocus = () => {
      load()
    }

    window.addEventListener('focus', handleFocus)

    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [userId])

  const collectionTitle = useMemo(() => {
  if (profile?.full_name?.trim()) {
  const firstName = profile.full_name.split(' ')[0]
  return `${firstName}'s Collection`
}

  if (profile?.username?.trim()) {
    return `${profile.username}'s Collection`
  }

  return 'Collection'
}, [profile])

  const collectionWraps = useMemo(() => {
    return wraps
      .filter((wrap) => wrap.status === 'active' || wrap.status === 'holiday')
      .sort((a, b) => {
        if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [wraps])

  const departedWraps = useMemo(() => {
    return wraps
      .filter((wrap) => wrap.status === 'departed')
      .sort((a, b) => {
        if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [wraps])

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

    setSelectedWrapCounts({
      likes: likeCount || 0,
      wishlists: wishlistCount || 0,
    })
    setHasLikedSelectedWrap(!!likedRowResult.data)
    setHasWishlistedSelectedWrap(!!wishlistedRowResult.data)
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
    if (!selectedWrap || !currentUserId || currentUserId === userId || socialLoading) return

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

      await supabase.from('notifications').insert({
        recipient_user_id: userId,
        actor_user_id: currentUserId,
        wrap_id: selectedWrap.id,
        type: 'like',
      })
    }

    setSocialLoading(false)
  }

  async function handleToggleWishlist() {
    if (!selectedWrap || !currentUserId || currentUserId === userId || socialLoading) return

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

      await supabase.from('notifications').insert({
        recipient_user_id: userId,
        actor_user_id: currentUserId,
        wrap_id: selectedWrap.id,
        type: 'wishlist',
      })
    }

    setSocialLoading(false)
  }

   if (loading && wraps.length === 0 && !profile) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <section className="rounded-3xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Loading collection...</p>
          </section>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-2 shadow-sm xl:p-5">
          <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">
      {collectionTitle}
    </h1>
    <p className="text-sm text-gray-500">
      View wraps in this collection
    </p>
  </div>

    <div className="flex w-full flex-col gap-2 xl:w-auto xl:flex-row">
    {currentUserId !== userId && (
  <button
    type="button"
    onClick={async () => {
      if (!currentUserId) return

      if (isFollowing) {
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', userId)

        if (error) return

        setIsFollowing(false)
        setToastMessage(`Unfollowed ${profile?.full_name?.split(' ')[0] || 'user'}`)
        setTimeout(() => setToastMessage(''), 2000)
      } else {
        const { error } = await supabase.from('follows').insert({
          follower_id: currentUserId,
          following_id: userId,
          status: 'accepted',
        })

        if (error) return

        setIsFollowing(true)
        setToastMessage(`Following ${profile?.full_name?.split(' ')[0] || 'user'}`)
        setTimeout(() => setToastMessage(''), 2000)
      }
    }}
    className={`w-full cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm xl:w-auto ${
      isFollowing
        ? 'bg-gray-600'
        : 'bg-pink-600 hover:bg-pink-700'
    }`}
  >
    {isFollowing ? 'Following ✓' : 'Follow'}
  </button>
)}

    
  </div>
</div>

          {collectionWraps.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-8 text-center">
              <p className="text-gray-600">No wraps yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-4">
              {collectionWraps.map((wrap) => {
                const imageUrl = getPrimaryImage(wrap)

                return (
                  <button
                    key={wrap.id}
                    type="button"
                    onClick={() => openViewWrapModal(wrap)}
                    className="group flex h-auto cursor-pointer flex-col overflow-hidden rounded-xl border bg-white p-0 text-left shadow-none transition duration-200 hover:-translate-y-1 hover:shadow-md xl:rounded-2xl xl:shadow-sm"
                  >
                    <div className="relative aspect-[3/4] w-full bg-gray-100 pointer-events-none">
                      <img
                        src={imageUrl}
                        alt={wrap.name}
                        className="h-full w-full object-cover object-[center_20%] transition duration-300 group-hover:scale-[1.03]"
                      />

                      {wrap.for_sale && (
                        <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow">
                          <div>🪓 For Sale</div>
                          <div className="text-[10px] font-medium text-gray-700">
                            {wrap.for_sale_price_is_pm
                              ? 'PM'
                              : wrap.for_sale_price !== null
                              ? formatCurrency(
                                  wrap.for_sale_price,
                                  wrap.for_sale_currency || 'AUD'
                                )
                              : ''}
                          </div>
                        </div>
                      )}

                      {wrap.is_favourite && (
                        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-pink-600 shadow">
                          ★ Perma
                        </div>
                      )}
                    </div>

                    <div className="space-y-0.5 p-2 pointer-events-none xl:space-y-1 xl:p-5">
                      <h3 className="text-sm font-bold leading-tight text-gray-900 xl:text-base xl:leading-normal">
                        {wrap.name}
                      </h3>
                      <p className="text-xs leading-tight text-gray-600 xl:text-sm xl:leading-normal">
                        {wrap.brand || 'No brand added'}
                      </p>

                      {wrap.status === 'holiday' && wrap.on_loan_to && (
                        <div className="inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 xl:px-2 xl:py-1 xl:text-xs">
                          On loan to {wrap.on_loan_to}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-8">
            <h3 className="mb-3 text-lg font-bold text-gray-900">
              Departed Wraps
            </h3>

            {departedWraps.length === 0 ? (
              <p className="text-sm text-gray-500">No departed wraps yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {departedWraps.map((wrap) => (
                  <button
                    key={wrap.id}
                    type="button"
                    onClick={() => openViewWrapModal(wrap)}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border bg-gray-50 p-0 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="relative aspect-[4/5] w-full bg-gray-100 pointer-events-none">
                      <img
                        src={getPrimaryImage(wrap)}
                        alt={wrap.name}
                        className="h-full w-full object-cover object-[center_20%] opacity-90 transition duration-300 group-hover:scale-[1.03]"
                      />

                      {wrap.for_sale && (
                        <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow">
                          <div>🪓 For Sale</div>
                          <div className="text-[10px] font-medium text-gray-700">
                            {wrap.for_sale_price_is_pm
                              ? 'PM'
                              : wrap.for_sale_price !== null
                              ? formatCurrency(
                                  wrap.for_sale_price,
                                  wrap.for_sale_currency || 'AUD'
                                )
                              : ''}
                          </div>
                        </div>
                      )}

                      {wrap.is_favourite && (
                        <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-pink-600 shadow">
                          ★ Perma
                        </div>
                      )}
                    </div>

                    <div className="space-y-1 p-3">
                      <h4 className="line-clamp-1 text-sm font-bold text-gray-900">
                        {wrap.name}
                      </h4>
                      <p className="line-clamp-1 text-xs text-gray-600">
                        {wrap.brand || 'No brand added'}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
                      <h2 className="text-2xl font-bold text-gray-900 xl:text-2xl">
                        {selectedWrap.name}
                      </h2>

                      {currentUserId && currentUserId !== userId && (
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

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Wrap Details
                    </h3>

                    <div className="space-y-2 text-sm text-gray-700">
                      <p>
                        <span className="font-semibold text-gray-900">Status:</span>{' '}
                        {selectedWrap.status}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">Purchase Date:</span>{' '}
                        {selectedWrap.purchase_date || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">Purchased From:</span>{' '}
                        {selectedWrap.purchased_from || '—'}
                      </p>
                      <p>
                        <span className="font-semibold text-gray-900">Country:</span>{' '}
                        {selectedWrap.purchase_country || '—'}
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
                alt={selectedWrap.name}
                className="max-h-[90vh] w-full rounded-2xl bg-black object-contain"
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}