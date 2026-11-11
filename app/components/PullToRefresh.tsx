'use client'

// Phone pull-to-refresh: at the very top of the page, pull down and let go to re-fetch.
// A small spinner slides down under the top bar while onRefresh runs.
//
// It only *listens* to touches (passive), so normal scrolling, the sticky search bar and
// horizontal rows are untouched. It starts only when the page is scrolled to the top, the
// finger moves mostly downwards, and no sheet is open (sheets lock body scroll).
// While mounted, the browser's own overscroll (Chrome's reload pull / iOS bounce at the top)
// is turned off on <html> so the two don't fight; it's restored when the page unmounts.

import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 70 // px of (damped) pull needed to refresh
const MAX_PULL = 100
const HOLD_AT = 56 // where the spinner sits while refreshing
const MIN_SPIN_MS = 500 // so a fast refresh still shows the spinner

export default function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<unknown> | void }) {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])
  const pullRef = useRef(0)
  const refreshingRef = useRef(false)

  useEffect(() => {
    const html = document.documentElement
    const previousOverscroll = html.style.overscrollBehaviorY
    html.style.overscrollBehaviorY = 'none'

    let tracking = false
    let pulling = false
    let startX = 0
    let startY = 0

    const setPullBoth = (value: number) => {
      pullRef.current = value
      setPull(value)
    }

    function onTouchStart(event: TouchEvent) {
      tracking = false
      pulling = false
      if (refreshingRef.current || event.touches.length !== 1) return
      if (window.scrollY > 0) return
      if (document.body.style.overflow === 'hidden') return // a sheet / modal is open
      const target = event.target as Element | null
      if (target?.closest?.('[data-no-pull-refresh]')) return
      tracking = true
      startX = event.touches[0].clientX
      startY = event.touches[0].clientY
    }

    function onTouchMove(event: TouchEvent) {
      if (!tracking) return
      const dx = event.touches[0].clientX - startX
      const dy = event.touches[0].clientY - startY
      if (!pulling) {
        if (Math.abs(dx) > Math.abs(dy)) { tracking = false; return } // sideways swipe
        if (dy < -6) { tracking = false; return } // scrolling up the page
        if (dy < 8) return
        if (window.scrollY > 0) { tracking = false; return }
        pulling = true
      }
      setPullBoth(Math.max(0, Math.min(MAX_PULL, (dy - 8) * 0.5)))
    }

    async function onTouchEnd() {
      if (!tracking) return
      tracking = false
      if (!pulling) return
      pulling = false
      if (pullRef.current < THRESHOLD) {
        setPullBoth(0)
        return
      }
      refreshingRef.current = true
      setRefreshing(true)
      setPullBoth(HOLD_AT)
      const started = Date.now()
      try {
        await onRefreshRef.current()
      } catch (error) {
        console.error('refresh error', error)
      }
      const elapsed = Date.now() - started
      if (elapsed < MIN_SPIN_MS) await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS - elapsed))
      refreshingRef.current = false
      setRefreshing(false)
      setPullBoth(0)
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('touchend', onTouchEnd, { passive: true })
    window.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      html.style.overscrollBehaviorY = previousOverscroll
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [])

  if (pull === 0 && !refreshing) return null

  const progress = Math.min(1, pull / THRESHOLD)
  return (
    <div
      aria-hidden={!refreshing}
      role={refreshing ? 'status' : undefined}
      aria-label={refreshing ? 'Refreshing' : undefined}
      className="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] z-40 flex justify-center md:hidden"
    >
      <div
        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-100 bg-white shadow-md"
        style={{
          transform: `translateY(${pull - 40}px)`,
          opacity: refreshing ? 1 : progress,
          transition: springTransition(refreshing, pull),
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          className={`h-5 w-5 text-pink-600 ${refreshing ? 'animate-ptr-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        >
          <path d="M21 12a9 9 0 1 1-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
      </div>
    </div>
  )
}

// Follow the finger exactly while pulling; ease when it springs back or settles
function springTransition(refreshing: boolean, pull: number) {
  return refreshing || pull === 0 ? 'transform 0.2s ease-out, opacity 0.2s ease-out' : 'none'
}
