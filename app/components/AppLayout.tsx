'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import imageCompression from 'browser-image-compression'
import { FeedbackHost } from './Toast'
import { useLockBodyScroll } from './useLockBodyScroll'

export default function AppLayout({
  children,
  hideHeader = false,
  phoneTopRight,
}: {
  children: React.ReactNode
  hideHeader?: boolean
  // Optional icons on the right of the phone top bar (Home: ♡ + Add Wrap)
  phoneTopRight?: React.ReactNode
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
  // Navigation: Home = Explore, Profile = your own profile (/dashboard)
  const desktopNavItems = [
    { label: 'Home', href: '/explore' },
    { label: 'WDYWT', href: '/wdywt' },
    { label: 'Messages', href: '/messages' },
  ]
  const phoneNavItems = [
    { kind: 'link', label: 'Home', href: '/explore' },
    { kind: 'link', label: 'WDYWT', href: '/wdywt' },
    { kind: 'create', label: 'Create', href: '' },
    { kind: 'link', label: 'Messages', href: '/messages' },
    { kind: 'profile', label: 'Profile', href: '/dashboard' },
  ] as const
  const isActivePath = (href: string) =>
    pathname === href || (href === '/messages' && (pathname || '').startsWith('/messages/'))

  // ➕ Create sheet
  const [createOpen, setCreateOpen] = useState(false)
  useLockBodyScroll(createOpen)

  function handleCreate(option: 'wrap' | 'wdywt' | 'dip') {
    setCreateOpen(false)
    if (option === 'wrap') {
      // Already on the profile → open the form there; otherwise go there and open it
      if (pathname === '/dashboard') window.dispatchEvent(new Event('wrapapp:add-wrap'))
      else router.push('/dashboard?add=1')
    } else if (option === 'wdywt') {
      if (pathname === '/wdywt') window.dispatchEvent(new Event('wrapapp:post-wdywt'))
      else router.push('/wdywt?post=1')
    } else {
      router.push('/create-dip')
    }
  }

  // Keep the ♡ badge in step when Activity marks things read / clears them
  useEffect(() => {
    const onUnread = (event: Event) => {
      const count = Number((event as CustomEvent).detail)
      if (!Number.isNaN(count)) setUnreadCount(count)
    }
    window.addEventListener('wrapapp:unread', onUnread)
    return () => window.removeEventListener('wrapapp:unread', onUnread)
  }, [])

  const plusIcon = (className: string, strokeWidth: string) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8v8M8 12h8"/></svg>
  )

  // ♡ → /activity, with the unread count
  const heartLink = (variant: 'phone' | 'desktop') => {
    const isActive = pathname === '/activity'
    return (
      <Link
        href="/activity"
        aria-label={unreadCount > 0 ? `Activity, ${unreadCount} unread` : 'Activity'}
        className={`relative flex items-center justify-center ${variant === 'phone' ? 'h-11 w-11' : 'h-10 w-10 rounded-xl hover:bg-gray-50'} ${isActive ? 'text-pink-600' : 'text-gray-800'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.15 : 0} stroke="currentColor" strokeWidth={isActive ? '2.2' : '1.8'} strokeLinecap="round" strokeLinejoin="round" className={variant === 'phone' ? 'h-[26px] w-[26px]' : 'h-6 w-6'}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-600 px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Link>
    )
  }

  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === 'undefined') return false
    return !localStorage.getItem('dipdesk_splashed')
  })

  const [splashFading, setSplashFading] = useState(false)

  useEffect(() => {
    if (!showSplash) return
    const fadeTimer = setTimeout(() => {
      setSplashFading(true)
    }, 2000)
    const hideTimer = setTimeout(() => {
      setShowSplash(false)
      localStorage.setItem('dipdesk_splashed', '1')
    }, 2500)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [showSplash])

  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    async function subscribeToPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
      if (Notification.permission === 'denied') return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const registration = await navigator.serviceWorker.ready

      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        })
      }

      await supabase
        .from('push_subscriptions')
        .upsert(
          { user_id: user.id, subscription: subscription.toJSON() },
          { onConflict: 'user_id' }
        )
    }

    subscribeToPush()
  }, [])
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isIOSChrome, setIsIOSChrome] = useState(false)

  useEffect(() => {
    // Don't show if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if already dismissed
    if (localStorage.getItem('dipdesk_install_dismissed')) return

    const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const iOSChrome = iOS && /CriOS/i.test(navigator.userAgent)
    const iOSSafari = iOS && !iOSChrome

    setIsIOS(iOS)
    setIsIOSChrome(iOSChrome)

    if (iOSChrome) {
      setShowInstallBanner(true)
      return
    }

    if (iOSSafari) {
      setShowInstallBanner(true)
      return
    }

    // Android Chrome
    const handler = (e: any) => {
      e.preventDefault()
      setInstallPrompt(e)
      setShowInstallBanner(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismissInstallBanner() {
    setShowInstallBanner(false)
    localStorage.setItem('dipdesk_install_dismissed', '1')
  }

  async function handleInstallClick() {
    if (!installPrompt) return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowInstallBanner(false)
      localStorage.setItem('dipdesk_install_dismissed', '1')
    }
  }

  if (showSplash) {
    return (
      <div
        className="flex min-h-dvh flex-col items-center justify-center transition-opacity duration-500"
        style={{
          background: 'linear-gradient(135deg, #db2777, #f43f5e, #fb923c)',
          opacity: splashFading ? 0 : 1,
        }}
      >
        <div className="flex flex-col items-center gap-6">
          <img
            src="/icon-512.png"
            alt="WrapApp"
            className="h-36 w-36 rounded-3xl shadow-2xl"
          />
          <p className="text-3xl font-extrabold tracking-tight text-white">
            WrapApp
          </p>
          <p className="text-sm text-white/70">For the Love of Wraps</p>
        </div>
      </div>
    )
  }

  return (
    // overflow-x-clip: safety net against sideways page scroll (clip, not hidden, so sticky bars keep working)
    <div className="flex min-h-dvh flex-col overflow-x-clip bg-white">
      {!hideHeader && (
        <>
          {/* Phone top bar: WrapApp + ♡ (notifications) on every main page, padded for the iPhone notch.
              Not on message threads — they have their own full-screen header. */}
          {!(pathname || '').startsWith('/messages/') && (
            <header className="sticky top-0 z-40 border-b border-gray-200 bg-white pt-[env(safe-area-inset-top)] md:hidden">
              <div className="flex h-12 items-center justify-between px-3">
                <Link href="/explore" className="text-xl font-extrabold tracking-tight text-pink-600">
                  WrapApp
                </Link>
                <div className="flex items-center gap-1">
                  {phoneTopRight}
                  {heartLink('phone')}
                </div>
              </div>
            </header>
          )}

          {/* Desktop top nav: Home · WDYWT · Messages, then ♡ ➕ and your avatar (Profile) */}
          <header className="hidden border-b bg-white md:block">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
              <Link href="/explore" className="cursor-pointer text-xl font-bold text-gray-900">
                WrapApp
              </Link>

              <nav className="flex items-center gap-1">
                {desktopNavItems.map((item) => {
                  const isActive = isActivePath(item.href)
                  return (
                    <button
                      key={item.href}
                      type="button"
                      onClick={() => router.push(item.href)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        isActive
                          ? 'bg-pink-50 text-pink-600'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
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

              <div className="flex items-center gap-2">
                {heartLink('desktop')}
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  aria-label="Create"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-50"
                >
                  {plusIcon('h-6 w-6', '1.8')}
                </button>
                <Link
                  href="/dashboard"
                  aria-label="Your profile"
                  className={`group relative ml-1 cursor-pointer shrink-0 rounded-full ${isActivePath('/dashboard') ? 'ring-2 ring-pink-600 ring-offset-2' : ''}`}
                >
                  {avatar ? (
                    <img
                      src={avatar}
                      alt="Your profile"
                      className="h-9 w-9 rounded-full object-cover ring-2 ring-pink-200"
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-bold text-white ring-2 ring-pink-200">
                      {initials || '?'}
                    </div>
                  )}
                </Link>
              </div>
            </div>
          </header>

          {/* Install banner */}
          {showInstallBanner && (
            <div className="fixed inset-x-0 z-40 md:hidden"
              style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom))' }}>
              <div className="mx-3 mb-2 rounded-2xl border border-pink-100 bg-white p-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <img src="/icon-192.png" alt="WrapApp" className="h-10 w-10 rounded-xl" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900">Add WrapApp to Home Screen</p>
                    {isIOSChrome ? (
                      <p className="text-xs text-gray-500">Open in Safari to install</p>
                    ) : isIOS ? (
                      <p className="text-xs text-gray-500">Tap Share → Add to Home Screen</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        className="text-xs font-semibold text-pink-600"
                      >
                        Tap to install →
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={dismissInstallBanner}
                    className="shrink-0 rounded-full p-1 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Phone bottom nav: Home · WDYWT · ➕ · Messages · Profile (Instagram-style) */}
<nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white md:hidden">
  <div className="grid grid-cols-5">
    {phoneNavItems.map((item) => {
      // Centre ➕ opens the create sheet
      if (item.kind === 'create') {
        return (
          <button
            key="create"
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-label="Create"
            style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
            className="flex h-full w-full min-h-[60px] flex-col items-center justify-start px-1 pt-1 text-gray-800 active:text-gray-600"
          >
            {plusIcon('h-[34px] w-[34px] pointer-events-none', '1.7')}
          </button>
        )
      }

      // Profile = your avatar
      if (item.kind === 'profile') {
        const isActive = isActivePath('/dashboard') || isActivePath('/tools')
        return (
          <Link
            key="profile"
            href="/dashboard"
            prefetch={true}
            aria-current={isActive ? 'page' : undefined}
            style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
            className="flex h-full w-full min-h-[60px] flex-col items-center justify-start gap-1 px-1 pt-1.5"
          >
            {avatar ? (
              <img
                src={avatar}
                alt="Your profile"
                className={`h-[26px] w-[26px] rounded-full object-cover pointer-events-none ${isActive ? 'ring-2 ring-pink-600 ring-offset-1' : ''}`}
              />
            ) : (
              <div className={`flex h-[26px] w-[26px] items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-[10px] font-bold text-white pointer-events-none ${isActive ? 'ring-2 ring-pink-600 ring-offset-1' : ''}`}>
                {initials || '?'}
              </div>
            )}
            <span className={`pointer-events-none text-xs leading-none ${isActive ? 'font-semibold text-pink-600' : 'font-medium text-gray-500'}`}>
              Profile
            </span>
          </Link>
        )
      }

      const isActive = isActivePath(item.href)
      // Active icon draws a little bolder
      const sw = isActive ? '2.5' : '1.8'

      const icon =
        item.label === 'Home' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.15 : 0} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="h-[26px] w-[26px]"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        ) : item.label === 'WDYWT' ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.15 : 0} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="h-[26px] w-[26px]"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.15 : 0} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" className="h-[26px] w-[26px]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        )

      return (
        <Link
          key={item.href}
          href={item.href}
          prefetch={true}
          aria-current={isActive ? 'page' : undefined}
          style={{ paddingBottom: 'max(6px, env(safe-area-inset-bottom))' }}
          className={`relative flex h-full w-full min-h-[60px] flex-col items-center justify-start gap-1 px-1 pt-1.5 text-xs leading-none ${
            isActive ? 'font-semibold text-pink-600' : 'font-medium text-gray-500 active:text-gray-700'
          }`}
        >
          <span className="pointer-events-none leading-none relative">
            {icon}
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
  </div>
</nav>
        </>
      )}

      <main
  className={`flex-1 px-3 pt-3 md:px-10 md:pt-10 ${
    // Nav is 48px + max(6px, safe area), min 60px — this clears it with room to spare
    !hideHeader ? 'pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-10' : ''
  }`}
>
        {children}
      </main>

      {/* ➕ Create: bottom sheet on phone, small card on desktop */}
      {createOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 md:items-center md:p-4"
          onClick={() => setCreateOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Create"
            onClick={(e) => e.stopPropagation()}
            className="animate-sheet-up w-full max-w-sm rounded-t-3xl bg-white p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-2xl md:rounded-3xl md:pb-3"
          >
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
            <p className="px-3 pb-2 pt-1 text-center text-sm font-semibold text-gray-500">Create</p>
            {([
              { key: 'wrap', emoji: '🧣', label: 'Add a wrap', hint: 'Add to your collection' },
              { key: 'wdywt', emoji: '📸', label: 'Post WDYWT', hint: 'What did you wear today?' },
              { key: 'dip', emoji: '🎲', label: 'Start a dip', hint: 'Run a dip in Chasing Unicorns' },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => handleCreate(option.key)}
                className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-gray-50 active:bg-gray-100"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-50 text-xl">{option.emoji}</span>
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-500">{option.hint}</span>
                </span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="mt-2 min-h-[48px] w-full rounded-2xl border border-gray-200 text-base font-semibold text-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Shared toast + confirm sheet for every page */}
      <FeedbackHost />
    </div>
  )
}