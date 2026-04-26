'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AppLayout({
  children,
  hideHeader = false,
}: {
  children: React.ReactNode
  hideHeader?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [avatar, setAvatar] = useState<string | null>(null)
  const [initials, setInitials] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
useEffect(() => {
    const cached = localStorage.getItem('dipdesk_dashboard_profile')
    if (cached) {
      try {
        const p = JSON.parse(cached)
        setAvatar(p.avatar_url || null)
        const name = p.full_name || p.username || ''
        setInitials(
          name.trim().split(' ').slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
        )
      } catch {}
    }

    async function loadAvatar() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', user.id)
        .single()

      if (data) {
        setAvatar(data.avatar_url || null)
        const name = data.full_name || data.username || ''
        setInitials(
          name.trim().split(' ').slice(0, 2).map((w: string) => w[0].toUpperCase()).join('')
        )
        localStorage.setItem('dipdesk_dashboard_profile', JSON.stringify(data))
      }
    }

    loadAvatar()
  }, [])

  async function handleAvatarUpload(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setUploadingAvatar(true)

    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${user.id}/avatar.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file, { upsert: true })

    if (uploadError) {
      setUploadingAvatar(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
    const avatarUrl = `${data.publicUrl}?t=${Date.now()}`

    await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)

    setAvatar(avatarUrl)
    setUploadingAvatar(false)

    const cached = localStorage.getItem('dipdesk_dashboard_profile')
    if (cached) {
      try {
        const p = JSON.parse(cached)
        localStorage.setItem('dipdesk_dashboard_profile', JSON.stringify({ ...p, avatar_url: avatarUrl }))
      } catch {}
    }
  }
  const navItems = [
    { label: 'Home', href: '/dashboard' },
    { label: 'Explore', href: '/explore' },
    { label: 'ISO ⭐', href: '/wishlist' },
    { label: 'Messages', href: '/messages' },
    { label: 'Tools', href: '/tools' },
  ]

  return (
    <div className="flex min-h-dvh flex-col bg-gray-50">
      {!hideHeader && (
        <>
          {/* Desktop top nav */}
          <header className="hidden border-b bg-white md:block">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
             <button
                type="button"
                onClick={() => router.push('/dashboard')}
                className="cursor-pointer text-xl font-bold text-gray-900"
              >
                WrapApp
              </button>

              <nav className="flex items-center gap-2">
                {navItems.map((item) => {
                  const isActive = pathname === item.href

                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => router.push(item.href)}
                      className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-pink-600 text-white'
                          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                    </button>
                  )
                })}
              </nav>

              <label className="group relative cursor-pointer shrink-0" title="Click to update photo">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Your avatar"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-pink-200"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-bold text-white ring-2 ring-pink-200">
                    {uploadingAvatar ? '...' : (initials || '?')}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <span className="text-[10px] font-semibold text-white leading-tight text-center px-1">
                    {uploadingAvatar ? '...' : 'Update'}
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
            </div>
          </header>

          {/* Phone bottom nav */}
<nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-white md:hidden">
  <div className="grid grid-cols-5 gap-1 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
    {navItems.map((item) => {
      const isActive = pathname === item.href

      const icon =
        item.label === 'Home'
          ? '⌂'
          : item.label === 'Explore'
          ? '⌕'
          : item.label === 'ISO'
? '⭐'
          : item.label === 'Messages'
          ? '✉'
          : '🛠'

      return (
        <Link
          key={item.href}
          href={item.href}
          prefetch={true}
          className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold ${
            isActive
              ? 'bg-pink-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-100'
          }`}
        >
          <span className="pointer-events-none text-base leading-none">
            {icon}
          </span>

          <span className="pointer-events-none leading-none">
            {item.label}
          </span>
        </Link>
      )
    })}
  </div>
</nav>
        </>
      )}

      <main
  className={`flex-1 p-6 md:p-10 ${
    !hideHeader ? 'pb-24 md:pb-10' : ''
  }`}
>
        {children}
      </main>
    </div>
  )
}