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
      } catch {}
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)

      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setAvatar(data.avatar_url || null)
        setFullName(data.full_name || data.username || '')
        localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify(data))
      }
    }
    load()
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
          onClick={() => router.push('/dashboard?report=true')}
          className="w-full rounded-xl border px-4 py-3 text-left font-semibold text-gray-700 hover:bg-gray-50"
        >
          📊 Report
        </button>

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