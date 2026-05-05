'use client'

import AppLayout from '@/app/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Step = 'calculator' | 'setup' | 'confirm' | 'posts'

const WRAP_EMOJIS = [
  '💕','🌸','🍀','🩵','🌈','🎀','🍎','🌻','🩷','🦋',
  '🌺','🍓','🌙','⭐','🌊','🦄','🌷','🍉','🧁','💜',
  '🩶','🤍','🌿','🫐','🍋','🌼','🦢','🐚','🎠','🪷','🌅',
]

function CreateDipInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const wrapIdFromUrl = searchParams.get('wrapId') || ''
  const wrapNameFromUrl = searchParams.get('wrapName') || ''
  const brandFromUrl = searchParams.get('brand') || ''

  const [step, setStep] = useState<Step>('calculator')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Wrap details
  const [wrapName, setWrapName] = useState(wrapNameFromUrl)
  const [brand, setBrand] = useState(brandFromUrl)
  const [wrapValue, setWrapValue] = useState('')
  const [condition, setCondition] = useState('EUC')
  const [size, setSize] = useState('')
  const [blend, setBlend] = useState('')
  const [shippingFrom, setShippingFrom] = useState('Australia')
  const [shippingCredit, setShippingCredit] = useState('20')
  const [smokeFree, setSmokeFree] = useState(true)
  const [petFree, setPetFree] = useState(true)
  const [feedbackHubLink, setFeedbackHubLink] = useState('')

  // Calculator
  const [ticketPrice, setTicketPrice] = useState('30')
  const [totalDips, setTotalDips] = useState('')
  const [lsOverrides, setLsOverrides] = useState<Record<number, string>>({})
  const [bePriceOverride, setBePriceOverride] = useState('')

  // Game
  const [overrideGameSlots, setOverrideGameSlots] = useState(false)
  const [customGameSlots, setCustomGameSlots] = useState('')
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([])
  const [gamePriceOverrides, setGamePriceOverrides] = useState<Record<number, string>>({})

  // UI
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      const { data } = await supabase
        .from('profiles')
        .select('feedback_hub_link')
        .eq('id', user.id)
        .single()
      if (data && (data as any).feedback_hub_link) {
        setFeedbackHubLink((data as any).feedback_hub_link)
      }
    })
  }, [])

  // Core calculations
  const numericValue = Number(wrapValue) || 0
  const numericTicket = Number(ticketPrice) || 30
  const targetAmount = Math.round(numericValue * 1.20 + 20)
  const calculatedDips = numericValue > 0 ? Math.round(targetAmount / numericTicket) : 0
  const resolvedDips = Number(totalDips) > 0 ? Number(totalDips) : calculatedDips
  const likesRequired = Math.round(resolvedDips * 0.33)
  const totalValue = resolvedDips * numericTicket
  const isOver2000 = totalValue > 2000

  // Pricing
  const mainPrice = numericTicket
  const bePriceCalculated = Math.round(numericTicket * 0.734)
  const bePrice = bePriceOverride !== '' ? Number(bePriceOverride) : bePriceCalculated

  const lsTiers = useMemo(() => {
    const p = numericTicket
    return [
      { spots: 1, price: Math.round(p * 0.9) },
      { spots: 2, price: Math.round(p * 1.665) },
      { spots: 3, price: Math.round(p * 2.295) },
      { spots: 4, price: Math.round(p * 2.934) },
      { spots: 5, price: Math.round(p * 3.488) },
    ]
  }, [numericTicket])

  const resolvedLsTiers = lsTiers.map((tier, i) => ({
    ...tier,
    price: lsOverrides[i] !== undefined ? Number(lsOverrides[i]) : tier.price,
  }))

  // Game slots
  const calculatedGameSlots = Math.max(1, Math.round(resolvedDips / 6.67))
  const resolvedGameSlots = overrideGameSlots && Number(customGameSlots) > 0 ? Number(customGameSlots) : calculatedGameSlots

  const suggestedGamePrices = useMemo(() => [
    { label: 'Standard', price: numericTicket },
    { label: 'L1', price: Math.round(numericTicket * 0.9) },
    { label: 'Bookend +$2', price: Math.round(numericTicket * 0.734) + 2 },
    { label: 'Bookend', price: Math.round(numericTicket * 0.734) },
    { label: 'Bookend -$2', price: Math.max(0, Math.round(numericTicket * 0.734) - 2) },
    { label: 'Free', price: 0 },
  ], [numericTicket])

  const resolvedGamePrices = suggestedGamePrices.map((g, i) => ({
    ...g,
    price: gamePriceOverrides[i] !== undefined ? Number(gamePriceOverrides[i]) : g.price,
  }))

  const avgGamePrice = Math.round(
    resolvedGamePrices.slice(0, resolvedGameSlots).reduce((sum, g) => sum + g.price, 0) / Math.max(1, resolvedGameSlots)
  )

  // Strings
  const householdDisclosure = `${smokeFree ? 'Smoke free' : 'Not smoke free'} / ${petFree ? 'Pet free' : 'Not pet free'}`

  const gameSection = selectedEmojis.length > 0
    ? `\n🎮 Game Tickets (${resolvedGameSlots} slots — pick an emoji, price revealed when all sold!):\n${selectedEmojis.map((e) => e).join(' ')}\nAverage game price: $${avgGamePrice} USD\n`
    : ''

  const interestPostText = `#newinterestpost
Interest Post

Likes needed: ${likesRequired} (33% of ${resolvedDips} dips)

${brand} ${wrapName}
Size: ${size || '[add size]'}
Blend: ${blend || '[add blend]'}
Condition: ${condition}

${resolvedDips} dips @ $${mainPrice} USD each = $${totalValue} USD total${isOver2000 ? ' + $4.95 draw fee' : ''}

Liker Specials:
- 1 spot = $${lsTiers[0].price}
- 2 spots = $${lsTiers[1].price}
- 3 spots = $${lsTiers[2].price}
- 4 spots = $${lsTiers[3].price}
- 5 spots = $${lsTiers[4].price}

Bookend spots (1 & ${resolvedDips}): $${bePrice} each
${gameSection}
Shipping from ${shippingFrom}
$${shippingCredit} USD shipping credit included

${householdDisclosure}

Feedback Hub: ${feedbackHubLink || '[add your Feedback Hub link]'}

Comment "next" with your number/s or "random" to enter when live! 🎉`

  const inQueuePostText = `#newinqueue

${brand} ${wrapName} is in the queue and will be going live soon! 🦄

Keep an eye out for the live post — comment "next" with your numbers to claim your spots!

${householdDisclosure}
Shipping from ${shippingFrom} | $${shippingCredit} USD shipping credit included`

  const livePostText = `#newlivepost

🎉 WE ARE LIVE! 🎉

${brand} ${wrapName}
Size: ${size || '[add size]'}
Blend: ${blend || '[add blend]'}
Condition: ${condition}

${resolvedDips} dips @ $${mainPrice} USD each

Liker Specials (claim in first 24 hrs!):
- 1 spot = $${lsTiers[0].price}
- 2 spots = $${lsTiers[1].price}
- 3 spots = $${lsTiers[2].price}
- 4 spots = $${lsTiers[3].price}
- 5 spots = $${lsTiers[4].price}

Bookend spots (1 & ${resolvedDips}): $${bePrice} each
${gameSection}
Comment "next" followed by your number/s or "random" 🎲
Each claim must be a NEW comment (not a reply!)

Spot list: [add Google Sheet link]

Shipping from ${shippingFrom} | $${shippingCredit} USD credit included
${householdDisclosure}
Feedback Hub: ${feedbackHubLink || '[add your Feedback Hub link]'}

Post SCREENSHOTS of payments in comments once paid! 📸`

  const paymentPostText = `#fullandcollectingpayments

💸 Payments are now open! 💸

${brand} ${wrapName} is 80%+ full — time to pay for your spots!

Please send payment via PayPal Friends & Family (NO COMMENTS, GIFTED only)
Post a screenshot of your payment in the comments 📸

International fees apply if sending outside your country.

Thank you everyone — so close! 🦄`

  const closedPostText = `🎉 FULL AND CLOSED! 🎉

${brand} ${wrapName} is SOLD OUT! 🦄

If you still owe payment, please pay ASAP — unpaid spots will be reallocated after 24 hours.

Tagging everyone who needs to pay: [tag unpaid players]

Thank you all so much! Drawing soon! 🎲`

  async function handleCreate() {
    if (!currentUserId) return
    if (!wrapName.trim()) { setError('Enter wrap name'); return }
    if (!wrapValue || numericValue <= 0) { setError('Enter wrap value'); return }
    if (resolvedDips < 1) { setError('Number of dips must be at least 1'); return }

    setCreating(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('dips')
      .insert([{
        user_id: currentUserId,
        wrap_id: wrapIdFromUrl || null,
        title: `${brand} ${wrapName}`.trim(),
        brand: brand || null,
        wrap_name: wrapName,
        total_spots: resolvedDips,
        price_per_spot: mainPrice,
        total_value: totalValue,
        likes_required: likesRequired,
        current_likes: 0,
        payment_trigger_percent: 80,
        payment_window_hours: 24,
        shipping_timeframe_days: 3,
        is_ready_for_draw: false,
        status: 'interest',
        stage: 'interest',
        price_ls1: resolvedLsTiers[0].price,
        price_ls2: resolvedLsTiers[1].price,
        price_ls3: resolvedLsTiers[2].price,
        price_ls4: resolvedLsTiers[3].price,
        price_ls5: resolvedLsTiers[4].price,
        price_bookend: bePrice,
        wrap_condition: condition,
        wrap_size: size || null,
        wrap_blend: blend || null,
        shipping_from: shippingFrom || null,
        shipping_credit: Number(shippingCredit) || null,
        smoke_free: smokeFree,
        pet_free: petFree,
        feedback_hub_link: feedbackHubLink || null,
        wrap_value: numericValue || null,
      }])
      .select()
      .single()

    setCreating(false)

    if (insertError || !data) {
      setError(insertError?.message || 'Could not create dip')
      return
    }

    if (feedbackHubLink && currentUserId) {
      await supabase
        .from('profiles')
        .update({ feedback_hub_link: feedbackHubLink } as any)
        .eq('id', currentUserId)
    }

    router.push(`/dips/${data.id}`)
  }

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  function toggleEmoji(emoji: string) {
    if (selectedEmojis.includes(emoji)) {
      setSelectedEmojis(prev => prev.filter(e => e !== emoji))
    } else if (selectedEmojis.length < resolvedGameSlots) {
      setSelectedEmojis(prev => [...prev, emoji])
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'calculator', label: 'Calculator' },
    { key: 'setup', label: 'Wrap Details' },
    { key: 'confirm', label: 'Create' },
  ]

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-10">

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="rounded-xl border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
          <h1 className="text-xl font-bold text-gray-900">Create Dip</h1>
        </div>

        <div className="flex gap-1">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStep(s.key)}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${step === s.key ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {/* STEP 1 — CALCULATOR */}
        {step === 'calculator' && (
          <div className="space-y-4">

            {/* Inputs */}
            <div className="rounded-2xl bg-gradient-to-r from-pink-50 to-rose-50 border border-pink-100 p-4 flex gap-3 items-start">
                <span className="text-2xl">🎲</span>
                <div>
                  <p className="text-sm font-bold text-pink-700 mb-0.5">What is a Dip?</p>
                  <p className="text-xs text-pink-600 leading-relaxed">A dip is a random number draw used in wrap Facebook groups to sell wraps fairly. WrapApp helps you manage your dip — track spots, run the draw, and share results. Payments and posts still happen through your Facebook group.</p>
                </div>
              </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-900">Dip Calculator</h2>
              <p className="text-xs text-gray-500">Enter your wrap value and ticket price to get suggested pricing.</p>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Wrap Value (USD)</label>
                <input
                  type="number"
                  value={wrapValue}
                  onChange={(e) => setWrapValue(e.target.value)}
                  placeholder="e.g. 800"
                  className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                />
                <p className="mt-1 text-xs text-gray-400">Use current market value, not what you paid</p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Main Ticket Price (USD)</label>
                <input
                  type="number"
                  value={ticketPrice}
                  onChange={(e) => setTicketPrice(e.target.value)}
                  placeholder="30"
                  className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                />
                <p className="mt-1 text-xs text-gray-400">Adjusting this recalculates all LS tiers, bookend, and total value automatically.</p>
              </div>

              {numericValue > 0 && (
                <div className="rounded-xl bg-pink-50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Wrap value</span>
                    <span className="font-bold">${numericValue}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">+ 20% buffer for specials</span>
                    <span className="font-bold">+${Math.round(numericValue * 0.20)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">+ $20 shipping</span>
                    <span className="font-bold">+$20</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600 font-semibold">Target to recover</span>
                    <span className="font-bold text-pink-600">${targetAmount}</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="text-gray-600">Likes needed</span>
                    <span className="font-bold">{likesRequired}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total value</span>
                    <span className="font-bold">${totalValue}</span>
                  </div>
                  <div className="flex items-center justify-between border-t pt-2 gap-3">
                    <span className="text-gray-600 font-semibold text-sm">Number of Dips</span>
                    <input
                      type="number"
                      value={totalDips !== '' ? totalDips : calculatedDips}
                      onChange={(e) => setTotalDips(e.target.value)}
                      min={1}
                      className="w-24 rounded-xl border px-3 py-1.5 text-base font-bold text-center outline-none focus:border-pink-500 bg-white"
                    />
                  </div>
                  {isOver2000 && (
                    <div className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800 mt-2">
                      ⚠️ Value over $2000 — Random.org paid draw (+$4.95) and Google Sheet mandatory
                    </div>
                  )}
                </div>
              )}

              
            </div>

            {/* Pricing breakdown */}
            {numericValue > 0 && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900">Suggested Pricing</h3>
                <p className="text-xs text-gray-500">Suggestions only — use whatever prices you like.</p>

                <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Liker Specials (LS)</p>
                  {lsTiers.map((tier, i) => (
                    <div key={tier.spots} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-gray-600 w-16 shrink-0">{tier.spots} spot{tier.spots > 1 ? 's' : ''}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        <span className="text-gray-400 text-xs">$</span>
                        <input
                          type="number"
                          value={lsOverrides[i] !== undefined ? lsOverrides[i] : tier.price}
                          onChange={(e) => setLsOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                          className="w-20 rounded-lg border px-2 py-1 text-sm font-semibold text-center outline-none focus:border-pink-500 bg-white"
                        />
                        <span className="text-gray-400 text-xs">USD</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Standard</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Main (per spot)</span>
                    <span className="font-semibold">${mainPrice} USD</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-600 shrink-0">Bookend (spots 1 & {resolvedDips})</span>
                    <div className="flex items-center gap-1 ml-auto">
                      <span className="text-gray-400 text-xs">$</span>
                      <input
                        type="number"
                        value={bePriceOverride !== '' ? bePriceOverride : bePriceCalculated}
                        onChange={(e) => setBePriceOverride(e.target.value)}
                        className="w-20 rounded-lg border px-2 py-1 text-sm font-semibold text-center outline-none focus:border-pink-500 bg-white"
                      />
                      <span className="text-gray-400 text-xs">USD</span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-400">💡 Prices auto-calculate from ticket price. Edit any price manually if needed.</p>
              </div>
            )}

            {/* Game slots — shown in dip management once live */}
            {false && numericValue > 0 && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-gray-900">Game Slots</h3>
                  <p className="text-xs text-gray-500 mt-1">Players pick an emoji without knowing the price — revealed when all game tickets are sold. Helps close the dip faster.</p>
                </div>

                <div className="rounded-xl bg-pink-50 p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Suggested game slots</span>
                    <span className="font-bold">{calculatedGameSlots}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average game ticket price</span>
                    <span className="font-bold">${avgGamePrice} USD</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <input id="overrideGame" type="checkbox" checked={overrideGameSlots} onChange={(e) => setOverrideGameSlots(e.target.checked)} />
                    <label htmlFor="overrideGame" className="text-sm font-medium text-gray-700">Override number of game slots</label>
                  </div>
                  {overrideGameSlots && (
                    <input
                      type="number"
                      value={customGameSlots}
                      onChange={(e) => setCustomGameSlots(e.target.value)}
                      placeholder="Enter custom game slots"
                      className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500"
                    />
                  )}
                </div>

                {/* Game price tiers */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Game Prices</p>
                  <p className="text-xs text-gray-400 mb-3">Each slot gets one price — hidden until all are sold. Adjust any price.</p>
                  <div className="space-y-2">
                    {suggestedGamePrices.slice(0, resolvedGameSlots).map((g, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 w-28 shrink-0">{g.label}</span>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                          <input
                            type="number"
                            value={gamePriceOverrides[i] !== undefined ? gamePriceOverrides[i] : g.price}
                            onChange={(e) => setGamePriceOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                            className="w-full rounded-xl border pl-6 pr-3 py-2 text-sm outline-none focus:border-pink-500"
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">USD</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Emoji picker */}
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Choose Game Emojis</p>
                  <p className="text-xs text-gray-400 mb-3">
                    Select {resolvedGameSlots} emojis — one per game slot ({selectedEmojis.length}/{resolvedGameSlots} selected)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {WRAP_EMOJIS.map((emoji) => {
                      const isSelected = selectedEmojis.includes(emoji)
                      const isFull = selectedEmojis.length >= resolvedGameSlots && !isSelected
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleEmoji(emoji)}
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

                  {selectedEmojis.length > 0 && (
                    <div className="mt-4 rounded-xl bg-gray-50 p-3">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Your game ({selectedEmojis.length} slots):</p>
                      <div className="flex flex-wrap gap-3">
                        {selectedEmojis.map((emoji, i) => {
                          const price = gamePriceOverrides[i] !== undefined
                            ? Number(gamePriceOverrides[i])
                            : suggestedGamePrices[i]?.price ?? 0
                          const label = suggestedGamePrices[i]?.label ?? ''
                          return (
                            <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl bg-white border p-2 min-w-[52px] text-center">
                              <span className="text-2xl">{emoji}</span>
                              <span className="text-[10px] font-semibold text-gray-700">${price}</span>
                              <span className="text-[9px] text-gray-400">{label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('setup')}
              disabled={!wrapValue || resolvedDips < 1}
              className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 text-sm font-bold text-white disabled:opacity-40"
            >
              Next: Wrap Details →
            </button>
          </div>
        )}

        {/* STEP 2 — WRAP DETAILS */}
        {step === 'setup' && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-900">Wrap Details</h2>
              <p className="text-xs text-gray-500">These details will be used to generate your Facebook posts.</p>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Wrap Name</label>
                  <input value={wrapName} onChange={(e) => setWrapName(e.target.value)} placeholder="e.g. Shore Thang" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Luna Cocoon" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Size / STIH</label>
                  <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. Size 6" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Blend</label>
                  <input value={blend} onChange={(e) => setBlend(e.target.value)} placeholder="e.g. 100% cotton" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Condition</label>
                  <select value={condition} onChange={(e) => setCondition(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500">
                    <option value="VVGUC">VVGUC</option>
                    <option value="EUC">EUC</option>
                    <option value="VGUC">VGUC</option>
                    <option value="GUC">GUC</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shipping Credit (USD)</label>
                  <input type="number" value={shippingCredit} onChange={(e) => setShippingCredit(e.target.value)} className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shipping From</label>
                  <input value={shippingFrom} onChange={(e) => setShippingFrom(e.target.value)} placeholder="e.g. Australia" className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Babywearing Feedback Hub Link</label>
                  <input value={feedbackHubLink} onChange={(e) => setFeedbackHubLink(e.target.value)} placeholder="https://..." className="w-full rounded-xl border px-3 py-2.5 text-base outline-none focus:border-pink-500" />
                  <p className="mt-1 text-xs text-gray-400">Required by most group rules. Saved to your profile for future dips.</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <input id="smoke" type="checkbox" checked={smokeFree} onChange={(e) => setSmokeFree(e.target.checked)} />
                  <label htmlFor="smoke" className="text-sm font-medium text-gray-700">Smoke free</label>
                </div>
                <div className="flex items-center gap-2">
                  <input id="pet" type="checkbox" checked={petFree} onChange={(e) => setPetFree(e.target.checked)} />
                  <label htmlFor="pet" className="text-sm font-medium text-gray-700">Pet free</label>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('calculator')} className="flex-1 rounded-2xl border py-3.5 text-sm font-semibold text-gray-700">← Back</button>
              <button type="button" onClick={() => setStep('confirm')} disabled={!wrapName.trim()} className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 text-sm font-bold text-white disabled:opacity-40">Next: Confirm →</button>
            </div>
          </div>
        )}

        {/* STEP 3 — FACEBOOK POSTS — moved to dip management */}
        {false && step === 'posts' && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-4">
              <p className="text-xs text-gray-500">Copy each post at the right time in your dip cycle.</p>

              {[
                { key: 'interest', stage: '1. Interest Post', when: 'Post first to gauge interest and collect likes', text: interestPostText, tip: '30% likes needed within 48hrs, 50% within 72hrs, 100% within 7 days' },
                { key: 'queue', stage: '2. In Queue Post', when: 'Post after CU admin approves your interest post', text: inQueuePostText, tip: 'Tag Chasing Unicorn Admins page when requesting to go live' },
                { key: 'live', stage: '3. Live Post', when: 'Post when dip goes live — add Google Sheet link first', text: livePostText, tip: 'Likers should claim within first 24 hours as a courtesy' },
                { key: 'payment', stage: '4. Payment Post', when: 'Post when dip reaches 80% full', text: paymentPostText, tip: 'Tag all players who need to pay. They have 24 hours.' },
                { key: 'closed', stage: '5. Closed Post', when: 'Post when all spots are filled', text: closedPostText, tip: 'Tag the CU Admins page to request your draw' },
              ].map((post) => (
                <div key={post.key} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{post.stage}</p>
                      <p className="text-xs text-gray-500">{post.when}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyText(post.text, post.key)}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${copied === post.key ? 'bg-green-500 text-white' : 'bg-pink-500 text-white'}`}
                    >
                      {copied === post.key ? '✓ Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-600 whitespace-pre-wrap max-h-28 overflow-y-auto">
                    {post.text}
                  </div>
                  <p className="mt-1 text-xs text-amber-600">💡 {post.tip}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border bg-white p-4 shadow-sm">
              <h3 className="text-sm font-bold text-gray-900 mb-2">CU Hashtags</h3>
              <div className="flex flex-wrap gap-2">
                {['#newinterestpost', '#newinqueue', '#newlivepost', '#fullandcollectingpayments'].map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => copyText(tag, tag)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${copied === tag ? 'bg-green-500 text-white border-green-500' : 'border-gray-200 text-gray-600 hover:border-pink-300'}`}
                  >
                    {copied === tag ? '✓ Copied!' : tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('setup')} className="flex-1 rounded-2xl border py-3.5 text-sm font-semibold text-gray-700">← Back</button>
              <button type="button" onClick={() => setStep('confirm')} className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 text-sm font-bold text-white">Next: Create Dip →</button>
            </div>
          </div>
        )}

        {/* STEP 4 — CONFIRM */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-3">
              <h2 className="font-bold text-gray-900">Confirm & Create</h2>
              <p className="text-xs text-gray-500">Review before creating.</p>

              <div className="space-y-2 text-sm">
                {[
                  ['Wrap', `${brand} ${wrapName}`],
                  ['Condition', condition],
                  ['Wrap value', `$${numericValue} USD`],
                  ['Total dips', resolvedDips],
                  ['Main ticket price', `$${mainPrice} USD`],
                  ['Total value', `$${totalValue} USD`],
                  ['Likes needed', likesRequired],
                  ['LS prices', resolvedLsTiers.map(t => `$${t.price}`).join(' / ')],
                  ['Bookend price', `$${bePrice} USD`],
                  ['Shipping credit', `$${shippingCredit} USD`],
                  ['Household', householdDisclosure],
                ].map(([label, value]) => (
                  <div key={String(label)} className="flex justify-between py-1 border-b last:border-0">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900 text-right max-w-[60%]">{value}</span>
                  </div>
                ))}
              </div>

              {isOver2000 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
                  ⚠️ Value over $2000 — add $4.95 for Random.org paid draw. Google Sheet mandatory.
                </div>
              )}

              {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('setup')} className="flex-1 rounded-2xl border py-3.5 text-sm font-semibold text-gray-700">← Back</button>
              <button type="button" onClick={handleCreate} disabled={creating} className="flex-1 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3.5 text-sm font-bold text-white disabled:opacity-50">
                {creating ? 'Creating...' : '🎉 Create Dip'}
              </button>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  )
}

export default function CreateDip() {
  return (
    <Suspense>
      <CreateDipInner />
    </Suspense>
  )
}