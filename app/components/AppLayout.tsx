'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function AppLayout({
  children,
  hideHeader = false,
}: {
  children: React.ReactNode
  hideHeader?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  const navItems = [
    { label: 'Home', href: '/dashboard' },
    { label: 'Explore', href: '/explore' },
    { label: 'ISO', href: '/wishlist' },
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