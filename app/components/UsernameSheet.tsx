'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { normaliseUsername, usernameProblem } from '@/lib/usernames'

const DASHBOARD_PROFILE_KEY = 'dipdesk_dashboard_profile'

type Availability =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available' }
  | { state: 'taken' }
  | { state: 'not_allowed'; reason: string }
  | { state: 'unchanged' }

// Bottom sheet for the public page settings: username (short link) + private profile.
// Used from Tools → My public page and from the dip page prompt.
export default function UsernameSheet({
  userId,
  onClose,
  onSaved,
}: {
  userId: string
  onClose: () => void
  onSaved?: (next: { username: string | null; isPrivate: boolean }) => void
}) {
  // Cached profile first (instant), then refreshed from Supabase
  const cachedProfile = (() => {
    try { return JSON.parse(localStorage.getItem(DASHBOARD_PROFILE_KEY) || '{}') } catch { return {} }
  })()
  const cachedIsOwn = String(cachedProfile.id || '') === String(userId)

  const [currentUsername, setCurrentUsername] = useState<string>(cachedIsOwn ? cachedProfile.username || '' : '')
  const [isAdmin, setIsAdmin] = useState<boolean>(cachedIsOwn ? cachedProfile.role === 'super_admin' : false)
  // Box starts empty unless they already have a real username
  const [value, setValue] = useState<string>(cachedIsOwn ? cachedProfile.username || '' : '')
  const [isPrivate, setIsPrivate] = useState<boolean>(cachedIsOwn ? !!cachedProfile.is_private : false)
  const [availability, setAvailability] = useState<Availability>({ state: 'idle' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const touchedRef = useRef(false)
  const checkSeq = useRef(0)

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('username, is_private, role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const p = data as { username: string | null; is_private: boolean | null; role: string | null }
        setCurrentUsername(p.username || '')
        setIsAdmin(p.role === 'super_admin')
        if (!touchedRef.current) {
          setValue(p.username || '')
          setIsPrivate(!!p.is_private)
        }
      })
  }, [userId])

  const normalised = normaliseUsername(value)

  // Check availability as they type (short delay)
  useEffect(() => {
    const seq = ++checkSeq.current
    const timer = setTimeout(async () => {
      if (!normalised) { setAvailability({ state: 'not_allowed', reason: 'Choose a username.' }); return }
      if (normalised === currentUsername) { setAvailability({ state: 'unchanged' }); return }
      const problem = usernameProblem(normalised, { isAdmin })
      if (problem) { setAvailability({ state: 'not_allowed', reason: problem }); return }
      setAvailability({ state: 'checking' })
      const { data, error: queryError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', normalised)
        .neq('id', userId)
        .limit(1)
      if (seq !== checkSeq.current) return // a newer check started
      if (queryError) { setAvailability({ state: 'idle' }); return }
      setAvailability(data && data.length > 0 ? { state: 'taken' } : { state: 'available' })
    }, 350)
    return () => clearTimeout(timer)
  }, [normalised, currentUsername, isAdmin, userId])

  async function save() {
    setError('')
    // A username is always required (everyone gets one automatically)
    const problem = usernameProblem(normalised, { isAdmin })
    if (problem) { setError(problem); return }
    if (availability.state === 'taken') { setError('That username is taken — try another.'); return }
    setSaving(true)
    const { error: saveError } = await supabase
      .from('profiles')
      .update({ username: normalised || null, is_private: isPrivate } as never)
      .eq('id', userId)
    setSaving(false)
    if (saveError) {
      setError(
        saveError.code === '23505'
          ? 'That username is taken — try another.'
          : saveError.code === '23514'
          ? 'That username isn’t allowed — use lowercase letters, numbers, dots and underscores.'
          : 'Couldn’t save — try again.'
      )
      return
    }
    try {
      const p = JSON.parse(localStorage.getItem(DASHBOARD_PROFILE_KEY) || '{}')
      if (String(p.id || '') === String(userId)) {
        localStorage.setItem(DASHBOARD_PROFILE_KEY, JSON.stringify({ ...p, username: normalised || null, is_private: isPrivate }))
      }
    } catch {}
    onSaved?.({ username: normalised || null, isPrivate })
    onClose()
  }

  const status = (() => {
    switch (availability.state) {
      case 'checking': return <span className="text-gray-500">Checking…</span>
      case 'available': return <span className="font-semibold text-green-700">✓ Available</span>
      case 'taken': return <span className="font-semibold text-red-600">✗ Taken</span>
      case 'not_allowed': return <span className="font-semibold text-red-600">✗ Not allowed — {availability.reason}</span>
      case 'unchanged': return <span className="text-gray-500">This is your current username</span>
      default: return null
    }
  })()

  return (
    <div className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My public page"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-white p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl space-y-3"
      >
        <h2 className="text-lg font-bold text-gray-900">🌐 My public page</h2>
        <p className="text-sm text-gray-500">
          Anyone can see your collection here, even without an account. Your dip posts link to it.
        </p>

        <div>
          <label htmlFor="username-input" className="mb-1 block text-sm font-medium text-gray-700">Username</label>
          <input
            id="username-input"
            type="text"
            value={value}
            onChange={(e) => { touchedRef.current = true; setValue(normaliseUsername(e.target.value)); setError('') }}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. sarah.jones"
            className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] text-gray-800 outline-none placeholder:text-gray-400 focus:border-pink-400"
          />
          {status && <p className="mt-1 text-sm">{status}</p>}
          <p className="mt-1 text-sm text-gray-600">
            Your link: <span className="font-semibold text-gray-900">wrapapp.com.au/{normalised || '…'}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">Lowercase letters, numbers, dots and underscores.</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">
            Changing it means links in past dip posts will stop working.
          </p>
        </div>

        <label className="flex min-h-[44px] items-start gap-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 shrink-0"
            checked={isPrivate}
            onChange={(e) => { touchedRef.current = true; setIsPrivate(e.target.checked) }}
          />
          <span>
            <span className="font-semibold">🔒 Private profile</span>
            <span className="block text-xs text-gray-500">Hides your public page from people who aren’t logged in. Dip posts will link to wrapapp.com.au instead. You can also hide single wraps when editing them.</span>
          </span>
        </label>

        {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

        {currentUsername && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`https://wrapapp.com.au/${currentUsername}`).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }).catch(() => {})
            }}
            className="min-h-[44px] w-full rounded-xl border text-sm font-semibold text-gray-700"
          >
            {copied ? '✓ Link copied' : `📋 Copy wrapapp.com.au/${currentUsername}`}
          </button>
        )}

        <button
          type="button"
          disabled={saving || availability.state === 'taken' || availability.state === 'not_allowed' || availability.state === 'checking'}
          onClick={() => void save()}
          className="min-h-[48px] w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        {currentUsername && (
          <a href={`/${currentUsername}`} className="flex min-h-[44px] w-full items-center justify-center text-sm font-semibold text-pink-700 underline">
            View my public page
          </a>
        )}
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] w-full rounded-xl border px-4 text-sm font-semibold text-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
