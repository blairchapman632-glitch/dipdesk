'use client'

import { supabase } from '@/lib/supabase'
import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/app/components/AppLayout'

type Dip = {
  id: string
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

const STAGES = ['interest', 'queue', 'live', 'payments', 'closed', 'drawn']

const STAGE_LABELS: Record<string, string> = {
  interest: '1. Interest',
  queue: '2. Queue',
  live: '3. Live',
  payments: '4. Payments',
  closed: '5. Closed',
  drawn: '6. Drawn',
}

export default function DipDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [dip, setDip] = useState<Dip | null>(null)
  const [spots, setSpots] = useState<Spot[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'guide' | 'spots' | 'settings'>('guide')

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
  const [googleSheetLink, setGoogleSheetLink] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [likesInput, setLikesInput] = useState('')
  const [winningNumber, setWinningNumber] = useState('')
  const [paymentMethods, setPaymentMethods] = useState('')

  // Copy state
  const [copied, setCopied] = useState<string | null>(null)

  // Game builder
  const WRAP_EMOJIS = [
    '💕','🌸','🍀','🩵','🌈','🎀','🍎','🌻','🩷','🦋',
    '🌺','🍓','🌙','⭐','🌊','🦄','🌷','🍉','🧁','💜',
    '🩶','🤍','🌿','🫐','🍋','🌼','🦢','🐚','🎠','🪷','🌅',
  ]
  const [showGameBuilder, setShowGameBuilder] = useState(false)
  const [showBookend, setShowBookend] = useState(false)
  const [showClosing, setShowClosing] = useState(false)
  const [bookendPrice, setBookendPrice] = useState('')
  const [closingPrice, setClosingPrice] = useState('')
  const [closingSpots, setClosingSpots] = useState('')
  const [gameSlots, setGameSlots] = useState(0)
  const [customGameSlots, setCustomGameSlots] = useState('')
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([])
  const [gamePriceOverrides, setGamePriceOverrides] = useState<Record<number, string>>({})
  const [savedGame, setSavedGame] = useState<{id: string, emoji_map: {emoji: string, price: number}[]} | null>(null)
  const [likers, setLikers] = useState<{id: string, name: string}[]>([])
  const [newLikerName, setNewLikerName] = useState('')
  const [addingLiker, setAddingLiker] = useState(false)
  const [savingGame, setSavingGame] = useState(false)
  const [gameMessage, setGameMessage] = useState('')
  const [closingLikerPrice, setClosingLikerPrice] = useState('')

  // Google Sheets
  const [googleConnected, setGoogleConnected] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('google_access_token, google_refresh_token, google_token_expiry')
        .eq('id', user.id)
        .single()
      const p = data as any
      if (p?.google_access_token && p?.google_token_expiry && Date.now() < p.google_token_expiry - 60000) {
        setGoogleConnected(true)
      } else if (p?.google_access_token && p?.google_refresh_token) {
        setGoogleConnected(true)
      }
    })
  }, [])

  async function syncToSheets() {
    if (!currentUserId) return
    setSyncing(true)
    setSyncMessage('')
    const res = await fetch('/api/sheets/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dipId: id, userId: currentUserId }),
    })
    const data = await res.json()
    if (data.error === 'not_connected') {
      setGoogleConnected(false)
      setSyncMessage('Connect Google Sheets first')
    } else if (data.success) {
      setSyncMessage('Sheet updated ✓')
      await loadDip()
    } else {
      setSyncMessage('Sync failed — try again')
    }
    setSyncing(false)
    setTimeout(() => setSyncMessage(''), 3000)
  }
  async function loadDip() {
    const { data: dipData } = await supabase
      .from('dips')
      .select('*')
      .eq('id', id)
      .single()

    if (!dipData) { setLoading(false); return }
    setDip(dipData)
    setGoogleSheetLink(dipData.google_sheet_link || '')
    setLikesInput(String(dipData.current_likes || 0))
    setWinningNumber(dipData.winning_number ? String(dipData.winning_number) : '')
    setPaymentMethods(dipData.payment_methods || '')
    setBookendPrice(dipData.bookend_price_override ? String(dipData.bookend_price_override) : '')
    setClosingPrice(dipData.closing_price ? String(dipData.closing_price) : '')
    setClosingLikerPrice(dipData.closing_liker_price ? String(dipData.closing_liker_price) : '')
    setClosingSpots(dipData.closing_spots_count ? String(dipData.closing_spots_count) : '')

    const { data: spotData } = await supabase
      .from('spots')
      .select('*')
      .eq('dip_id', id)
      .order('spot_number', { ascending: true })

    setSpots(spotData || [])
const { data: likerData } = await supabase
      .from('dip_likers')
      .select('*')
      .eq('dip_id', id)
      .order('created_at', { ascending: true })
    setLikers(likerData || [])
    const { data: gameData } = await supabase
      .from('dip_games')
      .select('*')
      .eq('dip_id', id)
      .maybeSingle()

    
    if (gameData) {
      setSavedGame(gameData)
      const map = gameData.emoji_map as {emoji: string, price: number}[]
      setSelectedEmojis(map.map((m: {emoji: string, price: number}) => m.emoji))
      const overrides: Record<number, string> = {}
      map.forEach((m: {emoji: string, price: number}, i: number) => { overrides[i] = String(m.price) })
      setGamePriceOverrides(overrides)
      setCustomGameSlots(String(map.length))
    }

    setLoading(false)
  }

  useEffect(() => { loadDip() }, [id])

  // Derived stats
  const filledSpots = spots.filter(s => s.player_name).length
  const paidSpots = spots.filter(s => s.paid).length
  const unpaidSpots = spots.filter(s => s.player_name && !s.paid)
  const filledPercent = dip ? Math.round((filledSpots / dip.total_spots) * 100) : 0
  const likesPercent = dip?.likes_required ? Math.min(100, Math.round(((dip.current_likes || 0) / dip.likes_required) * 100)) : 0
  const totalOwed = spots.reduce((sum, s) => sum + (s.amount_owed || 0), 0)
  const totalPaid = spots.filter(s => s.paid).reduce((sum, s) => sum + (s.amount_owed || 0), 0)
  const remainingSpots = dip ? dip.total_spots - filledSpots : 0
  const avgPricePerSold = filledSpots > 0 ? Math.round(totalOwed / filledSpots) : 0
  const targetAmount = dip?.wrap_value ? Math.round(dip.wrap_value * 1.20 + (dip.shipping_credit || 0)) : null
  const avgNeededOnRemaining = targetAmount && remainingSpots > 0 ? Math.round((targetAmount - totalOwed) / remainingSpots) : null
  const usedSpotNumbers = spots.map(s => s.spot_number)

  function getPriceForType(type: string): number {
    if (!dip) return 0
    switch (type) {
      case 'main': return dip.price_per_spot
      case 'ls1': return dip.price_ls1 || dip.price_per_spot
      case 'ls2': return dip.price_ls2 || dip.price_per_spot
      case 'ls3': return dip.price_ls3 || dip.price_per_spot
      case 'ls4': return dip.price_ls4 || dip.price_per_spot
      case 'ls5': return dip.price_ls5 || dip.price_per_spot
      case 'bookend': return dip.price_bookend || dip.price_per_spot
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
    await loadDip()
  }

  async function handleTogglePaid(spot: Spot) {
    const newPaid = !spot.paid
    if (spot.player_name) {
      await supabase.from('spots')
        .update({ paid: newPaid })
        .eq('dip_id', id)
        .eq('player_name', spot.player_name)
    } else {
      await supabase.from('spots').update({ paid: newPaid }).eq('id', spot.id)
    }
    await loadDip()
    if (googleConnected && currentUserId) {
      syncToSheets()
    }
  }

  async function handleDeleteSpot(spotId: string) {
    await supabase.from('spots').delete().eq('id', spotId)
    await loadDip()
  }

  async function handleAdvanceStage() {
    if (!dip) return
    const currentIndex = STAGES.indexOf(dip.stage)
    if (currentIndex === -1 || currentIndex >= STAGES.length - 1) return
    const nextStage = STAGES[currentIndex + 1]
    const { error } = await supabase.from('dips').update({ stage: nextStage, status: nextStage }).eq('id', id)
    if (error) {
      alert('Error: ' + error.message)
      return
    }
    await loadDip()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSaveLikes() {
    const n = Number(likesInput)
    if (isNaN(n) || n < 0) return
    await supabase.from('dips').update({ current_likes: n }).eq('id', id)
    await loadDip()
  }

  async function handleSaveGoogleSheet() {
    setSavingSettings(true)
    await supabase.from('dips').update({ google_sheet_link: googleSheetLink || null }).eq('id', id)
    await loadDip()
    setSavingSettings(false)
  }

  async function handleSavePaymentMethods() {
    setSavingSettings(true)
    await supabase.from('dips').update({ payment_methods: paymentMethods || null }).eq('id', id)
    await loadDip()
    setSavingSettings(false)
  }

  async function handleSaveResult() {
    if (!dip) return
    const num = Number(winningNumber)
    if (isNaN(num) || num < 1 || num > dip.total_spots) return
    const winningSpot = spots.find(s => s.spot_number === num)
    await supabase.from('dips').update({
      winning_number: num,
      winner_name: winningSpot?.player_name || null,
      drawn_at: new Date().toISOString(),
      stage: 'drawn',
      status: 'drawn',
    }).eq('id', id)
    await loadDip()
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
  async function handleAddLiker() {
    if (!newLikerName.trim()) return
    setAddingLiker(true)
    await supabase.from('dip_likers').insert({ dip_id: id, name: newLikerName.trim() })
    setNewLikerName('')
    setAddingLiker(false)
    await loadDip()
  }

  async function handleDeleteLiker(likerId: string) {
    await supabase.from('dip_likers').delete().eq('id', likerId)
    await loadDip()
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
    if (!confirm('Reset game? This cannot be undone.')) return
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
    if (!confirm('Reveal game prices? This will update all game spot amounts. Make sure you have sent results to CU Admins first.')) return
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
      const firstName = s.player_name?.split(' ')[0] || s.player_name
      return `@${firstName} — ${emoji} ${price}`
    })
    return `🎮 GAME REVEAL! 🎮

${dip.brand || ''} ${dip.wrap_name || ''}

Here are your game prices:
${lines.join('\n')}

Please pay as per payment instructions! 💕`
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
Each claim must be a NEW comment (not a reply!)`
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
Each claim must be a NEW comment (not a reply!)`
  }
  function buildGamePost() {
    if (!dip || selectedEmojis.length === 0) return ''
    const suggested = getSuggestedGamePrices(dip.price_per_spot, selectedEmojis.length)
    const resolvedSlots = Number(customGameSlots) > 0 ? Number(customGameSlots) : gameSlots
    const avgPrice = Math.round(
      selectedEmojis.map((_, i) => {
        const override = gamePriceOverrides[i]
        return override !== undefined ? Number(override) : (suggested[i]?.price ?? dip.price_per_spot)
      }).reduce((a, b) => a + b, 0) / Math.max(1, selectedEmojis.length)
    )
    const suggestedPrizes = getSuggestedGamePrices(dip.price_per_spot, selectedEmojis.length)
    const prices = selectedEmojis.map((_, i) => {
      const price = gamePriceOverrides[i] !== undefined ? Number(gamePriceOverrides[i]) : (suggestedPrizes[i]?.price ?? dip.price_per_spot)
      return price
    })
    const prizeList = prices.map(p => p === 0 ? '🎉 FREE' : `$${p} USD`).join(' | ')
    // Shuffle emojis so order doesn't reveal which emoji = which price
    const shuffledEmojis = [...selectedEmojis].sort(() => Math.random() - 0.5)

    return `🎮 GAME TIME! 🎮

${dip.brand || ''} ${dip.wrap_name || ''}

Pick an emoji for a game spot — price is hidden until all ${selectedEmojis.length} are claimed!

${shuffledEmojis.join('  ')}

Prizes hidden behind the emojis:
${prizeList}

Comment "next" + your emoji to claim!
Each claim must be a NEW comment (not a reply!)

⚠️ Results sent to CU Admins before reveal.`
  }
async function handleArchiveDip() {
    if (!dip) return
    if (!confirm('Archive this dip? It will move to your dip history in Tools.')) return
    await supabase.from('dips').update({ 
      archived: true,
      total_raised: totalOwed,
    }).eq('id', id)
    router.push('/tools')
  }
  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
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

Feedback Hub: ${dip.feedback_hub_link || '[add Feedback Hub link]'}`
  }

  function buildQueuePost() {
    if (!dip) return ''
    const household = `${dip.smoke_free ? 'Smoke free' : 'Not smoke free'} / ${dip.pet_free ? 'Pet free' : 'Not pet free'}`
    const ls = [
      `- 1 spot = $${dip.price_ls1 || '?'}`,
      `- 2 spots = $${dip.price_ls2 || '?'}`,
      `- 3 spots = $${dip.price_ls3 || '?'}`,
      `- 4 spots = $${dip.price_ls4 || '?'}`,
      `- 5 spots = $${dip.price_ls5 || '?'}`,
    ].join('\n')
    return `#newinqueue

${dip.brand || ''} ${dip.wrap_name || ''}
Size: ${dip.wrap_size || '[add size]'}
Blend: ${dip.wrap_blend || '[add blend]'}
Condition: ${dip.wrap_condition || '[add condition]'}

${dip.total_spots} spots @ $${dip.price_per_spot} USD each
Likes: ${dip.current_likes || 0}/${dip.likes_required || '?'} ❤️

We're in the queue and going live soon! 🦄

Liker Specials (first 24hrs when live):
${ls}

👀 Likers — keep an eye out for the live post! You'll have 24hrs to claim your spots at the liker special price.

$${dip.shipping_credit || '?'} USD shipping credit included
Shipping from ${dip.shipping_from || '[location]'}
${household}

Feedback Hub: ${dip.feedback_hub_link || '[add Feedback Hub link]'}`
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
    const likerTags = likers.length > 0 ? likers.map(l => `@${l.name.split(' ')[0]}`).join('\n') : ''
    return `#newlivepost

🎉 WE ARE LIVE! 🎉${filledPct > 0 ? `\n${filledPct}% FILLED` : ''}

${dip.brand || ''} ${dip.wrap_name || ''}
Size: ${dip.wrap_size || '[add size]'}
Blend: ${dip.wrap_blend || '[add blend]'}
Condition: ${dip.wrap_condition || '[add condition]'}

${dip.total_spots} spots @ $${dip.price_per_spot} USD each${over2k ? ' + $4.95 draw fee' : ''}
Likes: ${dip.current_likes || 0}/${dip.likes_required || '?'} ❤️

Liker Specials (first 24hrs only!):
${ls}

Comment "next" followed by your number/s or "random" 🎲
Each claim must be a NEW comment (not a reply!)
You may pay once the dip is 80% full.

Spot list: ${dip.google_sheet_link || '[add Google Sheet link]'}

$${dip.shipping_credit || '?'} USD shipping credit included
Shipping from ${dip.shipping_from || '[location]'}
${household}

Feedback Hub: ${dip.feedback_hub_link || '[add Feedback Hub link]'}${likerTags ? `\n\n❤️ Likers — you have 24hrs to claim your liker special! Comment below with your number/s.\n${likerTags}` : ''}`
  }

  function buildPaymentPost() {
    if (!dip) return ''
    const unpaidNames = [...new Set(unpaidSpots.map(s => s.player_name).filter(Boolean))]
    const tagList = unpaidNames.map(n => `@${n!.split(' ')[0]}`).join('\n')
    return `#fullandcollectingpayments

💸 Payments are now open! 💸

${dip.brand || ''} ${dip.wrap_name || ''} is 80%+ full — time to pay for your spots!

Payment via: ${dip.payment_methods || 'PayPal Friends & Family (no comments, gifted only)'}
Post a screenshot of your payment in the comments 📸

${tagList ? `Tagging those who need to pay:\n${tagList}` : ''}

Thank you everyone — so close! 🦄`
  }
function buildWinnerPost() {
    if (!dip) return ''
    return `🎉 AND THE WINNER IS... 🎉

${dip.brand || ''} ${dip.wrap_name || ''}

🎲 Spot #${dip.winning_number} — Congratulations @${dip.winner_name?.split(' ')[0] || dip.winner_name}! 🎲

Thank you so much to everyone who played — you are all amazing! 🦄

${dip.brand || ''} ${dip.wrap_name || ''} will be shipped within 3 days. 💕`
  }
  function buildClosedPost() {
    if (!dip) return ''
    const unpaidNames = [...new Set(
      unpaidSpots
        .filter(s => (s.amount_owed || 0) > 0)
        .map(s => s.player_name)
        .filter(Boolean)
    )]
    const tagList = unpaidNames.map(n => `@${n!.split(' ')[0]}`).join('\n')
    return `🎉 FULL AND CLOSED! 🎉

${dip.brand || ''} ${dip.wrap_name || ''} is SOLD OUT! 🦄

If you still owe payment, please pay ASAP — unpaid spots will be reallocated after 24 hours.

${tagList ? `Still needs to pay:\n${tagList}` : 'All paid — ready for draw! 🎲'}

Thank you all so much! Drawing soon! 🎲`
  }

  const stageGuide: Record<string, {
    title: string
    instruction: string
    tip: string
    postKey: string
    postLabel: string
    postText: () => string
    checklist: string[]
  }> = {
    interest: {
      title: '📣 Interest Post',
      instruction: 'Post your interest post on Facebook to gauge interest and collect likes. You need 30% of likes within 48hrs, 50% within 72hrs, and 100% within 7 days.',
      tip: 'Tag potential likers — people who have played in dips for this wrap before, or reacted to your sale post. 📸 Before going live, take a screenshot of your post likes — this is how you verify who qualifies for liker specials.',
      postKey: 'interest',
      postLabel: 'Copy Interest Post',
      postText: buildInterestPost,
      checklist: [
        'Post interest post on Facebook with #newinterestpost',
        'Track likes daily — 30% needed in 48hrs',
        'Update likes count below as they come in',
        'Once all likes reached, tag CU Admins to go live',
      ],
    },
    queue: {
      title: '⏳ In Queue',
      instruction: 'Tag Chasing Unicorn Admins on your interest post requesting to go live. Once approved, create a NEW post (not an edit) with the queue post below to let players know the dip is coming.',
      tip: 'It normally takes 4-7 days to go live. Don\'t message admins unless it\'s been 2+ weeks.',
      postKey: 'queue',
      postLabel: 'Copy Queue Post',
      postText: buildQueuePost,
      checklist: [
        'Tag CU Admins page on your interest post',
        'Post in-queue post with #newinqueue',
        'Wait for admin approval',
        'Add Google Sheet link in Settings before going live',
      ],
    },
    live: {
      title: '🎉 Live!',
      instruction: 'Your dip is live! Post the live post on Facebook. Players comment "next" + their numbers to claim spots. Add them to your spot list below as they come in.',
      tip: 'Likers should claim within the first 24hrs as a courtesy. If likers don\'t play, send their names to CU Admins.',
      postKey: 'live',
      postLabel: 'Copy Live Post',
      postText: buildLivePost,
      checklist: [
        'Post live post on Facebook with #newlivepost',
        'Add Google Sheet link to Settings',
        'Add players to spot list below as they claim',
        'Move to Payments when 80% full',
      ],
    },
    payments: {
      title: '💸 Collecting Payments',
      instruction: 'Your dip is 80%+ full. Post the payment post and tag all players who need to pay. They have 24 hours to pay or their spot gets reallocated.',
      tip: 'Tag all unpaid players when you post. They have 24 hours to pay or their spot gets reallocated.',
      postKey: 'payment',
      postLabel: 'Copy Payment Post',
      postText: buildPaymentPost,
      checklist: [
        'Post payment post with #fullandcollectingpayments',
        'Tag all unpaid players in the post',
        'Mark players as paid below when screenshots received',
        'Reallocate unpaid spots after 24hrs',
        'Move to Closed when all spots filled and paid',
      ],
    },
    closed: {
      title: '🔒 Closed',
      instruction: 'All spots are filled! Post the closed post and tag CU Admins to request your draw. Verify all payments before requesting.',
      tip: 'Tag the CU Admins page to request draw — don\'t PM individual admins. Don\'t ask if it\'s been less than 24hrs.',
      postKey: 'closed',
      postLabel: 'Copy Closed Post',
      postText: buildClosedPost,
      checklist: [
        'Post closed post',
        'Verify ALL payments received',
        'Tag CU Admins page to request draw',
        'Record winning number below once drawn',
      ],
    },
    drawn: {
      title: '🎲 Drawn!',
      instruction: 'Congratulations! Record the winning number below. Ship the wrap within 3 days of the draw.',
      tip: 'Mark the Facebook post as "closed and drawn" — do NOT delete the post.',
      postKey: 'drawn',
      postLabel: dip?.winning_number ? 'Copy Winner Announcement' : '',
      postText: buildWinnerPost,
      checklist: [
        'Record winning number below',
        'Notify the winner',
        'Ship within 3 days',
        'Mark Facebook post as "closed and drawn"',
        'Do NOT delete the Facebook post',
        'Archive dip below once complete',
      ],
    },
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

  const guide = stageGuide[dip.stage] || stageGuide['interest']
  const currentStageIndex = STAGES.indexOf(dip.stage)
  const isLastStage = currentStageIndex >= STAGES.length - 1

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-4 pb-24">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="rounded-xl border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            ← Dashboard
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-gray-900 truncate">{dip.title}</h1>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!confirm('Delete this dip? This cannot be undone.')) return
              await supabase.from('spots').delete().eq('dip_id', id)
              await supabase.from('dips').delete().eq('id', id)
              router.push('/dashboard')
            }}
            className="rounded-xl border border-red-200 px-3 py-2 text-xs font-semibold text-red-500"
          >
            Delete
          </button>
        </div>

        {/* Stage progress bar */}
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex gap-1">
            {STAGES.map((stage, i) => (
              <div
                key={stage}
                className={`flex-1 rounded-full h-2 transition-all ${
                  i <= currentStageIndex
                    ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-gray-400">
            {STAGES.map((stage) => (
              <span key={stage} className={dip.stage === stage ? 'text-pink-500 font-bold' : ''}>
                {STAGE_LABELS[stage].split('. ')[1]}
              </span>
            ))}
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className={`rounded-2xl border p-3 shadow-sm text-center ${filledPercent >= 80 ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
            <p className="text-lg font-bold text-gray-900">{filledSpots}/{dip.total_spots}</p>
            <p className="text-xs text-gray-500">spots filled</p>
            <p className={`text-xs font-bold mt-0.5 ${filledPercent >= 80 ? 'text-green-600' : 'text-gray-400'}`}>
              {filledPercent}%{filledPercent >= 80 ? ' 🎉 Ready for payments!' : ''}
            </p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className={`h-full ${filledPercent >= 80 ? 'bg-green-500' : 'bg-gradient-to-r from-pink-500 to-rose-500'}`} style={{ width: `${filledPercent}%` }} />
            </div>
          </div>
          <div className="rounded-2xl border bg-white p-3 shadow-sm text-center">
            <p className="text-lg font-bold text-gray-900">{dip.current_likes || 0}/{dip.likes_required || '?'}</p>
            <p className="text-xs text-gray-500">likes</p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500" style={{ width: `${likesPercent}%` }} />
            </div>
            {dip.stage === 'live' && filledSpots > 0 && (
              <p className="text-xs text-gray-600 font-semibold mt-1">avg spot ${avgPricePerSold}</p>
            )}
          </div>
          <div className={`rounded-2xl border p-3 shadow-sm text-center ${avgNeededOnRemaining !== null && avgNeededOnRemaining < 0 ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
            <p className="text-lg font-bold text-gray-900">{paidSpots}/{filledSpots}</p>
            <p className="text-xs text-gray-500">paid</p>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-pink-500 to-rose-500" style={{ width: `${filledSpots > 0 ? Math.round((paidSpots/filledSpots)*100) : 0}%` }} />
            </div>
            {dip.stage === 'live' && (
              <p className={`text-xs mt-1 font-semibold ${avgNeededOnRemaining !== null && avgNeededOnRemaining < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                {avgNeededOnRemaining !== null ? (avgNeededOnRemaining < 0 ? 'Target reached! 🎉' : `$${avgNeededOnRemaining} avg needed`) : 'add wrap value'}
              </p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['guide', 'spots', 'settings'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold capitalize transition ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {tab === 'guide' ? '📋 Guide' : tab === 'spots' ? '🎯 Spots' : '⚙️ Settings'}
            </button>
          ))}
        </div>

        {/* GUIDE TAB */}
        {activeTab === 'guide' && (
          <div className="space-y-4">

            {/* Stage card */}
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
              <h2 className="text-lg font-bold text-gray-900">{guide.title}</h2>
              <p className="text-sm text-gray-700 leading-relaxed">{guide.instruction}</p>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
                💡 {guide.tip}
              </div>

              {/* Checklist */}
              <div className="space-y-2">
                {guide.checklist.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <span className="mt-0.5 text-pink-400 shrink-0">☐</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              {/* Copy post button */}
              {guide.postLabel && (
                <button
                  type="button"
                  onClick={() => copyText(guide.postText(), guide.postKey)}
                  className={`w-full rounded-xl py-3 text-sm font-bold transition ${
                    copied === guide.postKey
                      ? 'bg-green-500 text-white'
                      : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  }`}
                >
                  {copied === guide.postKey ? '✓ Copied!' : `📋 ${guide.postLabel}`}
                </button>
              )}

              {/* Post preview */}
              {guide.postText() && (
                <div className="rounded-xl bg-gray-50 px-3 py-3 text-xs text-gray-600 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {guide.postText()}
                </div>
              )}
            </div>

            {/* Likes tracker — show on interest stage */}
            {dip.stage === 'interest' && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900">Update Likes</h3>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={likesInput}
                    onChange={(e) => setLikesInput(e.target.value)}
                    className="flex-1 rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                    placeholder="Current likes"
                  />
                  <button
                    type="button"
                    onClick={handleSaveLikes}
                    className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  Need {dip.likes_required} total — 30% ({Math.round((dip.likes_required || 0) * 0.3)}) by 48hrs, 50% ({Math.round((dip.likes_required || 0) * 0.5)}) by 72hrs
                </p>
              </div>
            )}
{/* Saved game card */}
            {savedGame && dip.stage === 'live' && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">🎮 Active Game</h3>
                  <button type="button" onClick={handleResetGame} className="text-xs text-red-400 underline">Reset</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(savedGame.emoji_map as {emoji: string, price: number}[]).map((m) => {
                    const claimed = spots.some(s => s.spot_type === `game:${m.emoji}` && s.player_name)
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
                  👆 This is your private view — prices are hidden from players until all claimed.
                </div>
                <button
                  type="button"
                  onClick={() => copyText(buildAdminRevealMessage(), 'adminreveal')}
                  className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${copied === 'adminreveal' ? 'bg-green-500 text-white' : 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'}`}
                >
                  {copied === 'adminreveal' ? '✓ Copied!' : '📋 Copy Admin Reveal Message'}
                </button>
                {(() => {
                  const map = savedGame.emoji_map as {emoji: string, price: number}[]
                  const allClaimed = map.every(m => spots.some(s => s.spot_type === `game:${m.emoji}` && s.player_name))
                  const alreadyRevealed = spots.some(s => s.spot_type.startsWith('game:') && s.game_revealed)
                  if (!allClaimed) return (
                    <p className="text-xs text-gray-400 text-center">
                      {map.filter(m => spots.some(s => s.spot_type === `game:${m.emoji}` && s.player_name)).length}/{map.length} emojis claimed — reveal available when all claimed
                    </p>
                  )
                  if (alreadyRevealed) return (
                    <div className="space-y-2">
                      <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-800">
                        ✅ Prices revealed — sync your Google Sheet to update the public list.
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
                        ✅ Game saved and locked. View it in the Active Game card above.
                        <button
                          type="button"
                          onClick={handleResetGame}
                          className="block mt-2 text-red-400 underline"
                        >
                          Reset game to edit
                        </button>
                      </div>
                    ) : (
                    <>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-800">
                      ⚠️ Per CU rules — send game results to CU Admins before posting publicly. No cash/PayPal prizes allowed.
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
                                    className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-pink-500"
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
                          {buildGamePost()}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyText(buildGamePost(), 'game')}
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
{/* Likers — show on interest and queue */}
            {(dip.stage === 'interest' || dip.stage === 'queue') && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-gray-900">❤️ Likers</h3>
                  <span className="text-xs text-gray-400">{likers.length} / {dip.likes_required || '?'}</span>
                </div>
                <p className="text-xs text-gray-500">Add names as people like your post. They'll be tagged in the live post.</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newLikerName}
                    onChange={(e) => setNewLikerName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLiker()}
                    placeholder="e.g. Sarah Jones"
                    className="flex-1 rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddLiker}
                    disabled={addingLiker || !newLikerName.trim()}
                    className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {likers.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {likers.map(l => (
                      <div key={l.id} className="flex items-center gap-1 rounded-full bg-pink-50 border border-pink-200 px-3 py-1">
                        <span className="text-xs font-semibold text-pink-700">{l.name}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteLiker(l.id)}
                          className="text-pink-400 hover:text-pink-600 text-xs ml-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {/* Google sheet — show on queue/live */}
            {(dip.stage === 'queue' || dip.stage === 'live') && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900">Google Sheet Link</h3>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={googleSheetLink}
                    onChange={(e) => setGoogleSheetLink(e.target.value)}
                    placeholder="https://docs.google.com/..."
                    className="flex-1 rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-pink-500"
                  />
                  <button
                    type="button"
                    onClick={handleSaveGoogleSheet}
                    disabled={savingSettings}
                    className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                  >
                    Save
                  </button>
                </div>
                <p className="text-xs text-gray-400">This will appear in your live post automatically.</p>
              </div>
            )}
{/* Archive — show on drawn stage */}
            {dip.stage === 'drawn' && dip.winning_number && !dip.archived && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900">✅ Complete & Archive</h3>
                <p className="text-xs text-gray-500">Once shipped and complete, archive this dip to move it to your dip history in Tools.</p>
                <button
                  type="button"
                  onClick={handleArchiveDip}
                  className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-sm font-bold text-white"
                >
                  Archive Dip
                </button>
              </div>
            )}
            {/* Winner — show on closed/drawn */}
            {(dip.stage === 'closed' || dip.stage === 'drawn') && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900">
                  {dip.winning_number ? `🎉 Winner: ${dip.winner_name} (spot ${dip.winning_number})` : 'Record Winning Number'}
                </h3>
                {!dip.winning_number && (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={winningNumber}
                        onChange={(e) => setWinningNumber(e.target.value)}
                        placeholder={`1 – ${dip.total_spots}`}
                        className="flex-1 rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                      />
                      <button
                        type="button"
                        onClick={handleSaveResult}
                        className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white"
                      >
                        Save
                      </button>
                    </div>
                    <p className="text-xs text-gray-400">Enter the number drawn by the CU Admin.</p>
                  </>
                )}
              </div>
            )}

            {/* Google Sheets sync */}
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-gray-900">Google Sheet</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {dip.google_sheet_link ? 'Sheet connected — sync to update' : 'Creates and syncs your spot list automatically'}
                  </p>
                </div>
                {dip.google_sheet_link && (
                  <a
                    href={dip.google_sheet_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-pink-500 underline shrink-0"
                  >
                    Open ↗
                  </a>
                )}
              </div>

              {googleConnected ? (
                <button
                  type="button"
                  onClick={syncToSheets}
                  disabled={syncing}
                  className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {syncing ? 'Syncing...' : dip.google_sheet_link ? '🔄 Sync Sheet' : '📊 Create & Sync Sheet'}
                </button>
              ) : (
                <a
                  href={`/api/auth/google?state=${id}__${currentUserId}`}
                  className="block w-full rounded-xl bg-green-500 py-2.5 text-center text-sm font-bold text-white"
                >
                  Connect Google Sheets
                </a>
              )}

              {syncMessage && (
                <p className={`text-xs font-semibold ${syncMessage.includes('✓') ? 'text-green-600' : 'text-red-500'}`}>
                  {syncMessage}
                </p>
              )}
            </div>

            {/* Stage navigation */}
            <div className="flex gap-2">
              {currentStageIndex > 0 && (
                <button
                  type="button"
                  onClick={async () => {
                    const prevStage = STAGES[currentStageIndex - 1]
                    await supabase.from('dips').update({ stage: prevStage, status: prevStage }).eq('id', id)
                    await loadDip()
                  }}
                  className="rounded-2xl border border-gray-200 px-4 py-3.5 text-sm font-semibold text-gray-400 hover:bg-gray-50"
                >
                  ← Back
                </button>
              )}
              {!isLastStage && (
                <button
                  type="button"
                  onClick={handleAdvanceStage}
                  className="flex-1 rounded-2xl border-2 border-pink-200 py-3.5 text-sm font-bold text-pink-600 hover:bg-pink-50"
                >
                  Move to {STAGE_LABELS[STAGES[currentStageIndex + 1]]} →
                </button>
              )}
            </div>
          </div>
        )}

        {/* SPOTS TAB */}
        {activeTab === 'spots' && (
          <div className="space-y-4">

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
                    placeholder="e.g. Sarah Jones"
                    className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    {['ls2','ls3','ls4','ls5'].includes(addSpotType)
                      ? `Spot Numbers — pick ${addSpotType.replace('ls','')} (${addSelectedSpots.length}/${addSpotType.replace('ls','')} selected)`
                      : 'Spot #'}
                  </label>
                  {['ls2','ls3','ls4','ls5'].includes(addSpotType) ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1.5 min-h-[36px] rounded-xl border px-3 py-2 bg-white">
                        {addSelectedSpots.length === 0 && (
                          <span className="text-xs text-gray-400">Tap numbers below to select</span>
                        )}
                        {addSelectedSpots.map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAddSelectedSpots(prev => prev.filter(x => x !== n))}
                            className="rounded-lg bg-pink-100 px-2 py-0.5 text-xs font-bold text-pink-700"
                          >
                            {n} ✕
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
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
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:border-pink-400 hover:bg-pink-50"
                            >
                              {n}
                            </button>
                          ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto rounded-xl border px-3 py-2 bg-white">
                      {Array.from({ length: dip.total_spots }, (_, i) => i + 1)
                        .filter(n => !usedSpotNumbers.includes(n))
                        .map(n => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setAddSelectedSpots([n])}
                            className={`rounded-lg border px-2 py-1 text-xs font-semibold transition ${
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
                    <option value="bookend">Bookend — ${dip.price_bookend || '?'}</option>
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
                      ⚠️ Set up your game in the Guide tab first to pick emojis.
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
                  {/* Header */}
                  <div className="grid grid-cols-[40px_1fr_80px_70px_60px] gap-2 px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                    <span>#</span>
                    <span>Player</span>
                    <span>Type</span>
                    <span>Owed</span>
                    <span>Paid</span>
                  </div>

                  {spots.map((spot) => (
                    <div
                      key={spot.id}
                      className={`grid grid-cols-[40px_1fr_80px_70px_60px] gap-2 px-4 py-3 items-center text-sm ${
                        spot.paid ? 'bg-green-50' : ''
                      }`}
                    >
                      <span className="font-bold text-gray-400">{spot.spot_number}</span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{spot.player_name}</p>
                      </div>
                      <span className="text-xs text-gray-500">{getSpotTypeLabel(spot.spot_type)}</span>
                      <span className="text-xs font-semibold text-gray-700">
                        {spot.spot_type === 'game' && !spot.game_revealed
                          ? '🎮 TBD'
                          : spot.amount_owed !== null
                          ? `$${spot.amount_owed}`
                          : '—'}
                      </span>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePaid(spot)}
                          className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                            spot.paid
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {spot.paid ? '✓' : '—'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!confirm(`Delete spot #${spot.spot_number} for ${spot.player_name}?`)) return
                            handleDeleteSpot(spot.id)
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-red-400 bg-red-50 transition hover:bg-red-100"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
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
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-900">Dip Details</h2>

              <div className="space-y-2 text-sm">
                {([
                  ['Wrap', dip.title],
                  ['Condition', dip.wrap_condition || '—'],
                  ['Size', dip.wrap_size || '—'],
                  ['Blend', dip.wrap_blend || '—'],
                  ['Total spots', String(dip.total_spots)],
                  ['Main price', `$${dip.price_per_spot} USD`],
                  ['LS 1', `$${dip.price_ls1 || '—'}`],
                  ['LS 2', `$${dip.price_ls2 || '—'}`],
                  ['LS 3', `$${dip.price_ls3 || '—'}`],
                  ['LS 4', `$${dip.price_ls4 || '—'}`],
                  ['LS 5', `$${dip.price_ls5 || '—'}`],
                  ['Bookend', `$${dip.price_bookend || '—'}`],
                  ['Shipping from', dip.shipping_from || '—'],
                  ['Shipping credit', dip.shipping_credit ? `$${dip.shipping_credit} USD` : '—'],
                  ['Household', `${dip.smoke_free ? 'Smoke free' : 'Not smoke free'} / ${dip.pet_free ? 'Pet free' : 'Not pet free'}`],
                  ['Feedback Hub', dip.feedback_hub_link || '—'],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between py-1 border-b last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right max-w-[60%] truncate">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Google Sheet</h2>
              <input
                type="url"
                value={googleSheetLink}
                onChange={(e) => setGoogleSheetLink(e.target.value)}
                placeholder="https://docs.google.com/..."
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-pink-500"
              />
              <button
                type="button"
                onClick={handleSaveGoogleSheet}
                disabled={savingSettings}
                className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingSettings ? 'Saving...' : 'Save Google Sheet Link'}
              </button>
              {googleSheetLink && (
  <a href={googleSheetLink} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-pink-500 underline">
    Open Sheet ↗
  </a>
)}
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Payment Methods</h2>
              <p className="text-xs text-gray-500">List how you accept payment — this will appear in your payments post.</p>
              <textarea
                value={paymentMethods}
                onChange={(e) => setPaymentMethods(e.target.value)}
                placeholder="e.g. PayPal Friends & Family, Wise"
                rows={3}
                className="w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:border-pink-500 resize-none"
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

            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Update Likes</h2>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={likesInput}
                  onChange={(e) => setLikesInput(e.target.value)}
                  className="flex-1 rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                  placeholder="Current likes"
                />
                <button
                  type="button"
                  onClick={handleSaveLikes}
                  className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-bold text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}