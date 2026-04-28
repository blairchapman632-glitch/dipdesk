'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import imageCompression from 'browser-image-compression'

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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
const [unreadMessages, setUnreadMessages] = useState(0)
useEffect(() => {
    const handleStorage = () => {
      const cached = localStorage.getItem('dipdesk_unread_messages')
      if (cached) {
        try {
          setUnreadMessages(JSON.parse(cached))
        } catch {}
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])
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
const cachedUnread = localStorage.getItem('dipdesk_unread_count')
    if (cachedUnread) {
      try {
        setUnreadCount(JSON.parse(cachedUnread))
      } catch {}
    }

    const cachedUnreadMessages = localStorage.getItem('dipdesk_unread_messages')
    if (cachedUnreadMessages) {
      try {
        setUnreadMessages(JSON.parse(cachedUnreadMessages))
      } catch {}
    }

    async function loadUnreadCount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Notification count
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .is('read_at', null)

      setUnreadCount(notifCount || 0)
      localStorage.setItem('dipdesk_unread_count', JSON.stringify(notifCount || 0))

      // Get my conversation IDs
      const { data: convData } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_1_id.eq.${user.id},participant_2_id.eq.${user.id}`)

      const convIds = (convData || []).map((c) => c.id)

      if (convIds.length === 0) return

      // Count unread messages in my conversations
      const { count: msgCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('read', false)
        .neq('sender_id', user.id)
        .in('conversation_id', convIds)

      console.log('unread messages count:', msgCount)
      setUnreadMessages(msgCount || 0)
      localStorage.setItem('dipdesk_unread_messages', JSON.stringify(msgCount || 0))
    }

    loadUnreadCount()
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
        localStorage.setItem('dipdesk_dashboard_profile', JSON.stringify({ ...data, id: user.id }))
      }
    }

    loadAvatar()
  }, [])

  async function handleAvatarUpload(file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const preview = URL.createObjectURL(file)
    setAvatarPreview(preview)
    setUploadingAvatar(true)

    try {
      file = await imageCompression(file, {
        maxSizeMB: 0.3,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      })
    } catch (error) {
      console.error('avatar compression error', error)
    }

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
    setAvatarPreview(null)
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
    { label: 'WDYWT', href: '/wdywt' },
    { label: 'Explore', href: '/explore' },
    { label: 'Messages', href: '/messages' },
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
                      className={`relative cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-pink-600 text-white'
                          : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {item.label}
                      {item.label === 'Messages' && unreadMessages > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-600 text-[9px] font-bold text-white">
                          {unreadMessages > 9 ? '9+' : unreadMessages}
                        </span>
                      )}
                    </button>
                  )
                })}
              </nav>

              <Link href="/tools" className="group relative cursor-pointer shrink-0">
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Your avatar"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-pink-200"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-bold text-white ring-2 ring-pink-200">
                    {initials || '?'}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
                  <span className="text-[10px] font-semibold text-white leading-tight text-center px-1">
                    Me
                  </span>
                </div>
              </Link>
            </div>
          </header>

          {/* Phone bottom nav */}
<nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-white md:hidden">
  <div className="grid grid-cols-5 gap-1 px-2 pt-2" style={{paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))'}}>
    {navItems.map((item) => {
      const isActive = pathname === item.href

      const icon =
        item.label === 'Home' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        ) : item.label === 'Explore' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        ) : item.label === 'WDYWT' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        ) : item.label === 'Messages' ? (
          <span className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {unreadMessages > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-600 text-[9px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </span>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
        )

      return (
        <Link
          key={item.href}
          href={item.href}
          prefetch={true}
          className={`relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-xs font-semibold ${
            isActive
              ? 'bg-pink-600 text-white'
              : 'bg-white text-gray-600 border border-gray-200 active:bg-gray-100'
          }`}
        >
          <span className="pointer-events-none leading-none relative">
            {icon}
            {item.label === 'Home' && unreadCount > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-600 text-[9px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
            {item.label === 'Messages' && unreadMessages > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-pink-600 text-[9px] font-bold text-white">
                {unreadMessages > 9 ? '9+' : unreadMessages}
              </span>
            )}
          </span>

          <span className="pointer-events-none leading-none">
            {item.label}
          </span>
        </Link>
      )
    })}

          <Link
            href="/tools"
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-gray-200 px-1 py-2"
          >
            {avatar ? (
              <img
                src={avatar}
                alt="You"
                className="h-7 w-7 rounded-full object-cover ring-2 ring-pink-200 pointer-events-none"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xs font-bold text-white pointer-events-none">
                {initials || '?'}
              </div>
            )}
            <span className="pointer-events-none text-xs font-semibold leading-none text-gray-600">
              Me
            </span>
          </Link>
  </div>
</nav>
        </>
      )}

      <main
  className={`flex-1 p-6 md:p-10 ${
    !hideHeader ? 'pb-28 md:pb-10' : ''
  }`}
>
        {children}
      </main>
    </div>
  )
}