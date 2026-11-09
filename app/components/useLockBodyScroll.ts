'use client'

import { useEffect } from 'react'

// Stops the page behind an open sheet/modal from scrolling.
// Counts open sheets, so nested sheets don't unlock the page too early.
let openCount = 0
let savedOverflow = ''

export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked || typeof document === 'undefined') return
    if (openCount === 0) {
      savedOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    openCount++
    return () => {
      openCount = Math.max(0, openCount - 1)
      if (openCount === 0) document.body.style.overflow = savedOverflow
    }
  }, [locked])
}
