'use client'

import { supabase } from '@/lib/supabase'
import { use, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/app/components/AppLayout'
import { DIP_STAGES, DIP_STAGE_LABELS, DIP_STAGE_SHORT_LABELS } from '@/lib/dipStages'

type Dip = {
  id: string
  user_id: string
  title: string
  brand: string | null
  wrap_name: string | null
  wrap_condition: string | null
  wrap_size: string | null
  wrap_blend: string | null
  total_spots: number
  price_per_spot: number
  price_ls1: number | null
  price_ls2: number | null
  price_ls3: number | null
  price_ls4: number | null
  price_ls5: number | null
  price_bookend: number | null
  total_value: number | null
  likes_required: number | null
  current_likes: number | null
  stage: string
  status: string | null
  google_sheet_link: string | null
  paypal_link: string | null
  shipping_from: string | null
  shipping_credit: number | null
  smoke_free: boolean | null
  pet_free: boolean | null
  feedback_hub_link: string | null
  winning_number: number | null
  winner_name: string | null
  drawn_at: string | null
  is_ready_for_draw: boolean | null
  payment_methods: string | null
  bookend_price_override: number | null
  closing_price: number | null
  closing_liker_price: number | null
  closing_spots_count: number | null
  bookend_locked: boolean | null
  closing_locked: boolean | null
  game_locked: boolean | null
  wrap_value: number | null
  archived: boolean | null
  wrap_id: string | null
  live_notified: boolean | null
  // null while the live post is waiting for CU admin approval; set when approved
  live_approved_at: string | null
}

type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type Spot = {
  id: string
  dip_id: string
  spot_number: number
  player_name: string | null
  spot_type: string
  amount_owed: number | null
  paid: boolean
  game_revealed: boolean
}

const STAGES: string[] = [...DIP_STAGES]


type GameEntry = { emoji: string; price: number }
type SavedGame = { id: string; emoji_map: GameEntry[] }
type Liker = { id: string; name: string; unliked?: boolean | null }
type DipCache = { dip: Dip; spots: Spot[]; likers: Liker[]; game: SavedGame | null }

const dipCacheKey = (dipId: string) => `dipdesk_dip_${dipId}`

function readDipCache(dipId: string): DipCache | null {
  try {
    const raw = localStorage.getItem(dipCacheKey(dipId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DipCache
    return parsed && parsed.dip ? parsed : null
  } catch {
    return null
  }
}

function writeDipCache(dipId: string, data: DipCache) {
  try {
    localStorage.setItem(dipCacheKey(dipId), JSON.stringify(data))
  } catch {}
}

// Same input always gives the same order, so the game post never reshuffles
// between preview, copy, and reloads.
function stableShuffle<T>(items: T[], seedText: string): T[] {
  let h = 2166136261
  for (const ch of seedText) {
    h ^= ch.codePointAt(0) || 0
    h = Math.imul(h, 16777619)
  }
  if (h === 0) h = 1
  const rand = () => {
    h ^= h << 13
    h ^= h >>> 17
    h ^= h << 5
    return (h >>> 0) / 4294967296
  }
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const isGameSpotType = (type: string | null | undefined) => !!type && type.startsWith('game')

// Google Sheet auto-sync state. 'dirty' = changes waiting to be sent.
type SheetSyncState = 'unknown' | 'dirty' | 'syncing' | 'ok' | 'error'
const sheetSyncKey = (dipId: string) => `dipdesk_dip_sync_${dipId}`

// A NEW sheet is only ever created for active dips (not archived, not Drawn).
// Existing sheets on Drawn/archived dips can still be updated.
const canCreateSheetFor = (d: { archived: boolean | null; stage: string } | null | undefined) =>
  !!d && !d.archived && d.stage !== 'drawn'

// Names from the seller's past dips, used for suggestions
type NameHistoryEntry = { name: string; kind: 'liker' | 'player' }
const nameHistoryKey = (userId: string) => `dipdesk_name_history_${userId}`

// Name suggestions: case-insensitive "contains", word-start matches first, de-duplicated
function suggestNames(query: string, candidates: string[], exclude: string[], limit: number): string[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []
  const excluded = new Set(exclude.map(n => n.trim().toLowerCase()))
  const seen = new Set<string>()
  const hits: { name: string; rank: number; order: number }[] = []
  candidates.forEach((name, order) => {
    const lower = name.trim().toLowerCase()
    if (!lower || seen.has(lower) || excluded.has(lower) || lower === q) return
    if (!lower.includes(q)) return
    seen.add(lower)
    const wordStart = lower.split(/\s+/).some(w => w.startsWith(q))
    hits.push({ name: name.trim(), rank: wordStart ? 0 : 1, order })
  })
  hits.sort((a, b) => a.rank - b.rank || a.order - b.order)
  return hits.slice(0, limit).map(h => h.name)
}

// Over this total, CU requires a Random.org paid draw and a Google Sheet
const RANDOM_ORG_THRESHOLD = 2000

export default function DipDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [dip, setDip] = useState<Dip | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  // One-page layout: tools drawer, in-app confirm, toast, previews
  const [toolsOpen, setToolsOpen] = useState(false)
  const [toolsSection, setToolsSection] = useState<'boost' | 'payment' | 'details' | null>(null)
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null)
  const [toast, setToast] = useState<{ text: string; tone: 'success' | 'error' } | null>(null)
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [openPreviews, setOpenPreviews] = useState<Record<string, boolean>>({})
  const [showDrawnSpots, setShowDrawnSpots] = useState(false)
  const [stageBusy, setStageBusy] = useState(false)

  // Editing after creation
  const [detailsForm, setDetailsForm] = useState<Record<string, string | boolean> | null>(null)
  const [detailsError, setDetailsError] = useState('')
  const [savingDetails, setSavingDetails] = useState(false)
  const [editSpot, setEditSpot] = useState<Spot | null>(null)
  const [editSpotForm, setEditSpotForm] = useState({ player: '', type: 'main', amount: '' })
  const [editPlayer, setEditPlayer] = useState<string | null>(null)
  const [editPlayerName, setEditPlayerName] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Add spot form
  const [addPlayerName, setAddPlayerName] = useState('')
  const [addSpotNumber, setAddSpotNumber] = useState('')
  const [addSpotType, setAddSpotType] = useState('main')
  const [addSelectedSpots, setAddSelectedSpots] = useState<number[]>([])
  const [addMessage, setAddMessage] = useState('')
  const [addingSpot, setAddingSpot] = useState(false)
  const [addGameEmoji, setAddGameEmoji] = useState('')
  const [addCustomPrice, setAddCustomPrice] = useState('')

  // Settings
  const [savingSettings, setSavingSettings] = useState(false)
  const [winningNumber, setWinningNumber] = useState('')
  const [paymentMethods, setPaymentMethods] = useState('')

  // Copy state
  const [copied, setCopied] = useState<string | null>(null)
  const [copyError, setCopyError] = useState('')

  // Winner
  const [winnerMessage, setWinnerMessage] = useState('')

  // Game builder
  const WRAP_EMOJIS = [
    '💕','🌸','🍀','🩵','🌈','🎀','🍎','🌻','🩷','🦋',
    '🌺','🍓','🌙','⭐','🌊','🦄','🌷','🍉','🧁','💜',
    '🩶','🤍','🌿','🫐','🍋','🌼','🦢','🐚','🎠','🪷','🌅',
    '🍒','🧞','🌋','🍇',
  ]
  const [showGameBuilder, setShowGameBuilder] = useState(false)
  const [showBookend, setShowBookend] = useState(false)
  const [showClosing, setShowClosing] = useState(false)
  const [bookendPrice, setBookendPrice] = useState('')
  const [closingPrice, setClosingPrice] = useState('')
  const [closingSpots, setClosingSpots] = useState('')
  const [customGameSlots, setCustomGameSlots] = useState('')
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([])
  const [gamePriceOverrides, setGamePriceOverrides] = useState<Record<number, string>>({})
  const [savedGame, setSavedGame] = useState<SavedGame | null>(null)
  const [likers, setLikers] = useState<Liker[]>([])
  const [newLikerName, setNewLikerName] = useState('')
  const [likerMessage, setLikerMessage] = useState('')
  const [savingGame, setSavingGame] = useState(false)
  const [gameMessage, setGameMessage] = useState('')
  const [closingLikerPrice, setClosingLikerPrice] = useState('')

  // Google Sheets
  const [googleConnected, setGoogleConnected] = useState(false)
  const [googleChecked, setGoogleChecked] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [connectingGoogle, setConnectingGoogle] = useState(false)
  const [sheetSync, setSheetSync] = useState<SheetSyncState>('unknown')
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Latest dip, readable from timers/async code without stale closures
  const dipRef = useRef<Dip | null>(null)
  const syncInFlightRef = useRef(false)
  const syncAgainRef = useRef(false)
  const autoCreateTriedRef = useRef(false)
  const catchUpCheckedRef = useRef(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Fast liker / player entry
  const likerInputRef = useRef<HTMLInputElement | null>(null)
  const [nameHistory, setNameHistory] = useState<NameHistoryEntry[]>([])
  const [spotsView, setSpotsView] = useState<'players' | 'spots'>('players')
  const [payMessage, setPayMessage] = useState('')
  // Seller's public collection link for post footers
  const [sellerPublic, setSellerPublic] = useState<{ username: string | null; isPrivate: boolean } | null>(null)

  // Google connection status comes from the server — tokens never reach the browser
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const user = session?.user
      if (!user || !session?.access_token) { setGoogleChecked(true); return }
      setCurrentUserId(user.id)
      try {
        const res = await fetch('/api/google/status', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        setGoogleConnected(!!data.connected)
      } catch {}
      setGoogleChecked(true)
    })
  }, [])

  // Seller's public page info, for the footer on every dip post (cached)
  useEffect(() => {
    const sellerId = dip?.user_id
    if (!sellerId) return
    const key = `dipdesk_seller_public_${sellerId}`
    try {
      const cached = localStorage.getItem(key)
      if (cached) setSellerPublic(JSON.parse(cached))
    } catch {}
    void supabase
      .from('profiles')
      .select('username, is_private')
      .eq('id', sellerId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const next = { username: (data as any).username || null, isPrivate: !!(data as any).is_private }
        setSellerPublic(next)
        try { localStorage.setItem(key, JSON.stringify(next)) } catch {}
      })
  }, [dip?.user_id])

  // Last known sheet state for this dip (so "up to date" / "couldn't update" survives reloads)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(sheetSyncKey(id)) as SheetSyncState | null
      if (saved === 'ok' || saved === 'dirty' || saved === 'error') setSheetSync(saved)
    } catch {}
    // Message after returning from Google
    try {
      const flag = new URLSearchParams(window.location.search).get('google')
      if (flag === 'cancelled') setSyncMessage('Google connect was cancelled.')
      else if (flag === 'error') setSyncMessage('Couldn’t connect Google — try again.')
    } catch {}
  }, [id])

  // Past names (likers + players) from this seller's other dips, most recent first.
  // Cached; refreshed in the background.
  useEffect(() => {
    if (!currentUserId) return
    const key = nameHistoryKey(currentUserId)
    try {
      const cached = localStorage.getItem(key)
      if (cached) setNameHistory(JSON.parse(cached))
    } catch {}
    void (async () => {
      const { data: pastDips } = await supabase
        .from('dips')
        .select('id, created_at')
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false })
        .limit(25) // keeps the likers/spots lookups under Supabase's 1000-row default
      const ids = ((pastDips as { id: string }[]) || []).map(d => d.id).filter(d => String(d) !== String(id))
      if (ids.length === 0) { setNameHistory([]); return }
      const [{ data: likerRows }, { data: playerRows }] = await Promise.all([
        supabase.from('dip_likers').select('dip_id, name').in('dip_id', ids),
        supabase.from('spots').select('dip_id, player_name').in('dip_id', ids),
      ])
      const entries: NameHistoryEntry[] = []
      const seen = new Set<string>()
      const push = (name: string | null | undefined, kind: 'liker' | 'player') => {
        const clean = (name || '').trim()
        if (!clean) return
        const k = `${kind}:${clean.toLowerCase()}`
        if (seen.has(k)) return
        seen.add(k)
        entries.push({ name: clean, kind })
      }
      for (const dipId of ids) {
        for (const l of (likerRows as { dip_id: string; name: string }[]) || []) {
          if (String(l.dip_id) === String(dipId)) push(l.name, 'liker')
        }
        for (const s of (playerRows as { dip_id: string; player_name: string | null }[]) || []) {
          if (String(s.dip_id) === String(dipId)) push(s.player_name, 'player')
        }
      }
      setNameHistory(entries)
      try { localStorage.setItem(key, JSON.stringify(entries)) } catch {}
    })()
  }, [currentUserId, id])

  // If the seller leaves within the 2s wait, send the pending sync now
  useEffect(() => {
    const flush = () => {
      if (syncTimerRef.current) void runSheetSync(true)
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function getAccessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  }

  async function connectGoogle() {
    setConnectingGoogle(true)
    setSyncMessage('')
    try {
      const token = await getAccessToken()
      if (!token) { setSyncMessage('Please log in again.'); return }
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ dipId: id }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setSyncMessage(data.message || 'Could not start Google connect — try again.')
    } catch {
      setSyncMessage('Could not start Google connect — try again.')
    } finally {
      setConnectingGoogle(false)
    }
  }

  // ---- Automatic Google Sheet sync ----
  // Any change that affects the sheet calls scheduleSheetSync(). Changes within 2s
  // are batched into one sync. Only one sync runs at a time; if more changes arrive
  // mid-sync, one more sync runs afterwards. Never blocks the page.
  function setSheetSyncState(next: SheetSyncState) {
    setSheetSync(next)
    if (next === 'ok' || next === 'dirty' || next === 'error') {
      try { localStorage.setItem(sheetSyncKey(id), next) } catch {}
    }
  }

  async function runSheetSync(keepalive = false) {
    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current)
      syncTimerRef.current = null
    }
    // Single guard for every path (auto-create, auto-sync, retry, flush):
    // never create a sheet for an archived or Drawn dip.
    const latest = dipRef.current
    if (!latest) return
    if (!latest.google_sheet_link && !canCreateSheetFor(latest)) {
      syncAgainRef.current = false
      setSheetSync('unknown')
      return
    }
    if (syncInFlightRef.current) {
      syncAgainRef.current = true
      return
    }
    syncInFlightRef.current = true
    setSheetSync('syncing')

    let result: 'ok' | 'error' | 'not_connected' = 'error'
    try {
      const token = await getAccessToken()
      if (token) {
        const res = await fetch('/api/sheets/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ dipId: id }),
          keepalive,
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data.success) {
          result = 'ok'
          // The sync may have created (or replaced) the sheet — keep the link in step
          if (data.sheetId) {
            const url = `https://docs.google.com/spreadsheets/d/${data.sheetId}/edit`
            if (dipRef.current && dipRef.current.google_sheet_link !== url) {
              dipRef.current = { ...dipRef.current, google_sheet_link: url }
            }
            setDip(prev => {
              if (!prev || prev.google_sheet_link === url) return prev
              const next = { ...prev, google_sheet_link: url }
              const cached = readDipCache(id)
              if (cached) writeDipCache(id, { ...cached, dip: next })
              return next
            })
          }
        } else if (data.error === 'not_connected') {
          result = 'not_connected'
        }
      }
    } catch {
      result = 'error'
    }

    syncInFlightRef.current = false
    if (result === 'not_connected') {
      setGoogleConnected(false)
      setSheetSyncState('dirty') // catch up once they reconnect
      syncAgainRef.current = false
      return
    }
    if (syncAgainRef.current) {
      syncAgainRef.current = false
      void runSheetSync()
      return
    }
    setSheetSyncState(result === 'ok' ? 'ok' : 'error')
  }

  function scheduleSheetSync() {
    if (!isOwner) return
    // No sheet yet and the dip is archived/Drawn: nothing to update, and never create one
    if (!dipRef.current?.google_sheet_link && !canCreateSheetFor(dipRef.current)) return
    if (!googleConnected) {
      // Remember there are unsent changes; the sheet catches up after reconnecting
      if (dip?.google_sheet_link) setSheetSyncState('dirty')
      return
    }
    setSheetSyncState('dirty')
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => { void runSheetSync() }, 2000)
  }
  // Puts dip data (from cache or Supabase) into state
  function applyDipData(data: DipCache) {
    const dipData = data.dip
    dipRef.current = dipData
    setDip(dipData)
    setWinningNumber(dipData.winning_number ? String(dipData.winning_number) : '')
    setPaymentMethods(dipData.payment_methods || '')
    setBookendPrice(dipData.bookend_price_override ? String(dipData.bookend_price_override) : '')
    setClosingPrice(dipData.closing_price ? String(dipData.closing_price) : '')
    setClosingLikerPrice(dipData.closing_liker_price ? String(dipData.closing_liker_price) : '')
    setClosingSpots(dipData.closing_spots_count ? String(dipData.closing_spots_count) : '')
    setSpots(data.spots || [])
    setLikers(data.likers || [])

    const gameData = data.game
    setSavedGame(gameData)
    if (gameData) {
      const map = gameData.emoji_map
      setSelectedEmojis(map.map((m) => m.emoji))
      const overrides: Record<number, string> = {}
      map.forEach((m, i) => { overrides[i] = String(m.price) })
      setGamePriceOverrides(overrides)
      setCustomGameSlots(String(map.length))
    }
  }

  // Returns the fresh data too, so callers can check counts right after a change
  async function loadDip(): Promise<DipCache | null> {
    const [dipRes, spotRes, likerRes, gameRes] = await Promise.all([
      supabase.from('dips').select('*').eq('id', id).single(),
      supabase.from('spots').select('*').eq('dip_id', id).order('spot_number', { ascending: true }),
      supabase.from('dip_likers').select('*').eq('dip_id', id).order('created_at', { ascending: true }),
      supabase.from('dip_games').select('*').eq('dip_id', id).maybeSingle(),
    ])

    const dipData = dipRes.data as Dip | null
    if (!dipData) {
      // Only treat as gone if Supabase says there's no row; on a network error keep cached data
      if (dipRes.error?.code === 'PGRST116') {
        try { localStorage.removeItem(dipCacheKey(id)) } catch {}
        dipRef.current = null
        setDip(null)
      }
      setLoading(false)
      return null
    }

    // If one of the side queries failed, keep the last cached copy of that part
    const prev = readDipCache(id)
    const fresh: DipCache = {
      dip: dipData,
      spots: spotRes.error ? (prev?.spots || []) : ((spotRes.data as Spot[]) || []),
      likers: likerRes.error ? (prev?.likers || []) : ((likerRes.data as Liker[]) || []),
      game: gameRes.error ? (prev?.game ?? null) : ((gameRes.data as SavedGame | null) || null),
    }
    applyDipData(fresh)
    writeDipCache(id, fresh)
    setLoading(false)
    return fresh
  }

  // Cache-first: show cached dip before first paint, then refresh in the background
  useLayoutEffect(() => {
    const cached = readDipCache(id)
    if (cached) {
      applyDipData(cached)
      setLoading(false)
    }
  }, [id])

  useEffect(() => { loadDip() }, [id])

  // Derived stats
  const filledSpots = spots.filter(s => s.player_name).length
  const unpaidSpots = spots.filter(s => s.player_name && !s.paid)
  // Likes = liker names not marked unliked (the names list is the only source)
  const likedLikers = likers.filter(l => !l.unliked)
  const likesCount = likedLikers.length
  const likesTarget = dip?.likes_required || 0
  const likesReached = likesTarget > 0 && likesCount >= likesTarget
  const totalOwed = spots.reduce((sum, s) => sum + (s.amount_owed || 0), 0)
  const totalPaid = spots.filter(s => s.paid).reduce((sum, s) => sum + (s.amount_owed || 0), 0)
  const remainingSpots = dip ? dip.total_spots - filledSpots : 0
  const targetAmount = dip?.wrap_value ? Math.round(dip.wrap_value * 1.20 + (dip.shipping_credit || 0)) : null
  const avgNeededOnRemaining = targetAmount && remainingSpots > 0 ? Math.round((targetAmount - totalOwed) / remainingSpots) : null
  const usedSpotNumbers = spots.map(s => s.spot_number)

  // How many spots each player has (Paid applies to all of a player's spots)
  const spotsPerPlayer: Record<string, number> = {}
  for (const s of spots) {
    if (s.player_name) spotsPerPlayer[s.player_name] = (spotsPerPlayer[s.player_name] || 0) + 1
  }

  // Game status
  const gameMap: GameEntry[] = savedGame?.emoji_map || []
  const isEmojiClaimed = (emoji: string) => spots.some(s => s.spot_type === `game:${emoji}` && s.player_name)
  const gameClaimedCount = gameMap.filter(m => isEmojiClaimed(m.emoji)).length
  const gameAllClaimed = gameMap.length > 0 && gameClaimedCount === gameMap.length
  const gameRevealed = spots.some(s => s.spot_type.startsWith('game:') && s.game_revealed)

  // Winner — only valid when a winning number is saved AND that spot has a player
  const winnerSpot = dip?.winning_number
    ? spots.find(s => s.spot_number === dip.winning_number && s.player_name)
    : undefined
  const winnerName = winnerSpot?.player_name || null

  // Only the dip's owner auto-syncs their own Google Sheet
  const isOwner = !!dip && !!currentUserId && String(dip.user_id) === String(currentUserId)
  // Owner may get a new sheet only on an active dip (not archived, not Drawn)
  const canCreateSheet = isOwner && canCreateSheetFor(dip)

  // CU: over $2000 needs a Random.org paid draw + Google Sheet
  const overRandomOrg = !!dip && dip.total_spots * dip.price_per_spot > RANDOM_ORG_THRESHOLD

  // Payments view: one row per player
  const playerGroups = (() => {
    const map: Record<string, { name: string; spotIds: string[]; spotNumbers: number[]; owed: number; hiddenGame: boolean; paid: boolean }> = {}
    for (const s of spots) {
      if (!s.player_name) continue
      const g = map[s.player_name] || (map[s.player_name] = { name: s.player_name, spotIds: [], spotNumbers: [], owed: 0, hiddenGame: false, paid: true })
      g.spotIds.push(s.id)
      g.spotNumbers.push(s.spot_number)
      g.owed += s.amount_owed || 0
      if (isGameSpotType(s.spot_type) && !s.game_revealed) g.hiddenGame = true
      if (!s.paid) g.paid = false
    }
    return Object.values(map)
      .map(g => ({ ...g, spotNumbers: [...g.spotNumbers].sort((a, b) => a - b) }))
      .sort((a, b) => Number(a.paid) - Number(b.paid) || a.spotNumbers[0] - b.spotNumbers[0])
  })()
  const unpaidPlayerCount = playerGroups.filter(g => !g.paid).length
  const isPaymentStage = dip?.stage === 'payments' || dip?.stage === 'closed'

  // Suggestions
  const likerSuggestions = suggestNames(
    newLikerName,
    nameHistory.map(n => n.name),
    likers.map(l => l.name),
    5
  )
  const duplicateLiker = (() => {
    const q = newLikerName.trim().toLowerCase()
    if (!q) return null
    return likers.find(l => l.name.trim().toLowerCase() === q) || null
  })()
  const thisDipPlayers = [...new Set(spots.map(s => s.player_name).filter((n): n is string => !!n))]
  const playerSuggestions = suggestNames(
    addPlayerName,
    [
      ...likedLikers.map(l => l.name),
      ...thisDipPlayers,
      ...nameHistory.filter(n => n.kind === 'player').map(n => n.name),
    ],
    [],
    6
  )

  // Number of spots can't go below the highest spot already taken
  const highestTakenSpot = spots.reduce((max, s) => (s.player_name ? Math.max(max, s.spot_number) : max), 0)

  // Suggestions in the spot edit sheet
  const editSpotSuggestions = editSpot
    ? suggestNames(
        editSpotForm.player,
        [
          ...likedLikers.map(l => l.name),
          ...thisDipPlayers,
          ...nameHistory.filter(n => n.kind === 'player').map(n => n.name),
        ],
        [],
        5
      )
    : []

  // Auto-create the sheet as soon as the seller is connected and the dip has none
  // (covers "just created the dip" and "just came back from connecting Google").
  // Also catch up a sync that was left pending last visit.
  useEffect(() => {
    if (!dip || !googleConnected || !isOwner) return
    if (!dip.google_sheet_link) {
      if (!canCreateSheet) return // archived or Drawn: never auto-create
      if (autoCreateTriedRef.current) return
      autoCreateTriedRef.current = true
      void runSheetSync()
      return
    }
    if (catchUpCheckedRef.current) return
    catchUpCheckedRef.current = true
    try {
      if (localStorage.getItem(sheetSyncKey(id)) === 'dirty') void runSheetSync()
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dip?.id, dip?.google_sheet_link, googleConnected, isOwner, canCreateSheet])

  function getPriceForType(type: string): number {
    if (!dip) return 0
    switch (type) {
      case 'main': return dip.price_per_spot
      case 'ls1': return dip.price_ls1 || dip.price_per_spot
      case 'ls2': return dip.price_ls2 || dip.price_per_spot
      case 'ls3': return dip.price_ls3 || dip.price_per_spot
      case 'ls4': return dip.price_ls4 || dip.price_per_spot
      case 'ls5': return dip.price_ls5 || dip.price_per_spot
      case 'bookend': return dip.bookend_price_override ?? dip.price_bookend ?? dip.price_per_spot
      case 'game': return 0 // hidden until revealed
      case 'closing': return Number(closingPrice) || 0
      case 'closing-liker': return Number(closingLikerPrice) || 0
      case 'custom': return Number(addCustomPrice) || 0
      default: return dip.price_per_spot
    }
  }

  function getSpotTypeLabel(type: string): string {
    if (type.startsWith('game:')) return `🎮 ${type.replace('game:', '')}`
    switch (type) {
      case 'main': return 'Main'
      case 'ls1': return 'LS 1'
      case 'ls2': return 'LS 2'
      case 'ls3': return 'LS 3'
      case 'ls4': return 'LS 4'
      case 'ls5': return 'LS 5'
      case 'bookend': return 'Bookend'
      case 'game': return '🎮 Game'
      case 'closing': return '🏁 Closing'
      case 'closing-liker': return '⭐ Closing Liker'
      case 'custom': return '✏️ Custom'
      default: return type
    }
  }

  async function handleAddSpot() {
    if (!dip) return
    if (!addPlayerName.trim()) { setAddMessage('Enter player name'); return }

    const lsCount: Record<string, number> = { ls1: 1, ls2: 2, ls3: 3, ls4: 4, ls5: 5 }
    const requiredSpots = lsCount[addSpotType] || 1
    const isMulti = requiredSpots > 1

    // Parse spot numbers
    const spotNums = addSelectedSpots

    if (spotNums.length === 0) {
      setAddMessage('Enter spot number(s)')
      return
    }

    if (isMulti && spotNums.length !== requiredSpots) {
      setAddMessage(`${addSpotType.toUpperCase()} requires exactly ${requiredSpots} spot numbers`)
      return
    }

    if (!isMulti && spotNums.length !== 1) {
      setAddMessage('Enter one spot number')
      return
    }

    for (const n of spotNums) {
      if (n < 1 || n > dip.total_spots) {
        setAddMessage(`Spot ${n} is out of range (1–${dip.total_spots})`)
        return
      }
      if (usedSpotNumbers.includes(n)) {
        setAddMessage(`Spot ${n} is already taken`)
        return
      }
    }

    setAddingSpot(true)
    const price = getPriceForType(addSpotType)

    // Build rows — first spot gets full price, rest get 0
    const rows = spotNums.map((n, i) => ({
      dip_id: id,
      spot_number: n,
      player_name: addPlayerName.trim(),
      spot_type: addSpotType === 'game' && addGameEmoji ? `game:${addGameEmoji}` : addSpotType,
      amount_owed: addSpotType === 'game' ? null : i === 0 ? price : 0,
      paid: false,
      game_revealed: false,
    }))

    const { error } = await supabase.from('spots').insert(rows)

    if (error) { setAddMessage(error.message); setAddingSpot(false); return }

    setAddPlayerName('')
    setAddSpotNumber('')
    setAddSpotType('main')
    setAddSelectedSpots([])
    setAddMessage('')
    setAddingSpot(false)
    const fresh = await loadDip()
    scheduleSheetSync()

    // Auto-move forward: Live → Full when every spot is filled (never backwards)
    if (fresh && fresh.dip.stage === 'live') {
      const filled = fresh.spots.filter(s => s.player_name).length
      if (filled >= fresh.dip.total_spots) {
        if (await moveToStage('payments')) {
          setSpotsView('players')
          showToast('All spots filled — now collecting payments')
        }
      }
    }
  }

  // Paid is per player: marks ALL of that player's spots. Optimistic, so it's instant.
  async function setPlayerPaid(playerName: string | null, paid: boolean, singleSpotId?: string) {
    const prevSpots = spots
    const matches = (s: Spot) => (playerName ? s.player_name === playerName : s.id === singleSpotId)
    const nextSpots = spots.map(s => (matches(s) ? { ...s, paid } : s))
    setSpots(nextSpots)
    if (dip) writeDipCache(id, { dip, spots: nextSpots, likers, game: savedGame })
    setPayMessage('')

    const query = playerName
      ? supabase.from('spots').update({ paid }).eq('dip_id', id).eq('player_name', playerName)
      : supabase.from('spots').update({ paid }).eq('id', singleSpotId!)
    const { error } = await query
    if (error) {
      setSpots(prevSpots)
      if (dip) writeDipCache(id, { dip, spots: prevSpots, likers, game: savedGame })
      setPayMessage('Couldn’t update paid status — try again.')
      setTimeout(() => setPayMessage(''), 5000)
      return
    }
    scheduleSheetSync()

    // Auto-move forward: Full → Ready to draw when every player has paid (never backwards)
    if (paid && dip?.stage === 'payments') {
      const taken = nextSpots.filter(s => s.player_name)
      if (taken.length > 0 && taken.every(s => s.paid)) {
        if (await moveToStage('closed')) showToast('Everyone has paid — ready to draw')
      }
    }
  }

  async function handleTogglePaid(spot: Spot) {
    await setPlayerPaid(spot.player_name, !spot.paid, spot.id)
  }

  async function handleDeleteSpot(spotId: string) {
    await supabase.from('spots').delete().eq('id', spotId)
    await loadDip()
    scheduleSheetSync()
  }

  // ---- In-app confirm, toast ----
  function askConfirm(opts: ConfirmOptions): Promise<boolean> {
    return new Promise(resolve => setConfirmState({ ...opts, resolve }))
  }

  function resolveConfirm(ok: boolean) {
    const current = confirmState
    setConfirmState(null)
    current?.resolve(ok)
  }

  function showToast(text: string, tone: 'success' | 'error' = 'success') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ text, tone })
    toastTimerRef.current = setTimeout(() => setToast(null), 3500)
  }

  // ---- Stage moves ----
  async function moveToStage(next: string, extra: Record<string, unknown> = {}): Promise<boolean> {
    setStageBusy(true)
    const { error } = await supabase.from('dips').update({ stage: next, status: next, ...extra }).eq('id', id)
    setStageBusy(false)
    if (error) {
      showToast('Couldn’t change stage — try again.', 'error')
      return false
    }
    await loadDip()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    return true
  }

  async function handleMoveToQueue() {
    if (!likesReached) {
      const ok = await askConfirm({
        title: `Only ${likesCount} of ${likesTarget || '?'} likes — move anyway?`,
        message: 'CU usually needs the full likes target before the dip goes in the queue.',
        confirmLabel: 'Move to queue anyway',
      })
      if (!ok) return
    }
    await moveToStage('queue')
  }

  async function handleSubmitLive() {
    if (overRandomOrg && !dip?.google_sheet_link) {
      const ok = await askConfirm({
        title: 'No Google Sheet yet — continue?',
        message: 'This dip is over $2000, so CU requires a Google Sheet. Connect Google Sheets above to create one.',
        confirmLabel: 'Continue anyway',
      })
      if (!ok) return
    }
    // Submitted, not yet approved
    if (await moveToStage('live', { live_approved_at: null })) {
      showToast('Live post submitted — waiting for CU admins')
    }
  }

  // CU admins approved the live post: the dip is actually live now.
  // Wishlist notifications go out here (not at submit).
  async function handleApproveLive() {
    if (!dip) return
    setStageBusy(true)
    const { error } = await supabase
      .from('dips')
      .update({ live_approved_at: new Date().toISOString() })
      .eq('id', id)
    setStageBusy(false)
    if (error) {
      showToast('Couldn’t save — try again.', 'error')
      return
    }
    await notifyWishlistersLive()
    await loadDip()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    showToast('Your dip is live 🎉')
  }

  async function handleMoveToPayments() {
    if (!dip) return
    if (filledSpots < dip.total_spots) {
      const ok = await askConfirm({
        title: `Only ${filledSpots} of ${dip.total_spots} spots filled — move anyway?`,
        message: 'Payments normally open once the dip is 100% full.',
        confirmLabel: 'Collect payments anyway',
      })
      if (!ok) return
    }
    if (await moveToStage('payments')) setSpotsView('players')
  }

  async function handleMoveToClosed() {
    if (unpaidPlayerCount > 0) {
      const ok = await askConfirm({
        title: `${unpaidPlayerCount} ${unpaidPlayerCount === 1 ? 'player' : 'players'} still to pay — move anyway?`,
        message: 'Ready to draw normally means everyone has paid.',
        confirmLabel: 'Move to Ready to draw anyway',
      })
      if (!ok) return
    }
    await moveToStage('closed')
  }

  async function handleBackStage() {
    if (!dip) return
    const idx = STAGES.indexOf(dip.stage)
    if (idx <= 0) return
    const prev = STAGES[idx - 1]
    const ok = await askConfirm({
      title: `Go back to ${DIP_STAGE_LABELS[prev]}?`,
      message: 'Nothing is deleted — you can move forward again any time.',
      confirmLabel: `Back to ${DIP_STAGE_LABELS[prev]}`,
    })
    if (!ok) return
    await moveToStage(prev)
  }

  // ---- Edit dip details (Tools → Dip details) ----
  function openToolsSection(key: 'boost' | 'payment' | 'details' | null) {
    if (key === 'details' && dip) {
      setDetailsForm({
        wrap_name: dip.wrap_name || '',
        brand: dip.brand || '',
        wrap_size: dip.wrap_size || '',
        wrap_blend: dip.wrap_blend || '',
        wrap_condition: dip.wrap_condition || 'EUC',
        shipping_credit: dip.shipping_credit != null ? String(dip.shipping_credit) : '',
        shipping_from: dip.shipping_from || '',
        feedback_hub_link: dip.feedback_hub_link || '',
        smoke_free: !!dip.smoke_free,
        pet_free: !!dip.pet_free,
        total_spots: String(dip.total_spots),
        likes_required: dip.likes_required != null ? String(dip.likes_required) : '',
        price_per_spot: String(dip.price_per_spot),
        bookend: String(dip.bookend_price_override ?? dip.price_bookend ?? ''),
        price_ls1: dip.price_ls1 != null ? String(dip.price_ls1) : '',
        price_ls2: dip.price_ls2 != null ? String(dip.price_ls2) : '',
        price_ls3: dip.price_ls3 != null ? String(dip.price_ls3) : '',
        price_ls4: dip.price_ls4 != null ? String(dip.price_ls4) : '',
        price_ls5: dip.price_ls5 != null ? String(dip.price_ls5) : '',
      })
      setDetailsError('')
    }
    setToolsSection(key)
  }

  async function handleSaveDetails() {
    if (!dip || !detailsForm) return
    const f = detailsForm
    const str = (k: string) => String(f[k] ?? '').trim()
    // '' -> null; otherwise a number >= 0 (NaN if invalid)
    const money = (k: string) => (str(k) === '' ? null : Number(str(k)))

    const name = str('wrap_name')
    if (!name) { setDetailsError('Wrap name is required.'); return }

    const totalSpots = Number(str('total_spots'))
    if (!Number.isInteger(totalSpots) || totalSpots < 1) {
      setDetailsError('Number of spots must be a whole number, 1 or more.')
      return
    }
    if (totalSpots < highestTakenSpot) {
      setDetailsError(`Number of spots can’t go below ${highestTakenSpot} — spot ${highestTakenSpot} is already taken.`)
      return
    }

    const likes = str('likes_required') === '' ? null : Number(str('likes_required'))
    if (likes !== null && (!Number.isInteger(likes) || likes < 0)) {
      setDetailsError('Likes target must be a whole number.')
      return
    }

    const main = Number(str('price_per_spot'))
    if (!(main > 0)) { setDetailsError('Main ticket price must be more than $0.'); return }

    const priceFields = ['bookend', 'price_ls1', 'price_ls2', 'price_ls3', 'price_ls4', 'price_ls5', 'shipping_credit']
    for (const k of priceFields) {
      const v = money(k)
      if (v !== null && (Number.isNaN(v) || v < 0)) {
        setDetailsError('Prices must be numbers, $0 or more.')
        return
      }
    }

    const brandValue = str('brand')
    const bookend = money('bookend')
    const update: Record<string, unknown> = {
      wrap_name: name,
      brand: brandValue || null,
      title: `${brandValue} ${name}`.trim(),
      wrap_size: str('wrap_size') || null,
      wrap_blend: str('wrap_blend') || null,
      wrap_condition: str('wrap_condition') || 'EUC',
      shipping_credit: money('shipping_credit'),
      shipping_from: str('shipping_from') || null,
      feedback_hub_link: str('feedback_hub_link') || null,
      smoke_free: !!f.smoke_free,
      pet_free: !!f.pet_free,
      total_spots: totalSpots,
      likes_required: likes,
      price_per_spot: main,
      price_ls1: money('price_ls1'),
      price_ls2: money('price_ls2'),
      price_ls3: money('price_ls3'),
      price_ls4: money('price_ls4'),
      price_ls5: money('price_ls5'),
      price_bookend: bookend,
      total_value: totalSpots * main,
    }
    // Keep a Boost bookend override in step so the edited price is what gets charged
    if (dip.bookend_price_override != null) update.bookend_price_override = bookend

    setSavingDetails(true)
    setDetailsError('')
    const { error } = await supabase.from('dips').update(update).eq('id', id)
    setSavingDetails(false)
    if (error) {
      setDetailsError('Couldn’t save — try again.')
      return
    }
    await loadDip()
    scheduleSheetSync()
    showToast('Dip details saved ✓')
  }

  // ---- Edit a spot / a player ----
  function openSpotEditor(spot: Spot) {
    setEditPlayer(null)
    setEditError('')
    setEditSpot(spot)
    setEditSpotForm({
      player: spot.player_name || '',
      type: spot.spot_type,
      amount: spot.amount_owed == null ? '' : String(spot.amount_owed),
    })
  }

  function openPlayerEditor(name: string) {
    setEditSpot(null)
    setEditError('')
    setEditPlayer(name)
    setEditPlayerName(name)
  }

  function changeEditSpotType(type: string) {
    setEditSpotForm(f => ({
      ...f,
      type,
      // Prefill the amount from the dip's current price for that type (custom/game keep what's there)
      amount: type === 'custom' || type.startsWith('game') ? f.amount : String(getPriceForType(type)),
    }))
  }

  async function handleSaveSpotEdit() {
    if (!editSpot) return
    const player = editSpotForm.player.trim()
    if (!player) { setEditError('Enter the player name.'); return }
    const amountRaw = editSpotForm.amount.trim()
    const amount = amountRaw === '' ? null : Number(amountRaw)
    if (amount !== null && (Number.isNaN(amount) || amount < 0)) {
      setEditError('Amount owed must be a number, $0 or more.')
      return
    }
    setSavingEdit(true)
    const { error } = await supabase
      .from('spots')
      .update({ player_name: player, spot_type: editSpotForm.type, amount_owed: amount })
      .eq('id', editSpot.id)
    setSavingEdit(false)
    if (error) { setEditError('Couldn’t save — try again.'); return }
    setEditSpot(null)
    await loadDip()
    scheduleSheetSync()
    showToast(`Spot ${editSpot.spot_number} updated ✓`)
  }

  async function handleDeleteSpotFromEditor() {
    if (!editSpot) return
    const ok = await askConfirm({
      title: `Delete spot #${editSpot.spot_number}?`,
      message: `${editSpot.player_name} will be removed from spot ${editSpot.spot_number}.`,
      confirmLabel: 'Delete spot',
      danger: true,
    })
    if (!ok) return
    const spotId = editSpot.id
    setEditSpot(null)
    await handleDeleteSpot(spotId)
  }

  async function handleRenamePlayer() {
    if (!editPlayer) return
    const next = editPlayerName.trim()
    if (!next) { setEditError('Enter the player name.'); return }
    if (next === editPlayer) { setEditPlayer(null); return }
    setSavingEdit(true)
    const { error } = await supabase
      .from('spots')
      .update({ player_name: next })
      .eq('dip_id', id)
      .eq('player_name', editPlayer)
    setSavingEdit(false)
    if (error) { setEditError('Couldn’t save — try again.'); return }
    setEditPlayer(null)
    await loadDip()
    scheduleSheetSync()
    showToast('Player renamed ✓')
  }

  async function handleDeleteDip() {
    const ok = await askConfirm({
      title: 'Delete this dip?',
      message: 'This deletes the dip and its spot list. It cannot be undone.',
      confirmLabel: 'Delete dip',
      danger: true,
    })
    if (!ok) return
    await supabase.from('spots').delete().eq('dip_id', id)
    await supabase.from('dips').delete().eq('id', id)
    try { localStorage.removeItem(dipCacheKey(id)) } catch {}
    router.push('/dashboard')
  }

  async function notifyWishlistersLive() {
    if (!dip) return
    if (!(dip as any).live_notified && dip.wrap_id) {
      const { data: wishlisters } = await supabase
        .from('wishlists')
        .select('user_id')
        .eq('wrap_id', dip.wrap_id)

      const recipientIds = [...new Set((wishlisters || []).map((w: any) => w.user_id))]
        .filter((uid) => uid && uid !== currentUserId)

      if (recipientIds.length > 0) {
        const notifRows = recipientIds.map((uid) => ({
          recipient_user_id: uid,
          actor_user_id: currentUserId,
          wrap_id: dip.wrap_id,
          type: 'dip_live',
          read_at: null,
        }))
        await supabase.from('notifications').insert(notifRows)

        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: recipientIds,
            title: `🎲 A wishlisted wrap is being dipped!`,
            body: `${dip.brand || ''} ${dip.wrap_name || ''}`.trim(),
            url: '/explore',
          }),
        }).catch(() => {})
      }

      await supabase.from('dips').update({ live_notified: true }).eq('id', id)
    }
  }


  async function handleSavePaymentMethods() {
    setSavingSettings(true)
    await supabase.from('dips').update({ payment_methods: paymentMethods || null }).eq('id', id)
    await loadDip()
    setSavingSettings(false)
  }

  async function handleSaveResult() {
    if (!dip) return
    const raw = winningNumber.trim()
    const num = Number(raw)
    if (!raw || !Number.isInteger(num) || num < 1 || num > dip.total_spots) {
      setWinnerMessage(`Enter a whole number from 1 to ${dip.total_spots}.`)
      return
    }
    setWinnerMessage('')
    const winningSpot = spots.find(s => s.spot_number === num && s.player_name)
    await supabase.from('dips').update({
      winning_number: num,
      winner_name: winningSpot?.player_name || null,
      drawn_at: new Date().toISOString(),
      stage: 'drawn',
      status: 'drawn',
    }).eq('id', id)
    await loadDip()
    scheduleSheetSync()
  }

  // Game helpers
  function getSuggestedGamePrices(mainPrice: number, slotCount: number) {
    const base = [
      { label: 'Standard', price: mainPrice },
      { label: 'LS 1', price: Math.round(mainPrice * 0.9) },
      { label: 'Bookend +$2', price: Math.round(mainPrice * 0.734) + 2 },
      { label: 'Bookend', price: Math.round(mainPrice * 0.734) },
      { label: 'Bookend -$2', price: Math.max(0, Math.round(mainPrice * 0.734) - 2) },
      { label: 'Free', price: 0 },
    ]
    // If more slots than base, fill extras with main price
    while (base.length < slotCount) {
      base.splice(base.length - 1, 0, {
        label: `Slot ${base.length}`,
        price: Math.round(mainPrice * 0.9),
      })
    }
    return base.slice(0, slotCount)
  }

  function toggleEmoji(emoji: string, maxSlots: number) {
    if (selectedEmojis.includes(emoji)) {
      setSelectedEmojis(prev => prev.filter(e => e !== emoji))
    } else if (selectedEmojis.length < maxSlots) {
      setSelectedEmojis(prev => [...prev, emoji])
    }
  }
  // Fast entry: clears and refocuses straight away (keyboard stays up), shows the
  // name instantly, then saves in the background.
  async function handleAddLiker(nameArg?: string) {
    const name = (nameArg ?? newLikerName).trim()
    if (!name) return
    setNewLikerName('')
    likerInputRef.current?.focus()
    setLikerMessage('')

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setLikers(prev => [...prev, { id: tempId, name, unliked: false }])

    const { data, error } = await supabase
      .from('dip_likers')
      .insert({ dip_id: id, name })
      .select()
      .single()

    setLikers(prev => {
      const next = error || !data
        ? prev.filter(l => l.id !== tempId)
        : prev.map(l => (l.id === tempId ? (data as Liker) : l))
      if (dip) writeDipCache(id, { dip, spots, likers: next, game: savedGame })
      return next
    })
    if (error || !data) {
      setLikerMessage(`Couldn’t add ${name} — try again.`)
      setTimeout(() => setLikerMessage(''), 5000)
    }
  }

  async function handleDeleteLiker(likerId: string) {
    if (likerId.startsWith('temp-')) return
    await supabase.from('dip_likers').delete().eq('id', likerId)
    await loadDip()
  }

  // Tap a name to toggle liked / unliked. Optimistic, so it feels instant;
  // reverts if Supabase rejects it.
  async function handleToggleLiker(liker: Liker) {
    if (String(liker.id).startsWith('temp-')) return // still saving
    const nextUnliked = !liker.unliked
    const apply = (unliked: boolean) =>
      setLikers(prev => {
        const next = prev.map(l => (String(l.id) === String(liker.id) ? { ...l, unliked } : l))
        if (dip) writeDipCache(id, { dip, spots, likers: next, game: savedGame })
        return next
      })
    apply(nextUnliked)
    setLikerMessage('')
    const { data, error } = await supabase
      .from('dip_likers')
      .update({ unliked: nextUnliked })
      .eq('id', liker.id)
      .select('id')
    if (error || !data || data.length === 0) {
      apply(!!liker.unliked)
      setLikerMessage('Couldn’t update that liker — try again.')
      setTimeout(() => setLikerMessage(''), 5000)
    }
  }
  async function handleSaveGame() {
    if (!dip || selectedEmojis.length === 0) return
    setSavingGame(true)
    setGameMessage('')
    const suggested = getSuggestedGamePrices(dip.price_per_spot, selectedEmojis.length)
    const emoji_map = selectedEmojis.map((emoji, i) => ({
      emoji,
      price: gamePriceOverrides[i] !== undefined ? Number(gamePriceOverrides[i]) : suggested[i]?.price ?? dip.price_per_spot
    }))
    if (savedGame) {
      await supabase.from('dip_games').update({ emoji_map }).eq('id', savedGame.id)
    } else {
      await supabase.from('dip_games').insert({ dip_id: id, emoji_map })
    }
    await supabase.from('dips').update({ game_locked: true }).eq('id', id)
    await loadDip()
    setSavingGame(false)
    setGameMessage('Game saved ✓')
    setTimeout(() => setGameMessage(''), 3000)
  }

  async function handleResetGame() {
    if (!savedGame) return
    if (!(await askConfirm({
      title: 'Reset game?',
      message: 'This deletes the saved game so you can set it up again. It cannot be undone.',
      confirmLabel: 'Reset game',
      danger: true,
    }))) return
    await supabase.from('dip_games').delete().eq('id', savedGame.id)
    await supabase.from('dips').update({ game_locked: false }).eq('id', id)
    setSavedGame(null)
    setSelectedEmojis([])
    setGamePriceOverrides({})
    setCustomGameSlots('')
    setGameMessage('Game reset')
    setTimeout(() => setGameMessage(''), 3000)
  }
async function handleRevealGamePrices() {
    if (!savedGame || !dip) return
    if (!(await askConfirm({
      title: 'Reveal game prices?',
      message: 'This fills in what each game player owes. Make sure you have sent the results to CU admins first.',
      confirmLabel: 'Reveal prices',
    }))) return
    const map = savedGame.emoji_map as {emoji: string, price: number}[]
    const gameSpots = spots.filter(s => s.spot_type.startsWith('game:') && s.player_name)
    for (const spot of gameSpots) {
      const emoji = spot.spot_type.replace('game:', '')
      const match = map.find(m => m.emoji === emoji)
      if (match !== undefined) {
        await supabase.from('spots').update({ amount_owed: match.price, game_revealed: true }).eq('id', spot.id)
      }
    }
    await loadDip()
    scheduleSheetSync()
  }
  function buildAdminRevealMessage() {
    if (!savedGame || !dip) return ''
    const map = savedGame.emoji_map as {emoji: string, price: number}[]
    const lines = map.map(m => `${m.emoji} = ${m.price === 0 ? 'FREE' : '$' + m.price + ' USD'}`)
    return `Game reveal for ${dip.brand || ''} ${dip.wrap_name || ''}:\n\n${lines.join('\n')}`
  }
  function buildGameRevealPost() {
    if (!savedGame || !dip) return ''
    const map = savedGame.emoji_map as {emoji: string, price: number}[]
    const gameSpots = spots.filter(s => s.spot_type.startsWith('game:') && s.player_name)
    const lines = gameSpots.map(s => {
      const emoji = s.spot_type.replace('game:', '')
      const match = map.find(m => m.emoji === emoji)
      const price = match ? (match.price === 0 ? 'FREE 🎉' : `$${match.price} USD`) : '?'
      return `@${s.player_name} — ${emoji} ${price}`
    })
    return `🎮 GAME REVEAL! 🎮

${dip.brand || ''} ${dip.wrap_name || ''}

Here are your game prices:
${lines.join('\n')}

Please pay as per payment instructions! 💕

${postFooter()}`
  }
  async function handleSaveBookend() {
    if (!bookendPrice) return
    await supabase.from('dips').update({
      bookend_price_override: Number(bookendPrice),
      bookend_locked: true,
    }).eq('id', id)
    await loadDip()
  }

  async function handleSaveClosing() {
    if (!closingPrice) return
    await supabase.from('dips').update({
      closing_price: Number(closingPrice),
      closing_liker_price: closingLikerPrice ? Number(closingLikerPrice) : null,
      closing_spots_count: closingSpots ? Number(closingSpots) : null,
      closing_locked: true,
    }).eq('id', id)
    await loadDip()
  }
function buildBookendPost() {
    if (!dip) return ''
    const price = bookendPrice || dip.price_bookend || '?'
    return `🔖 BOOKEND SPECIAL! 🔖

${dip.brand || ''} ${dip.wrap_name || ''}

Spots 1 & ${dip.total_spots} available at $${price} USD each!

Comment "next" + spot 1 or spot ${dip.total_spots} to claim!
Each claim must be a NEW comment (not a reply!)

${postFooter()}`
  }

  function buildClosingPost() {
    if (!dip) return ''
    const remaining = dip.total_spots - filledSpots
    const numSpots = closingSpots || remaining
    const price = closingPrice || '?'
    const likerLine = closingLikerPrice ? `\n⭐ Likers: $${closingLikerPrice} USD each!` : ''
    return `🏁 CLOSING SPECIAL! 🏁

${dip.brand || ''} ${dip.wrap_name || ''}

Last ${numSpots} spots available at $${price} USD each!${likerLine}
Don't miss out — almost gone! 🦄

Comment "next" + your number to claim!
Each claim must be a NEW comment (not a reply!)

${postFooter()}`
  }
  // Entries from the unsaved game builder (emoji + price, in slot order)
  function getBuilderGameEntries(): GameEntry[] {
    if (!dip) return []
    const suggested = getSuggestedGamePrices(dip.price_per_spot, selectedEmojis.length)
    return selectedEmojis.map((emoji, i) => ({
      emoji,
      price: gamePriceOverrides[i] !== undefined ? Number(gamePriceOverrides[i]) : (suggested[i]?.price ?? dip.price_per_spot),
    }))
  }

  function buildGamePost(entries: GameEntry[]) {
    if (!dip || entries.length === 0) return ''
    const prizeList = entries.map(e => e.price === 0 ? '🎉 FREE' : `$${e.price} USD`).join(' | ')
    // Shuffle emojis so order doesn't reveal which emoji = which price.
    // Seeded, so preview, copy and reloads always show the same order.
    const emojis = entries.map(e => e.emoji)
    const shuffledEmojis = stableShuffle(emojis, `${id}:${emojis.join('')}`)

    return `🎮 GAME TIME! 🎮

${dip.brand || ''} ${dip.wrap_name || ''}

Pick an emoji for a game spot — price is hidden until all ${entries.length} are claimed!

${shuffledEmojis.join('  ')}

Prizes hidden behind the emojis:
${prizeList}

Comment "next" + your emoji to claim!
Each claim must be a NEW comment (not a reply!)

⚠️ Results sent to CU admins before reveal.

${postFooter()}`
  }
async function handleArchiveDip() {
    if (!dip) return
    if (!(await askConfirm({
      title: winnerName ? 'Complete & archive this dip?' : 'No winner recorded — archive anyway?',
      message: 'It moves to your dip history in Tools. You can unarchive it there.',
      confirmLabel: 'Archive dip',
    }))) return
    await supabase.from('dips').update({ 
      archived: true,
      total_raised: totalOwed,
      winner_name: winnerName,
    }).eq('id', id)
    router.push('/tools')
  }
  async function copyText(text: string, key: string) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('no clipboard')
      await navigator.clipboard.writeText(text)
      setCopyError('')
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setCopied(null)
      // Open that post's preview so there's text to press-and-hold
      setOpenPreviews(prev => ({ ...prev, [key]: true }))
      setCopyError('Couldn’t copy. Press and hold the post preview text to select and copy it instead.')
      setTimeout(() => setCopyError(''), 7000)
    }
  }

  // Two-line footer on every dip post (not the admin-only message).
  // Links to the seller's public collection; private profiles get the plain site link.
  function postFooter() {
    const site = 'wrapapp.com.au'
    if (!dip || !sellerPublic || sellerPublic.isPrivate) return `🎲 Dip run on WrapApp
${site}`
    const link = sellerPublic.username ? `${site}/${sellerPublic.username}` : `${site}/user/${dip.user_id}`
    return `🎲 Dip run on WrapApp
See my wrap collection: ${link}`
  }

  // FB Post text builders
  function buildInterestPost() {
    if (!dip) return ''
    const ls = [
      `- 1 spot = $${dip.price_ls1 || '?'}`,
      `- 2 spots = $${dip.price_ls2 || '?'}`,
      `- 3 spots = $${dip.price_ls3 || '?'}`,
      `- 4 spots = $${dip.price_ls4 || '?'}`,
      `- 5 spots = $${dip.price_ls5 || '?'}`,
    ].join('\n')
    const household = `${dip.smoke_free ? 'Smoke free' : 'Not smoke free'} / ${dip.pet_free ? 'Pet free' : 'Not pet free'}`
    const totalVal = dip.total_spots * dip.price_per_spot
    const over2k = totalVal > 2000
    return `#newinterestpost

${dip.brand || ''} ${dip.wrap_name || ''}
Size: ${dip.wrap_size || '[add size]'}
Blend: ${dip.wrap_blend || '[add blend]'}
Condition: ${dip.wrap_condition || '[add condition]'}

${dip.total_spots} spots @ $${dip.price_per_spot} USD each${over2k ? ' + $4.95 draw fee' : ''}
Likes needed: ${dip.likes_required}

Liker Specials:
${ls}

$${dip.shipping_credit || '?'} USD shipping credit included
Shipping from ${dip.shipping_from || '[location]'}
${household}

Feedback Hub: ${dip.feedback_hub_link || '[add Feedback Hub link]'}

${postFooter()}`
  }

  // Queue is not a new post — the seller edits the interest post and swaps the hashtag
  function buildQueuePost() {
    return '#newinqueue'
  }

  function buildLivePost() {
    if (!dip) return ''
    const ls = [
      `- 1 spot = $${dip.price_ls1 || '?'}`,
      `- 2 spots = $${dip.price_ls2 || '?'}`,
      `- 3 spots = $${dip.price_ls3 || '?'}`,
      `- 4 spots = $${dip.price_ls4 || '?'}`,
      `- 5 spots = $${dip.price_ls5 || '?'}`,
    ].join('\n')
    const household = `${dip.smoke_free ? 'Smoke free' : 'Not smoke free'} / ${dip.pet_free ? 'Pet free' : 'Not pet free'}`
    const totalVal = dip.total_spots * dip.price_per_spot
    const over2k = totalVal > 2000
    const filledPct = Math.round((filledSpots / dip.total_spots) * 100)
    // Unliked names are never tagged
    const likerTags = likedLikers.length > 0 ? likedLikers.map(l => `@${l.name}`).join('\n') : ''
    return `#newlivepost

🎉 WE ARE LIVE! 🎉${filledPct > 0 ? `\n${filledPct}% FILLED` : ''}

${dip.brand || ''} ${dip.wrap_name || ''}
Size: ${dip.wrap_size || '[add size]'}
Blend: ${dip.wrap_blend || '[add blend]'}
Condition: ${dip.wrap_condition || '[add condition]'}

${dip.total_spots} spots @ $${dip.price_per_spot} USD each${over2k ? ' + $4.95 draw fee' : ''}
Likes: ${likesCount}/${dip.likes_required || '?'} ❤️

Liker Specials (first 24hrs only!):
${ls}

Comment "next" followed by your number/s or "random" 🎲
Each claim must be a NEW comment (not a reply!)
Payments open once the dip is 100% full.

Spot list: ${dip.google_sheet_link || '[add Google Sheet link]'}

$${dip.shipping_credit || '?'} USD shipping credit included
Shipping from ${dip.shipping_from || '[location]'}
${household}

Feedback Hub: ${dip.feedback_hub_link || '[add Feedback Hub link]'}${likerTags ? `\n\n❤️ Likers — you have 24hrs to claim your liker special! Comment below with your number/s.\n${likerTags}` : ''}

${postFooter()}`
  }

  function buildPaymentPost() {
    if (!dip) return ''
    const unpaidNames = [...new Set(unpaidSpots.map(s => s.player_name).filter(Boolean))]
    const tagList = unpaidNames.map(n => `@${n}`).join('\n')
    return `#fullandcollectingpayments

💸 Payments are now open! 💸

${dip.brand || ''} ${dip.wrap_name || ''} is FULL — time to pay for your spots!

Payment via: ${dip.payment_methods || 'PayPal Friends & Family (no comments, gifted only)'}
Post a screenshot of your payment in the comments 📸

${tagList ? `Tagging those who need to pay:\n${tagList}` : ''}

Thank you everyone — so close! 🦄

${postFooter()}`
  }
  function buildWinnerPost() {
    // Only when a valid winning number is saved and that spot has a player
    if (!dip || !dip.winning_number || !winnerName) return ''
    return `🎉 AND THE WINNER IS... 🎉

${dip.brand || ''} ${dip.wrap_name || ''}

🎲 Spot #${dip.winning_number} — Congratulations @${winnerName}! 🎲

Thank you so much to everyone who played — you are all amazing! 🦄

${dip.brand || ''} ${dip.wrap_name || ''} will be shipped within 3 days. 💕

${postFooter()}`
  }
  function buildClosedPost() {
    if (!dip) return ''
    const unpaidNames = [...new Set(
      unpaidSpots
        .filter(s => (s.amount_owed || 0) > 0)
        .map(s => s.player_name)
        .filter(Boolean)
    )]
    const tagList = unpaidNames.map(n => `@${n}`).join('\n')
    return `🎉 FULL AND READY TO DRAW! 🎉

${dip.brand || ''} ${dip.wrap_name || ''} is SOLD OUT! 🦄

${tagList ? `If you still owe payment, please pay ASAP — unpaid spots will be reallocated after 24 hours.\n\nStill needs to pay:\n${tagList}` : 'Everyone has paid — ready for the draw! 🎲'}

Thank you all so much! Drawing soon! 🎲

${postFooter()}`
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-200 border-t-pink-600" />
        </div>
      </AppLayout>
    )
  }

  if (!dip) {
    return (
      <AppLayout>
        <div className="text-center py-20 text-gray-500">Dip not found</div>
      </AppLayout>
    )
  }

  const currentStageIndex = STAGES.indexOf(dip.stage)
  // Live has two states: submitted (waiting for CU admins) and approved (actually live)
  const liveApproved = dip.stage !== 'live' || !!dip.live_approved_at
  const gameNeedsReveal = !!savedGame && gameAllClaimed && !gameRevealed
  // Boost only appears once the dip is actually live (approved). After Live it stays
  // only while a fully-claimed game still needs revealing / its reveal post copied.
  const isAfterLive = ['payments', 'closed', 'drawn'].includes(dip.stage)
  const showBoost =
    (dip.stage === 'live' && !!dip.live_approved_at) || (isAfterLive && !!savedGame && gameAllClaimed)

  // Copy button (secondary: white, pink border) + optional preview.
  // The stage's action button is the strongest button on the page.
  const renderPostBlock = (key: string, label: string, text: string) => (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => copyText(text, key)}
        className={`min-h-[52px] w-full rounded-xl px-4 text-base font-bold transition ${
          copied === key
            ? 'border-2 border-green-500 bg-green-500 text-white'
            : 'border-2 border-pink-400 bg-white text-pink-700'
        }`}
      >
        {copied === key ? '✓ Copied!' : `📋 ${label}`}
      </button>
      <button
        type="button"
        onClick={() => setOpenPreviews(prev => ({ ...prev, [key]: !prev[key] }))}
        className="min-h-[44px] w-full text-sm font-semibold text-gray-600"
      >
        {openPreviews[key] ? 'Hide preview ▴' : 'Show preview ▾'}
      </button>
      {openPreviews[key] && (
        <div className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700 whitespace-pre-wrap break-words">
          {text}
        </div>
      )}
    </div>
  )

  const renderAction = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      disabled={stageBusy}
      className="min-h-[56px] w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 text-base font-bold text-white shadow-md disabled:opacity-50"
    >
      {stageBusy ? 'Saving…' : label}
    </button>
  )

  const renderProgress = (label: string, value: number, max: number) => {
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
    const done = max > 0 && value >= max
    return (
      <div>
        <p className={`text-sm font-bold ${done ? 'text-green-700' : 'text-gray-800'}`}>
          {label}{done ? ' ✓' : ''}
        </p>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div className={`h-full ${done ? 'bg-green-500' : 'bg-gradient-to-r from-pink-500 to-rose-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    )
  }

  // Shared blocks (used in more than one place)
  const winnerCard = (
    <>
            {(dip.stage === 'closed' || dip.stage === 'drawn') && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                {dip.winning_number && winnerName ? (
                  <h3 className="font-bold text-gray-900">🎉 Winner: {winnerName} (spot {dip.winning_number})</h3>
                ) : dip.winning_number ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
                    <p className="text-sm font-bold text-amber-900">Spot {dip.winning_number} has no player</p>
                    <p className="mt-1 text-xs text-amber-800">Add the player for spot {dip.winning_number} in the spot list, or enter the correct winning number below.</p>
                  </div>
                ) : (
                  <h3 className="font-bold text-gray-900">Record Winning Number</h3>
                )}
                {!winnerName && (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={winningNumber}
                        onChange={(e) => { setWinningNumber(e.target.value); setWinnerMessage('') }}
                        placeholder={`1 – ${dip.total_spots}`}
                        className="flex-1 rounded-xl border px-3 py-2.5 text-[16px] outline-none focus:border-pink-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveResult}
                        className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white"
                      >
                        Save
                      </button>
                    </div>
                    {winnerMessage && (
                      <p className="text-sm font-semibold text-red-600">{winnerMessage}</p>
                    )}
                    <p className="text-xs text-gray-500">Enter the number drawn by CU admins.</p>
                  </>
                )}
              </div>
            )}
    </>
  )

  const spotsContent = (
    <>

            {/* Payments: switch between player view and the normal spot list */}
            {isPaymentStage && (
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                {([['players', '👤 By player'], ['spots', '🎯 All spots']] as const).map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setSpotsView(view)}
                    className={`min-h-[44px] rounded-lg text-sm font-bold transition ${
                      spotsView === view ? 'bg-white text-pink-600 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {payMessage && <p className="text-sm font-semibold text-red-600">{payMessage}</p>}

            {/* Player view — one row per player, unpaid first */}
            {isPaymentStage && spotsView === 'players' && (
              <>
                <div className={`rounded-2xl border p-4 shadow-sm ${unpaidPlayerCount === 0 && playerGroups.length > 0 ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-gray-600">Still owed</span>
                    <span className={`text-2xl font-bold ${totalOwed - totalPaid > 0 ? 'text-rose-600' : 'text-green-700'}`}>
                      ${totalOwed - totalPaid} USD
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    {playerGroups.length === 0
                      ? 'No players yet.'
                      : unpaidPlayerCount === 0
                      ? 'Everyone has paid ✓'
                      : `${unpaidPlayerCount} of ${playerGroups.length} players still to pay`}
                  </p>
                </div>

                <div className="rounded-2xl border bg-white shadow-sm overflow-hidden divide-y">
                  {playerGroups.map(g => (
                    <div key={g.name} className={`flex items-center gap-3 px-3 py-2.5 ${g.paid ? 'bg-green-50' : ''}`}>
                      {/* Tap to edit this player (rename, or edit one of their spots) */}
                      <button
                        type="button"
                        onClick={() => openPlayerEditor(g.name)}
                        className="min-h-[44px] min-w-0 flex-1 text-left"
                        aria-label={`Edit ${g.name}`}
                      >
                        <p className="font-semibold text-gray-900 break-words">{g.name} <span className="text-xs font-normal text-gray-400">✎</span></p>
                        <p className="text-xs text-gray-500">
                          {g.spotNumbers.length === 1 ? 'Spot' : 'Spots'} {g.spotNumbers.join(', ')}
                        </p>
                        <p className="text-sm font-bold text-gray-800">
                          ${g.owed} USD{g.hiddenGame ? ' + 🎮 TBD' : ''}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void setPlayerPaid(g.name, !g.paid)}
                        aria-label={g.paid ? `Mark ${g.name} unpaid` : `Mark ${g.name} paid`}
                        className={`min-h-[44px] min-w-[96px] shrink-0 rounded-xl px-3 text-sm font-bold transition ${
                          g.paid ? 'bg-green-500 text-white' : 'border-2 border-gray-200 bg-white text-gray-700'
                        }`}
                      >
                        {g.paid ? '✓ Paid' : 'Mark paid'}
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!(isPaymentStage && spotsView === 'players') && (
            <>
            {/* Add spot */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Add Spot</h2>

              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Player Name</label>
                  <input
                    type="text"
                    value={addPlayerName}
                    onChange={(e) => setAddPlayerName(e.target.value)}
                    autoComplete="off"
                    autoCapitalize="words"
                    placeholder="e.g. Sarah Jones"
                    className="min-h-[44px] w-full rounded-xl border px-3 py-2.5 text-[16px] outline-none focus:border-pink-500"
                  />
                  {playerSuggestions.length > 0 && (
                    <div className="mt-1 overflow-hidden rounded-xl border bg-white">
                      {playerSuggestions.map((name, i) => {
                        const lower = name.toLowerCase()
                        const source = likedLikers.some(l => l.name.trim().toLowerCase() === lower)
                          ? '❤️ liker'
                          : thisDipPlayers.some(p => p.trim().toLowerCase() === lower)
                          ? 'in this dip'
                          : 'past dip'
                        return (
                          <button
                            key={name}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => setAddPlayerName(name)}
                            className={`flex min-h-[44px] w-full items-center justify-between gap-2 px-3 text-left text-[15px] font-semibold text-gray-800 hover:bg-pink-50 ${i > 0 ? 'border-t' : ''}`}
                          >
                            <span className="min-w-0 break-words">{name}</span>
                            <span className="shrink-0 text-xs font-normal text-gray-500">{source}</span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {['ls2','ls3','ls4','ls5'].includes(addSpotType)
                      ? `Spot Numbers — pick ${addSpotType.replace('ls','')} (${addSelectedSpots.length}/${addSpotType.replace('ls','')} selected)`
                      : 'Spot #'}
                  </label>
                  {['ls2','ls3','ls4','ls5'].includes(addSpotType) ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 min-h-[48px] items-center rounded-xl border px-2 py-1 bg-white">
                        {addSelectedSpots.length === 0 && (
                          <span className="px-1 text-sm text-gray-500">Tap numbers below to select</span>
                        )}
                        {addSelectedSpots.map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAddSelectedSpots(prev => prev.filter(x => x !== n))}
                            className="min-h-[44px] rounded-lg bg-pink-100 px-3 text-sm font-bold text-pink-700"
                          >
                            {n} ✕
                          </button>
                        ))}
                      </div>
                      {/* Free spots — 44px buttons, no inner scroll box */}
                      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                        {Array.from({ length: dip.total_spots }, (_, i) => i + 1)
                          .filter(n => !usedSpotNumbers.includes(n) && !addSelectedSpots.includes(n))
                          .map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                const required = Number(addSpotType.replace('ls', ''))
                                if (addSelectedSpots.length < required) {
                                  setAddSelectedSpots(prev => [...prev, n])
                                }
                              }}
                              className="min-h-[44px] rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:border-pink-400 hover:bg-pink-50"
                            >
                              {n}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
                      {Array.from({ length: dip.total_spots }, (_, i) => i + 1)
                        .filter(n => !usedSpotNumbers.includes(n))
                        .map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAddSelectedSpots([n])}
                            className={`min-h-[44px] rounded-lg border text-sm font-semibold transition ${
                              addSelectedSpots[0] === n
                                ? 'bg-pink-500 text-white border-pink-500'
                                : 'border-gray-200 bg-white text-gray-700 hover:border-pink-400 hover:bg-pink-50'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                  <select
                    value={addSpotType}
                    onChange={(e) => { setAddSpotType(e.target.value); setAddGameEmoji(''); setAddCustomPrice('') }}
                    className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                  >
                    <option value="main">Main — ${dip.price_per_spot}</option>
                    <option value="ls1">LS 1 — ${dip.price_ls1 || '?'}</option>
                    <option value="ls2">LS 2 — ${dip.price_ls2 || '?'}</option>
                    <option value="ls3">LS 3 — ${dip.price_ls3 || '?'}</option>
                    <option value="ls4">LS 4 — ${dip.price_ls4 || '?'}</option>
                    <option value="ls5">LS 5 — ${dip.price_ls5 || '?'}</option>
                    <option value="bookend">Bookend — ${dip.bookend_price_override ?? dip.price_bookend ?? '?'}</option>
                    <option value="game">🎮 Game — hidden</option>
                    <option value="closing">🏁 Closing — ${closingPrice || '?'}</option>
                    {closingLikerPrice ? <option value="closing-liker">⭐ Closing Liker — ${closingLikerPrice}</option> : null}
                    <option value="custom">✏️ Custom price</option>
                  </select>
                </div>
              </div>
{addSpotType === 'custom' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Custom price (USD)</label>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">$</span>
                    <input
                      type="number"
                      value={addCustomPrice}
                      onChange={(e) => setAddCustomPrice(e.target.value)}
                      placeholder="Enter price"
                      className="flex-1 rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                    />
                    <span className="text-xs text-gray-400">USD</span>
                  </div>
                </div>
              )}
              {addSpotType === 'game' && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Player's emoji</label>
                  {(!savedGame || savedGame.emoji_map.length === 0) ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
                      ⚠️ Set up your game first in 🧰 Tools → Boost → Game.
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {(savedGame?.emoji_map as {emoji: string, price: number}[] || []).map(({emoji}) => {
                          const alreadyClaimed = spots.some(s => s.spot_type === `game:${emoji}` && s.player_name)
                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => !alreadyClaimed && setAddGameEmoji(emoji)}
                              disabled={alreadyClaimed}
                              className={`h-12 w-12 rounded-xl text-2xl border transition relative ${
                                addGameEmoji === emoji
                                  ? 'bg-pink-100 border-pink-400 scale-110 shadow-sm'
                                  : alreadyClaimed
                                  ? 'bg-gray-100 border-gray-100 opacity-30 cursor-not-allowed'
                                  : 'bg-gray-50 border-gray-200 hover:border-pink-300'
                              }`}
                            >
                              {emoji}
                              {alreadyClaimed && (
                                <span className="absolute -top-1 -right-1 text-[10px] bg-gray-400 text-white rounded-full w-4 h-4 flex items-center justify-center">✓</span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {addGameEmoji && (
                        <p className="mt-2 text-xs text-gray-500">Selected: {addGameEmoji} — price hidden until revealed</p>
                      )}
                      {savedGame && (savedGame.emoji_map as {emoji: string, price: number}[]).every(({emoji: e}) => spots.some(s => s.spot_type === `game:${e}` && s.player_name)) && (
                        <p className="mt-2 text-xs text-green-600 font-semibold">All game emojis claimed! 🎉</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div className="rounded-xl bg-pink-50 px-3 py-2 text-sm">
                <span className="text-gray-600">Amount owed: </span>
                <span className="font-bold text-gray-900">
                  {addSpotType === 'game'
                    ? 'Hidden until revealed'
                    : addSpotType === 'custom' && !addCustomPrice
                    ? 'Enter price above'
                    : `$${getPriceForType(addSpotType)} USD`}
                </span>
              </div>

              <button
                type="button"
                onClick={handleAddSpot}
                disabled={addingSpot}
                className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {addingSpot ? 'Adding...' : '+ Add Spot'}
              </button>

              {addMessage && (
                <p className="text-sm text-red-500">{addMessage}</p>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Spots remaining</span>
                <span className="font-bold">{dip.total_spots - filledSpots}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Total owed</span>
                <span className="font-bold">${totalOwed} USD</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Total paid</span>
                <span className="font-bold text-green-600">${totalPaid} USD</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">Still owed</span>
                <span className="font-bold text-rose-500">${totalOwed - totalPaid} USD</span>
              </div>
            </div>

            {/* Spot list */}
            <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
              {spots.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No spots added yet
                </div>
              ) : (
                <div className="divide-y">
                  {/* Header note */}
                  <div className="px-4 py-2 bg-gray-50 text-xs text-gray-600">
                    <span className="font-semibold">Paid</span> marks <span className="font-semibold">all</span> of that player’s spots — players pay once for everything.
                  </div>

                  {spots.map((spot) => {
                    const playerSpotCount = spot.player_name ? spotsPerPlayer[spot.player_name] || 1 : 1
                    return (
                      <div
                        key={spot.id}
                        className={`flex items-center gap-2 px-2 py-2 text-sm ${spot.paid ? 'bg-green-50' : ''}`}
                      >
                        {/* Delete — far left, away from Paid */}
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await askConfirm({
                              title: `Delete spot #${spot.spot_number}?`,
                              message: `${spot.player_name} will be removed from spot ${spot.spot_number}.`,
                              confirmLabel: 'Delete spot',
                              danger: true,
                            })
                            if (ok) void handleDeleteSpot(spot.id)
                          }}
                          aria-label={`Delete spot ${spot.spot_number}`}
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-bold text-red-400 hover:bg-red-50"
                        >
                          ✕
                        </button>

                        <span className="w-8 shrink-0 text-center font-bold text-gray-500">{spot.spot_number}</span>

                        {/* Tap to edit this spot */}
                        <button
                          type="button"
                          onClick={() => openSpotEditor(spot)}
                          className="min-h-[44px] min-w-0 flex-1 text-left"
                          aria-label={`Edit spot ${spot.spot_number}`}
                        >
                          <p className="font-semibold text-gray-900 break-words">{spot.player_name} <span className="text-xs font-normal text-gray-400">✎</span></p>
                          <p className="text-xs text-gray-500">
                            {getSpotTypeLabel(spot.spot_type)} ·{' '}
                            <span className="font-semibold text-gray-700">
                              {isGameSpotType(spot.spot_type) && !spot.game_revealed
                                ? '🎮 TBD'
                                : spot.amount_owed !== null
                                ? `$${spot.amount_owed}`
                                : '—'}
                            </span>
                          </p>
                        </button>

                        {/* Paid — far right, applies to all of this player's spots */}
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(spot)}
                          aria-label={spot.paid ? `Mark ${spot.player_name} unpaid (all spots)` : `Mark ${spot.player_name} paid (all spots)`}
                          className={`min-h-[44px] min-w-[84px] shrink-0 rounded-xl px-2 py-1 text-xs font-bold leading-tight transition ${
                            spot.paid
                              ? 'bg-green-500 text-white'
                              : 'border-2 border-gray-200 bg-white text-gray-600'
                          }`}
                        >
                          {spot.paid ? '✓ Paid' : 'Mark paid'}
                          {playerSpotCount > 1 && (
                            <span className="block text-[11px] font-semibold opacity-90">all {playerSpotCount} spots</span>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Unpaid list for payment stage */}
            {dip.stage === 'payments' && unpaidSpots.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
                <h3 className="font-bold text-amber-900 mb-2 text-sm">Still unpaid ({unpaidSpots.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {unpaidSpots.map(s => (
                    <span key={s.id} className="rounded-full bg-white border border-amber-200 px-3 py-1 text-xs font-semibold text-amber-800">
                      {s.player_name} (#{s.spot_number} — ${s.amount_owed})
                    </span>
                  ))}
                </div>
              </div>
            )}
            </>
            )}
    </>
  )

  const nextStepTitle =
    dip.stage === 'live' && !liveApproved
      ? 'Live — waiting for approval'
      : DIP_STAGE_LABELS[dip.stage] || dip.stage

  const nextStepBody = (() => {
    switch (dip.stage) {
      case 'interest':
        return (
          <>
            <p className="text-[15px] leading-relaxed text-gray-800">
              Post your interest post in Chasing Unicorns (CU) with #newinterestpost. Add each person who likes it to the Likers list below.
              You need 30% of likes in 48hrs, 50% in 72hrs, and all within 7 days.
            </p>
            {renderProgress(`${likesCount} of ${likesTarget || '?'} likes`, likesCount, likesTarget)}
            {renderPostBlock('interest', 'Copy interest post', buildInterestPost())}
            {renderAction('Likes reached → Move to queue', () => void handleMoveToQueue())}
          </>
        )
      case 'queue':
        return (
          <>
            <p className="text-[15px] leading-relaxed text-gray-800">
              <span className="font-bold">1.</span> Edit your interest post and change the hashtag to #newinqueue. Don’t make a new post.
            </p>
            {renderPostBlock('queue', 'Copy #newinqueue', buildQueuePost())}
            <p className="text-[15px] leading-relaxed text-gray-800">
              <span className="font-bold">2.</span> Create a NEW post in CU with the live post and submit it to CU admins for approval.
            </p>
            {!dip.google_sheet_link && (
              <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-900">
                No Google Sheet yet — the live post will say “[add Google Sheet link]”. Connect Google Sheets above first.
              </p>
            )}
            {renderPostBlock('live', 'Copy live post', buildLivePost())}
            {renderAction('I’ve submitted the live post to CU admins', () => void handleSubmitLive())}
          </>
        )
      case 'live':
        if (!liveApproved) {
          return (
            <>
              <p className="text-[15px] leading-relaxed text-gray-800">
                Waiting for CU admin approval — this can take a week or more. When CU admins approve your live post, tap the button below.
              </p>
              {renderPostBlock('live', 'Copy live post again', buildLivePost())}
              {renderAction('Admins approved — dip is live', () => void handleApproveLive())}
            </>
          )
        }
        return (
          <>
            <p className="text-[15px] leading-relaxed text-gray-800">
              Your dip is live! Players comment “next” + their numbers — add each claim to the spot list below.
              When every spot is filled, the dip moves to collecting payments automatically.
            </p>
            {renderProgress(`${filledSpots} of ${dip.total_spots} spots filled`, filledSpots, dip.total_spots)}
            {avgNeededOnRemaining !== null && remainingSpots > 0 && (
              <p className="text-sm text-gray-600">
                {avgNeededOnRemaining < 0 ? 'Money goal reached! 🎉' : `Average needed on remaining spots: $${avgNeededOnRemaining}`}
              </p>
            )}
            {gameNeedsReveal && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2">
                <p className="text-sm font-semibold text-amber-900">🎮 Every game spot is claimed — time to reveal the prices.</p>
                <button
                  type="button"
                  onClick={() => { setToolsSection('boost'); setToolsOpen(true) }}
                  className="min-h-[44px] w-full rounded-xl bg-amber-500 px-3 text-sm font-bold text-white"
                >
                  Open Tools → Boost → Game
                </button>
              </div>
            )}
            {renderPostBlock('live', 'Copy live post', buildLivePost())}
            {renderAction('All spots filled → Collect payments', () => void handleMoveToPayments())}
          </>
        )
      case 'payments':
        return (
          <>
            <p className="text-[15px] leading-relaxed text-gray-800">
              Your dip is 100% full! Post the payment post in CU and tag each player by hand. Mark players paid below when their screenshot arrives —
              the dip moves to Ready to draw once everyone has paid.
            </p>
            <p className={`text-base font-bold ${unpaidPlayerCount === 0 ? 'text-green-700' : 'text-rose-600'}`}>
              {unpaidPlayerCount === 0 ? 'Everyone has paid ✓' : `${unpaidPlayerCount} ${unpaidPlayerCount === 1 ? 'player' : 'players'} still to pay`}
            </p>
            <p className="text-sm text-gray-600">
              Payment via: {dip.payment_methods || 'PayPal Friends & Family (default)'} ·{' '}
              <button
                type="button"
                onClick={() => { setToolsSection('payment'); setToolsOpen(true) }}
                className="-my-3 min-h-[44px] font-semibold text-pink-700 underline"
              >
                change
              </button>
            </p>
            {gameNeedsReveal && (
              <button
                type="button"
                onClick={() => { setToolsSection('boost'); setToolsOpen(true) }}
                className="min-h-[44px] w-full rounded-xl bg-amber-500 px-3 text-sm font-bold text-white"
              >
                🎮 Reveal game prices (Tools → Boost)
              </button>
            )}
            {renderPostBlock('payment', 'Copy payment post', buildPaymentPost())}
            {renderAction('Everyone has paid → Ready to draw', () => void handleMoveToClosed())}
          </>
        )
      case 'closed':
        return (
          <>
            <p className="text-[15px] leading-relaxed text-gray-800">
              Everyone has paid! Post the closed post and tag CU admins to request your draw. When CU admins have drawn, enter the winning number below.
            </p>
            {renderPostBlock('closed', 'Copy closed post', buildClosedPost())}
            {winnerCard}
          </>
        )
      case 'drawn':
        return (
          <>
            <p className="text-[15px] leading-relaxed text-gray-800">
              {winnerName
                ? `🎉 ${winnerName} won with spot ${dip.winning_number}! Copy the winner post, ship within 3 days, and mark the Facebook post “closed and drawn” (don’t delete it).`
                : 'Record the winning number below so you can post the winner.'}
            </p>
            {winnerName && renderPostBlock('drawn', 'Copy winner post', buildWinnerPost())}
            {dip.archived
              ? <p className="text-sm font-semibold text-green-700">Archived ✓ — it’s in your dip history in Tools.</p>
              : renderAction('Complete & Archive', () => void handleArchiveDip())}
          </>
        )
      default:
        return null
    }
  })()

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 pb-28">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="min-h-[44px] rounded-xl border px-3 text-sm text-gray-600 hover:bg-gray-50"
          >
            ← Dashboard
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{dip.title}</h1>
          </div>
        </div>

        {/* Stage progress bar */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="mb-2 text-sm font-bold text-pink-600">
            Stage {currentStageIndex + 1} of {STAGES.length}: {DIP_STAGE_LABELS[dip.stage] || dip.stage}
          </p>
          <div className="grid grid-cols-6 gap-1">
            {STAGES.map((stage, i) => (
              <div
                key={stage}
                className={`rounded-full h-2 transition-all ${
                  i <= currentStageIndex
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-6 gap-1 text-center text-[11px] leading-tight">
            {STAGES.map((stage) => (
              <span
                key={stage}
                className={dip.stage === stage ? 'font-bold text-pink-600' : 'text-gray-500'}
              >
                {DIP_STAGE_SHORT_LABELS[stage]}
              </span>
            ))}
          </div>
        </div>

        {/* Random.org reminder — CU rule for dips over $2000 */}
        {overRandomOrg && ['live', 'payments', 'closed'].includes(dip.stage) && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
            ⚠️ Over $2000 — the draw must use Random.org (+$4.95) and a Google Sheet is required.
          </div>
        )}

        {/* Google Sheet — created and kept up to date automatically */}
        {/* Shown when there's a sheet, or the owner could get one (active dips only) */}
        {(dip.google_sheet_link || canCreateSheet) && (
          <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-2">
            {isOwner && googleChecked && !googleConnected ? (
              <>
                <h3 className="font-bold text-gray-900">📊 {dip.google_sheet_link ? 'Reconnect Google Sheets' : 'Connect Google Sheets'}</h3>
                <p className="text-sm text-gray-600">
                  {dip.google_sheet_link
                    ? 'Your Google connection has expired. Reconnect so your spot list sheet keeps updating automatically.'
                    : 'WrapApp will create your spot list sheet and keep it updated automatically. The link goes in your live post.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={connectGoogle}
                    disabled={connectingGoogle || !currentUserId}
                    className="min-h-[44px] flex-1 rounded-xl bg-green-500 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {connectingGoogle ? 'Opening Google...' : dip.google_sheet_link ? 'Reconnect Google Sheets' : 'Connect Google Sheets'}
                  </button>
                  {dip.google_sheet_link && (
                    <a
                      href={dip.google_sheet_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-[44px] items-center rounded-xl border border-pink-200 bg-pink-50 px-4 text-sm font-semibold text-pink-700"
                    >
                      Open Sheet ↗
                    </a>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">📊 Google Sheet</p>
                  {isOwner && googleConnected && (
                    <div className="text-xs font-semibold">
                      {sheetSync === 'error' ? (
                        <span className="text-red-600">
                          {dip.google_sheet_link ? 'Couldn’t update sheet' : 'Couldn’t create sheet'} —{' '}
                          <button
                            type="button"
                            onClick={() => void runSheetSync()}
                            className="-my-3 min-h-[44px] px-1 font-bold underline"
                          >
                            Retry
                          </button>
                        </span>
                      ) : sheetSync === 'syncing' || sheetSync === 'dirty' || !dip.google_sheet_link ? (
                        <span className="text-gray-500">{dip.google_sheet_link ? 'Updating…' : 'Creating your sheet…'}</span>
                      ) : sheetSync === 'ok' ? (
                        <span className="text-green-700">Sheet up to date ✓</span>
                      ) : (
                        <span className="text-gray-500">Updates automatically</span>
                      )}
                    </div>
                  )}
                </div>
                {dip.google_sheet_link && (
                  <a
                    href={dip.google_sheet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[44px] shrink-0 items-center rounded-xl border border-pink-200 bg-pink-50 px-4 text-sm font-semibold text-pink-700"
                  >
                    Open Sheet ↗
                  </a>
                )}
              </div>
            )}
            {syncMessage && <p className="text-sm font-semibold text-red-600">{syncMessage}</p>}
          </div>
        )}

        {/* NEXT STEP */}
        <div className="rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-pink-600">👉 Next step</p>
            <h2 className="text-lg font-bold text-gray-900">{nextStepTitle}</h2>
          </div>
          {nextStepBody}
        </div>

        {/* Main content for this stage */}
        {(dip.stage === 'interest' || dip.stage === 'queue') && (
          <>
            {(dip.stage === 'interest' || dip.stage === 'queue') && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">❤️ Likers</h3>
                  <span className={`text-sm font-semibold ${likesReached ? 'text-green-600' : 'text-gray-500'}`}>
                    {likesCount} / {likesTarget || '?'}{likesReached ? ' ✓' : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Add names as people like your post — this is your likes count. Tap a name if they unlike (it stays crossed out and isn’t counted or tagged). ✕ deletes a typo.
                </p>
                {likesTarget > 0 && (
                  <p className="text-xs text-gray-500">
                    Need {likesTarget} — 30% ({Math.round(likesTarget * 0.3)}) by 48hrs, 50% ({Math.round(likesTarget * 0.5)}) by 72hrs.
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    ref={likerInputRef}
                    type="text"
                    value={newLikerName}
                    onChange={(e) => setNewLikerName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { e.preventDefault(); void handleAddLiker() }
                    }}
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCapitalize="words"
                    placeholder="e.g. Sarah Jones"
                    className="min-h-[44px] min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-[16px] outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    // Keep focus in the name box so the phone keyboard stays up
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleAddLiker()}
                    disabled={!newLikerName.trim()}
                    className="min-h-[44px] rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {duplicateLiker && (
                  <p className="text-sm font-semibold text-amber-700">
                    ⚠️ {duplicateLiker.name} is already in the list{duplicateLiker.unliked ? ' (unliked — tap their name to re-like)' : ''}.
                  </p>
                )}
                {likerSuggestions.length > 0 && (
                  <div className="overflow-hidden rounded-xl border bg-white">
                    <p className="bg-gray-50 px-3 py-1.5 text-xs text-gray-500">From your past dips — tap to add</p>
                    {likerSuggestions.map(name => (
                      <button
                        key={name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void handleAddLiker(name)}
                        className="flex min-h-[44px] w-full items-center border-t px-3 text-left text-[15px] font-semibold text-gray-800 hover:bg-pink-50"
                      >
                        + {name}
                      </button>
                    ))}
                  </div>
                )}
                {likerMessage && (
                  <p className="text-sm font-semibold text-red-600">{likerMessage}</p>
                )}
                {likers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {likers.map(l => (
                      <div
                        key={l.id}
                        className={`flex max-w-full items-center rounded-full border ${
                          l.unliked ? 'bg-gray-50 border-gray-200' : 'bg-pink-50 border-pink-200'
                        }`}
                      >
                        {/* Tap name: toggle liked / unliked */}
                        <button
                          type="button"
                          onClick={() => handleToggleLiker(l)}
                          aria-pressed={!!l.unliked}
                          aria-label={l.unliked ? `${l.name} — unliked. Tap to mark liked` : `${l.name} — liked. Tap to mark unliked`}
                          className={`min-h-[44px] min-w-0 pl-3 pr-1 text-left text-sm font-semibold break-words ${
                            l.unliked ? 'text-gray-400 line-through' : 'text-pink-700'
                          }`}
                        >
                          {l.name}
                          {l.unliked && <span className="ml-1 text-[11px] font-normal no-underline">(unliked)</span>}
                        </button>
                        {/* ✕: delete completely (typos) */}
                        <button
                          type="button"
                          onClick={() => handleDeleteLiker(l.id)}
                          aria-label={`Delete ${l.name}`}
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm ${
                            l.unliked ? 'text-gray-400 hover:text-gray-600' : 'text-pink-500 hover:text-pink-700'
                          }`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {(dip.stage === 'live' || dip.stage === 'payments' || dip.stage === 'closed') && (
          <div className="space-y-4">
            {spotsContent}
          </div>
        )}

        {dip.stage === 'drawn' && (
          <div className="space-y-4">
            {winnerCard}
            <button
              type="button"
              onClick={() => setShowDrawnSpots(v => !v)}
              className="min-h-[44px] w-full rounded-xl border bg-white text-sm font-semibold text-gray-700"
            >
              {showDrawnSpots ? 'Hide spot list ▴' : 'Show spot list ▾'}
            </button>
            {showDrawnSpots && (
              <div className="space-y-4">
            {spotsContent}
              </div>
            )}
          </div>
        )}

        {/* Tools */}
        <button
          type="button"
          onClick={() => { setToolsSection(null); setToolsOpen(true) }}
          className="min-h-[52px] w-full rounded-2xl border-2 border-gray-200 bg-white px-4 text-base font-bold text-gray-800 shadow-sm"
        >
          🧰 Tools <span className="text-sm font-normal text-gray-500">— boost, payment methods, details</span>
        </button>

        {currentStageIndex > 0 && (
          <button
            type="button"
            onClick={() => void handleBackStage()}
            className="mx-auto block min-h-[44px] px-3 text-sm font-semibold text-gray-500 underline"
          >
            ← Back a stage
          </button>
        )}
      </div>

      {/* Tools drawer (bottom sheet) */}
      {toolsOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40"
          onClick={() => setToolsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Dip tools"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-gray-50 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">🧰 Tools</h2>
              <button
                type="button"
                onClick={() => setToolsOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-xl text-base font-bold text-gray-500"
                aria-label="Close tools"
              >
                ✕
              </button>
            </div>

            {([
              ['boost', '🚀 Boost — game, bookend, closing'],
              ['payment', '💸 Payment methods'],
              ['details', '📄 Dip details'],
            ] as const).filter(([key]) => key !== 'boost' || showBoost).map(([key, label]) => (
              <div key={key} className="rounded-2xl border bg-white">
                <button
                  type="button"
                  onClick={() => openToolsSection(toolsSection === key ? null : key)}
                  className="flex min-h-[52px] w-full items-center justify-between px-4 text-left text-base font-bold text-gray-900"
                  aria-expanded={toolsSection === key}
                >
                  {label}
                  <span className="text-gray-400">{toolsSection === key ? '▴' : '▾'}</span>
                </button>
                {toolsSection === key && (
                  <div className="space-y-4 border-t p-3">
                    {key === 'boost' && (
                        <>
            {/* Saved game card — always in Live; in any later stage once every game spot is claimed
                (so prices can still be revealed and the reveal post copied) */}
            {savedGame && (dip.stage === 'live' || gameAllClaimed) && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">🎮 Active Game</h3>
                  {!gameRevealed && (
                    <button type="button" onClick={handleResetGame} className="min-h-[44px] px-2 text-xs text-red-500 underline">Reset game</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {gameMap.map((m) => {
                    const claimed = isEmojiClaimed(m.emoji)
                    return (
                      <div key={m.emoji} className={`flex flex-col items-center gap-0.5 rounded-xl border p-2 min-w-[52px] text-center ${claimed ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                        <span className="text-2xl">{m.emoji}</span>
                        <span className="text-[10px] font-semibold text-gray-700">${m.price === 0 ? 'FREE' : m.price}</span>
                        <span className="text-[9px] text-gray-400">{claimed ? '✓ claimed' : 'open'}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                  👆 This is your private view — prices are hidden from players until every game spot is claimed.
                </div>

                {/* Game post — can be posted any time while live */}
                {!gameRevealed && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => copyText(buildGamePost(gameMap), 'game')}
                      className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${copied === 'game' ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'}`}
                    >
                      {copied === 'game' ? '✓ Copied!' : '📋 Copy Game Post'}
                    </button>
                    <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap">
                      {buildGamePost(gameMap)}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => copyText(buildAdminRevealMessage(), 'adminreveal')}
                    className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${copied === 'adminreveal' ? 'bg-green-500 text-white' : 'border-2 border-pink-200 text-pink-700'}`}
                  >
                    {copied === 'adminreveal' ? '✓ Copied!' : '📋 Copy Admin Reveal Message'}
                  </button>
                  <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap">
                    {buildAdminRevealMessage()}
                  </div>
                </div>

                {(() => {
                  if (!gameAllClaimed) return (
                    <p className="text-xs text-gray-500 text-center">
                      {gameClaimedCount}/{gameMap.length} emojis claimed — reveal available when all are claimed
                    </p>
                  )
                  if (gameRevealed) return (
                    <div className="space-y-2">
                      <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
                        ✅ Prices revealed — your Google Sheet updates automatically.
                      </div>
                      <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap">
                        {buildGameRevealPost()}
                      </div>
                      <button
                        type="button"
                        onClick={() => copyText(buildGameRevealPost(), 'gamereveal')}
                        className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${copied === 'gamereveal' ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'}`}
                      >
                        {copied === 'gamereveal' ? '✓ Copied!' : '📋 Copy Reveal Post'}
                      </button>
                    </div>
                  )
                  return (
                    <button
                      type="button"
                      onClick={handleRevealGamePrices}
                      className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white"
                    >
                      🎲 Reveal Prices
                    </button>
                  )
                })()}
              </div>
            )}
            {/* Boost tools — live stage only */}
            {dip.stage === 'live' && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900">🚀 Boost</h3>
                  <p className="text-xs text-gray-500 mt-1">Tools to help fill remaining spots faster.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowGameBuilder(!showGameBuilder); setShowBookend(false); setShowClosing(false) }}
                    className={`rounded-xl border-2 py-3 text-xs font-bold transition ${showGameBuilder ? 'bg-pink-500 text-white border-pink-500' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
                  >
                    🎮 Game
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowBookend(!showBookend); setShowGameBuilder(false); setShowClosing(false) }}
                    className={`rounded-xl border-2 py-3 text-xs font-bold transition ${showBookend ? 'bg-pink-500 text-white border-pink-500' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
                  >
                    🔖 Bookend
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowClosing(!showClosing); setShowGameBuilder(false); setShowBookend(false) }}
                    className={`rounded-xl border-2 py-3 text-xs font-bold transition ${showClosing ? 'bg-pink-500 text-white border-pink-500' : 'border-pink-200 text-pink-600 hover:bg-pink-50'}`}
                  >
                    🏁 Closing
                  </button>
                </div>

                {showBookend && (
                  <div className="space-y-3 pt-2">
                    {dip.bookend_locked ? (
                      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-xs text-green-800">
                        ✅ Bookend saved at ${dip.bookend_price_override} USD — locked.
                      </div>
                    ) : (
                      <div>
                        <label className="mb-1 block text-sm font-semibold text-gray-700">Bookend price (USD)</label>
                        <p className="text-xs text-gray-400 mb-2">Suggested: ${dip.price_bookend || '?'}</p>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">$</span>
                          <input
                            type="number"
                            value={bookendPrice}
                            onChange={(e) => setBookendPrice(e.target.value)}
                            placeholder={String(dip.price_bookend || '')}
                            className="flex-1 rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                          />
                          <span className="text-xs text-gray-400">USD</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveBookend}
                          disabled={!bookendPrice}
                          className="mt-3 w-full rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                        >
                          💾 Save Bookend
                        </button>
                      </div>
                    )}
                    <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap">
                      {buildBookendPost()}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(buildBookendPost(), 'bookend')}
                      className={`w-full rounded-xl py-3 text-sm font-bold transition ${copied === 'bookend' ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'}`}
                    >
                      {copied === 'bookend' ? '✓ Copied!' : '📋 Copy Bookend Post'}
                    </button>
                  </div>
                )}

                {showClosing && (
                  <div className="space-y-3 pt-2">
                    {dip.closing_locked ? (
                      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-xs text-green-800 space-y-1">
                        <p>✅ Closing special saved — locked.</p>
                        <p>Price: ${dip.closing_price} USD{dip.closing_liker_price ? ` | Likers: $${dip.closing_liker_price} USD` : ''}</p>
                        {dip.closing_spots_count && <p>Spots: {dip.closing_spots_count}</p>}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Spots remaining</label>
                            <input
                              type="number"
                              value={closingSpots}
                              onChange={(e) => setClosingSpots(e.target.value)}
                              placeholder={String(dip.total_spots - filledSpots)}
                              className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Price (USD)</label>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">$</span>
                              <input
                                type="number"
                                value={closingPrice}
                                onChange={(e) => setClosingPrice(e.target.value)}
                                placeholder="e.g. 20"
                                className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                          <div className="col-span-2">
                            <label className="mb-1 block text-sm font-semibold text-gray-700">Liker price (USD) <span className="text-gray-400 font-normal">— optional</span></label>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">$</span>
                              <input
                                type="number"
                                value={closingLikerPrice}
                                onChange={(e) => setClosingLikerPrice(e.target.value)}
                                placeholder="Leave blank if same as above"
                                className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                              />
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleSaveClosing}
                          disabled={!closingPrice}
                          className="w-full rounded-xl bg-green-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                        >
                          💾 Save Closing Special
                        </button>
                      </>
                    )}
                    <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap">
                      {buildClosingPost()}
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(buildClosingPost(), 'closing')}
                      className={`w-full rounded-xl py-3 text-sm font-bold transition ${copied === 'closing' ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'}`}
                    >
                      {copied === 'closing' ? '✓ Copied!' : '📋 Copy Closing Post'}
                    </button>
                  </div>
                )}

                {showGameBuilder && (
                  <div className="space-y-4 pt-2">
                    {dip.game_locked ? (
                      <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-xs text-green-800">
                        ✅ Game saved and locked. Copy the game post from the Active Game card above.
                        <button
                          type="button"
                          onClick={handleResetGame}
                          className="block mt-1 min-h-[44px] text-red-500 underline"
                        >
                          Reset game to edit
                        </button>
                      </div>
                    ) : (
                    <>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
                      ⚠️ Per CU rules — send game results to CU admins before posting publicly. No cash/PayPal prizes allowed.
                    </div>

                    {/* Slot count */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-1">Number of game slots</p>
                      <p className="text-xs text-gray-400 mb-2">Suggested: {Math.max(1, Math.round(dip.total_spots / 6.67))} slots</p>
                      <input
                        type="number"
                        value={customGameSlots}
                        onChange={(e) => {
                          setCustomGameSlots(e.target.value)
                          setSelectedEmojis([])
                          setGamePriceOverrides({})
                        }}
                        placeholder={String(Math.max(1, Math.round(dip.total_spots / 6.67)))}
                        className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                      />
                    </div>

                    {/* Game prices */}
                    {(() => {
                      const resolvedSlots = Number(customGameSlots) > 0 ? Number(customGameSlots) : Math.max(1, Math.round(dip.total_spots / 6.67))
                      const suggested = getSuggestedGamePrices(dip.price_per_spot, resolvedSlots)
                      const avgGamePrice = Math.round(
                        suggested.map((g, i) => gamePriceOverrides[i] !== undefined ? Number(gamePriceOverrides[i]) : g.price)
                          .reduce((a, b) => a + b, 0) / Math.max(1, resolvedSlots)
                      )
                      return (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Game prices</p>
                          <p className="text-xs text-gray-400 mb-3">One price per slot — hidden until all claimed. Edit any price.</p>
                          <div className="space-y-2">
                            {suggested.map((g, i) => (
                              <div key={i} className="flex items-center gap-3">
                                <span className="text-xs text-gray-500 w-24 shrink-0">{g.label}</span>
                                <div className="flex items-center gap-1 flex-1">
                                  <span className="text-gray-400 text-sm">$</span>
                                  <input
                                    type="number"
                                    value={gamePriceOverrides[i] !== undefined ? gamePriceOverrides[i] : g.price}
                                    onChange={(e) => setGamePriceOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                                    className="w-full rounded-xl border px-3 py-2 text-[16px] outline-none focus:border-pink-500"
                                  />
                                  <span className="text-xs text-gray-400">USD</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        <div className="mt-3 rounded-xl bg-pink-50 px-3 py-2 text-sm">
                            <span className="text-gray-600">Average game price: </span>
                            <span className="font-bold text-gray-900">${avgGamePrice} USD</span>
                          </div>
                        </div>
                      )
                    })()}

                    {/* Emoji picker */}
                    {(() => {
                      const resolvedSlots = Number(customGameSlots) > 0 ? Number(customGameSlots) : Math.max(1, Math.round(dip.total_spots / 6.67))
                      return (
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Pick emojis</p>
                          <p className="text-xs text-gray-400 mb-3">
                            Select {resolvedSlots} emojis — one per slot ({selectedEmojis.length}/{resolvedSlots} selected)
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {WRAP_EMOJIS.map((emoji) => {
                              const isSelected = selectedEmojis.includes(emoji)
                              const isFull = selectedEmojis.length >= resolvedSlots && !isSelected
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => toggleEmoji(emoji, resolvedSlots)}
                                  disabled={isFull}
                                  className={`h-10 w-10 rounded-xl text-xl transition border ${
                                    isSelected
                                      ? 'bg-pink-100 border-pink-400 scale-110 shadow-sm'
                                      : isFull
                                      ? 'bg-gray-50 border-gray-100 opacity-30'
                                      : 'bg-gray-50 border-gray-200 hover:border-pink-300'
                                  }`}
                                >
                                  {emoji}
                                </button>
                              )
                            })}
                          </div>

                          {/* Preview */}
                          {selectedEmojis.length > 0 && (
                            <div className="mt-4 rounded-xl bg-gray-50 p-3">
                              <p className="text-xs font-semibold text-gray-500 mb-2">Game preview:</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedEmojis.map((emoji, i) => {
                                  const suggested = getSuggestedGamePrices(dip.price_per_spot, selectedEmojis.length)
                                  const price = gamePriceOverrides[i] !== undefined
                                    ? Number(gamePriceOverrides[i])
                                    : suggested[i]?.price ?? 0
                                  return (
                                    <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl bg-white border p-2 min-w-[48px] text-center">
                                      <span className="text-2xl">{emoji}</span>
                                      <span className="text-[10px] font-semibold text-gray-700">${price}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                    {selectedEmojis.length > 0 && (
                      <div className="space-y-3">
                        <button
                          type="button"
                          onClick={handleSaveGame}
                          disabled={savingGame}
                          className="w-full rounded-xl bg-green-500 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          {savingGame ? 'Saving...' : savedGame ? '💾 Update Game' : '💾 Save Game'}
                        </button>
                        {gameMessage && (
                          <p className="text-xs font-semibold text-green-600">{gameMessage}</p>
                        )}
                        <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap">
                          {buildGamePost(getBuilderGameEntries())}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(buildGamePost(getBuilderGameEntries()), 'game')}
                          className={`w-full rounded-xl py-3 text-sm font-bold transition ${
                            copied === 'game' ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                          }`}
                        >
                          {copied === 'game' ? '✓ Copied!' : '📋 Copy Game Post'}
                        </button>
                      </div>
                    )}
                  </>
                    )}
                  </div>
                )}
              </div>
            )}
                        </>
                    )}
                    {key === 'payment' && (
                      <>
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Payment Methods</h2>
              <p className="text-xs text-gray-500">List how you accept payment — this will appear in your payments post.</p>
              <textarea
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder="e.g. PayPal Friends & Family, Wise"
                rows={3}
                className="w-full rounded-xl border px-3 py-2.5 text-[16px] outline-none focus:border-pink-500 resize-none"
              />
              <button
                type="button"
                onClick={handleSavePaymentMethods}
                disabled={savingSettings}
                className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Payment Methods'}
              </button>
            </div>
                      </>
                    )}
                    {key === 'details' && (
                      <>
            {/* Editable dip details */}
            {detailsForm && (
              <div className="space-y-3">
                {([
                  ['wrap_name', 'Wrap name *', 'text'],
                  ['brand', 'Brand', 'text'],
                  ['wrap_size', 'Size / STIH', 'text'],
                  ['wrap_blend', 'Blend', 'text'],
                ] as const).map(([field, label, type]) => (
                  <div key={field}>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
                    <input
                      type={type}
                      value={String(detailsForm[field] ?? '')}
                      onChange={(e) => setDetailsForm(f => (f ? { ...f, [field]: e.target.value } : f))}
                      className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Condition</label>
                  <select
                    value={String(detailsForm.wrap_condition || 'EUC')}
                    onChange={(e) => setDetailsForm(f => (f ? { ...f, wrap_condition: e.target.value } : f))}
                    className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                  >
                    <option value="EUC">EUC — excellent</option>
                    <option value="VVGUC">VVGUC — very very good</option>
                    <option value="VGUC">VGUC — very good</option>
                    <option value="GUC">GUC — good</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Shipping credit (USD)</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={String(detailsForm.shipping_credit ?? '')}
                      onChange={(e) => setDetailsForm(f => (f ? { ...f, shipping_credit: e.target.value } : f))}
                      className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Shipping from</label>
                    <input
                      value={String(detailsForm.shipping_from ?? '')}
                      onChange={(e) => setDetailsForm(f => (f ? { ...f, shipping_from: e.target.value } : f))}
                      className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Feedback Hub link</label>
                  <input
                    value={String(detailsForm.feedback_hub_link ?? '')}
                    onChange={(e) => setDetailsForm(f => (f ? { ...f, feedback_hub_link: e.target.value } : f))}
                    placeholder="https://..."
                    className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                  />
                </div>
                <div className="flex flex-wrap gap-x-6">
                  <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
                    <input type="checkbox" className="h-5 w-5" checked={!!detailsForm.smoke_free} onChange={(e) => setDetailsForm(f => (f ? { ...f, smoke_free: e.target.checked } : f))} />
                    Smoke free
                  </label>
                  <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
                    <input type="checkbox" className="h-5 w-5" checked={!!detailsForm.pet_free} onChange={(e) => setDetailsForm(f => (f ? { ...f, pet_free: e.target.checked } : f))} />
                    Pet free
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Number of spots</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={String(detailsForm.total_spots ?? '')}
                      onChange={(e) => setDetailsForm(f => (f ? { ...f, total_spots: e.target.value } : f))}
                      className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Likes target</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={String(detailsForm.likes_required ?? '')}
                      onChange={(e) => setDetailsForm(f => (f ? { ...f, likes_required: e.target.value } : f))}
                      className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
                    />
                  </div>
                </div>
                {highestTakenSpot > 0 && (
                  <p className="text-xs text-gray-500">
                    Number of spots can’t go below {highestTakenSpot} — spot {highestTakenSpot} is already taken.
                  </p>
                )}

                <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                  <p className="text-sm font-semibold text-gray-700">Prices (USD)</p>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      ['price_per_spot', 'Main ticket'],
                      ['bookend', 'Bookend (each)'],
                      ['price_ls1', 'LS 1'],
                      ['price_ls2', 'LS 2'],
                      ['price_ls3', 'LS 3'],
                      ['price_ls4', 'LS 4'],
                      ['price_ls5', 'LS 5'],
                    ] as const).map(([field, label]) => (
                      <div key={field}>
                        <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={String(detailsForm[field] ?? '')}
                          onChange={(e) => setDetailsForm(f => (f ? { ...f, [field]: e.target.value } : f))}
                          className="min-h-[44px] w-full rounded-xl border bg-white px-3 text-[16px] outline-none focus:border-pink-500"
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-600">
                    Price changes only apply to spots added from now on. Spots already in the list keep their amount owed (tap a spot to change it).
                  </p>
                </div>

                {detailsError && <p className="text-sm font-semibold text-red-600">{detailsError}</p>}

                <button
                  type="button"
                  onClick={() => void handleSaveDetails()}
                  disabled={savingDetails}
                  className="min-h-[52px] w-full rounded-xl bg-gray-900 text-base font-bold text-white disabled:opacity-50"
                >
                  {savingDetails ? 'Saving…' : 'Save dip details'}
                </button>
              </div>
            )}

                      </>
                    )}
                  </div>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() => void handleDeleteDip()}
              className="min-h-[52px] w-full rounded-2xl border-2 border-red-200 bg-white px-4 text-base font-bold text-red-600"
            >
              🗑 Delete dip
            </button>
          </div>
        </div>
      )}

      {/* Edit a spot */}
      {editSpot && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/40" onClick={() => setEditSpot(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit spot ${editSpot.spot_number}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit spot #{editSpot.spot_number}</h3>
              <button type="button" onClick={() => setEditSpot(null)} className="min-h-[44px] min-w-[44px] text-base font-bold text-gray-500" aria-label="Close">✕</button>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Player name</label>
              <input
                value={editSpotForm.player}
                onChange={(e) => setEditSpotForm(f => ({ ...f, player: e.target.value }))}
                autoComplete="off"
                autoCapitalize="words"
                className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
              />
              {editSpotSuggestions.length > 0 && (
                <div className="mt-1 overflow-hidden rounded-xl border">
                  {editSpotSuggestions.map((name, i) => (
                    <button
                      key={name}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setEditSpotForm(f => ({ ...f, player: name }))}
                      className={`flex min-h-[44px] w-full items-center px-3 text-left text-[15px] font-semibold text-gray-800 hover:bg-pink-50 ${i > 0 ? 'border-t' : ''}`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Spot type</label>
              <select
                value={editSpotForm.type}
                onChange={(e) => changeEditSpotType(e.target.value)}
                className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
              >
                {!['main', 'ls1', 'ls2', 'ls3', 'ls4', 'ls5', 'bookend', 'closing', 'closing-liker', 'custom'].includes(editSpotForm.type) && (
                  <option value={editSpotForm.type}>{getSpotTypeLabel(editSpotForm.type)}</option>
                )}
                <option value="main">Main — ${dip.price_per_spot}</option>
                <option value="ls1">LS 1 — ${dip.price_ls1 ?? '?'}</option>
                <option value="ls2">LS 2 — ${dip.price_ls2 ?? '?'}</option>
                <option value="ls3">LS 3 — ${dip.price_ls3 ?? '?'}</option>
                <option value="ls4">LS 4 — ${dip.price_ls4 ?? '?'}</option>
                <option value="ls5">LS 5 — ${dip.price_ls5 ?? '?'}</option>
                <option value="bookend">Bookend — ${dip.bookend_price_override ?? dip.price_bookend ?? '?'}</option>
                <option value="closing">🏁 Closing{closingPrice ? ` — $${closingPrice}` : ''}</option>
                {closingLikerPrice ? <option value="closing-liker">⭐ Closing Liker — ${closingLikerPrice}</option> : null}
                <option value="custom">✏️ Custom</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Amount owed (USD)</label>
              <input
                type="number"
                inputMode="decimal"
                value={editSpotForm.amount}
                onChange={(e) => setEditSpotForm(f => ({ ...f, amount: e.target.value }))}
                placeholder={isGameSpotType(editSpotForm.type) ? 'Hidden until revealed' : '0'}
                className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
              />
              <p className="mt-1 text-xs text-gray-500">Changing the type fills in that type’s current price — you can change it.</p>
            </div>

            {editError && <p className="text-sm font-semibold text-red-600">{editError}</p>}

            <button
              type="button"
              onClick={() => void handleSaveSpotEdit()}
              disabled={savingEdit}
              className="min-h-[52px] w-full rounded-xl bg-gray-900 text-base font-bold text-white disabled:opacity-50"
            >
              {savingEdit ? 'Saving…' : 'Save spot'}
            </button>
            <button
              type="button"
              onClick={() => void handleDeleteSpotFromEditor()}
              className="min-h-[52px] w-full rounded-xl border-2 border-red-200 text-base font-bold text-red-600"
            >
              Delete spot
            </button>
          </div>
        </div>
      )}

      {/* Edit a player (rename all their spots, or pick one spot to edit) */}
      {editPlayer && (
        <div className="fixed inset-0 z-[65] flex items-end justify-center bg-black/40" onClick={() => setEditPlayer(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit ${editPlayer}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Edit player</h3>
              <button type="button" onClick={() => setEditPlayer(null)} className="min-h-[44px] min-w-[44px] text-base font-bold text-gray-500" aria-label="Close">✕</button>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Player name (all their spots)</label>
              <input
                value={editPlayerName}
                onChange={(e) => setEditPlayerName(e.target.value)}
                autoComplete="off"
                autoCapitalize="words"
                className="min-h-[44px] w-full rounded-xl border px-3 text-[16px] outline-none focus:border-pink-500"
              />
            </div>
            {editError && <p className="text-sm font-semibold text-red-600">{editError}</p>}
            <button
              type="button"
              onClick={() => void handleRenamePlayer()}
              disabled={savingEdit}
              className="min-h-[52px] w-full rounded-xl bg-gray-900 text-base font-bold text-white disabled:opacity-50"
            >
              {savingEdit ? 'Saving…' : 'Save name'}
            </button>
            <div className="space-y-2 pt-1">
              <p className="text-sm font-semibold text-gray-700">Their spots — tap one to edit</p>
              {spots.filter(s => s.player_name === editPlayer).map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => openSpotEditor(s)}
                  className="flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3 text-left text-[15px]"
                >
                  <span className="font-semibold text-gray-900">Spot {s.spot_number} · {getSpotTypeLabel(s.spot_type)}</span>
                  <span className="text-gray-700">
                    {isGameSpotType(s.spot_type) && !s.game_revealed ? '🎮 TBD' : s.amount_owed != null ? `$${s.amount_owed}` : '—'} ✎
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* In-app confirm sheet (replaces browser confirm/alert) */}
      {confirmState && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40"
          onClick={() => resolveConfirm(false)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label={confirmState.title}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-3"
          >
            <h3 className="text-lg font-bold text-gray-900">{confirmState.title}</h3>
            {confirmState.message && <p className="text-[15px] text-gray-600">{confirmState.message}</p>}
            <button
              type="button"
              onClick={() => resolveConfirm(true)}
              className={`min-h-[52px] w-full rounded-xl text-base font-bold text-white ${confirmState.danger ? 'bg-red-600' : 'bg-gray-900'}`}
            >
              {confirmState.confirmLabel || 'Yes'}
            </button>
            <button
              type="button"
              onClick={() => resolveConfirm(false)}
              className="min-h-[52px] w-full rounded-xl border text-base font-semibold text-gray-700"
            >
              {confirmState.cancelLabel || 'Cancel'}
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 top-4 z-[80] mx-auto max-w-md rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${
            toast.tone === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
          onClick={() => setToast(null)}
        >
          {toast.text}
        </div>
      )}

      {/* Copy failed — tell the user how to copy by hand */}
      {copyError && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-24 z-[80] mx-auto max-w-md rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-lg"
          onClick={() => setCopyError('')}
        >
          {copyError}
        </div>
      )}
    </AppLayout>
  )
}
