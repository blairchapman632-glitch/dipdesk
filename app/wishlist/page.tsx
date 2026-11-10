'use client'

import AppLayout from '@/app/components/AppLayout'
import IsoList from '@/app/components/IsoList'

// The list itself (data, cache, tiles, wrap view, notes) lives in IsoList,
// which the ISO tab on your profile uses too.
export default function Page() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <section className="rounded-3xl border bg-white p-4 shadow-sm xl:p-5">
          <div className="mb-5">
            <h1 className="text-2xl font-bold text-gray-900">ISO Wraps</h1>
            <p className="text-sm text-gray-500">Your ISO Wraps</p>
          </div>

          <IsoList layout="page" />
        </section>
      </div>
    </AppLayout>
  )
}
