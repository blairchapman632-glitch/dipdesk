'use client'

import AppLayout from '@/app/components/AppLayout'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const DASHBOARD_EMAIL_KEY = 'dipdesk_dashboard_email'

export default function Page() {
  const router = useRouter()

  const isAdmin =
    typeof window !== 'undefined' &&
    localStorage.getItem(DASHBOARD_EMAIL_KEY) === 'paige.wilson26@outlook.com'

  const handleLogout = async () => {
    await supabase.auth.signOut()
    localStorage.removeItem(DASHBOARD_EMAIL_KEY)
    router.replace('/')
  }

  return (
    <AppLayout>
      <div className="max-w-xl space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Tools</h1>

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