'use client'

import AppLayout from '@/app/components/AppLayout'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from 'react'
import imageCompression from 'browser-image-compression'

const DASHBOARD_EMAIL_KEY = 'dipdesk_dashboard_email'
const DASHBOARD_PROFILE_KEY = 'dipdesk_dashboard_profile'

export default function Page() {
  const router = useRouter()
  const [avatar, setAvatar] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [uploading, setUploading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [showFeedback, setShowFeedback] = useState(false)
  const [showBioEdit, setShowBioEdit] = useState(false)
  const [savingBio, setSavingBio] = useState(false)
  const [bioSaved, setBioSaved] = useState(false)
  const [wrapCount, setWrapCount] = useState<number | null>(null)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)

  const isAdmin =
    typeof window !== 'undefined' &&
    localStorage.getItem(DASHBOARD_EMAIL_KEY) === 'paige.wilson26@outlook.com'

  useEffect(() => {
    const cached = localStorage.getItem(DASHBOARD_PROFILE_KEY)
    if (cached) {
      try {
        const p = JSON.parse(cached)
        setAvatar(p.avatar_url || null)
        setFullName(p.full_name || p.username || '')
        setBio(p.bio || '')
        setCurrentUserId(p.id || null)
      } catch {}
    }

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)

      const [
        { data: profileData },
        { count: wraps },
        { count: followers },
        { count: following },
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, username, avatar_url, bio')
          .eq('id', user.id)
          .single(),
        supabase
          .from('wraps')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('status', ['active', 'holiday']),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', user.id)
          .eq('status', 'accepted'),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', user.id)
          .eq('status', 'accepted'),
      ])

      if (profileData) {
        const data = profileData as any
        setBio(data.bio || '')
        setAvatar(data.avatar_url || null)
        setFullName(data.full_name || data.username || '')
        localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify({ ...data, id: user.id }))
      }

      setWrapCount(wraps || 0)
      setFollowerCount(followers || 0)
      setFollowingCount(following || 0)
    })
  }, [])

  async function handleAvatarUpload(file: File) {
    if (!currentUserId) return
    setUploading(true)

    try {
      file = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      })
    } catch {}

    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${currentUserId}/avatar.${fileExt}`

    const { error } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (!error) {
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', currentUserId)
      setAvatar(avatarUrl)

      const cached = localStorage.getItem(DASHBOARD_PROFILE_KEY)
      if (cached) {
        try {
          const p = JSON.parse(cached)
          localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify({ ...p, avatar_url: avatarUrl }))
        } catch {}
      }
    }

    setUploading(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.clear()
    router.replace('/')
  }

  return (
    <AppLayout>
      <div className="max-w-xl space-y-4">

        {/* Profile header */}
        <div className="rounded-2xl bg-white border p-5 shadow-sm">
          <div className="flex items-center gap-4">
            <label className="relative cursor-pointer group flex-shrink-0">
              {avatar ? (
                <img
                  src={avatar}
                  alt={fullName}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-pink-200"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-2xl font-bold text-white ring-2 ring-pink-200">
                  {fullName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <span className="text-[10px] font-semibold text-white text-center px-1">
                  {uploading ? '...' : 'Update'}
                </span>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleAvatarUpload(file)
                }}
              />
            </label>

            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-gray-900 truncate">{fullName || 'Your Profile'}</p>
              {bio ? (
                <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{bio}</p>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowBioEdit(true)}
                  className="text-sm text-pink-500 mt-0.5"
                >
                  + Add bio
                </button>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-4 flex justify-around border-t pt-4">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {wrapCount ?? '—'}
              </p>
              <p className="text-xs text-gray-500">wraps</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {followerCount ?? '—'}
              </p>
              <p className="text-xs text-gray-500">followers</p>
            </div>
            <div className="w-px bg-gray-100" />
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">
                {followingCount ?? '—'}
              </p>
              <p className="text-xs text-gray-500">following</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                const cached = localStorage.getItem(DASHBOARD_PROFILE_KEY)
                if (cached) {
                  try {
                    const p = JSON.parse(cached)
                    if (p.id) router.push(`/user/${p.id}`)
                  } catch {}
                }
              }}
              className="rounded-xl border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              View Profile
            </button>
            <button
              type="button"
              onClick={() => setShowBioEdit(true)}
              className="rounded-xl border border-gray-300 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Edit Bio
            </button>
          </div>
        </div>

        {/* Settings list */}
        <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <button
            type="button"
            onClick={() => router.push('/wishlist')}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b"
          >
            <span className="text-lg">⭐</span> ISO Wraps
          </button>

          <button
            type="button"
            onClick={() => router.push('/dashboard?report=true')}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b"
          >
            <span className="text-lg">📊</span> Report
          </button>

          <button
            type="button"
            onClick={() => setShowFeedback(true)}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-pink-600 hover:bg-pink-50 border-b"
          >
            <span className="text-lg">💬</span> Feedback / Contact
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push('/admin')}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 border-b"
            >
              <span className="text-lg">⚙️</span> Admin
            </button>
          )}

          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-semibold text-red-500 hover:bg-red-50"
          >
            <span className="text-lg">🚪</span> Logout
          </button>
        </div>

        <div className="flex justify-center gap-4 pt-2 pb-4">
          <a href="/terms" className="text-xs text-gray-400 hover:text-pink-500">Terms</a>
          <span className="text-xs text-gray-300">·</span>
          <a href="/privacy" className="text-xs text-gray-400 hover:text-pink-500">Privacy</a>
          <span className="text-xs text-gray-300">·</span>
          <a href="/community" className="text-xs text-gray-400 hover:text-pink-500">Guidelines</a>
        </div>
      </div>

      {/* Bio edit modal */}
      {showBioEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowBioEdit(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-3">Edit Bio</h2>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the wrap community about yourself..."
              rows={4}
              maxLength={200}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-pink-300 resize-none"
            />
            <div className="mt-1 flex items-center justify-between mb-4">
              <p className="text-xs text-gray-400">{bio.length}/200</p>
            </div>
            <button
              type="button"
              disabled={savingBio}
              onClick={async () => {
                if (!currentUserId) return
                setSavingBio(true)
                await supabase.from('profiles').update({ bio: bio.trim() || null }).eq('id', currentUserId)
                const cached = localStorage.getItem(DASHBOARD_PROFILE_KEY)
                if (cached) {
                  try {
                    const p = JSON.parse(cached)
                    localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify({ ...p, bio: bio.trim() || null }))
                  } catch {}
                }
                setSavingBio(false)
                setBioSaved(true)
                setShowBioEdit(false)
                setTimeout(() => setBioSaved(false), 2000)
              }}
              className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingBio ? 'Saving...' : 'Save Bio'}
            </button>
            <button
              type="button"
              onClick={() => setShowBioEdit(false)}
              className="mt-2 w-full rounded-xl border px-4 py-2 text-sm font-semibold text-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Feedback modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowFeedback(false)}>
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Send Feedback</h2>
            <p className="text-sm text-gray-500 mb-5">We'd love to hear your thoughts, ideas or suggestions for WrapApp — or just say hello! 👋</p>
            <button
              type="button"
              onClick={() => { window.location.href = 'mailto:blairchapman632@gmail.com?subject=WrapApp%20Feedback&body=Hi%20Paige%20and%20Blair' }}
              className="block w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-center font-semibold text-white mb-3"
            >
              Open Email App
            </button>
            <div className="rounded-xl border bg-gray-50 px-4 py-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Or copy our email</p>
              <p className="text-sm font-bold text-gray-900 select-all">blairchapman632@gmail.com</p>
            </div>
            <button
              type="button"
              onClick={() => setShowFeedback(false)}
              className="mt-4 w-full rounded-xl border px-4 py-2 text-sm font-semibold text-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  )
}