'use client'

// First-launch onboarding (welcome → profile photo → first wrap → follow collectors).
// Mounted by AppLayout on every main page. Shows once for a new user: no avatar AND no wraps,
// and 'wrapapp_onboarded' not set. Established users are recognised from the cached profile /
// wraps first, so they never pay for a query.

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'
import { useLockBodyScroll } from './useLockBodyScroll'

const ONBOARDED_KEY = 'wrapapp_onboarded'
const PROFILE_CACHE_KEY = 'dipdesk_dashboard_profile'
const WRAPS_CACHE_KEY = 'dipdesk_dashboard_wraps'
const SUGGESTION_LIMIT = 6

type Suggestion = {
  id: string
  name: string
  avatarUrl: string | null
  wrapCount: number
}

function markOnboarded() {
  try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {}
}

export default function Onboarding({ onAvatarChange }: { onAvatarChange?: (url: string) => void }) {
  const router = useRouter()
  const pathname = usePathname()

  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [userId, setUserId] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [onboardingAvatar, setOnboardingAvatar] = useState<string | null>(null)
  const [isUploadingOnboardingAvatar, setIsUploadingOnboardingAvatar] = useState(false)
  // Step 4
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [followBusyId, setFollowBusyId] = useState<string | null>(null)
  // Chosen on step 3: open the add-wrap form when onboarding finishes
  const [addWrapAfter, setAddWrapAfter] = useState(false)

  useLockBodyScroll(showOnboarding)

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        if (localStorage.getItem(ONBOARDED_KEY)) return
      } catch { return }

      // Local session only (no network)
      const { data: { session } } = await supabase.auth.getSession()
      const uid = session?.user?.id
      if (!uid || cancelled) return

      // Cache first: an avatar or any wraps means this isn't a new user
      try {
        const cachedProfile = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || 'null')
        if (cachedProfile && String(cachedProfile.id) === String(uid)) {
          if (cachedProfile.avatar_url) { markOnboarded(); return }
          const cachedWraps = JSON.parse(localStorage.getItem(WRAPS_CACHE_KEY) || 'null')
          if (Array.isArray(cachedWraps) && cachedWraps.length > 0) { markOnboarded(); return }
        }
      } catch {}

      // No cache that proves it → one small check (avatar + wrap count)
      const [{ data: profileData }, { count: wrapCount }] = await Promise.all([
        supabase.from('profiles').select('full_name, username, avatar_url').eq('id', uid).maybeSingle(),
        supabase.from('my_wraps').select('id', { count: 'exact', head: true }),
      ])
      if (cancelled) return

      const hasNoAvatar = !profileData?.avatar_url
      const hasNoWraps = !wrapCount
      if (!(hasNoAvatar && hasNoWraps)) { markOnboarded(); return }

      setUserId(uid)
      setFirstName((profileData?.full_name || '').split(' ')[0] || '')
      setShowOnboarding(true)
      void loadSuggestions(uid)
    }

    // Suggested collectors — same rules as Explore: not me, not already followed,
    // at least one wrap; newest wrap activity first, then most wraps.
    async function loadSuggestions(uid: string) {
      const [{ data: recentWraps }, { data: myFollows }] = await Promise.all([
        supabase
          .from('wraps')
          .select('user_id, created_at')
          .in('status', ['active', 'holiday'])
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('follows').select('following_id').eq('follower_id', uid),
      ])
      if (cancelled) return

      const alreadyFollowing = new Set((myFollows || []).map((f) => String(f.following_id)))
      const latestByUser: Record<string, number> = {}
      for (const wrap of recentWraps || []) {
        const id = String(wrap.user_id)
        const t = new Date(wrap.created_at).getTime()
        if (!Number.isNaN(t) && t > (latestByUser[id] || 0)) latestByUser[id] = t
      }
      const candidateIds = Object.keys(latestByUser).filter((id) => id !== String(uid) && !alreadyFollowing.has(id))
      if (candidateIds.length === 0) return

      // Real wrap counts + names/avatars for the candidates
      const [{ data: countRows }, { data: profiles }] = await Promise.all([
        supabase.from('wraps').select('user_id').in('user_id', candidateIds),
        supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', candidateIds),
      ])
      if (cancelled) return

      const counts: Record<string, number> = {}
      for (const row of countRows || []) counts[String(row.user_id)] = (counts[String(row.user_id)] || 0) + 1
      const profileById = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]))

      const list: Suggestion[] = candidateIds
        .filter((id) => (counts[id] || 0) > 0 && profileById[id])
        .sort((a, b) => (latestByUser[b] || 0) - (latestByUser[a] || 0) || (counts[b] || 0) - (counts[a] || 0))
        .slice(0, SUGGESTION_LIMIT)
        .map((id) => ({
          id,
          name: profileById[id].full_name || profileById[id].username || 'Collector',
          avatarUrl: profileById[id].avatar_url || null,
          wrapCount: counts[id] || 0,
        }))
      setSuggestions(list)
    }

    void check()
    return () => { cancelled = true }
  }, [])

  async function uploadOnboardingAvatar(file: File) {
    if (!userId) return
    setIsUploadingOnboardingAvatar(true)
    try {
      file = await imageCompression(file, { maxSizeMB: 0.3, maxWidthOrHeight: 400, useWebWorker: true })
    } catch {}
    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${userId}/avatar.${fileExt}`
    const { error } = await supabase.storage.from('avatars').upload(fileName, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId)
      setOnboardingAvatar(avatarUrl)
      onAvatarChange?.(avatarUrl)
      const cached = localStorage.getItem(PROFILE_CACHE_KEY)
      if (cached) {
        try {
          const p = JSON.parse(cached)
          localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({ ...p, avatar_url: avatarUrl }))
        } catch {}
      }
    }
    setIsUploadingOnboardingAvatar(false)
  }

  async function toggleFollow(person: Suggestion) {
    if (!userId || followBusyId) return
    setFollowBusyId(person.id)
    if (followedIds.has(person.id)) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', person.id)
      if (!error) setFollowedIds((prev) => { const next = new Set(prev); next.delete(person.id); return next })
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: userId, following_id: person.id, status: 'accepted' })
      if (!error) setFollowedIds((prev) => new Set(prev).add(person.id))
    }
    setFollowBusyId(null)
  }

  // Open the same add-wrap form the ➕ sheet opens
  function openAddWrap() {
    if (pathname === '/dashboard') window.dispatchEvent(new Event('wrapapp:add-wrap'))
    else router.push('/dashboard?add=1')
  }

  // Step 3 → step 4 (or finish straight away if there's nobody to suggest)
  function afterFirstWrapStep(addWrap: boolean) {
    if (suggestions.length > 0) {
      setAddWrapAfter(addWrap)
      setOnboardingStep(4)
      return
    }
    markOnboarded()
    setShowOnboarding(false)
    if (addWrap) openAddWrap()
  }

  function finish() {
    markOnboarded()
    setShowOnboarding(false)
    if (addWrapAfter) openAddWrap()
    else if (pathname !== '/explore') router.push('/explore')
  }

  if (!showOnboarding) return null

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white overflow-y-auto pt-[env(safe-area-inset-top)]">

      {onboardingStep === 1 && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg">
            <img src="/icon-512.png" alt="WrapApp" className="h-20 w-20 rounded-2xl" />
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">
            Welcome to WrapApp{firstName ? `, ${firstName}` : ''}! 🎉
          </h1>
          <p className="text-gray-500 text-base mb-6 leading-relaxed">
            Your home for wrap collecting, sharing, and discovering.
          </p>
          <div className="space-y-3 w-full text-left">
            <div className="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3">
              <span className="text-2xl">👜</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Manage your collection</p>
                <p className="text-xs text-gray-500">Track, organise and showcase your wraps</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3">
              <span className="text-2xl">🔍</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Discover the community</p>
                <p className="text-xs text-gray-500">Explore other collections and connect</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-pink-50 px-4 py-3">
              <span className="text-2xl">🛍️</span>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Buy and sell wraps</p>
                <p className="text-xs text-gray-500">List your wraps for sale within the community</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOnboardingStep(2)}
            className="mt-8 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-4 text-base font-bold text-white shadow-lg"
          >
            Let&apos;s get started →
          </button>
        </div>
      )}

      {onboardingStep === 2 && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Add a profile photo</h2>
          <p className="text-gray-500 text-sm mb-8">Help the community put a face to your collection</p>
          <label className="relative cursor-pointer group mb-8">
            {onboardingAvatar ? (
              <img src={onboardingAvatar} alt="Your avatar" className="h-32 w-32 rounded-full object-cover ring-4 ring-pink-200 shadow-lg" />
            ) : (
              <div className="h-32 w-32 rounded-full bg-gradient-to-br from-pink-100 to-rose-100 ring-4 ring-pink-200 shadow-lg flex flex-col items-center justify-center">
                <span className="text-4xl">📷</span>
                <p className="text-xs text-pink-400 font-semibold mt-1">Tap to upload</p>
              </div>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadOnboardingAvatar(file) }} />
          </label>
          {isUploadingOnboardingAvatar && <p className="text-sm text-pink-500 mb-4">Uploading...</p>}
          <button
            type="button"
            onClick={() => setOnboardingStep(3)}
            disabled={isUploadingOnboardingAvatar}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-4 text-base font-bold text-white shadow-lg disabled:opacity-50 mb-3"
          >
            {onboardingAvatar ? 'Looking great! Continue →' : 'Continue →'}
          </button>
          <button type="button" onClick={() => setOnboardingStep(3)} className="text-sm text-gray-400">
            Skip for now
          </button>
        </div>
      )}

      {onboardingStep === 3 && (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <span className="text-6xl mb-6">👜</span>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Add your first wrap</h2>
          <p className="text-gray-500 text-sm mb-8 leading-relaxed">
            Start building your collection. Add photos, details, and track every wrap you own.
          </p>
          <button
            type="button"
            onClick={() => afterFirstWrapStep(true)}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-4 text-base font-bold text-white shadow-lg mb-3"
          >
            Add my first wrap 🎉
          </button>
          <button
            type="button"
            onClick={() => afterFirstWrapStep(false)}
            className="text-sm text-gray-400"
          >
            I&apos;ll do this later
          </button>
        </div>
      )}

      {onboardingStep === 4 && (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <span className="text-5xl mb-4">👋</span>
          <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Follow some collectors</h2>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            See their wraps and posts on Home.
          </p>
          <div className="grid w-full max-w-sm grid-cols-3 gap-x-2 gap-y-5">
            {suggestions.map((person) => {
              const isFollowing = followedIds.has(person.id)
              return (
                <div key={person.id} className="flex min-w-0 flex-col items-center">
                  {person.avatarUrl ? (
                    <img src={person.avatarUrl} alt={person.name} loading="lazy" className="h-16 w-16 rounded-full object-cover ring-2 ring-pink-100" />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xl font-bold text-white">
                      {person.name[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <p className="mt-1.5 w-full truncate text-xs font-semibold text-gray-900">{person.name}</p>
                  <p className="text-[11px] text-gray-500">{person.wrapCount} wrap{person.wrapCount === 1 ? '' : 's'}</p>
                  <button
                    type="button"
                    onClick={() => void toggleFollow(person)}
                    disabled={followBusyId === person.id}
                    className={`mt-1.5 h-8 min-w-[76px] rounded-full border px-3 text-xs font-semibold disabled:opacity-60 ${
                      isFollowing ? 'border-gray-200 bg-gray-100 text-gray-600' : 'border-pink-200 bg-pink-50 text-pink-600'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={finish}
            className="mt-8 w-full max-w-sm rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-4 text-base font-bold text-white shadow-lg"
          >
            {addWrapAfter ? 'Done — add my first wrap →' : 'Done'}
          </button>
        </div>
      )}

      <div className="flex justify-center gap-2 pt-4 pb-[calc(3rem+env(safe-area-inset-bottom))]">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className={`h-2 rounded-full transition-all duration-300 ${step === onboardingStep ? 'w-6 bg-pink-500' : 'w-2 bg-gray-200'}`} />
        ))}
      </div>
    </div>
  )
}
