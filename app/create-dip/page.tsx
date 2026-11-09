'use client'

import AppLayout from '@/app/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { getCoverImage } from '@/lib/wrapCover'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

type Step = 'wrap' | 'price' | 'details'

type CollectionWrap = {
  id: string
  name: string
  brand: string | null
  size: string | null
  material: string | null
  status: string | null
  purchase_price: number | string | null
  purchase_currency: string | null
  wrap_images?: { id: string; image_url: string; is_primary?: boolean | null; sort_order: number }[]
}

const CREATE_WRAPS_KEY = 'dipdesk_create_dip_wraps'
const DASHBOARD_WRAPS_KEY = 'dipdesk_dashboard_wraps'
const RANDOM_ORG_THRESHOLD = 2000
const CALC_CURRENCIES = ['AUD', 'USD', 'EUR', 'GBP', 'NZD', 'CAD', 'CHF', 'JPY', 'SEK', 'NOK', 'DKK', 'SGD', 'HKD']

// Tap-to-show explainers
const INFO: Record<string, string> = {
  moneyGoal: 'How much you want to get back for the wrap, in USD. WrapApp adds a 20% buffer and $20 shipping, then suggests how many spots to sell.',
  ls: 'Liker Specials (LS) are bundle prices for people who liked your interest post. LS 1 = 1 spot, LS 2 = 2 spots for one price, and so on up to LS 5. Likers can claim them in the first 24hrs of the live post.',
  bookend: 'Bookend spots are the first and last numbers (spot 1 and the last spot). They’re priced a little lower than a main spot, each.',
  stih: 'Enter the wrap size (e.g. Size 6). For ring slings, enter the STIH length instead.',
  condition: 'EUC = excellent used condition. VVGUC = very very good used condition. VGUC = very good used condition. GUC = good used condition.',
}

function CreateDipInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const wrapIdFromUrl = searchParams.get('wrapId') || ''
  const wrapNameFromUrl = searchParams.get('wrapName') || ''
  const brandFromUrl = searchParams.get('brand') || ''
  const wrapPriceFromUrl = searchParams.get('wrapPrice') || ''
  const wrapCurrencyFromUrl = searchParams.get('wrapCurrency') || 'AUD'

  const [step, setStep] = useState<Step>(wrapNameFromUrl ? 'price' : 'wrap')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [openInfo, setOpenInfo] = useState<string | null>(null)

  // Wrap
  const [wrapId, setWrapId] = useState(wrapIdFromUrl)
  const [wrapName, setWrapName] = useState(wrapNameFromUrl)
  const [brand, setBrand] = useState(brandFromUrl)
  const [purchasePrice, setPurchasePrice] = useState(wrapPriceFromUrl)
  const [purchaseCurrency, setPurchaseCurrency] = useState(wrapCurrencyFromUrl)
  const [manualWrap, setManualWrap] = useState(false)
  const [showPicker, setShowPicker] = useState(!wrapNameFromUrl)
  const [collection, setCollection] = useState<CollectionWrap[]>([])

  // Price
  const [moneyGoal, setMoneyGoal] = useState('')
  const [ticketPrice, setTicketPrice] = useState('30')
  const [totalDips, setTotalDips] = useState('')
  const [lsOverrides, setLsOverrides] = useState<Record<number, string>>({})
  const [bePriceOverride, setBePriceOverride] = useState('')
  const [showAdjust, setShowAdjust] = useState(false)

  // Currency calculator (collapsed)
  const [showConvert, setShowConvert] = useState(false)
  const [calcAmount, setCalcAmount] = useState('')
  const [calcFrom, setCalcFrom] = useState('USD')
  const [calcTo, setCalcTo] = useState('AUD')
  const [calcResult, setCalcResult] = useState<number | null>(null)
  const [calcRate, setCalcRate] = useState<number | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)

  // Details (sensible defaults)
  const [condition, setCondition] = useState('EUC')
  const [size, setSize] = useState('')
  const [blend, setBlend] = useState('')
  const [shippingFrom, setShippingFrom] = useState('Australia')
  const [shippingCredit, setShippingCredit] = useState('20')
  const [smokeFree, setSmokeFree] = useState(true)
  const [petFree, setPetFree] = useState(true)
  const [feedbackHubLink, setFeedbackHubLink] = useState('')

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  async function handleConvert() {
    if (!calcAmount || !calcFrom || !calcTo || calcFrom === calcTo) return
    setCalcLoading(true)
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${calcFrom}&symbols=${calcTo}`)
      const data = await res.json()
      const rate = data.rates[calcTo]
      setCalcRate(rate)
      setCalcResult(Number(calcAmount) * rate)
    } catch {}
    setCalcLoading(false)
  }

  // Store the collection; when arriving from a wrap, also fill its size/blend (once)
  function applyCollection(list: CollectionWrap[]) {
    setCollection(list)
    if (!wrapIdFromUrl) return
    const w = list.find(c => String(c.id) === String(wrapIdFromUrl))
    if (!w) return
    setSize(prev => prev || w.size || '')
    setBlend(prev => prev || w.material || '')
  }

  // Collection tiles: cached first (own cache, else the Dashboard's), refreshed in the background
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CREATE_WRAPS_KEY) || localStorage.getItem(DASHBOARD_WRAPS_KEY)
      if (cached) applyCollection(JSON.parse(cached))
    } catch {}

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setCurrentUserId(user.id)
      const [{ data: profile }, { data: wraps }] = await Promise.all([
        supabase.from('profiles').select('feedback_hub_link').eq('id', user.id).single(),
        supabase
          .from('my_wraps') // own wraps incl. purchase price (owner-only view)
          .select('id, name, brand, size, material, status, purchase_price, purchase_currency, created_at, wrap_images(id, image_url, is_primary, sort_order)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .order('sort_order', { referencedTable: 'wrap_images' }),
      ])
      const hub = (profile as any)?.feedback_hub_link
      if (hub) setFeedbackHubLink(prev => prev || hub)
      if (wraps) {
        applyCollection(wraps as CollectionWrap[])
        try { localStorage.setItem(CREATE_WRAPS_KEY, JSON.stringify(wraps)) } catch {}
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableWraps = collection.filter(w => w.status !== 'departed')

  function pickWrap(w: CollectionWrap) {
    setWrapId(w.id)
    setWrapName(w.name || '')
    setBrand(w.brand || '')
    setSize(w.size || '')
    setBlend(w.material || '')
    setPurchasePrice(w.purchase_price ? String(w.purchase_price) : '')
    setPurchaseCurrency(w.purchase_currency || 'AUD')
    setManualWrap(false)
    setShowPicker(false)
  }

  function startManualWrap() {
    setWrapId('')
    setWrapName('')
    setBrand('')
    setSize('')
    setBlend('')
    setPurchasePrice('')
    setManualWrap(true)
    setShowPicker(false)
  }

  // Core calculations
  const numericGoal = Number(moneyGoal) || 0
  const numericTicket = Number(ticketPrice) || 30
  const targetAmount = Math.round(numericGoal * 1.20 + 20)
  const calculatedDips = numericGoal > 0 ? Math.max(1, Math.round(targetAmount / numericTicket)) : 0
  const resolvedDips = Number(totalDips) > 0 ? Number(totalDips) : calculatedDips
  const likesRequired = Math.round(resolvedDips * 0.33)
  const totalValue = resolvedDips * numericTicket
  const isOver2000 = totalValue > RANDOM_ORG_THRESHOLD
  const estimatedReturn = Math.max(0, totalValue - Math.round(numericGoal * 0.20) - 20)

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

  const wrapStepDone = wrapName.trim().length > 0
  const priceStepDone = resolvedDips >= 1

  async function handleCreate() {
    if (!currentUserId) { setError('Please log in again.'); return }
    if (!wrapName.trim()) { setError('Enter the wrap name'); setStep('details'); return }
    if (resolvedDips < 1) { setError('Set your money goal or number of spots'); setStep('price'); return }

    setCreating(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('dips')
      .insert([{
        user_id: currentUserId,
        wrap_id: wrapId || null,
        title: `${brand} ${wrapName}`.trim(),
        brand: brand || null,
        wrap_name: wrapName.trim(),
        total_spots: resolvedDips,
        price_per_spot: mainPrice,
        total_value: totalValue,
        likes_required: likesRequired,
        current_likes: 0,
        payment_trigger_percent: 100,
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
        facebook_group: 'Chasing Unicorns',
        wrap_value: numericGoal || null, // "Money goal" (column name is legacy)
      }])
      .select()
      .single()

    setCreating(false)

    if (insertError || !data) {
      setError(insertError?.message || 'Could not create dip')
      return
    }

    if (feedbackHubLink) {
      await supabase
        .from('profiles')
        .update({ feedback_hub_link: feedbackHubLink } as any)
        .eq('id', currentUserId)
    }

    router.push(`/dips/${data.id}`)
  }

  // ⓘ button + explainer text
  const infoButton = (key: string, label: string) => (
    <button
      type="button"
      onClick={() => setOpenInfo(openInfo === key ? null : key)}
      aria-expanded={openInfo === key}
      aria-label={`What is ${label}?`}
      className="-my-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-base text-pink-600"
    >
      ⓘ
    </button>
  )
  const infoText = (key: string) =>
    openInfo === key ? (
      <p className="rounded-xl bg-pink-50 px-3 py-2 text-sm text-pink-900">{INFO[key]}</p>
    ) : null

  const inputClass = 'min-h-[44px] w-full rounded-xl border px-3 py-2.5 text-[16px] outline-none focus:border-pink-500'
  const randomOrgReminder = isOver2000 ? (
    <div className="rounded-xl bg-amber-50 border border-amber-300 px-4 py-3 text-sm font-semibold text-amber-900">
      ⚠️ Over $2000 — the draw must use Random.org (+$4.95) and a Google Sheet is required.
    </div>
  ) : null

  const steps: { key: Step; label: string; enabled: boolean }[] = [
    { key: 'wrap', label: 'Wrap', enabled: true },
    { key: 'price', label: 'Price', enabled: wrapStepDone },
    { key: 'details', label: 'Details', enabled: wrapStepDone && priceStepDone },
  ]

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5 pb-28">

        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="min-h-[44px] rounded-xl border px-3 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
          <h1 className="text-xl font-bold text-gray-900">🎲 Start a Dip</h1>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {steps.map((s, i) => (
            <button
              key={s.key}
              type="button"
              onClick={() => s.enabled && setStep(s.key)}
              disabled={!s.enabled}
              className={`min-h-[44px] rounded-xl text-sm font-semibold transition ${
                step === s.key ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white' : 'bg-gray-100 text-gray-600 disabled:text-gray-400'
              }`}
            >
              {i + 1}. {s.label}
            </button>
          ))}
        </div>

        {/* STEP 1 — WRAP */}
        {step === 'wrap' && (
          <div className="space-y-4">
            {wrapName && !showPicker && !manualWrap ? (
              <div className="rounded-2xl border-2 border-pink-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-pink-600">Dipping</p>
                <p className="text-lg font-bold text-gray-900">{`${brand} ${wrapName}`.trim()}</p>
                <button
                  type="button"
                  onClick={() => setShowPicker(true)}
                  className="mt-1 min-h-[44px] text-sm font-semibold text-pink-700 underline"
                >
                  Choose a different wrap
                </button>
              </div>
            ) : manualWrap ? (
              <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                <h2 className="font-bold text-gray-900">Wrap not in your collection</h2>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Wrap name</label>
                  <input value={wrapName} onChange={(e) => setWrapName(e.target.value)} placeholder="e.g. Shore Thang" className={inputClass} autoFocus />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Brand <span className="font-normal text-gray-400">— optional</span></label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Luna Cocoon" className={inputClass} />
                </div>
                <button
                  type="button"
                  onClick={() => { setManualWrap(false); setShowPicker(true) }}
                  className="min-h-[44px] text-sm font-semibold text-pink-700 underline"
                >
                  Pick from my collection instead
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="font-bold text-gray-900">Which wrap are you dipping?</h2>
                {availableWraps.length === 0 ? (
                  <p className="text-sm text-gray-500">No wraps in your collection yet.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {availableWraps.map(w => {
                      const img = getCoverImage(w.wrap_images)?.image_url
                      const selected = String(w.id) === String(wrapId)
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => pickWrap(w)}
                          className={`overflow-hidden rounded-xl border-2 bg-white text-left ${selected ? 'border-pink-500' : 'border-transparent shadow-sm'}`}
                        >
                          {img ? (
                            <img src={img} alt={w.name} loading="lazy" className="aspect-square w-full object-cover object-[center_30%]" />
                          ) : (
                            <div className="flex aspect-square w-full items-center justify-center bg-pink-50 text-2xl">🧣</div>
                          )}
                          <div className="p-1.5">
                            <p className="line-clamp-2 text-xs font-semibold text-gray-900">{w.name}</p>
                            {w.brand && <p className="line-clamp-1 text-[11px] text-gray-500">{w.brand}</p>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
                <button
                  type="button"
                  onClick={startManualWrap}
                  className="min-h-[48px] w-full rounded-xl border-2 border-dashed border-gray-300 bg-white text-sm font-semibold text-gray-700"
                >
                  ✏️ Not in my collection — type a name
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setStep('price')}
              disabled={!wrapStepDone}
              className="min-h-[52px] w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-base font-bold text-white disabled:opacity-40"
            >
              Next: Price →
            </button>
          </div>
        )}

        {/* STEP 2 — PRICE */}
        {step === 'price' && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <div>
                <div className="flex items-center gap-1">
                  <label htmlFor="moneyGoal" className="text-base font-bold text-gray-900">Money goal (USD)</label>
                  {infoButton('moneyGoal', 'Money goal')}
                </div>
                {infoText('moneyGoal')}
                {purchasePrice && (
                  <p className="mb-2 mt-1 text-sm text-gray-600">📌 You paid {purchaseCurrency} ${purchasePrice} for this wrap.</p>
                )}
                <input
                  id="moneyGoal"
                  type="number"
                  inputMode="decimal"
                  value={moneyGoal}
                  onChange={(e) => setMoneyGoal(e.target.value)}
                  placeholder="e.g. 800"
                  className={inputClass}
                />
              </div>

              {resolvedDips > 0 && (
                <div className="rounded-xl bg-pink-50 p-3 space-y-1">
                  <p className="text-base font-bold text-gray-900">
                    Suggested: {resolvedDips} spots × ${mainPrice} = ${totalValue} USD
                  </p>
                  <p className="text-sm text-gray-700">Likes target: {likesRequired}</p>
                  {numericGoal > 0 && <p className="text-sm text-gray-700">Estimated return: <span className="font-semibold text-green-700">${estimatedReturn} USD</span></p>}
                </div>
              )}

              {randomOrgReminder}

              <button
                type="button"
                onClick={() => setShowAdjust(v => !v)}
                aria-expanded={showAdjust}
                className="flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3 text-sm font-semibold text-gray-800"
              >
                Adjust prices
                <span className="text-gray-400">{showAdjust ? '▴' : '▾'}</span>
              </button>

              {showAdjust && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Main ticket price (USD)</label>
                    <input type="number" inputMode="decimal" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} placeholder="30" className={inputClass} />
                    <p className="mt-1 text-xs text-gray-500">Changing this recalculates the LS and bookend prices.</p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">Number of spots</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTotalDips(String(Math.max(1, (Number(totalDips) || calculatedDips || 1) - 1)))}
                        className="h-11 w-11 rounded-xl border bg-white text-lg font-bold text-gray-700"
                        aria-label="Fewer spots"
                      >
                        −
                      </button>
                      <span className="w-12 text-center text-base font-bold text-gray-900">{resolvedDips}</span>
                      <button
                        type="button"
                        onClick={() => setTotalDips(String((Number(totalDips) || calculatedDips || 0) + 1))}
                        className="h-11 w-11 rounded-xl border bg-white text-lg font-bold text-gray-700"
                        aria-label="More spots"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-gray-700">Liker Specials (LS)</p>
                      {infoButton('ls', 'Liker Specials')}
                    </div>
                    {infoText('ls')}
                    {lsTiers.map((tier, i) => (
                      <div key={tier.spots} className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-gray-700">LS {tier.spots} ({tier.spots} spot{tier.spots > 1 ? 's' : ''})</span>
                        <div className="flex items-center gap-1">
                          <span className="text-gray-400">$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={lsOverrides[i] !== undefined ? lsOverrides[i] : tier.price}
                            onChange={(e) => setLsOverrides(prev => ({ ...prev, [i]: e.target.value }))}
                            className="min-h-[44px] w-24 rounded-lg border bg-white px-2 text-center text-[16px] font-semibold outline-none focus:border-pink-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-xl bg-gray-50 p-3 space-y-2">
                    <div className="flex items-center gap-1">
                      <p className="text-sm font-semibold text-gray-700">Bookend (spots 1 & {resolvedDips || 'last'}), each</p>
                      {infoButton('bookend', 'Bookend')}
                    </div>
                    {infoText('bookend')}
                    <div className="flex items-center justify-end gap-1">
                      <span className="text-gray-400">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        value={bePriceOverride !== '' ? bePriceOverride : bePriceCalculated}
                        onChange={(e) => setBePriceOverride(e.target.value)}
                        className="min-h-[44px] w-24 rounded-lg border bg-white px-2 text-center text-[16px] font-semibold outline-none focus:border-pink-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowConvert(v => !v)}
                aria-expanded={showConvert}
                className="flex min-h-[48px] w-full items-center justify-between rounded-xl border px-3 text-sm font-semibold text-gray-800"
              >
                💱 Convert currency
                <span className="text-gray-400">{showConvert ? '▴' : '▾'}</span>
              </button>

              {showConvert && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
                      <select value={calcFrom} onChange={(e) => { setCalcFrom(e.target.value); setCalcResult(null) }} className={inputClass}>
                        {CALC_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
                      <select value={calcTo} onChange={(e) => { setCalcTo(e.target.value); setCalcResult(null) }} className={inputClass}>
                        {CALC_CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={calcAmount}
                    onChange={(e) => { setCalcAmount(e.target.value); setCalcResult(null) }}
                    placeholder="Amount, e.g. 30"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={handleConvert}
                    disabled={calcLoading || !calcAmount}
                    className="min-h-[44px] w-full rounded-xl border-2 border-pink-300 text-sm font-bold text-pink-700 disabled:opacity-40"
                  >
                    {calcLoading ? 'Converting...' : 'Convert'}
                  </button>
                  {calcResult !== null && calcRate !== null && (
                    <div className="rounded-xl bg-pink-50 p-3 text-center">
                      <p className="text-2xl font-bold text-pink-700">
                        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: calcTo, maximumFractionDigits: 2 }).format(calcResult)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">1 {calcFrom} = {calcRate.toFixed(4)} {calcTo}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('wrap')} className="min-h-[52px] flex-1 rounded-2xl border text-sm font-semibold text-gray-700">← Back</button>
              <button
                type="button"
                onClick={() => setStep('details')}
                disabled={!priceStepDone}
                className="min-h-[52px] flex-[2] rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-base font-bold text-white disabled:opacity-40"
              >
                Next: Details →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3 — DETAILS */}
        {step === 'details' && (
          <div className="space-y-4">
            <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
              <p className="text-sm text-gray-600">Only the wrap name is required — everything else is optional and used in your posts.</p>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Wrap name <span className="text-rose-600">*</span></label>
                <input value={wrapName} onChange={(e) => setWrapName(e.target.value)} placeholder="e.g. Shore Thang" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Brand</label>
                <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Luna Cocoon" className={inputClass} />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium text-gray-700">Size / STIH</label>
                  {infoButton('stih', 'Size / STIH')}
                </div>
                {infoText('stih')}
                <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. Size 6" className={inputClass} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Blend</label>
                <input value={blend} onChange={(e) => setBlend(e.target.value)} placeholder="e.g. 100% cotton" className={inputClass} />
              </div>
              <div>
                <div className="flex items-center gap-1">
                  <label className="text-sm font-medium text-gray-700">Condition</label>
                  {infoButton('condition', 'the condition codes')}
                </div>
                {infoText('condition')}
                <select value={condition} onChange={(e) => setCondition(e.target.value)} className={inputClass}>
                  <option value="EUC">EUC — excellent</option>
                  <option value="VVGUC">VVGUC — very very good</option>
                  <option value="VGUC">VGUC — very good</option>
                  <option value="GUC">GUC — good</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shipping credit (USD)</label>
                  <input type="number" inputMode="decimal" value={shippingCredit} onChange={(e) => setShippingCredit(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Shipping from</label>
                  <input value={shippingFrom} onChange={(e) => setShippingFrom(e.target.value)} placeholder="e.g. Australia" className={inputClass} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Babywearing Feedback Hub link</label>
                <input value={feedbackHubLink} onChange={(e) => setFeedbackHubLink(e.target.value)} placeholder="https://..." className={inputClass} />
                <p className="mt-1 text-xs text-gray-500">Required by CU rules. Saved to your profile for future dips.</p>
              </div>
              <div className="flex flex-wrap gap-x-6">
                <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={smokeFree} onChange={(e) => setSmokeFree(e.target.checked)} className="h-5 w-5" />
                  Smoke free
                </label>
                <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={petFree} onChange={(e) => setPetFree(e.target.checked)} className="h-5 w-5" />
                  Pet free
                </label>
              </div>
            </div>

            <div className="rounded-2xl bg-pink-50 p-3 text-sm text-gray-800">
              <p className="font-bold">{`${brand} ${wrapName}`.trim() || 'Your wrap'}</p>
              <p>{resolvedDips} spots × ${mainPrice} · Likes target {likesRequired}{numericGoal > 0 ? ` · Money goal $${numericGoal}` : ''}</p>
            </div>

            {randomOrgReminder}

            {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('price')} className="min-h-[52px] flex-1 rounded-2xl border text-sm font-semibold text-gray-700">← Back</button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !wrapName.trim()}
                className="min-h-[52px] flex-[2] rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-base font-bold text-white disabled:opacity-50"
              >
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
