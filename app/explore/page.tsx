'use client'

import AppLayout from '@/app/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
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

const WRAP_PLACEHOLDER =
  'https://placehold.co/800x800/fdf2f8/be185d?text=Wrap'

const EXPLORE_WRAPS_KEY = 'dipdesk_explore_wraps'
const EXPLORE_USERS_KEY = 'dipdesk_explore_users'
const EXPLORE_FOLLOWING_KEY = 'dipdesk_explore_following'
const EXPLORE_PROFILES_KEY = 'dipdesk_explore_profiles'

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
  function openViewWrapModal(wrap: Wrap) {
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
  }

  function closeViewWrapModal() {
    setIsViewWrapModalOpen(false)
    setSelectedWrap(null)
    setSelectedViewImage(null)
    setIsImagePreviewOpen(false)
  }

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
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [latestWraps, setLatestWraps] = useState<Wrap[]>([])
  const [cachedLoaded, setCachedLoaded] = useState(false)
const [users, setUsers] = useState<ExploreUser[]>([])
const [followingUsers, setFollowingUsers] = useState<FollowingUser[]>([])
const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({})
  const [selectedWrap, setSelectedWrap] = useState<Wrap | null>(null)
  const [selectedViewImage, setSelectedViewImage] = useState<string | null>(null)
  const [isViewWrapModalOpen, setIsViewWrapModalOpen] = useState(false)
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    const cachedWraps = localStorage.getItem(EXPLORE_WRAPS_KEY)
const cachedProfiles = localStorage.getItem(EXPLORE_PROFILES_KEY)

const cachedUsers = localStorage.getItem(EXPLORE_USERS_KEY)
const cachedFollowing = localStorage.getItem(EXPLORE_FOLLOWING_KEY)

if (cachedWraps) {
  try {
    setLatestWraps(JSON.parse(cachedWraps))
    setCachedLoaded(true)
    setLoading(false)
  } catch {}
}

if (cachedProfiles) {
  try {
    setProfilesMap(JSON.parse(cachedProfiles))
  } catch {}
}

if (cachedUsers) {
  try {
    setUsers(JSON.parse(cachedUsers))
  } catch {}
}

if (cachedFollowing) {
  try {
    setFollowingUsers(JSON.parse(cachedFollowing))
  } catch {}
}
    async function loadExploreData() {
  setLoading(true)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const currentUserId = user?.id || null

      const { data: wrapData, error: wrapError } = await supabase
        .from('wraps')
                .select(
          'id, user_id, name, brand, description, purchase_date, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, wrap_images(id, image_url, is_primary, sort_order)'
        )
        .order('created_at', { ascending: false })
        .limit(24)

      if (wrapError) {
        console.error(wrapError)
        setLoading(false)
        return
      }

      const wraps = (wrapData as Wrap[]) || []
      setLatestWraps(wraps)
localStorage.setItem(EXPLORE_WRAPS_KEY, JSON.stringify(wraps))
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
        .select('id, full_name, username')
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
      const usersFromWraps: ExploreUser[] = uniqueUserIds.map((userId) => {
        const userWraps = wraps.filter((wrap) => wrap.user_id === userId)
        const latestUserWrap = userWraps[0]

        return {
          id: userId,
          name: getDisplayName(profileMap[userId]),
          image_url: getPrimaryImage(latestUserWrap),
          wrap_count: userWraps.length,
        }
      })

      setUsers(usersFromWraps)

// 🔽 LOAD FOLLOWING USERS
if (currentUserId) {
  const { data: followsData } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', currentUserId)
    .eq('status', 'accepted')

  const followingIds = (followsData || []).map((f) => f.following_id)

  const followingUsersData = followingIds
  .map((userId) => {
    const userWraps = wraps.filter((wrap) => wrap.user_id === userId)
    const latestUserWrap = userWraps[0]

    if (!profileMap[userId]) return null

    return {
      id: userId,
      name: getDisplayName(profileMap[userId]),
      image_url: getPrimaryImage(latestUserWrap),
      wrap_count: userWraps.length,
    }
  })
  .filter(Boolean) as FollowingUser[]

  setFollowingUsers(followingUsersData)
} else {
  setFollowingUsers([])
}

setLoading(false)
    }

    loadExploreData()

const handleFocus = () => {
  loadExploreData()
}

window.addEventListener('focus', handleFocus)

return () => {
  window.removeEventListener('focus', handleFocus)
}
  }, [])

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) return users

    return users.filter((user) => user.name.toLowerCase().includes(term))
  }, [users, searchTerm])

  const filteredWraps = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    if (!term) return latestWraps

    return latestWraps.filter((wrap) => {
      const wrapName = wrap.name.toLowerCase()
      const brandName = (wrap.brand || '').toLowerCase()
      const ownerName = getDisplayName(profilesMap[wrap.user_id]).toLowerCase()

      return (
        wrapName.includes(term) ||
        brandName.includes(term) ||
        ownerName.includes(term)
      )
    })
  }, [latestWraps, profilesMap, searchTerm])
  const hasSearch = searchTerm.trim().length > 0
  const noResults =
    !loading &&
    hasSearch &&
    filteredUsers.length === 0 &&
    filteredWraps.length === 0
  return (
    <AppLayout>
      <div className="space-y-3">
        <section className="rounded-xl border bg-white px-3 py-3 shadow-sm">
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              🔍
            </span>

            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Discover collections and wraps"
              className="w-full rounded-lg border px-10 py-2 text-sm text-gray-900 outline-none focus:border-pink-500"
            />
          </div>
        </section>
        {noResults && (
          <section className="rounded-xl border bg-white px-3 py-4 shadow-sm">
            <p className="text-center text-sm text-gray-500">
              No results found
            </p>
          </section>
        )}
        <section className="rounded-xl border bg-white px-3 py-3 shadow-sm">
  <div className="mb-2">
    <h2 className="text-sm font-bold text-gray-900">Following</h2>
  </div>

  {loading ? (
    <p className="text-sm text-gray-500">Loading following...</p>
  ) : followingUsers.length === 0 ? (
    <div className="rounded-lg border border-dashed px-3 py-4 text-center">
      <p className="text-sm text-gray-500">No following yet</p>
    </div>
  ) : (
    <div className="-mx-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
      <div className="flex gap-2 sm:flex-wrap">
        {followingUsers.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => router.push(`/user/${user.id}`)}
            className="flex w-[160px] shrink-0 cursor-pointer flex-col items-center rounded-lg border bg-white px-2 py-2 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-[170px]"
          >
            <img
  src={`${user.image_url}?width=200&quality=60`}
  loading="lazy"
              alt={user.name}
              className="mb-1.5 h-16 w-16 rounded-full object-cover pointer-events-none"
            />

            <p className="line-clamp-1 text-sm font-semibold text-gray-900 pointer-events-none">
              {user.name}
            </p>

            <p className="mt-0.5 text-xs text-gray-500 pointer-events-none">
              {user.wrap_count} wrap{user.wrap_count === 1 ? '' : 's'}
            </p>
          </button>
        ))}
      </div>
    </div>
  )}
</section>

        <section className="rounded-xl border bg-white px-3 py-3 shadow-sm">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-gray-900">Collections</h2>
          </div>

          {loading ? (
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
                    className="flex w-[160px] shrink-0 cursor-pointer flex-col items-center rounded-lg border bg-white px-2 py-2 text-center shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:w-[170px]"
                  >
                    <img
  src={`${user.image_url}?width=200&quality=60`}
  loading="lazy"
                      alt={user.name}
                      className="mb-1.5 h-16 w-16 rounded-full object-cover pointer-events-none"
                    />

                    <p className="line-clamp-1 text-sm font-semibold text-gray-900 pointer-events-none">
                      {user.name}
                    </p>

                    <p className="mt-0.5 text-xs text-gray-500 pointer-events-none">
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

        <section className="rounded-xl border bg-white px-3 py-3 shadow-sm">
          <div className="mb-2">
            <h2 className="text-sm font-bold text-gray-900">Latest Wraps</h2>
          </div>

          {loading ? (
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

                    
                  </div>

                  <div className="space-y-1 px-2.5 py-2">
                    <h3 className="line-clamp-1 text-sm font-bold text-gray-900 pointer-events-none">
                      {wrap.name}
                    </h3>

                    <p className="line-clamp-1 text-xs text-gray-500 pointer-events-none">
                      {wrap.brand || 'No brand added'}
                    </p>

                    <div>
                      <span
                        onClick={(event) => {
                          event.stopPropagation()
                          router.push(`/user/${wrap.user_id}`)
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-pink-50 px-2 py-1 text-xs font-semibold text-pink-600 hover:bg-pink-100"
                      >
                        {getDisplayName(profilesMap[wrap.user_id])}
                      </span>
                    </div>
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
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {selectedWrap.name}
                    </h2>

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

                  <button
                    type="button"
                    onClick={closeViewWrapModal}
                    className="cursor-pointer rounded-full border px-3 py-1 text-sm text-gray-600"
                  >
                    Close
                  </button>
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