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
  const [savingBio, setSavingBio] = useState(false)
  const [bioSaved, setBioSaved] = useState(false)

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
      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url, bio')
        .eq('id', user.id)
        .single()
      if (data) {
        const newBio = (data as any).bio || ''
        setBio(newBio)
        setAvatar(data.avatar_url || null)
        setFullName(data.full_name || data.username || '')
        localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify({ ...data, id: user.id }))
      }
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

        {/* Profile section */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm flex items-center gap-4">
          <label className="relative cursor-pointer group flex-shrink-0">
            {avatar ? (
              <img
                src={avatar}
                alt={fullName}
                className="h-16 w-16 rounded-full object-cover ring-2 ring-pink-200"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-xl font-bold text-white ring-2 ring-pink-200">
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

          <div>
            <p className="font-bold text-gray-900 text-lg">{fullName || 'Your Profile'}</p>
            <p className="text-sm text-gray-500">Tap photo to update</p>
          </div>
        </div>
<button
          type="button"
          onClick={() => {
            const cached = localStorage.getItem('dipdesk_dashboard_profile')
            if (cached) {
              try {
                const p = JSON.parse(cached)
                if (p.id) router.push(`/user/${p.id}`)
              } catch {}
            }
          }}
          className="w-full rounded-xl border px-4 py-3 text-left font-semibold text-gray-700 hover:bg-gray-50"
        >
          👤 My Profile
        </button>
        {/* Bio */}
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <label className="mb-2 block text-sm font-semibold text-gray-700">
            Bio
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell the wrap community about yourself..."
            rows={3}
            maxLength={200}
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-xs text-gray-400">{bio.length}/200</p>
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
                setTimeout(() => setBioSaved(false), 2000)
              }}
              className="rounded-xl bg-pink-500 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {savingBio ? 'Saving...' : bioSaved ? 'Saved ✓' : 'Save Bio'}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push('/wishlist')}
          className="w-full rounded-xl border px-4 py-3 text-left font-semibold text-gray-700 hover:bg-gray-50"
        >
          ⭐ ISO Wraps
        </button>

        <button
          type="button"
          onClick={() => router.push('/dashboard?report=true')}
          className="w-full rounded-xl border px-4 py-3 text-left font-semibold text-gray-700 hover:bg-gray-50"
        >
          📊 Report
        </button>

        
          <button
          type="button"
          onClick={() => setShowFeedback(true)}
          className="w-full rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-left font-semibold text-pink-600 hover:bg-pink-100"
        >
          💬 Send Feedback
        </button>

        {showFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowFeedback(false)}>
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 className="text-xl font-bold text-gray-900 mb-1">Send Feedback</h2>
              <p className="text-sm text-gray-500 mb-5">We'd love to hear your thoughts, ideas or suggestions for WrapApp.</p>
              
                href="mailto:blairchapman632@gmail.com?subject=WrapApp%20Feedback&body=Hi%20Paige%20and%20Blair"
                className="block w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-3 text-center font-semibold text-white mb-3"
              >
                Open Email App
              </a>
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

        {isAdmin && (
          <button
            type="button"
            onClick={() => router.push('/admin')}
            className="w-full rounded-xl border px-4 py-3 text-left font-semibold text-gray-700 hover:bg-gray-50"
          >
            ⚙️ Admin
          </button>
        )}

        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-xl border px-4 py-3 text-left font-semibold text-red-600 hover:bg-red-50"
        >
          🚪 Logout
        </button>
      </div>
    </AppLayout>
  )
}