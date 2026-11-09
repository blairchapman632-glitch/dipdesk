'use client'

// Shared classes for popups:
// - Phone: full-screen sheet (big popups) or bottom sheet that slides up (small popups)
// - Desktop (md+): the same centred modal as before
// Only the container changes — what's inside a popup stays the same.

// Full screen on phone, centred modal on desktop
export const fullSheetOverlay =
  'fixed inset-0 z-50 flex items-stretch justify-center bg-black/40 md:items-center md:p-4'
// Pass the full desktop width class, e.g. 'md:max-w-4xl' (written out so Tailwind generates it)
export const fullSheetPanel = (desktopMaxWidth: string) =>
  `animate-sheet-up h-full w-full overflow-y-auto overscroll-contain bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:animate-none md:h-auto md:max-h-[90vh] ${desktopMaxWidth} md:rounded-3xl md:p-6 md:shadow-2xl`

// Bottom sheet on phone, centred modal on desktop
export const bottomSheetOverlay =
  'fixed inset-0 z-50 flex items-end justify-center bg-black/40 md:items-center md:p-4'
export const bottomSheetPanel = (desktopMaxWidth: string) =>
  `animate-sheet-up max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-3xl bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl md:animate-none md:max-h-[90vh] ${desktopMaxWidth} md:rounded-3xl md:p-6`

// Phone-only top bar with a clear Back button (sticks to the top while scrolling)
export function SheetTopBar({ onClose, title, grabber = false }: { onClose: () => void; title?: string; grabber?: boolean }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 mb-3 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur md:hidden">
      {grabber && <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300" />}
      <div className="flex min-h-[48px] items-center gap-2 px-2">
        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[44px] min-w-[44px] items-center px-2 text-base font-semibold text-gray-700"
          aria-label="Close"
        >
          ‹ Back
        </button>
        {title && <p className="min-w-0 flex-1 truncate pr-2 text-center text-sm font-semibold text-gray-900">{title}</p>}
        {title && <span className="min-w-[44px]" />}
      </div>
    </div>
  )
}
