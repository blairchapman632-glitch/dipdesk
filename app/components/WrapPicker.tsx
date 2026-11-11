'use client'

// "Which wrap?" — your collection as small photo tiles in a sideways row.
// Optional: "None" clears it. Cache-first: uses your profile's cached wraps instantly,
// then refreshes them quietly (and updates that cache).

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getCoverThumb } from '@/lib/wrapCover'

const DASHBOARD_WRAPS_KEY = 'dipdesk_dashboard_wraps'

type PickerWrap = {
  id: string
  name: string
  brand: string | null
  status: string
  wrap_images?: { id: string; image_url: string; thumbnail_url?: string | null; sort_order: number }[]
}

function inCollection(wraps: PickerWrap[]) {
  return wraps
    .filter((wrap) => wrap.status !== 'departed')
    .sort((a, b) => a.name.localeCompare(b.name))
}

export default function WrapPicker({
  value,
  onChange,
}: {
  value: string | null
  onChange: (wrapId: string | null) => void
}) {
  const [wraps, setWraps] = useState<PickerWrap[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    try {
      const cached = localStorage.getItem(DASHBOARD_WRAPS_KEY)
      if (cached) {
        setWraps(inCollection(JSON.parse(cached)))
        setLoaded(true)
      }
    } catch {}

    async function load() {
      const { data } = await supabase
        .from('my_wraps')
        .select('id, name, brand, status, wrap_images(id, image_url, thumbnail_url, sort_order)')
        .order('sort_order', { referencedTable: 'wrap_images' })
      if (cancelled || !data) return
      setWraps(inCollection(data as PickerWrap[]))
      setLoaded(true)
    }
    void load()
    return () => { cancelled = true }
  }, [])

  if (loaded && wraps.length === 0) {
    return <p className="text-xs text-gray-400">Add wraps to your collection to tag them here.</p>
  }

  const tile = 'flex w-16 shrink-0 flex-col items-center gap-1'
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" data-no-pull-refresh>
      <button type="button" onClick={() => onChange(null)} className={tile} aria-pressed={value === null}>
        <span
          className={`flex h-16 w-16 items-center justify-center rounded-xl border text-xs font-semibold ${
            value === null ? 'border-pink-500 bg-pink-50 text-pink-600 ring-2 ring-pink-200' : 'border-gray-200 bg-gray-50 text-gray-500'
          }`}
        >
          None
        </span>
      </button>
      {!loaded &&
        [1, 2, 3, 4].map((i) => <div key={i} className="h-16 w-16 shrink-0 animate-pulse rounded-xl bg-gray-100" />)}
      {wraps.map((wrap) => {
        const selected = value !== null && String(value) === String(wrap.id)
        const img = getCoverThumb(wrap.wrap_images)
        return (
          <button key={wrap.id} type="button" onClick={() => onChange(wrap.id)} className={tile} aria-pressed={selected}>
            <span className={`block h-16 w-16 overflow-hidden rounded-xl bg-gray-100 ${selected ? 'ring-2 ring-pink-500 ring-offset-1' : ''}`}>
              {img ? (
                <img src={img} alt={wrap.name} loading="lazy" className="h-full w-full object-cover object-[center_20%]" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl">🧣</span>
              )}
            </span>
            <span className={`w-full truncate text-center text-[11px] leading-tight ${selected ? 'font-bold text-pink-600' : 'text-gray-600'}`}>
              {wrap.name}
            </span>
          </button>
        )
      })}
    </div>
  )
}
