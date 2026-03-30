'use client'

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
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Explore', href: '/explore' },
    { label: 'Wishlist', href: '/wishlist' },
    { label: 'Messages', href: '/messages' },
    { label: 'Tools', href: '/tools' },
  ]

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
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
          <nav className="fixed inset-x-0 bottom-0 z-40 h-20 border-t bg-white md:hidden">
  <div className="grid grid-cols-5 pb-3 pt-2">
              {navItems.map((item) => {
                const isActive = pathname === item.href

                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => router.push(item.href)}
                    className={`flex cursor-pointer flex-col items-center justify-center px-2 py-4 text-sm font-semibold rounded-xl transition ${
                      isActive 
  ? 'bg-pink-600 text-white shadow-sm' 
  : 'text-gray-500 hover:bg-gray-100' 
                    }`}
                  >
                    {item.label}
                  </button>
                )
              })}
            </div>
          </nav>
        </>
      )}

      <main
        className={`flex-1 overflow-y-auto p-6 md:p-10 ${
          !hideHeader ? 'pb-24 md:pb-10' : ''
        }`}
      >
        {children}
      </main>
    </div>
  )
}