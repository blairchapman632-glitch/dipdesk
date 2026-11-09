'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLockBodyScroll } from './useLockBodyScroll'

// Shared toast + in-app confirm sheet.
// Call showToast('…') / await askConfirm({…}) from anywhere (or the useToast / useConfirm hooks).
// <FeedbackHost /> renders them; AppLayout mounts one for every page.

type ToastItem = { id: number; text: string }
export type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}
type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void }

let toastListener: ((t: ToastItem | null) => void) | null = null
let confirmListener: ((c: ConfirmRequest | null) => void) | null = null
let nextId = 1

export function showToast(text: string) {
  toastListener?.({ id: nextId++, text })
}

export function askConfirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise(resolve => {
    // No host mounted (shouldn't happen inside AppLayout): fall back to the browser
    if (!confirmListener) {
      resolve(typeof window !== 'undefined' ? window.confirm(opts.message ? `${opts.title}\n\n${opts.message}` : opts.title) : false)
      return
    }
    confirmListener({ ...opts, resolve })
  })
}

export function useToast() {
  return useCallback((text: string) => showToast(text), [])
}

export function useConfirm() {
  return useCallback((opts: ConfirmOptions) => askConfirm(opts), [])
}

export function FeedbackHost() {
  const [toast, setToast] = useState<ToastItem | null>(null)
  const [visible, setVisible] = useState(false)
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null)

  useLockBodyScroll(!!confirmReq)

  useEffect(() => {
    // Only one host is active at a time
    if (toastListener || confirmListener) return
    toastListener = t => { setToast(t); setVisible(!!t) }
    confirmListener = c => setConfirmReq(c)
    return () => { toastListener = null; confirmListener = null }
  }, [])

  // Fade out after ~2s
  useEffect(() => {
    if (!toast) return
    const fade = setTimeout(() => setVisible(false), 2000)
    const clear = setTimeout(() => setToast(null), 2300)
    return () => { clearTimeout(fade); clearTimeout(clear) }
  }, [toast])

  function answer(ok: boolean) {
    const req = confirmReq
    setConfirmReq(null)
    req?.resolve(ok)
  }

  return (
    <>
      {toast && (
        <div
          role="status"
          className={`pointer-events-none fixed left-1/2 z-[90] -translate-x-1/2 px-4 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-[90vw] rounded-2xl border border-white/20 bg-gray-900/90 px-5 py-3 text-center text-sm font-semibold text-white shadow-2xl backdrop-blur md:max-w-md">
            {toast.text}
          </div>
        </div>
      )}

      {confirmReq && (
        <div
          className="fixed inset-0 z-[85] flex items-end justify-center bg-black/40 md:items-center md:p-4"
          onClick={() => answer(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={confirmReq.title}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl space-y-3 md:rounded-3xl md:pb-5"
          >
            <h3 className="text-lg font-bold text-gray-900">{confirmReq.title}</h3>
            {confirmReq.message && <p className="text-[15px] text-gray-600">{confirmReq.message}</p>}
            <div className="flex flex-col-reverse gap-2 md:flex-row">
              <button
                type="button"
                onClick={() => answer(false)}
                className="min-h-[48px] flex-1 rounded-xl border border-gray-200 text-base font-semibold text-gray-700 hover:bg-gray-50"
              >
                {confirmReq.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => answer(true)}
                className={`min-h-[48px] flex-1 rounded-xl text-base font-bold text-white ${
                  confirmReq.danger === false ? 'bg-gradient-to-r from-pink-500 to-rose-500' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirmReq.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
