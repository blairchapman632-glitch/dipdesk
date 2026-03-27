'use client'

import { useRouter } from 'next/navigation'

export default function AppLayout({
  children,
  hideHeader = false,
}: {
  children: React.ReactNode
  hideHeader?: boolean
}) {
  const router = useRouter()

  return (
    <div className="h-full flex flex-col">

      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white">

          <div
            className="text-xl font-bold cursor-pointer"
            onClick={() => router.push('/dashboard')}
          >
            DipDesk
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 rounded-xl border hover:bg-gray-100 cursor-pointer"
            >
              Dashboard
            </button>

            <button
              onClick={() => router.push('/create-dip')}
              className="px-4 py-2 rounded-xl bg-black text-white hover:opacity-90 cursor-pointer"
            >
              + Create Dip
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 bg-gray-50">
        {children}
      </div>
    </div>
  )
}