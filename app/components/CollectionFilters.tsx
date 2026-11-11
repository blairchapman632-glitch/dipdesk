'use client'

// Collection filters for profiles (yours and other collectors'): Brand, Length, Colour,
// Blend, Type. Same options and matching logic the profile pill row used before, now in a
// bottom sheet (same look as Explore's filter sheet) opened from a slim count + filter row.

import { useState } from 'react'
import { useLockBodyScroll } from './useLockBodyScroll'

export const COLLECTION_COLOUR_TAGS = ['White/Cream', 'Grey', 'Black', 'Brown/Tan', 'Pink/Blush', 'Red/Burgundy', 'Orange/Rust', 'Yellow/Mustard', 'Green', 'Teal/Petrol', 'Blue', 'Navy', 'Purple', 'Rainbow', 'Multi/Variegated', 'Natural/Undyed']
export const COLLECTION_BLEND_TAGS = ['Cotton', 'Linen', 'Silk', 'Hemp', 'Wool/Merino', 'Seacell', 'Tencel', 'Chenille', 'Camel', 'Bamboo', 'Cashmere']
export const COLLECTION_TYPE_TAGS = ['Hand Woven', 'Machine Woven', 'Ring Sling', 'Carrier']

type FilterableWrap = {
  brand?: string | null
  size?: string | null
  colour?: string | null
  material?: string | null
  wrap_type?: string | null
}

export function useCollectionFilters() {
  const [brand, setBrand] = useState('')
  const [sizeMin, setSizeMin] = useState('')
  const [sizeMax, setSizeMax] = useState('')
  const [colour, setColour] = useState('') // comma-separated tags (as before)
  const [blends, setBlends] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [sheetOpen, setSheetOpen] = useState(false)

  // One per filter group that's on (Length counts once)
  const activeCount =
    (brand ? 1 : 0) +
    (sizeMin || sizeMax ? 1 : 0) +
    (colour ? 1 : 0) +
    (blends.length > 0 ? 1 : 0) +
    (types.length > 0 ? 1 : 0)

  function clear() {
    setBrand('')
    setSizeMin('')
    setSizeMax('')
    setColour('')
    setBlends([])
    setTypes([])
  }

  // Same rules as the old profile pill filters
  function matches(wrap: FilterableWrap) {
    if (brand) {
      const wrapBrand = (wrap.brand || '').toLowerCase()
      if (!wrapBrand.includes(brand.toLowerCase())) return false
    }
    if (sizeMin || sizeMax) {
      const wrapSize = parseFloat(wrap.size || '')
      if (isNaN(wrapSize)) return false
      if (sizeMin && wrapSize < parseFloat(sizeMin)) return false
      if (sizeMax && wrapSize > parseFloat(sizeMax)) return false
    }
    if (colour) {
      const selected = colour.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean)
      const wrapColour = (wrap.colour || '').toLowerCase()
      if (!selected.some((c) => wrapColour.includes(c.split('/')[0].trim()))) return false
    }
    if (blends.length > 0) {
      const wrapMaterial = (wrap.material || '').toLowerCase()
      if (!blends.some((b) => wrapMaterial.includes(b.toLowerCase().split('/')[0].trim()))) return false
    }
    if (types.length > 0) {
      const wrapType = (wrap.wrap_type || '').toLowerCase()
      if (!types.some((t) => wrapType === t.toLowerCase())) return false
    }
    return true
  }

  return {
    brand, setBrand, sizeMin, setSizeMin, sizeMax, setSizeMax,
    colour, setColour, blends, setBlends, types, setTypes,
    sheetOpen, setSheetOpen, activeCount, clear, matches,
  }
}

export type CollectionFilters = ReturnType<typeof useCollectionFilters>

// Slim row above the grid: "16 wraps" / "3 of 16 wraps" + the filter button
export function CollectionFilterBar({
  filters,
  shown,
  total,
  children,
}: {
  filters: CollectionFilters
  shown: number
  total: number
  children?: React.ReactNode // extra buttons (e.g. + Add Wrap on desktop)
}) {
  const on = filters.activeCount > 0
  const noun = total === 1 ? 'wrap' : 'wraps'
  return (
    <div className="mb-3 flex items-center justify-between gap-2 px-1">
      <p className="min-w-0 truncate text-sm font-semibold text-gray-700">
        {on ? `${shown} of ${total} ${noun}` : `${total} ${noun}`}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <button
          type="button"
          onClick={() => filters.setSheetOpen(true)}
          aria-label={on ? `Filters (${filters.activeCount} on)` : 'Filters'}
          className={`relative flex min-h-[40px] min-w-[44px] items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
            on ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-200 bg-white text-gray-600'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="11" y1="18" x2="13" y2="18"/>
          </svg>
          {on && <span className="ml-1.5 text-xs font-bold">{filters.activeCount}</span>}
        </button>
      </div>
    </div>
  )
}

function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-[34px] rounded-full border px-3 text-sm font-semibold transition ${
        selected ? 'border-pink-500 bg-pink-500 text-white' : 'border-gray-200 bg-white text-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      {children}
    </section>
  )
}

// Bottom sheet on phones, centred card on desktop (same look as Explore's filter sheet)
export function CollectionFilterSheet({ filters }: { filters: CollectionFilters }) {
  useLockBodyScroll(filters.sheetOpen)
  if (!filters.sheetOpen) return null

  const close = () => filters.setSheetOpen(false)
  const selectedColours = filters.colour.split(',').map((c) => c.trim()).filter(Boolean)
  const toggle = (list: string[], tag: string) => (list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter collection"
        className="animate-sheet-up flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-4 pt-4">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-gray-200 md:hidden" />
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Filter</h3>
            <button type="button" onClick={close} className="min-h-[36px] px-1 text-sm text-gray-500">Done</button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-4">
          <Section title="Brand">
            <input
              type="text"
              value={filters.brand}
              onChange={(e) => filters.setBrand(e.target.value)}
              placeholder="Filter by brand..."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[16px] text-gray-900 outline-none focus:border-pink-500"
            />
          </Section>

          <Section title="Length (metres)">
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" step="0.1" value={filters.sizeMin} onChange={(e) => filters.setSizeMin(e.target.value)} placeholder="Min" className="w-full min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:border-pink-500" />
              <span className="text-sm text-gray-400">to</span>
              <input type="number" inputMode="decimal" step="0.1" value={filters.sizeMax} onChange={(e) => filters.setSizeMax(e.target.value)} placeholder="Max" className="w-full min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 text-[16px] outline-none focus:border-pink-500" />
            </div>
          </Section>

          <Section title="Colour">
            <div className="flex flex-wrap gap-1.5">
              {COLLECTION_COLOUR_TAGS.map((tag) => (
                <Chip
                  key={tag}
                  selected={selectedColours.includes(tag)}
                  onClick={() => filters.setColour(toggle(selectedColours, tag).join(', '))}
                >
                  {tag}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Blend">
            <div className="flex flex-wrap gap-1.5">
              {COLLECTION_BLEND_TAGS.map((tag) => (
                <Chip key={tag} selected={filters.blends.includes(tag)} onClick={() => filters.setBlends((prev) => toggle(prev, tag))}>
                  {tag}
                </Chip>
              ))}
            </div>
          </Section>

          <Section title="Type">
            <div className="flex flex-wrap gap-1.5">
              {COLLECTION_TYPE_TAGS.map((tag) => (
                <Chip key={tag} selected={filters.types.includes(tag)} onClick={() => filters.setTypes((prev) => toggle(prev, tag))}>
                  {tag}
                </Chip>
              ))}
            </div>
          </Section>
        </div>

        {/* Clear + Done */}
        <div className="flex shrink-0 gap-2 border-t border-gray-100 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:pb-4">
          <button
            type="button"
            onClick={filters.clear}
            disabled={filters.activeCount === 0}
            className="min-h-[48px] flex-1 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-700 disabled:opacity-40"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={close}
            className="min-h-[48px] flex-[2] rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-bold text-white shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
