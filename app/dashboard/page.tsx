'use client'

import { supabase } from '@/lib/supabase'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import AppLayout from '@/app/components/AppLayout'

type CurrencyCode = 'AUD' | 'USD' | 'EUR'

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
  size: string | null
  material: string | null
  colour: string | null
  dibs_user_id: string | null
  purchase_date: string | null
  purchase_price: number | null
  purchase_currency: CurrencyCode | null
  purchased_from: string | null
  purchase_country: string | null
  status: 'active' | 'holiday' | 'departed'
  on_loan_to: string | null
  sold_to: string | null
  sold_price: number | null
  sold_currency: CurrencyCode | null
  sold_date: string | null
  is_favourite: boolean
  for_sale: boolean
  for_sale_price: number | null
  for_sale_currency: CurrencyCode | null
  for_sale_price_is_pm: boolean
  created_at: string
  wrap_images?: WrapImage[]
}
type Profile = {
  id: string
  full_name: string | null
  username: string | null
  avatar_url?: string | null
}
type Dip = {
  id: string
  title: string
  brand: string | null
  wrap_name: string | null
  total_spots: number
  price_per_spot: number
  current_likes: number | null
  likes_required: number | null
  stage: string | null
  status: string | null
  wrap_id: string | null
}

type WrapFormImage = {
  id: string
  image_url: string
  is_primary: boolean
  sort_order: number
  status: 'uploaded' | 'uploading' | 'error'
  storage_path: string | null
  file_name: string | null
}
type ReportRow = {
  id: string
  wrap_name: string
  wrap_status: 'Collection' | 'Departed'
  purchase_date: string
  purchase_price: number | null
  sold_price: number | null
}
type WrapFormState = {
  id: string | null
  name: string
  brand: string
  size: string
  material: string
  colour: string
  dibs_user_id: string | null
  dibs_search: string
purchase_date: string
  purchase_price: string
  purchase_currency: CurrencyCode
  purchased_from: string
  purchase_country: string
  images: WrapFormImage[]
  on_loan_to: string
  sold_to: string
  sold_price: string
  sold_currency: CurrencyCode
  sold_date: string
  is_favourite: boolean
  for_sale: boolean
    for_sale_price: string
  for_sale_currency: CurrencyCode
  for_sale_price_is_pm: boolean
  status: 'active' | 'holiday' | 'departed'
}
type NotificationRow = {
  id: string
  recipient_user_id: string
  actor_user_id: string | null
  wrap_id: string | null
  type: 'like' | 'wishlist' | 'for_sale' | 'comment'
  created_at: string
  read_at: string | null
}

type NotificationItem = {
  id: string
  actor_user_id: string | null
  created_at: string
  read_at: string | null
  type: 'like' | 'wishlist' | 'for_sale' | 'comment'
  actor_name: string
  actor_avatar: string | null
  wrap: Wrap | null
}
const DASHBOARD_EMAIL_KEY = 'dipdesk_dashboard_email'
const DASHBOARD_DIPS_KEY = 'dipdesk_dashboard_dips'
const DASHBOARD_WRAPS_KEY = 'dipdesk_dashboard_wraps'
const DASHBOARD_NOTIFICATIONS_KEY = 'dipdesk_dashboard_notifications'
const DASHBOARD_PROFILE_KEY = 'dipdesk_dashboard_profile'
const DASHBOARD_ACTOR_AVATARS_KEY = 'dipdesk_dashboard_actor_avatars'

const EMPTY_WRAP_FORM: WrapFormState = {
  id: null,
  name: '',
  brand: '',
  size: '',
  material: '',
  colour: '',
  dibs_user_id: null,
  dibs_search: '',
purchase_date: new Date().toISOString().slice(0, 10),
  purchase_price: '',
  purchase_currency: 'AUD',
  purchased_from: '',
  purchase_country: '',
  images: [],
  on_loan_to: '',
  sold_to: '',
  sold_price: '',
  sold_currency: 'AUD',
  sold_date: new Date().toISOString().slice(0, 10),
  is_favourite: false,
   for_sale: false,
  for_sale_price: '',
  for_sale_currency: 'AUD',
  for_sale_price_is_pm: false,
  status: 'active',
}

const WRAP_PLACEHOLDER =
  'https://placehold.co/800x800/fdf2f8/be185d?text=Wrap'
const MAX_WRAP_IMAGES = 6
const MAX_IMAGE_SIZE_MB = 5
const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]
function formatCurrency(
  value: number | null | undefined,
  currency: CurrencyCode = 'AUD'
) {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function getStageLabel(stage: string | null, status: string | null) {
  return stage || status || 'Draft'
}

function getDipProgress(dip: Dip) {
  const likesRequired = dip.likes_required || 0
  const currentLikes = dip.current_likes || 0

  if (likesRequired > 0) {
    return Math.min(100, Math.round((currentLikes / likesRequired) * 100))
  }

  return 0
}

function getPrimaryImage(wrap?: Wrap) {
  if (!wrap?.wrap_images?.length) return WRAP_PLACEHOLDER

  const primary =
    wrap.wrap_images.find((image) => image.is_primary) ||
    [...wrap.wrap_images].sort((a, b) => a.sort_order - b.sort_order)[0]

  const url = primary?.image_url || ''

  if (!url) return WRAP_PLACEHOLDER

  const bucketMarker = '/wrap-images/'
  const bucketIndex = url.indexOf(bucketMarker)

  if (bucketIndex === -1) return WRAP_PLACEHOLDER

  const pathAfterBucket = url.slice(bucketIndex + bucketMarker.length)

  if (!pathAfterBucket.includes('/')) return WRAP_PLACEHOLDER

  return `${url}?width=400&quality=60`
}
function formatTimeAgo(dateString: string) {
  const now = new Date().getTime()
  const then = new Date(dateString).getTime()
  const diffSeconds = Math.max(1, Math.floor((now - then) / 1000))

  if (diffSeconds < 60) return 'Just now'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes}m ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`

  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(dateString))
}
export default function Dashboard() {
  const [email, setEmail] = useState('')
  const [dips, setDips] = useState<Dip[]>([])
  const [wraps, setWraps] = useState<Wrap[]>([])
  const [communityWraps, setCommunityWraps] = useState<Wrap[]>([])
  const [profilesMap, setProfilesMap] = useState<Record<string, { full_name: string | null; username: string | null }>>({})
  const [loading, setLoading] = useState(true)
    const [mobileTab, setMobileTab] = useState<'collection' | 'activity'>('collection')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
const [profile, setProfile] = useState<{ full_name: string | null; username: string | null; avatar_url: string | null } | null>(null)
const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const [isWrapModalOpen, setIsWrapModalOpen] = useState(false)
const [isViewWrapModalOpen, setIsViewWrapModalOpen] = useState(false)
const [isReportModalOpen, setIsReportModalOpen] = useState(false)
const [reportDateFrom, setReportDateFrom] = useState('')
const [reportDateTo, setReportDateTo] = useState('')
const [reportStatusFilter, setReportStatusFilter] = useState<
  'all' | 'collection' | 'departed'
>('all')
const [selectedWrap, setSelectedWrap] = useState<Wrap | null>(null)
const [selectedViewImage, setSelectedViewImage] = useState<string | null>(null)
const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false)
const [isReadOnlyWrapView, setIsReadOnlyWrapView] = useState(false)
const [isSavingWrap, setIsSavingWrap] = useState(false)
const [isUploadingImages, setIsUploadingImages] = useState(false)
const [dibsSearchResults, setDibsSearchResults] = useState<{id: string, name: string, username: string | null}[]>([])
const [dibsSearchLoading, setDibsSearchLoading] = useState(false)
const [purchasedFromResults, setPurchasedFromResults] = useState<{id: string, name: string, username: string | null}[]>([])
const [purchasedFromLoading, setPurchasedFromLoading] = useState(false)
const [brandSuggestions, setBrandSuggestions] = useState<string[]>([])
const [materialSuggestions, setMaterialSuggestions] = useState<string[]>([])
const [sizeSuggestions, setSizeSuggestions] = useState<string[]>([])
const [colourSuggestions, setColourSuggestions] = useState<string[]>([])
const [wrapForm, setWrapForm] = useState<WrapFormState>(EMPTY_WRAP_FORM)
const [notifications, setNotifications] = useState<NotificationItem[]>([])
const [selectedWrapCounts, setSelectedWrapCounts] = useState({
  likes: 0,
  wishlists: 0,
})
const [isClearingNotifications, setIsClearingNotifications] = useState(false)
    const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    router.replace('/')
  }

const updateWrapForm = <K extends keyof WrapFormState>(
  field: K,
  value: WrapFormState[K]
) => {
  setWrapForm((previous) => ({
    ...previous,
    [field]: value,
  }))
}
  const wrapsById = useMemo(() => {
    return wraps.reduce<Record<string, Wrap>>((accumulator, wrap) => {
      accumulator[wrap.id] = wrap
      return accumulator
    }, {})
  }, [wraps])

  const collectionWraps = useMemo(() => {
    return wraps
      .filter((wrap) => wrap.status === 'active' || wrap.status === 'holiday')
      .sort((a, b) => {
        if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1
        return (b.purchase_price || 0) - (a.purchase_price || 0)
      })
  }, [wraps])

  const departedWraps = useMemo(() => {
    return wraps
      .filter((wrap) => wrap.status === 'departed')
      .sort((a, b) => {
        if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1
        return (b.purchase_price || 0) - (a.purchase_price || 0)
      })
  }, [wraps])
const reportRows = useMemo<ReportRow[]>(() => {
  return wraps
    .filter((wrap) => {
      if (reportStatusFilter === 'collection') {
        if (!(wrap.status === 'active' || wrap.status === 'holiday')) return false
      }

      if (reportStatusFilter === 'departed') {
        if (wrap.status !== 'departed') return false
      }

      if (reportDateFrom && wrap.purchase_date && wrap.purchase_date < reportDateFrom) {
        return false
      }

      if (reportDateTo && wrap.purchase_date && wrap.purchase_date > reportDateTo) {
        return false
      }

      if (reportDateFrom && !wrap.purchase_date) return false

      return true
    })
    .sort((a, b) => {
      const aDate = a.purchase_date || ''
      const bDate = b.purchase_date || ''
      return bDate.localeCompare(aDate)
    })
    .map((wrap) => ({
      id: wrap.id,
      wrap_name: wrap.name,
      wrap_status: wrap.status === 'departed' ? 'Departed' : 'Collection',
      purchase_date: wrap.purchase_date || '',
      purchase_price: wrap.purchase_price,
      sold_price: wrap.sold_price,
    }))
}, [wraps, reportDateFrom, reportDateTo, reportStatusFilter])
const reportTotals = useMemo(() => {
  const totalPurchaseValue = reportRows.reduce((sum, row) => {
    return sum + (row.purchase_price || 0)
  }, 0)

  const totalSoldValue = reportRows.reduce((sum, row) => {
    return sum + (row.sold_price || 0)
  }, 0)

  return {
    totalPurchaseValue,
    totalSoldValue,
  }
}, [reportRows])
const unreadNotificationCount = useMemo(() => {
  return notifications.filter((notification) => !notification.read_at).length
}, [notifications])
  const loadData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
  setLoading(false)
  
  return
}

    setCurrentUserId(user.id)
    
    await supabase
  .from('profiles')
  .update({ last_active_at: new Date().toISOString() })
  .eq('id', user.id)

const userEmail = user.email || ''
setIsAdmin(userEmail === 'paige.wilson26@outlook.com')
setEmail(userEmail)
localStorage.setItem(DASHBOARD_EMAIL_KEY, userEmail)
const { data: profileData } = await supabase
  .from('profiles')
  .select('full_name, username, avatar_url')
  .eq('id', user.id)
  .single()

if (profileData) {
  setProfile(profileData)
  localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify(profileData))
}


    const [
  { data: dipData, error: dipError },
  { data: wrapData, error: wrapError },
  { data: communityWrapData },
  { data: notificationData, error: notificationError }
] = await Promise.all([
  supabase
    .from('dips')
    .select(
      'id, title, brand, wrap_name, total_spots, price_per_spot, current_likes, likes_required, stage, status, wrap_id'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }),

  supabase
    .from('wraps')
    .select(
'id, name, brand, description, colour, purchase_date, purchase_price, purchase_currency, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, wrap_images(id, image_url, is_primary, sort_order)'
)
    .eq('user_id', user.id)
    .order('is_favourite', { ascending: false })
    .order('purchase_price', { ascending: false }),

  supabase
  .from('wraps')
  .select(
'id, name, brand, description, colour, purchase_date, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, user_id, wrap_images(id, image_url, is_primary, sort_order)'
)
  .order('created_at', { ascending: false })
  .limit(20)
  ,
  supabase
    .from('notifications')
        .select('id, recipient_user_id, actor_user_id, wrap_id, type, created_at, read_at')
    .eq('recipient_user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)
])

    if (!dipError && dipData) {
      setDips(dipData)
      localStorage.setItem(DASHBOARD_DIPS_KEY, JSON.stringify(dipData))
    }

    if (!wrapError && wrapData) {
  const safeWraps = (wrapData as unknown as Wrap[]) || []
  setWraps(safeWraps)
  localStorage.setItem(DASHBOARD_WRAPS_KEY, JSON.stringify(safeWraps))
}
if (communityWrapData) {
  const wraps = communityWrapData as unknown as Wrap[]
  setCommunityWraps(wraps)

  const userIds = [...new Set(wraps.map(w => w.user_id))]

  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, full_name, username')
    .in('id', userIds)

  if (profileData) {
    const map: Record<string, { full_name: string | null; username: string | null }> = {}

    profileData.forEach((p) => {
      map[p.id] = {
        full_name: p.full_name,
        username: p.username,
      }
    })

    setProfilesMap(map)
  }
}

if (!notificationError && notificationData) {
  const rows = (notificationData as NotificationRow[]) || []
  const actorIds = [...new Set(rows.map((row) => row.actor_user_id).filter(Boolean) as string[])]
  const wrapIds = [...new Set(rows.map((row) => row.wrap_id).filter(Boolean) as string[])]

  let actorMap: Record<string, Profile> = {}
  let wrapMap: Record<string, Wrap> = {}

  if (actorIds.length > 0) {
    const { data: actorProfileData } = await supabase
      .from('profiles')
      .select('id, full_name, username, avatar_url')
      .in('id', actorIds)

    actorMap = ((actorProfileData as Profile[]) || []).reduce<Record<string, Profile>>(
      (accumulator, profile) => {
        accumulator[profile.id] = profile
        return accumulator
      },
      {}
    )
  }

  if (wrapIds.length > 0) {
    const { data: notificationWrapData } = await supabase
      .from('wraps')
      .select(
        'id, user_id, name, brand, description, colour, purchase_date, purchase_price, purchase_currency, purchased_from, purchase_country, status, on_loan_to, sold_to, sold_price, sold_currency, sold_date, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, created_at, wrap_images(id, image_url, is_primary, sort_order)'
      )
      .in('id', wrapIds)

    wrapMap = ((notificationWrapData as unknown as Wrap[]) || []).reduce<Record<string, Wrap>>(
      (accumulator, wrap) => {
        accumulator[wrap.id] = wrap
        return accumulator
      },
      {}
    )
  }

  const nextNotifications: NotificationItem[] = rows.map((row) => ({
  id: row.id,
  actor_user_id: row.actor_user_id,
  created_at: row.created_at,
  read_at: row.read_at,
  type: row.type,
  actor_name: row.actor_user_id
      ? ((actorMap[row.actor_user_id]?.full_name?.split(' ')[0]) ||
          actorMap[row.actor_user_id]?.username ||
          'Someone')
      : 'Someone',
  actor_avatar: row.actor_user_id
      ? (actorMap[row.actor_user_id] as any)?.avatar_url || null
      : null,
  wrap: row.wrap_id ? wrapMap[row.wrap_id] || null : null,
}))

  setNotifications(nextNotifications)
  localStorage.setItem(DASHBOARD_NOTIFICATIONS_KEY, JSON.stringify(nextNotifications))
  const actorAvatarMap: Record<string, string | null> = {}
  nextNotifications.forEach((n) => {
    if (n.actor_user_id) {
      actorAvatarMap[n.actor_user_id] = n.actor_avatar
    }
  })
  localStorage.setItem(DASHBOARD_ACTOR_AVATARS_KEY, JSON.stringify(actorAvatarMap))
}

    setLoading(false)
  }, [])

  useEffect(() => {
        const cachedEmail = localStorage.getItem(DASHBOARD_EMAIL_KEY)
    const cachedDips = localStorage.getItem(DASHBOARD_DIPS_KEY)
    const cachedWraps = localStorage.getItem(DASHBOARD_WRAPS_KEY)
    const cachedNotifications = localStorage.getItem(DASHBOARD_NOTIFICATIONS_KEY)

    // If no cache exists at all, keep loading=true until Supabase responds
    const hasCache = cachedEmail || cachedWraps
    if (!hasCache) {
      loadData()
      return
    }

    if (cachedEmail) setEmail(cachedEmail)

    if (cachedDips) {
      try {
        setDips(JSON.parse(cachedDips))
      } catch {
        localStorage.removeItem(DASHBOARD_DIPS_KEY)
      }
    }

        if (cachedWraps) {
      try {
        setWraps(JSON.parse(cachedWraps))
      } catch {
        localStorage.removeItem(DASHBOARD_WRAPS_KEY)
      }
    }

    if (cachedNotifications) {
      try {
        setNotifications(JSON.parse(cachedNotifications))
      } catch {
        localStorage.removeItem(DASHBOARD_NOTIFICATIONS_KEY)
      }
    }

    const cachedProfile = localStorage.getItem(DASHBOARD_PROFILE_KEY)
    if (cachedProfile) {
      try {
        setProfile(JSON.parse(cachedProfile))
      } catch {}
    }

    const cachedActorAvatars = localStorage.getItem(DASHBOARD_ACTOR_AVATARS_KEY)
    if (cachedActorAvatars) {
      try {
        const avatarMap = JSON.parse(cachedActorAvatars)
        setNotifications((prev) =>
          prev.map((n) => ({
            ...n,
            actor_avatar: n.actor_user_id ? avatarMap[n.actor_user_id] ?? n.actor_avatar : n.actor_avatar,
          }))
        )
      } catch {}
    }

    setLoading(false)
    loadData()
  }, [loadData])
  useEffect(() => {
  const params = new URLSearchParams(window.location.search)

  if (params.get('report') === 'true') {
    setIsReportModalOpen(true)
    router.replace('/dashboard')
  }
}, [router])
async function openViewWrapModal(wrap: Wrap, readOnly = false) {
  const sortedImages = [...(wrap.wrap_images || [])].sort(
    (a, b) => a.sort_order - b.sort_order
  )

  const primaryImage =
    sortedImages.find((image) => image.is_primary)?.image_url ||
    sortedImages[0]?.image_url ||
    getPrimaryImage(wrap)

  setSelectedWrap(wrap)
  setSelectedViewImage(primaryImage)
  setIsReadOnlyWrapView(readOnly)
  setIsViewWrapModalOpen(true)

  const [
    { count: likeCount },
    { count: wishlistCount }
  ] = await Promise.all([
    supabase
      .from('wrap_likes')
      .select('*', { count: 'exact', head: true })
      .eq('wrap_id', wrap.id),
    supabase
      .from('wishlists')
      .select('*', { count: 'exact', head: true })
      .eq('wrap_id', wrap.id)
  ])

  setSelectedWrapCounts({
    likes: likeCount || 0,
    wishlists: wishlistCount || 0,
  })
}
function closeViewWrapModal() {
  setIsViewWrapModalOpen(false)
  setSelectedWrap(null)
  setSelectedViewImage(null)
  setIsImagePreviewOpen(false)
  setIsReadOnlyWrapView(false)
}
function handleNotificationClick(notification: NotificationItem) {
  if (!notification.read_at) {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notification.id
          ? { ...n, read_at: new Date().toISOString() }
          : n
      )
      const newUnread = updated.filter((n) => !n.read_at).length
      localStorage.setItem('dipdesk_unread_count', JSON.stringify(newUnread))
      localStorage.setItem(DASHBOARD_NOTIFICATIONS_KEY, JSON.stringify(updated))
      return updated
    })

    supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notification.id)
      .then(() => {})
  }

  if (notification.type === 'for_sale' && notification.wrap) {
    openViewWrapModal(notification.wrap, true)
    return
  }

  if (notification.actor_user_id) {
    router.push(`/user/${notification.actor_user_id}`)
    return
  }

  if (notification.wrap) {
    openViewWrapModal(notification.wrap, true)
  }
}
async function uploadAvatar(file: File) {
  if (!currentUserId) return

  setIsUploadingAvatar(true)

  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${currentUserId}/avatar.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, { upsert: true })

  if (uploadError) {
    console.error(uploadError)
    setIsUploadingAvatar(false)
    return
  }

  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName)

  const avatarUrl = `${data.publicUrl}?t=${Date.now()}`

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', currentUserId)

  if (!updateError) {
    setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev)
  }

  setIsUploadingAvatar(false)
}

function getInitials(name: string | null | undefined) {
  if (!name?.trim()) return '?'
  return name
    .trim()
    .split(' ')
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('')
}
async function markAllNotificationsRead() {
  if (!currentUserId) return

  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_user_id', currentUserId)
    .is('read_at', null)

  setNotifications((prev) => {
    const updated = prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
    localStorage.setItem(DASHBOARD_NOTIFICATIONS_KEY, JSON.stringify(updated))
    localStorage.setItem('dipdesk_unread_count', JSON.stringify(0))
    return updated
  })
}

async function clearAllNotifications() {
  if (!currentUserId) return

  const confirmed = window.confirm('Delete all notifications permanently?')
  if (!confirmed) return

  setIsClearingNotifications(true)

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('recipient_user_id', currentUserId)

  if (error) {
    console.error('Clear notifications error:', error)
    setIsClearingNotifications(false)
    return
  }

  setNotifications([])
  localStorage.setItem(DASHBOARD_NOTIFICATIONS_KEY, JSON.stringify([]))
  localStorage.setItem('dipdesk_unread_count', JSON.stringify(0))
  setIsClearingNotifications(false)
}
function openReportModal() {
  setIsReportModalOpen(true)
}

function closeReportModal() {
  setIsReportModalOpen(false)
}
useEffect(() => {
    const term = wrapForm.brand.trim()
    if (!term || term.length < 1) { setBrandSuggestions([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('wraps').select('brand').ilike('brand', `%${term}%`).limit(10)
      const unique = [...new Set(((data as any[]) || []).map((w) => w.brand).filter(Boolean))] as string[]
      setBrandSuggestions(unique.sort())
    }, 200)
    return () => clearTimeout(timeout)
  }, [wrapForm.brand])

  useEffect(() => {
    const term = wrapForm.material.trim()
    if (!term || term.length < 1) { setMaterialSuggestions([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('wraps').select('material').ilike('material', `%${term}%`).limit(10)
      const unique = [...new Set(((data as any[]) || []).map((w) => w.material).filter(Boolean))] as string[]
      setMaterialSuggestions(unique.sort())
    }, 200)
    return () => clearTimeout(timeout)
  }, [wrapForm.material])

  useEffect(() => {
    const term = wrapForm.size.trim()
    if (!term || term.length < 1) { setSizeSuggestions([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('wraps').select('size').ilike('size', `%${term}%`).limit(10)
      const unique = [...new Set(((data as any[]) || []).map((w) => w.size).filter(Boolean))] as string[]
      setSizeSuggestions(unique.sort())
    }, 200)
    return () => clearTimeout(timeout)
  }, [wrapForm.size])

  useEffect(() => {
    const term = wrapForm.colour.trim()
    if (!term || term.length < 1) { setColourSuggestions([]); return }
    const timeout = setTimeout(async () => {
      const { data } = await supabase.from('wraps').select('colour').ilike('colour', `%${term}%`).limit(10)
      const unique = [...new Set(((data as any[]) || []).map((w) => w.colour).filter(Boolean))] as string[]
      setColourSuggestions(unique.sort())
    }, 200)
    return () => clearTimeout(timeout)
  }, [wrapForm.colour])
useEffect(() => {
    const term = wrapForm.purchased_from.trim()

    if (!term || term.length < 2) {
      setPurchasedFromResults([])
      return
    }

    setPurchasedFromLoading(true)

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(5)

      setPurchasedFromResults(
        ((data as any[]) || []).map((p) => ({
          id: p.id,
          name: p.full_name || p.username || 'User',
          username: p.username,
        }))
      )
      setPurchasedFromLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [wrapForm.purchased_from])
useEffect(() => {
    const term = wrapForm.dibs_search.trim()

    if (!term) {
      setDibsSearchResults([])
      return
    }

    setDibsSearchLoading(true)

    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .or(`full_name.ilike.%${term}%,username.ilike.%${term}%`)
        .limit(5)

      setDibsSearchResults(
        ((data as any[]) || []).map((p) => ({
          id: p.id,
          name: p.full_name || p.username || 'User',
          username: p.username,
        }))
      )
      setDibsSearchLoading(false)
    }, 300)

    return () => clearTimeout(timeout)
  }, [wrapForm.dibs_search])
  function openNewWrapModal() {
    setWrapForm({
      ...EMPTY_WRAP_FORM,
      purchase_date: new Date().toISOString().slice(0, 10),
      sold_date: new Date().toISOString().slice(0, 10),
    })
    setIsWrapModalOpen(true)
  }

  function openEditWrapModal(wrap: Wrap) {
   const sortedImages = [...(wrap.wrap_images || [])].sort(
  (a, b) => a.sort_order - b.sort_order
)
    setWrapForm({
  id: wrap.id,
  name: wrap.name || '',
  brand: wrap.brand || '',
  size: (wrap as any).size || '',
  material: (wrap as any).material || '',
  colour: (wrap as any).colour || '',
  dibs_user_id: (wrap as any).dibs_user_id || null,
  dibs_search: '',
purchase_date: wrap.purchase_date || '',
  purchase_price:
    wrap.purchase_price !== null && wrap.purchase_price !== undefined
      ? String(wrap.purchase_price)
      : '',
  purchase_currency: wrap.purchase_currency || 'AUD',
  purchased_from: wrap.purchased_from || '',
  purchase_country: wrap.purchase_country || '',
  images: sortedImages.map((image, index) => ({
    id: image.id,
    image_url: image.image_url,
    is_primary: image.is_primary || index === 0,
    sort_order: image.sort_order,
    status: 'uploaded',
    storage_path: null,
    file_name: null,
  })),
  on_loan_to: wrap.on_loan_to || '',
  sold_to: wrap.sold_to || '',
  sold_price:
    wrap.sold_price !== null && wrap.sold_price !== undefined
      ? String(wrap.sold_price)
      : '',
  sold_currency: wrap.sold_currency || 'AUD',
   sold_date: wrap.sold_date || new Date().toISOString().slice(0, 10),
    is_favourite: wrap.is_favourite,
  for_sale: wrap.for_sale,

  for_sale_price:
    wrap.for_sale_price !== null && wrap.for_sale_price !== undefined
      ? String(wrap.for_sale_price)
      : '',

    for_sale_currency: wrap.for_sale_currency || 'AUD',
  for_sale_price_is_pm: wrap.for_sale_price_is_pm || false,

  status: wrap.status,
})
    setIsWrapModalOpen(true)
  }

  function closeWrapModal() {
  if (isUploadingImages) {
    const confirmed = window.confirm(
      'Images are still uploading. Are you sure you want to close?'
    )
    if (!confirmed) return
  }

  if (isSavingWrap) {
    const confirmed = window.confirm(
      'This wrap is still saving. Are you sure you want to close?'
    )
    if (!confirmed) return
  }

  setIsWrapModalOpen(false)
  setWrapForm(EMPTY_WRAP_FORM)
}

  function setCoverPhoto(imageId: string) {
  setWrapForm((previous) => ({
    ...previous,
    images: previous.images.map((image) => ({
      ...image,
      is_primary: image.id === imageId,
    })),
  }))
}

function removeWrapImage(imageId: string) {
  setWrapForm((previous) => {
    const remainingImages = previous.images.filter((image) => image.id !== imageId)

    const hasPrimary = remainingImages.some((image) => image.is_primary)

    const nextImages = remainingImages.map((image, index) => ({
      ...image,
      is_primary: hasPrimary ? image.is_primary : index === 0,
      sort_order: index,
    }))

    return {
      ...previous,
      images: nextImages,
    }
  })
}

async function uploadWrapImages(files: FileList | File[]) {
  if (!currentUserId) return

  const incomingFiles = Array.from(files)
  if (incomingFiles.length === 0) return

  const availableSlots = MAX_WRAP_IMAGES - wrapForm.images.length
  const limitedFiles = incomingFiles.slice(0, availableSlots)

  if (limitedFiles.length === 0) {
    window.alert(`You can upload a maximum of ${MAX_WRAP_IMAGES} images.`)
    return
  }

  const validFiles = limitedFiles.filter((file) => {
    const isValidType = ALLOWED_IMAGE_TYPES.includes(file.type)
    const isValidSize = file.size <= MAX_IMAGE_SIZE_MB * 1024 * 1024

    if (!isValidType) {
      window.alert(`${file.name} is not a supported image type.`)
      return false
    }

    if (!isValidSize) {
      window.alert(`${file.name} is larger than ${MAX_IMAGE_SIZE_MB}MB.`)
      return false
    }

    return true
  })

  if (validFiles.length === 0) return

  setIsUploadingImages(true)

  const existingImageCount = wrapForm.images.length

  const tempImages: WrapFormImage[] = validFiles.map((file, index) => ({
    id: `temp-${Date.now()}-${index}-${file.name}`,
    image_url: URL.createObjectURL(file),
    is_primary: existingImageCount === 0 && index === 0,
    sort_order: existingImageCount + index,
    status: 'uploading',
    storage_path: null,
    file_name: file.name,
  }))

  setWrapForm((previous) => ({
    ...previous,
    images: [...previous.images, ...tempImages].map((image, index) => ({
      ...image,
      is_primary:
        previous.images.length === 0 && index === 0
          ? true
          : image.is_primary,
      sort_order: index,
    })),
  }))

  for (let index = 0; index < validFiles.length; index++) {
  let file = validFiles[index]

  try {
    file = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    })
  } catch (error) {
    console.error('compression error', error)
  }

  const tempImage = tempImages[index]
  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${currentUserId}/${Date.now()}-${index}.${fileExt}`

    const { error } = await supabase.storage
      .from('wrap-images')
      .upload(fileName, file)

    if (error) {
      setWrapForm((previous) => ({
        ...previous,
        images: previous.images.map((image) =>
          image.id === tempImage.id
            ? {
                ...image,
                status: 'error',
              }
            : image
        ),
      }))
      continue
    }

    const { data } = supabase.storage
      .from('wrap-images')
      .getPublicUrl(fileName)

    setWrapForm((previous) => ({
      ...previous,
      images: previous.images.map((image) =>
        image.id === tempImage.id
          ? {
              ...image,
              image_url: data.publicUrl,
              status: 'uploaded',
              storage_path: fileName,
              file_name: file.name,
            }
          : image
      ),
    }))
  }

  setIsUploadingImages(false)
}

async function replaceWrapImage(imageId: string, incomingFile: File) {
  if (!currentUserId) return

  const existingImage = wrapForm.images.find((image) => image.id === imageId)
  if (!existingImage) return

    const previousStoragePath = existingImage.storage_path
  const previousImageUrl = existingImage.image_url
  let file = incomingFile

  setIsUploadingImages(true)

    try {
    file = await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
    })
  } catch (error) {
    console.error('compression error', error)
  }

  setWrapForm((previous) => ({
    ...previous,
    images: previous.images.map((image) =>
      image.id === imageId
        ? {
            ...image,
            image_url: URL.createObjectURL(file),
            status: 'uploading',
            file_name: file.name,
          }
        : image
    ),
  }))

  const fileExt = file.name.split('.').pop() || 'jpg'
  const fileName = `${currentUserId}/${Date.now()}-replace.${fileExt}`

  const { error } = await supabase.storage
    .from('wrap-images')
    .upload(fileName, file)

  if (error) {
    setWrapForm((previous) => ({
      ...previous,
      images: previous.images.map((image) =>
        image.id === imageId
          ? {
              ...image,
              image_url: previousImageUrl,
              status: 'error',
              file_name: existingImage.file_name,
            }
          : image
      ),
    }))
    setIsUploadingImages(false)
    return
  }

  const { data } = supabase.storage
    .from('wrap-images')
    .getPublicUrl(fileName)

  if (previousStoragePath) {
    const { error: removeOldImageError } = await supabase.storage
      .from('wrap-images')
      .remove([previousStoragePath])

    if (removeOldImageError) {
      console.error('old image cleanup error', removeOldImageError)
    }
  }

  setWrapForm((previous) => ({
    ...previous,
    images: previous.images.map((image) =>
      image.id === imageId
        ? {
            ...image,
            image_url: data.publicUrl,
            status: 'uploaded',
            storage_path: fileName,
            file_name: file.name,
          }
        : image
    ),
  }))

  setIsUploadingImages(false)
}

    async function saveWrap() {
    if (!currentUserId) return
    if (!wrapForm.name.trim()) return
if (isUploadingImages) return

    setIsSavingWrap(true)

    const existingWrap = wrapForm.id ? wrapsById[wrapForm.id] : null
    const wasForSale = existingWrap?.for_sale || false

const wrapPayload = {
  user_id: currentUserId,
  name: wrapForm.name.trim(),
  brand: wrapForm.brand.trim() || null,
  size: wrapForm.size.trim() || null,
  material: wrapForm.material.trim() || null,
  colour: wrapForm.colour.trim() || null,
  dibs_user_id: wrapForm.dibs_user_id || null,
  purchase_date: wrapForm.purchase_date || null,
  purchase_price: wrapForm.purchase_price
    ? Number(wrapForm.purchase_price)
    : null,
  purchase_currency: wrapForm.purchase_currency || 'AUD',
  purchased_from: wrapForm.purchased_from.trim() || null,
  status: wrapForm.status,
  on_loan_to:
    wrapForm.status === 'holiday' ? wrapForm.on_loan_to.trim() || null : null,
  sold_to:
    wrapForm.status === 'departed' ? wrapForm.sold_to.trim() || null : null,
  sold_price:
    wrapForm.status === 'departed' && wrapForm.sold_price
      ? Number(wrapForm.sold_price)
      : null,
  sold_currency:
    wrapForm.status === 'departed' ? wrapForm.sold_currency || 'AUD' : null,
  sold_date:
    wrapForm.status === 'departed' ? wrapForm.sold_date || null : null,

  // ✅ NEW
    for_sale: wrapForm.for_sale,
  for_sale_price_is_pm: wrapForm.for_sale ? wrapForm.for_sale_price_is_pm : false,
  for_sale_price:
    wrapForm.for_sale && !wrapForm.for_sale_price_is_pm && wrapForm.for_sale_price
      ? Number(wrapForm.for_sale_price)
      : null,
  for_sale_currency:
    wrapForm.for_sale && !wrapForm.for_sale_price_is_pm
      ? wrapForm.for_sale_currency || 'AUD'
      : null,

  is_favourite: wrapForm.is_favourite,
}

    let wrapId = wrapForm.id

    if (wrapForm.id) {
      const { error } = await supabase
        .from('wraps')
        .update(wrapPayload)
        .eq('id', wrapForm.id)

      if (error) {
        console.error(error)
        setIsSavingWrap(false)
        return
      }
    } else {
      const { data, error } = await supabase
        .from('wraps')
        .insert(wrapPayload)
        .select('id')
        .single()

      if (error || !data) {
        console.error(error)
        setIsSavingWrap(false)
        return
      }

      wrapId = data.id
    }

       if (wrapId) {
      const { error: deleteExistingImagesError } = await supabase
        .from('wrap_images')
        .delete()
        .eq('wrap_id', wrapId)

      if (deleteExistingImagesError) {
        console.error('wrap_images delete error', deleteExistingImagesError)
        setIsSavingWrap(false)
        return
      }

     const savedImages = wrapForm.images.filter(
  (image) => image.status === 'uploaded'
)

const hasPrimary = savedImages.some((image) => image.is_primary)

const uploadedImages = savedImages.map((image, index) => ({
  wrap_id: wrapId,
  image_url: image.image_url,
  is_primary: hasPrimary ? image.is_primary : index === 0,
  sort_order: index,
}))

      if (uploadedImages.length > 0) {
        const { error: insertImagesError } = await supabase
          .from('wrap_images')
          .insert(uploadedImages)

        if (insertImagesError) {
          console.error('wrap_images insert error', insertImagesError)
          setIsSavingWrap(false)
          return
        }
      }
    }

        if (wrapId && wrapForm.for_sale && !wasForSale) {
      const { data: wishlistUsers } = await supabase
        .from('wishlists')
        .select('user_id')
        .eq('wrap_id', wrapId)
        .neq('user_id', currentUserId)

      const recipientIds = [...new Set((wishlistUsers || []).map((row) => row.user_id))]

      if (recipientIds.length > 0) {
        await supabase.from('notifications').insert(
          recipientIds.map((recipientId) => ({
            recipient_user_id: recipientId,
            actor_user_id: currentUserId,
            wrap_id: wrapId,
            type: 'for_sale' as const,
          }))
        )
      }
    }

    await loadData()
    setIsSavingWrap(false)
    closeWrapModal()
  }

  function markWrapAsDeparted() {
    if (!wrapForm.id) return

    const confirmed = window.confirm('Move this wrap to Departed Wraps?')
    if (!confirmed) return

    setWrapForm((previous) => ({
      ...previous,
      status: 'departed',
      sold_date: previous.sold_date || new Date().toISOString().slice(0, 10),
    }))
  }

  async function deleteWrap() {
    if (!wrapForm.id) return
    const confirmed = window.confirm('Delete this wrap permanently?')
    if (!confirmed) return

    setIsSavingWrap(true)

    const { error } = await supabase
      .from('wraps')
      .delete()
      .eq('id', wrapForm.id)

    if (error) {
      console.error(error)
      setIsSavingWrap(false)
      return
    }

    await loadData()
    setIsSavingWrap(false)
    closeWrapModal()
  }
  async function copyReportTable() {
  if (reportRows.length === 0) return

  const header = ['Wrap Name', 'Status', 'Date Bought', 'Price Paid', 'Price Sold']

  const lines = reportRows.map((row) => [
    row.wrap_name,
    row.wrap_status,
    row.purchase_date || '',
    row.purchase_price !== null ? String(row.purchase_price) : '',
    row.sold_price !== null ? String(row.sold_price) : '',
  ])

  const text = [header, ...lines].map((row) => row.join('\t')).join('\n')

  try {
    await navigator.clipboard.writeText(text)
    window.alert('Report table copied')
  } catch (error) {
    console.error(error)
    window.alert('Could not copy report table')
  }
}
function exportReportCsv() {
  if (reportRows.length === 0) return

  const headers = [
    'Wrap Name',
    'Status',
    'Date Bought',
    'Price Paid',
    'Price Sold',
  ]

  const rows = reportRows.map((row) => [
    row.wrap_name,
    row.wrap_status,
    row.purchase_date || '',
    row.purchase_price !== null ? String(row.purchase_price) : '',
    row.sold_price !== null ? String(row.sold_price) : '',
  ])

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(',')
    )
    .join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.setAttribute('download', 'wrap-report.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
  function createDipFromWrap() {
    const params = new URLSearchParams()

    if (wrapForm.id) params.set('wrapId', wrapForm.id)
    if (wrapForm.name) params.set('wrapName', wrapForm.name)
    if (wrapForm.brand) params.set('brand', wrapForm.brand)

    router.push(`/create-dip?${params.toString()}`)
  }

  if (loading && !profile && wraps.length === 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
          <p className="text-sm font-semibold text-gray-500">Loading WrapApp...</p>
        </div>
      </div>
    )
  }

  return (
        <AppLayout>
      <div className="space-y-6">
        
        <div className="xl:hidden">
          <div className="grid grid-cols-2 rounded-xl border bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setMobileTab('collection')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                mobileTab === 'collection'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Collection
            </button>

            <button
  type="button"
  onClick={() => setMobileTab('activity')}
  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
    mobileTab === 'activity'
      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm'
      : 'text-gray-600'
  }`}
>
  <span className="flex items-center justify-center gap-2">
    <span>Activity</span>
    {unreadNotificationCount > 0 && (
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
          mobileTab === 'activity'
            ? 'bg-white text-pink-600'
            : 'bg-pink-600 text-white'
        }`}
      >
        {unreadNotificationCount}
      </span>
    )}
  </span>
</button>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[3fr_1fr]">
                    <section
            className={`order-2 rounded-3xl border bg-white p-2 shadow-sm xl:order-1 xl:p-5 ${
              mobileTab === 'activity' ? 'hidden xl:block' : 'block'
            }`}
          >
<div className="mb-5 flex items-center justify-between gap-3">
  <h2 className="text-2xl font-bold text-gray-900">
    Your Collection
  </h2>

  <button
    type="button"
    onClick={openNewWrapModal}
    className="shrink-0 cursor-pointer rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
  >
    Add Wrap
  </button>
</div>

            {loading && wraps.length === 0 ? (
              <p className="text-sm text-gray-500">Loading wraps...</p>
            ) : collectionWraps.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-8 text-center">
                <p className="text-gray-600">No wraps yet</p>
                <button
                  type="button"
                  onClick={openNewWrapModal}
                  className="mt-4 cursor-pointer rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Add your first wrap
                </button>
              </div>
            ) : (<div className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
              
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
  loading="lazy"
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
        ? formatCurrency(wrap.for_sale_price, wrap.for_sale_currency || 'AUD')
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
  <h3 className="text-sm font-bold leading-tight text-gray-900 xl:text-base xl:leading-normal">{wrap.name}</h3>
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
  loading="lazy"
  alt={wrap.name}
  className="h-full w-full object-cover object-[center_20%] opacity-90 transition duration-300 group-hover:scale-[1.03]"
/>
                        {wrap.for_sale && (
  <div className="absolute left-3 top-3 rounded-xl bg-white/90 px-2 py-1 text-xs font-semibold text-amber-700 shadow">
    🪓 For Sale
    {wrap.for_sale_price !== null && (
  <div className="text-[10px] font-medium text-gray-700">
    {formatCurrency(wrap.for_sale_price, wrap.for_sale_currency || 'AUD')}
  </div>
)}
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

                             <section
            className={`order-1 bg-white p-3 xl:order-2 xl:rounded-3xl xl:border xl:p-5 xl:shadow-sm ${
              mobileTab === 'collection' ? 'hidden xl:block' : 'block'
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-3 xl:mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900 xl:text-2xl">Activity</h2>
                <p className="text-sm text-gray-500">
                  Updates and quick links.
                </p>
              </div>

              {notifications.length > 0 && (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="rounded-lg border px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                  >
                    Mark all read
                  </button>
                  <button
                    type="button"
                    onClick={clearAllNotifications}
                    disabled={isClearingNotifications}
                    className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    {isClearingNotifications ? 'Clearing...' : 'Clear all'}
                  </button>
                </div>
              )}
            </div>

                       <div className="space-y-2 xl:space-y-3">
              {notifications.map((notification) => {
                const wrap = notification.wrap
                const wrapName = wrap?.name || 'Wrap'
                const imageUrl = getPrimaryImage(wrap || undefined)

                const title =
                  notification.type === 'like' && notification.wrap
                    ? `${notification.actor_name} liked your wrap`
                    : notification.type === 'like' && !notification.wrap
                    ? `${notification.actor_name} liked your WDYWT post`
                    : notification.type === 'wishlist'
                    ? `${notification.actor_name} added your wrap to their wishlist`
                    : notification.type === 'comment'
                    ? `${notification.actor_name} commented on your WDYWT post`
                    : `${wrapName} from your wishlist is now for sale`

                const meta =
                  notification.type === 'for_sale'
                    ? wrap?.for_sale_price_is_pm
                      ? 'PM'
                      : wrap?.for_sale_price !== null && wrap?.for_sale_price !== undefined
                      ? formatCurrency(wrap.for_sale_price, wrap.for_sale_currency || 'AUD')
                      : 'For Sale'
                    : wrapName

                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full cursor-pointer rounded-2xl border p-3 text-left shadow-sm transition hover:shadow-md ${
                      !notification.read_at
                        ? 'border-l-4 border-l-pink-500 bg-pink-50'
                        : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {notification.actor_avatar ? (
                        <img
                          src={notification.actor_avatar}
                          alt={notification.actor_name}
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-bold text-white">
                          {getInitials(notification.actor_name)}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          {notification.type === 'for_sale' ? 'FOR SALE' : 'ACTIVITY'}
                        </p>

                        <p className="line-clamp-2 text-sm font-semibold text-gray-900">
                          {title}
                        </p>

                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
                          <span className="truncate">{meta}</span>
                          <span>•</span>
                          <span>{formatTimeAgo(notification.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}

              {dips.map((dip) => {
                const linkedWrap = dip.wrap_id ? wrapsById[dip.wrap_id] : undefined
                const imageUrl = getPrimaryImage(linkedWrap)
                const progress = getDipProgress(dip)

                return (
                  <button
                    key={dip.id}
                    type="button"
                    onClick={() => router.push(`/dips/${dip.id}`)}
                    className="w-full cursor-pointer rounded-2xl border bg-white p-3 text-left shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3 pointer-events-none">
                      <img
                        src={imageUrl}
                        alt={dip.title}
                        className="h-12 w-12 shrink-0 rounded-xl object-cover object-[center_30%]"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="mb-0.5 text-[10px] font-semibold text-gray-400">
                          MY DIP
                        </p>

                        <div className="flex items-start justify-between gap-2">
                          <h3 className="truncate text-sm font-bold text-gray-900">
                            {dip.title}
                          </h3>

                          <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-semibold text-pink-600">
                            {getStageLabel(dip.stage, dip.status)}
                          </span>
                        </div>

                        <p className="mt-0.5 truncate text-[11px] text-gray-500">
                          {dip.total_spots} spots • {formatCurrency(dip.price_per_spot, 'AUD')} per spot
                        </p>

                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}

              {notifications.length === 0 && dips.length === 0 && (
                <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-500">
                  No activity yet
                </div>
              )}
            </div>
          </section>
        </div>
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

            {selectedWrap.user_id !== currentUserId && (
              <>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                    'border-pink-200 bg-pink-50 text-pink-600'
                  }`}
                >
                  ❤️ {selectedWrapCounts.likes}
                </button>

                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
                    'border-amber-200 bg-amber-50 text-amber-700'
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
          {!isReadOnlyWrapView && (
            <button
              type="button"
              onClick={() => {
                closeViewWrapModal()
                openEditWrapModal(selectedWrap)
              }}
              className="cursor-pointer rounded-xl border px-3 py-1 text-sm font-semibold text-gray-700"
            >
              Edit
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

      <div className="mt-6 flex flex-wrap gap-3">
        

        
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
                className="max-h-[90vh] w-full rounded-2xl object-contain bg-black"
              />
            </div>
          </div>
       )}

        {isReportModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
            onClick={closeReportModal}
          >
            <div
              className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
      
    >
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Wrap Report
                  </h2>
                  <p className="text-sm text-gray-500">
                    View and export your wrap collection report.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeReportModal}
                  className="cursor-pointer rounded-full border px-3 py-1 text-sm text-gray-600"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Date From
    </label>
    <input
      type="date"
      value={reportDateFrom}
      onChange={(event) => setReportDateFrom(event.target.value)}
      className="w-full rounded-xl border px-3 py-2 outline-none focus:border-pink-500"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Date To
    </label>
    <input
      type="date"
      value={reportDateTo}
      onChange={(event) => setReportDateTo(event.target.value)}
      className="w-full rounded-xl border px-3 py-2 outline-none focus:border-pink-500"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Status
    </label>
    <select
      value={reportStatusFilter}
      onChange={(event) =>
        setReportStatusFilter(
          event.target.value as 'all' | 'collection' | 'departed'
        )
      }
      className="w-full rounded-xl border px-3 py-2 outline-none focus:border-pink-500"
    >
      <option value="all">All</option>
      <option value="collection">Collection</option>
      <option value="departed">Departed</option>
    </select>
  </div>
</div>
<div className="mt-6 grid gap-4 md:grid-cols-3">
  <div className="rounded-2xl border bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      Number of Wraps
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900">
      {reportRows.length}
    </p>
  </div>

  <div className="rounded-2xl border bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      Total Purchase Value
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900">
      {formatCurrency(reportTotals.totalPurchaseValue, 'AUD')}
    </p>
  </div>

  <div className="rounded-2xl border bg-white p-4 shadow-sm">
    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
      Total Sold Value
    </p>
    <p className="mt-2 text-2xl font-bold text-gray-900">
      {formatCurrency(reportTotals.totalSoldValue, 'AUD')}
    </p>
  </div>
</div>
<div className="mt-6 flex flex-wrap gap-3">
  <button
    type="button"
    onClick={exportReportCsv}
    disabled={reportRows.length === 0}
    className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
  >
    Export CSV
  </button>

  <button
    type="button"
    onClick={copyReportTable}
    disabled={reportRows.length === 0}
    className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50"
  >
    Copy Table
  </button>
</div>
<div className="mt-6 overflow-hidden rounded-2xl border bg-white">
  {reportRows.length === 0 ? (
    <div className="p-8 text-center text-sm text-gray-500">
      No wraps found for this report
    </div>
  ) : (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">
              Wrap Name
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">
              Status
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">
              Date Purchased
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">
              Price Paid
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">
              Price Sold
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {reportRows.map((row) => (
            <tr key={row.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-900">{row.wrap_name}</td>
              <td className="px-4 py-3 text-gray-600">{row.wrap_status}</td>
              <td className="px-4 py-3 text-gray-600">
                {row.purchase_date || '—'}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {row.purchase_price !== null
                  ? formatCurrency(row.purchase_price, 'AUD')
                  : '—'}
              </td>
              <td className="px-4 py-3 text-gray-600">
                {row.sold_price !== null
                  ? formatCurrency(row.sold_price, 'AUD')
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
            </div>
          </div>
        )}

              
        {isWrapModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {wrapForm.id ? 'Edit Wrap' : 'Add Wrap'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    Save wrap details without leaving the dashboard.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeWrapModal}
                  className="cursor-pointer rounded-full border px-3 py-1 text-sm text-gray-600"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Name of Wrap
    </label>
    <input
      value={wrapForm.name}
      onChange={(event) => updateWrapForm('name', event.target.value)}
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />
  </div>

  <div className="relative">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Brand
    </label>
    <input
      value={wrapForm.brand}
      onChange={(event) => updateWrapForm('brand', event.target.value)}
      placeholder="e.g. Didymos, Oscha"
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />
    {brandSuggestions.length > 0 && (
      <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg">
        {brandSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { updateWrapForm('brand', s); setBrandSuggestions([]) }}
            className="flex w-full px-3 py-2 text-left text-sm hover:bg-pink-50 first:rounded-t-xl last:rounded-b-xl"
          >
            {s}
          </button>
        ))}
      </div>
    )}
  </div>

    <div className="relative">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Size / STIH
    </label>
    <input
      value={wrapForm.size}
      onChange={(event) => updateWrapForm('size', event.target.value)}
      placeholder="e.g. Size 6, 4.2m"
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />
    {sizeSuggestions.length > 0 && (
      <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg">
        {sizeSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { updateWrapForm('size', s); setSizeSuggestions([]) }}
            className="flex w-full px-3 py-2 text-left text-sm hover:bg-pink-50 first:rounded-t-xl last:rounded-b-xl"
          >
            {s}
          </button>
        ))}
      </div>
    )}
  </div>

  <div className="relative">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Blend / Material
    </label>
    <input
      value={wrapForm.material}
      onChange={(event) => updateWrapForm('material', event.target.value)}
      placeholder="e.g. 100% cotton, linen/cotton"
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />
    {materialSuggestions.length > 0 && (
      <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg">
        {materialSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { updateWrapForm('material', s); setMaterialSuggestions([]) }}
            className="flex w-full px-3 py-2 text-left text-sm hover:bg-pink-50 first:rounded-t-xl last:rounded-b-xl"
          >
            {s}
          </button>
        ))}
      </div>
    )}
  </div>

  <div className="relative">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Colour
    </label>
    <input
      value={wrapForm.colour}
      onChange={(event) => updateWrapForm('colour', event.target.value)}
      placeholder="e.g. Blue, Rainbow, Earth tones"
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />
    {colourSuggestions.length > 0 && (
      <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg">
        {colourSuggestions.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => { updateWrapForm('colour', s); setColourSuggestions([]) }}
            className="flex w-full px-3 py-2 text-left text-sm hover:bg-pink-50 first:rounded-t-xl last:rounded-b-xl"
          >
            {s}
          </button>
        ))}
      </div>
    )}
  </div>

  <div className="relative">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Dibs
    </label>
    <input
      value={wrapForm.dibs_search}
      onChange={(event) => {
        updateWrapForm('dibs_search', event.target.value)
        updateWrapForm('dibs_user_id', null)
      }}
      placeholder="Search for a user..."
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />

    {dibsSearchLoading && (
      <p className="mt-1 text-xs text-gray-400">Searching...</p>
    )}

    {dibsSearchResults.length > 0 && !wrapForm.dibs_user_id && (
      <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg">
        {dibsSearchResults.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => {
              updateWrapForm('dibs_user_id', user.id)
              updateWrapForm('dibs_search', user.name)
              setDibsSearchResults([])
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-pink-50 first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="font-semibold text-gray-900">{user.name}</span>
            {user.username && (
              <span className="text-gray-400">@{user.username}</span>
            )}
          </button>
        ))}
      </div>
    )}

    {wrapForm.dibs_user_id && (
      <div className="mt-1 flex items-center gap-2">
        <p className="text-xs text-pink-600 font-medium">
          ✓ Dibs linked to {wrapForm.dibs_search}
        </p>
        <button
          type="button"
          onClick={() => {
            updateWrapForm('dibs_user_id', null)
            updateWrapForm('dibs_search', '')
          }}
          className="text-xs text-gray-400 hover:text-red-500"
        >
          Remove
        </button>
      </div>
    )}

    <p className="mt-1 text-xs text-gray-500">
      First right to buy if listed for sale
    </p>
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Date Purchased
    </label>
    <input
      type="date"
      value={wrapForm.purchase_date}
      onChange={(event) =>
        updateWrapForm('purchase_date', event.target.value)
      }
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
    />
  </div>

  <div className="relative">
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Purchased From
    </label>
    <input
      value={wrapForm.purchased_from}
      onChange={(event) =>
        updateWrapForm('purchased_from', event.target.value)
      }
      placeholder="Search user or type a name..."
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
    />

    {purchasedFromLoading && (
      <p className="mt-1 text-xs text-gray-400">Searching...</p>
    )}

    {purchasedFromResults.length > 0 && (
      <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow-lg">
        {purchasedFromResults.map((user) => (
          <button
            key={user.id}
            type="button"
            onClick={() => {
              updateWrapForm('purchased_from', user.name)
              setPurchasedFromResults([])
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-pink-50 first:rounded-t-xl last:rounded-b-xl"
          >
            <span className="font-semibold text-gray-900">{user.name}</span>
            {user.username && (
              <span className="text-gray-400">@{user.username}</span>
            )}
          </button>
        ))}
      </div>
    )}
  </div>

    <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Purchase Price
    </label>
    <input
      type="number"
      step="0.01"
      value={wrapForm.purchase_price}
      onChange={(event) =>
        updateWrapForm('purchase_price', event.target.value)
      }
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
    />
    <p className="mt-1 text-xs text-gray-500">
      Only you can see this. Other users cannot view your purchase price.
    </p>
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Currency
    </label>
    <select
      value={wrapForm.purchase_currency}
      onChange={(event) =>
        updateWrapForm(
          'purchase_currency',
          event.target.value as CurrencyCode
        )
      }
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
    >
      <option value="AUD">AUD</option>
      <option value="USD">USD</option>
      <option value="EUR">EUR</option>
    </select>
    <p className="mt-1 text-xs text-gray-500">
Record own currency for accurate reporting
</p>
  </div>

  

  <div className="md:col-span-2">
<label className="mb-2 block text-sm font-medium text-gray-700">
  Wrap Images (Max {MAX_WRAP_IMAGES})
</label>

{/* Upload Button */}
<div className="flex items-center gap-3 mb-3">
  <label className="cursor-pointer rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90">
    {isUploadingImages ? 'Uploading...' : 'Upload Images'}
    <input
      type="file"
      accept="image/*"
      multiple
      onChange={(event) => {
        if (event.target.files) {
          uploadWrapImages(event.target.files)
        }
      }}
      className="hidden"
    />
  </label>

  <span className="text-xs text-gray-500">
    {wrapForm.images.length}/{MAX_WRAP_IMAGES} images
  </span>
</div>

{/* Upload warning */}
{isUploadingImages && (
  <p className="mb-3 text-xs text-amber-600">
    Uploading images... please wait before closing
  </p>
)}

{/* Image Grid */}
{wrapForm.images.length > 0 && (
  <div className="grid grid-cols-3 gap-3">
    {wrapForm.images.map((image) => (
      <div
        key={image.id}
        className={`relative rounded-xl overflow-hidden border ${
          image.is_primary ? 'border-pink-500' : 'border-gray-200'
        }`}
      >
        <img
          src={image.image_url}
          className="h-24 w-full object-cover cursor-pointer"
          onClick={() => setCoverPhoto(image.id)}
        />

        {/* Cover badge */}
        {image.is_primary && (
          <div className="absolute top-1 left-1 rounded bg-white/90 px-2 py-0.5 text-xs font-semibold text-pink-600">
            Cover
          </div>
        )}

        {/* Uploading overlay */}
        {image.status === 'uploading' && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs">
            Uploading...
          </div>
        )}

        {/* Error overlay */}
        {image.status === 'error' && (
          <div className="absolute inset-0 bg-red-500/70 flex items-center justify-center text-white text-xs">
            Error
          </div>
        )}

        {/* Actions */}
<div className="absolute inset-x-1 bottom-1 flex gap-1 xl:bottom-1 xl:left-1 xl:right-1 xl:flex xl:justify-between xl:gap-1 xl:rounded-lg xl:bg-transparent xl:p-0">
  <button
    type="button"
    onClick={() => removeWrapImage(image.id)}
    className="min-w-0 flex-1 rounded bg-white/95 px-1 py-0.5 text-[10px] leading-tight text-gray-900 shadow-sm xl:px-0 xl:py-1 xl:text-xs xl:font-normal"
  >
    Remove
  </button>

  <label className="min-w-0 flex-1 cursor-pointer rounded bg-white/95 px-1 py-0.5 text-center text-[10px] leading-tight text-gray-900 shadow-sm xl:px-0 xl:py-1 xl:text-xs xl:font-normal">
    Replace
    <input
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) replaceWrapImage(image.id, file)
      }}
    />
  </label>
</div>
      </div>
    ))}
  </div>
)}
</div>

  <div>
    <label className="mb-1 block text-sm font-medium text-gray-700">
      Status
    </label>
    <select
      value={wrapForm.status}
      onChange={(event) =>
        updateWrapForm(
          'status',
          event.target.value as 'active' | 'holiday' | 'departed'
        )
      }
      className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
    >
      <option value="active">Active</option>
      <option value="holiday">On Holiday</option>
      <option value="departed">Departed</option>
    </select>
  </div>

  {wrapForm.status === 'holiday' && (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        On Holiday With
      </label>
      <input
        value={wrapForm.on_loan_to}
        onChange={(event) =>
          updateWrapForm('on_loan_to', event.target.value)
        }
        placeholder="Borrower name"
        className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
      />
    </div>
  )}

  {wrapForm.status === 'departed' && (
    <>
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Sold To
        </label>
        <input
          value={wrapForm.sold_to}
          onChange={(event) =>
            updateWrapForm('sold_to', event.target.value)
          }
          className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 placeholder:text-gray-400 outline-none focus:border-pink-500 xl:text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Date Sold
        </label>
        <input
          type="date"
          value={wrapForm.sold_date}
          onChange={(event) =>
            updateWrapForm('sold_date', event.target.value)
          }
          className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Sold Price
        </label>
        <input
          type="number"
          step="0.01"
          value={wrapForm.sold_price}
          onChange={(event) =>
            updateWrapForm('sold_price', event.target.value)
          }
          className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Sold Currency
        </label>
        <select
          value={wrapForm.sold_currency}
          onChange={(event) =>
            updateWrapForm(
              'sold_currency',
              event.target.value as CurrencyCode
            )
          }
          className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
        >
          <option value="AUD">AUD</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
Record own currency for accurate reporting
</p>
      </div>
    </>
  )}

  <div className="md:col-span-2 flex flex-col gap-4">
<div className="flex items-center gap-4">
  <div className="flex items-center gap-2">
    <input
      id="wrap-favourite"
      type="checkbox"
      checked={wrapForm.is_favourite}
      onChange={(event) =>
        updateWrapForm('is_favourite', event.target.checked)
      }
    />
    <label
      htmlFor="wrap-favourite"
      className="text-sm font-medium text-gray-700"
    >
      Perma
    </label>
  </div>

  <div className="flex items-center gap-2">
    <input
      id="wrap-for-sale"
      type="checkbox"
      checked={wrapForm.for_sale}
      onChange={(event) => {
        const checked = event.target.checked

        updateWrapForm('for_sale', checked)

        // auto-fill price if empty
        if (checked && !wrapForm.for_sale_price && wrapForm.purchase_price) {
          updateWrapForm('for_sale_price', wrapForm.purchase_price)
          updateWrapForm('for_sale_currency', wrapForm.purchase_currency)
        }
      }}
    />
    <label
      htmlFor="wrap-for-sale"
      className="text-sm font-medium text-gray-700"
    >
      For Sale
    </label>
  </div>
</div>

{wrapForm.for_sale && (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <input
        id="wrap-for-sale-pm"
        type="checkbox"
        checked={wrapForm.for_sale_price_is_pm}
        onChange={(event) => {
          const checked = event.target.checked
          updateWrapForm('for_sale_price_is_pm', checked)
          if (checked) {
            updateWrapForm('for_sale_price', '')
          }
        }}
      />
      <label
        htmlFor="wrap-for-sale-pm"
        className="text-sm font-medium text-gray-700"
      >
        List price as PM
      </label>
    </div>

    {!wrapForm.for_sale_price_is_pm && (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Sale Price
          </label>
          <input
            type="number"
            step="0.01"
            value={wrapForm.for_sale_price}
            onChange={(event) =>
              updateWrapForm('for_sale_price', event.target.value)
            }
            className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Currency
          </label>
          <select
            value={wrapForm.for_sale_currency}
            onChange={(event) =>
              updateWrapForm(
                'for_sale_currency',
                event.target.value as CurrencyCode
              )
            }
            className="w-full rounded-xl border px-3 py-2 text-base text-gray-900 outline-none focus:border-pink-500 xl:text-sm"
          >
            <option value="AUD">AUD</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </div>
      </div>
    )}
  </div>
)}
</div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
  type="button"
  onClick={saveWrap}
  disabled={isSavingWrap || isUploadingImages}
                  className="cursor-pointer rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {isUploadingImages
  ? 'Waiting for images...'
  : isSavingWrap
  ? 'Saving...'
  : 'Save Wrap'}
                </button>

                                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded-xl border px-4 py-2 text-sm font-semibold text-gray-400 bg-gray-100"
                >
                  Create Dip
                </button>

                {wrapForm.id && wrapForm.status !== 'departed' && (
                  <button
                    type="button"
                    onClick={markWrapAsDeparted}
                    className="cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold text-gray-700"
                  >
                    Sold
                  </button>
                )}

                {wrapForm.id && (
                  <button
                    type="button"
                    onClick={deleteWrap}
                    className="cursor-pointer rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}