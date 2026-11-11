'use client'

// Wraps a photo: double-tap (or double-click) likes it with a heart pop over the photo.
// Never unlikes. A single tap still does whatever onSingleTap did before; it waits a
// moment (300ms) so a double-tap doesn't also trigger it. With no onSingleTap there's no wait.

import { useEffect, useRef, useState } from 'react'

const DOUBLE_TAP_MS = 300

export default function DoubleTapLike({
  onDoubleTap,
  onSingleTap,
  enabled = true,
  className = '',
  children,
}: {
  onDoubleTap: () => void
  onSingleTap?: () => void
  // false (e.g. your own wrap, or logged out): single taps act at once, no heart
  enabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  const [hearts, setHearts] = useState<number[]>([])
  const lastTapRef = useRef(0)
  const singleTimerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (singleTimerRef.current) window.clearTimeout(singleTimerRef.current)
  }, [])

  function handleClick() {
    if (!enabled) {
      onSingleTap?.()
      return
    }
    const now = Date.now()
    if (now - lastTapRef.current < DOUBLE_TAP_MS) {
      lastTapRef.current = 0
      if (singleTimerRef.current) {
        window.clearTimeout(singleTimerRef.current)
        singleTimerRef.current = null
      }
      const key = now
      setHearts((prev) => [...prev, key])
      window.setTimeout(() => setHearts((prev) => prev.filter((k) => k !== key)), 850)
      onDoubleTap()
      return
    }
    lastTapRef.current = now
    if (onSingleTap) {
      singleTimerRef.current = window.setTimeout(() => {
        singleTimerRef.current = null
        onSingleTap()
      }, DOUBLE_TAP_MS)
    }
  }

  return (
    <div
      className={`relative select-none ${className}`}
      // manipulation: no double-tap-to-zoom on phones, so taps aren't delayed or zoomed
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
      onClick={handleClick}
    >
      {children}
      {hearts.map((key) => (
        <span key={key} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="animate-heart-pop h-24 w-24 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </span>
      ))}
    </div>
  )
}
