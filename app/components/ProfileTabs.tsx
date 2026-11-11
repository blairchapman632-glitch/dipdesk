'use client'

// Profile tab row: equal-width segmented tabs that always fit (no sideways scrolling).
// Each tab = icon on top (22px) + small label underneath. Active: white pill on the grey track,
// dark icon and label. Counts sit as a small pink badge on the icon's corner.
//
// Labels use one weight for every tab (active is shown by colour + the pill, not bold), so the
// widest label ("Collection", ~53px at 12px) still fits a fifth of a 320px screen.

import type { ReactNode } from 'react'

export type ProfileTab<K extends string> = {
  key: K
  label: string
  icon: ReactNode
  badge?: number
}

export default function ProfileTabs<K extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: {
  tabs: ProfileTab<K>[]
  active: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={`grid gap-0.5 rounded-xl bg-gray-100 p-1 ${className}`}
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={`flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-0 py-1 transition ${
              isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            <span className="relative flex h-[22px] w-[22px] items-center justify-center [&>svg]:h-[22px] [&>svg]:w-[22px]">
              {tab.icon}
              {!!tab.badge && tab.badge > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink-600 px-1 text-[10px] font-bold leading-none text-white">
                  {tab.badge > 99 ? '99+' : tab.badge}
                </span>
              )}
            </span>
            <span className="w-full truncate text-center text-xs font-medium leading-tight">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Shared icons (stroke = currentColor, sized by ProfileTabs)
const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const TAB_ICONS = {
  collection: (<svg {...iconProps}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>),
  forsale: (<svg {...iconProps}><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>),
  dips: (<svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/><circle cx="12" cy="12" r="1"/></svg>),
  iso: (<svg {...iconProps}><path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/></svg>),
  wdywt: (<svg {...iconProps}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>),
}
