'use client'

import { supabase } from '@/lib/supabase'
import { use, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import AppLayout from '@/app/components/AppLayout'

type Dip = {
  id: string
  title: string
  total_spots: number
  price_per_spot: number
  total_value: number | null
  stage: string
  status: string | null
  payment_trigger_percent: number
  payment_window_hours: number
  likes_required: number | null
  current_likes: number | null
  draw_method: string | null
  shipping_timeframe_days: number | null
  is_ready_for_draw: boolean | null
  payment_requests_started_at: string | null
  closed_at: string | null
  winning_number: number | null
  winner_name: string | null
  drawn_at: string | null
}

type Entry = {
  id: string
  entrant_name: string
  spots: number[]
  payment_status: string
  created_at?: string
}

type Payment = {
  id: string
  entry_id: string
  status: string
  amount_due: number
  amount_paid: number
  requested_at: string | null
  due_at: string | null
  paid_at: string | null
  payment_reference: string | null
  notes: string | null
}

type TabKey = 'overview' | 'entries' | 'payments' | 'result'

export default function DipDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [dip, setDip] = useState<Dip | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  const [entrantName, setEntrantName] = useState('')
  const [spotInput, setSpotInput] = useState('')
  const [entryMessage, setEntryMessage] = useState('')

  const [paymentMessage, setPaymentMessage] = useState('')

  const [likesInput, setLikesInput] = useState('')
  const [resultMessage, setResultMessage] = useState('')
  const [winningNumberInput, setWinningNumberInput] = useState('')

  const loadDip = async () => {
    setLoading(true)

    const { data: dipData, error: dipError } = await supabase
      .from('dips')
      .select('*')
      .eq('id', id)
      .single()

    if (dipError || !dipData) {
      setDip(null)
      setEntries([])
      setPayments([])
      setLoading(false)
      return
    }

    setDip(dipData)

    const { data: entryData } = await supabase
      .from('entries')
      .select('*')
      .eq('dip_id', id)
      .order('created_at', { ascending: true })

    const safeEntries = entryData || []
    setEntries(safeEntries)

    const entryIds = safeEntries.map((entry) => entry.id)

    if (entryIds.length > 0) {
      const { data: paymentData } = await supabase
        .from('payments')
        .select('*')
        .in('entry_id', entryIds)
        .order('created_at', { ascending: true })

      setPayments(paymentData || [])
    } else {
      setPayments([])
    }

    setLikesInput(String(dipData.current_likes || 0))
    setWinningNumberInput(dipData.winning_number ? String(dipData.winning_number) : '')
    setLoading(false)
  }

  useEffect(() => {
    loadDip()
  }, [id])

  const filledSpots = useMemo(() => {
    return entries.reduce((total, entry) => total + (entry.spots?.length || 0), 0)
  }, [entries])

  const totalAmount = useMemo(() => {
    if (!dip) return 0
    return Number(((dip.total_value ?? dip.total_spots * dip.price_per_spot)).toFixed(2))
  }, [dip])

  const filledPercent = useMemo(() => {
    if (!dip || dip.total_spots === 0) return 0
    return Math.round((filledSpots / dip.total_spots) * 100)
  }, [dip, filledSpots])

  const likesPercent = useMemo(() => {
    if (!dip || !dip.likes_required) return 0
    return Math.min(
      100,
      Math.round(((dip.current_likes || 0) / dip.likes_required) * 100)
    )
  }, [dip])

  const unpaidEntries = useMemo(() => {
    return entries.filter((entry) => entry.payment_status !== 'paid').length
  }, [entries])

  const paidEntries = useMemo(() => {
    return entries.filter((entry) => entry.payment_status === 'paid').length
  }, [entries])

  const paymentTriggerReached = useMemo(() => {
    if (!dip) return false
    return filledPercent >= (dip.payment_trigger_percent || 80)
  }, [dip, filledPercent])

  const paymentProgressPercent = useMemo(() => {
    if (entries.length === 0) return 0
    return Math.round((paidEntries / entries.length) * 100)
  }, [entries.length, paidEntries])

  const allUsedSpots = useMemo(() => {
    return entries.flatMap((entry) => entry.spots || [])
  }, [entries])

  const remainingSpots = useMemo(() => {
    if (!dip) return []
    const remaining: number[] = []

    for (let i = 1; i <= dip.total_spots; i += 1) {
      if (!allUsedSpots.includes(i)) {
        remaining.push(i)
      }
    }

    return remaining
  }, [dip, allUsedSpots])

  const paymentMap = useMemo(() => {
    return payments.reduce<Record<string, Payment>>((acc, payment) => {
      acc[payment.entry_id] = payment
      return acc
    }, {})
  }, [payments])

  const overduePayments = useMemo(() => {
    const now = new Date()

    return payments.filter((payment) => {
      if (!payment.due_at) return false
      if (payment.status === 'paid') return false
      return new Date(payment.due_at) < now
    }).length
  }, [payments])

  const allPaymentsReceived = useMemo(() => {
    return entries.length > 0 && entries.every((entry) => entry.payment_status === 'paid')
  }, [entries])

  const isSoldOut = useMemo(() => {
    if (!dip) return false
    return filledSpots >= dip.total_spots
  }, [dip, filledSpots])

  const canBeReadyForDraw = useMemo(() => {
    if (!dip) return false
    return isSoldOut && allPaymentsReceived && overduePayments === 0
  }, [dip, isSoldOut, allPaymentsReceived, overduePayments])

  const nextAction = useMemo(() => {
    if (!dip) return ''

    if ((dip.current_likes || 0) < (dip.likes_required || 0)) {
      const remainingLikes = Math.max((dip.likes_required || 0) - (dip.current_likes || 0), 0)
      return `${remainingLikes} more likes needed`
    }

    if (filledSpots === 0) return 'Start adding entries'

    if (!paymentTriggerReached) {
      const needed = Math.max(dip.payment_trigger_percent - filledPercent, 0)
      return `Need ${needed}% more before payments can start`
    }

    if (overduePayments > 0) {
      return `${overduePayments} overdue payment${overduePayments === 1 ? '' : 's'}`
    }

    if (unpaidEntries > 0) {
      return `${unpaidEntries} unpaid entr${unpaidEntries === 1 ? 'y' : 'ies'}`
    }

    if (!isSoldOut) {
      return `${dip.total_spots - filledSpots} spots still to fill`
    }

    if (canBeReadyForDraw && !dip.is_ready_for_draw) {
      return 'Ready for admin draw'
    }

    if (dip.is_ready_for_draw && !dip.winning_number) {
      return 'Record winning number'
    }

    if (dip.winning_number) {
      return 'Dip complete'
    }

    return 'All checks looking good'
  }, [
    dip,
    filledSpots,
    filledPercent,
    paymentTriggerReached,
    overduePayments,
    unpaidEntries,
    isSoldOut,
    canBeReadyForDraw,
  ])

  const statusLabel = useMemo(() => {
    if (!dip) return ''
    if (dip.winning_number) return 'drawn'
    if (dip.is_ready_for_draw) return 'ready_for_draw'
    if (overduePayments > 0) return 'payment_overdue'
    if (paymentTriggerReached) return 'payment_phase'
    if ((dip.current_likes || 0) < (dip.likes_required || 0)) return 'interest'
    if (!isSoldOut) return 'live'
    return 'active'
  }, [dip, overduePayments, paymentTriggerReached, isSoldOut])

  const statusBadgeClasses = useMemo(() => {
    if (statusLabel === 'drawn') return 'bg-green-100 text-green-800'
    if (statusLabel === 'ready_for_draw') return 'bg-blue-100 text-blue-800'
    if (statusLabel === 'payment_overdue') return 'bg-red-100 text-red-800'
    if (statusLabel === 'payment_phase') return 'bg-amber-100 text-amber-800'
    if (statusLabel === 'interest') return 'bg-purple-100 text-purple-800'
    return 'bg-gray-100 text-gray-800'
  }, [statusLabel])

  const getSpotState = (spotNumber: number) => {
    const entry = entries.find((item) => item.spots?.includes(spotNumber))

    if (!entry) return 'available'
    if (entry.payment_status === 'paid') return 'paid'
    return 'reserved'
  }

  const getSpotClasses = (spotNumber: number) => {
    const state = getSpotState(spotNumber)

    if (state === 'paid') {
      return 'bg-green-100 border-green-300 text-green-800'
    }

    if (state === 'reserved') {
      return 'bg-amber-100 border-amber-300 text-amber-800'
    }

    return 'bg-white border-gray-200 text-gray-700'
  }

  const handleAddEntry = async () => {
    setEntryMessage('')

    if (!entrantName.trim()) {
      setEntryMessage('Enter entrant name')
      return
    }

    const spots = Array.from(
      new Set(
        spotInput
          .split(',')
          .map((spot) => Number(spot.trim()))
          .filter((spot) => !Number.isNaN(spot))
      )
    )

    if (spots.length === 0) {
      setEntryMessage('Enter at least one valid spot number')
      return
    }

    if (!dip) {
      setEntryMessage('Dip not loaded')
      return
    }

    const hasOutOfRangeSpot = spots.some((spot) => spot < 1 || spot > dip.total_spots)

    if (hasOutOfRangeSpot) {
      setEntryMessage(`Spot numbers must be between 1 and ${dip.total_spots}`)
      return
    }

    const duplicateSpot = spots.find((spot) => allUsedSpots.includes(spot))

    if (duplicateSpot) {
      setEntryMessage(`Spot ${duplicateSpot} is already taken`)
      return
    }

    const { data: newEntry, error: entryError } = await supabase
      .from('entries')
      .insert([
        {
          dip_id: id,
          entrant_name: entrantName.trim(),
          spots,
          payment_status: 'unpaid',
        },
      ])
      .select()
      .single()

    if (entryError || !newEntry) {
      setEntryMessage(entryError?.message || 'Could not add entry')
      return
    }

    const amountDue = Number((spots.length * dip.price_per_spot).toFixed(2))

    const { error: paymentError } = await supabase.from('payments').insert([
      {
        entry_id: newEntry.id,
        status: 'unpaid',
        amount_due: amountDue,
        amount_paid: 0,
      },
    ])

    if (paymentError) {
      setEntryMessage(paymentError.message)
      return
    }

    setEntrantName('')
    setSpotInput('')
    setEntryMessage('Entry added')
    await loadDip()
  }

  const handleMarkPaid = async (entryId: string) => {
    setPaymentMessage('')

    const entry = entries.find((item) => item.id === entryId)
    const payment = paymentMap[entryId]

    if (!entry || !payment) {
      setPaymentMessage('Payment record not found')
      return
    }

    const now = new Date().toISOString()
    const amountPaid = Number(
      (entry.spots.length * (dip?.price_per_spot || 0)).toFixed(2)
    )

    const { error: entryError } = await supabase
      .from('entries')
      .update({ payment_status: 'paid' })
      .eq('id', entryId)

    if (entryError) {
      setPaymentMessage(entryError.message)
      return
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        status: 'paid',
        amount_paid: amountPaid,
        paid_at: now,
      })
      .eq('entry_id', entryId)

    if (paymentError) {
      setPaymentMessage(paymentError.message)
      return
    }

    setPaymentMessage('Payment marked as paid')
    await loadDip()
  }

  const handleRequestPayments = async () => {
    setPaymentMessage('')

    if (!dip) {
      setPaymentMessage('Dip not loaded')
      return
    }

    if (!paymentTriggerReached) {
      setPaymentMessage(
        `Payments should begin at ${dip.payment_trigger_percent}% full`
      )
      return
    }

    const now = new Date()
    const due = new Date(
      now.getTime() + dip.payment_window_hours * 60 * 60 * 1000
    )

    const unpaidEntryIds = entries
      .filter((entry) => entry.payment_status !== 'paid')
      .map((entry) => entry.id)

    if (unpaidEntryIds.length === 0) {
      setPaymentMessage('No unpaid entries to request')
      return
    }

    const { error: paymentError } = await supabase
      .from('payments')
      .update({
        requested_at: now.toISOString(),
        due_at: due.toISOString(),
      })
      .in('entry_id', unpaidEntryIds)

    if (paymentError) {
      setPaymentMessage(paymentError.message)
      return
    }

    await supabase
      .from('dips')
      .update({
        payment_requests_started_at: now.toISOString(),
        status: 'payment_phase',
        stage: 'payment_phase',
      })
      .eq('id', id)

    setPaymentMessage('Payment requests started')
    await loadDip()
  }

  const handleSaveLikes = async () => {
    setResultMessage('')

    const nextLikes = Number(likesInput)

    if (Number.isNaN(nextLikes) || nextLikes < 0) {
      setResultMessage('Enter a valid likes count')
      return
    }

    const { error } = await supabase
      .from('dips')
      .update({
        current_likes: nextLikes,
        status: nextLikes >= (dip?.likes_required || 0) ? 'live' : 'interest',
        stage: nextLikes >= (dip?.likes_required || 0) ? 'live' : 'interest',
      })
      .eq('id', id)

    if (error) {
      setResultMessage(error.message)
      return
    }

    setResultMessage('Likes updated')
    await loadDip()
  }

  const handleMarkReadyForDraw = async () => {
    setResultMessage('')

    if (!canBeReadyForDraw) {
      setResultMessage('Dip is not ready for draw yet')
      return
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('dips')
      .update({
        is_ready_for_draw: true,
        status: 'ready_for_draw',
        stage: 'ready_for_draw',
        closed_at: now,
      })
      .eq('id', id)

    if (error) {
      setResultMessage(error.message)
      return
    }

    setResultMessage('Dip marked ready for admin draw')
    await loadDip()
  }

  const handleSaveResult = async () => {
    setResultMessage('')

    if (!dip) return

    const winningNumber = Number(winningNumberInput)

    if (Number.isNaN(winningNumber) || winningNumber < 1 || winningNumber > dip.total_spots) {
      setResultMessage(`Enter a winning number between 1 and ${dip.total_spots}`)
      return
    }

    const winningEntry = entries.find((entry) => entry.spots.includes(winningNumber))

    if (!winningEntry) {
      setResultMessage('No entrant owns that number')
      return
    }

    const now = new Date().toISOString()

    const { error } = await supabase
      .from('dips')
      .update({
        winning_number: winningNumber,
        winner_name: winningEntry.entrant_name,
        drawn_at: now,
        status: 'drawn',
        stage: 'drawn',
      })
      .eq('id', id)

    if (error) {
      setResultMessage(error.message)
      return
    }

    setResultMessage('Result saved')
    await loadDip()
  }

  if (loading) {
    return (
      <AppLayout>
        <div>Loading...</div>
      </AppLayout>
    )
  }

    if (!dip) {
    return (
      <AppLayout>
        <div>Dip not found</div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/dashboard')}
              className="border border-gray-300 rounded-xl px-4 py-2 hover:bg-gray-100"
            >
              Back to Dashboard
            </button>

            <button
              onClick={async () => {
                const confirmDelete = confirm('Delete this dip? This cannot be undone.')

                if (!confirmDelete) return

                await supabase.from('payments').delete().in(
                  'entry_id',
                  entries.map((e) => e.id)
                )

                await supabase.from('entries').delete().eq('dip_id', id)

                await supabase.from('dips').delete().eq('id', id)

                router.push('/dashboard')
              }}
              className="border border-red-300 text-red-700 rounded-xl px-4 py-2 hover:bg-red-50"
            >
              Delete Dip
            </button>
          </div>

          <span className={`text-sm px-3 py-1 rounded-full ${statusBadgeClasses}`}>
            {statusLabel}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-3 bg-white rounded-2xl shadow-sm border p-5">
            <h1 className="text-3xl font-bold mb-2">{dip.title}</h1>
            <p className="text-sm text-gray-600 mb-3">Next action: {nextAction}</p>

            <div className="mt-2 p-3 rounded-xl bg-yellow-100 text-sm">
              {canBeReadyForDraw
                ? 'All checks complete — ready for admin draw'
                : paymentTriggerReached
                ? overduePayments > 0
                  ? `${overduePayments} payment${overduePayments === 1 ? '' : 's'} overdue`
                  : 'Payments can now be requested or completed'
                : `Dip is ${filledPercent}% full`}
            </div>

            <div className="grid gap-3 md:grid-cols-4 mt-4">
              <div className="border rounded-xl p-4">
                <p className="text-sm text-gray-500">Spots filled</p>
                <p className="text-2xl font-bold">
                  {filledSpots} / {dip.total_spots}
                </p>
              </div>

              <div className="border rounded-xl p-4">
                <p className="text-sm text-gray-500">Paid entries</p>
                <p className="text-2xl font-bold">{paidEntries}</p>
              </div>

              <div className="border rounded-xl p-4">
                <p className="text-sm text-gray-500">Unpaid entries</p>
                <p className="text-2xl font-bold">{unpaidEntries}</p>
              </div>

              <div className="border rounded-xl p-4">
                <p className="text-sm text-gray-500">Total value</p>
                <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border p-5">
            <p className="text-sm text-gray-500 mb-2">Progress</p>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Likes</span>
                <span>{likesPercent}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                  style={{ width: `${likesPercent}%` }}
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Spots</span>
                <span>{filledPercent}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                  style={{ width: `${filledPercent}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Payments</span>
                <span>{paymentProgressPercent}%</span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                  style={{ width: `${paymentProgressPercent}%` }}
                />
              </div>
            </div>

            <div className="mt-4 text-sm text-gray-600 space-y-1">
              <p>Likes required: {dip.likes_required || 'Not set'}</p>
              <p>Current likes: {dip.current_likes || 0}</p>
              <p>Payment trigger: {dip.payment_trigger_percent}% full</p>
              <p>Payment window: {dip.payment_window_hours} hours</p>
              <p>
                Draw method:{' '}
                {dip.draw_method === 'random_org'
                  ? 'Random.org draw'
                  : dip.draw_method === 'admin_live'
                  ? 'Live admin draw'
                  : 'Not set'}
              </p>
              <p>
                Shipping: {dip.shipping_timeframe_days || 'Not set'} days
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-2">
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-sm ${
                activeTab === 'overview'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Overview
            </button>

            <button
              onClick={() => setActiveTab('entries')}
              className={`px-4 py-2 rounded-xl text-sm ${
                activeTab === 'entries'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Entries
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2 rounded-xl text-sm ${
                activeTab === 'payments'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Payments
            </button>

            <button
              onClick={() => setActiveTab('result')}
              className={`px-4 py-2 rounded-xl text-sm ${
                activeTab === 'result'
                  ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white'
                  : 'bg-gray-100 text-gray-700'
              }`}
            >
              Result
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-xl font-semibold mb-4">Compliance</h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between border-b pb-2">
                  <span>Likes reached</span>
                  <span className="font-medium">
                    {(dip.current_likes || 0) >= (dip.likes_required || 0) ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span>Payment trigger reached</span>
                  <span className="font-medium">
                    {paymentTriggerReached ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span>All spots filled</span>
                  <span className="font-medium">{isSoldOut ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span>All payments received</span>
                  <span className="font-medium">
                    {allPaymentsReceived ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span>Overdue payments</span>
                  <span className="font-medium">{overduePayments}</span>
                </div>
                <div className="flex justify-between">
                  <span>Ready for admin draw</span>
                  <span className="font-medium">
                    {dip.is_ready_for_draw ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <input
                  type="number"
                  value={likesInput}
                  onChange={(e) => setLikesInput(e.target.value)}
                  className="border rounded-xl px-3 py-2"
                  placeholder="Current likes"
                />
                <button
                  onClick={handleSaveLikes}
                  className="border border-gray-300 rounded-xl px-4 py-2 hover:bg-gray-100"
                >
                  Save Likes
                </button>
                <button
                  onClick={handleMarkReadyForDraw}
                  disabled={!canBeReadyForDraw}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-2 rounded-xl disabled:opacity-50"
                >
                  Mark Ready for Draw
                </button>
              </div>

              {resultMessage && <p className="mt-3 text-sm">{resultMessage}</p>}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-xl font-semibold mb-4">Remaining Spot Numbers</h2>

              {remainingSpots.length === 0 ? (
                <p className="text-sm text-gray-600">No remaining spots</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {remainingSpots.map((spot) => (
                    <div
                      key={spot}
                      className="border rounded-lg px-3 py-2 text-sm bg-gray-50"
                    >
                      {spot}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'entries' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
              <h2 className="text-xl font-semibold">Add Entry</h2>

              <input
                type="text"
                placeholder="Entrant name"
                className="w-full border rounded-xl p-3"
                value={entrantName}
                onChange={(e) => setEntrantName(e.target.value)}
              />

              <input
                type="text"
                placeholder="Spot numbers e.g. 1, 2, 3"
                className="w-full border rounded-xl p-3"
                value={spotInput}
                onChange={(e) => setSpotInput(e.target.value)}
              />

              <button
                onClick={handleAddEntry}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-3 rounded-xl"
              >
                Add Entry
              </button>

              {entryMessage && <p className="text-sm">{entryMessage}</p>}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-xl font-semibold mb-4">Number Grid</h2>

              <div className="flex gap-3 flex-wrap text-sm mb-4">
                <div className="px-3 py-2 rounded-lg border bg-white">Available</div>
                <div className="px-3 py-2 rounded-lg border bg-amber-100 border-amber-300">
                  Reserved
                </div>
                <div className="px-3 py-2 rounded-lg border bg-green-100 border-green-300">
                  Paid
                </div>
              </div>

              <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                {Array.from({ length: dip.total_spots }, (_, index) => index + 1).map(
                  (spotNumber) => (
                    <div
                      key={spotNumber}
                      className={`border rounded-lg px-2 py-3 text-center text-sm font-medium ${getSpotClasses(
                        spotNumber
                      )}`}
                    >
                      {spotNumber}
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-xl font-semibold mb-4">Entrant List</h2>

              {entries.length === 0 ? (
                <p>No entries yet</p>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => (
                    <div key={entry.id} className="border rounded-xl p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{entry.entrant_name}</p>
                          <p className="text-sm text-gray-600">
                            Spots: {entry.spots.join(', ')}
                          </p>
                        </div>

                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            entry.payment_status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.payment_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Payment Tracker</h2>
                  <p className="text-sm text-gray-600">
                    Start requests once the dip is {dip.payment_trigger_percent}% full
                  </p>
                </div>

                <button
                  onClick={handleRequestPayments}
                  className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-3 rounded-xl"
                >
                  Start Payment Requests
                </button>
              </div>

              {paymentMessage && <p className="mt-3 text-sm">{paymentMessage}</p>}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-5">
              <h2 className="text-xl font-semibold mb-4">Payments</h2>

              {entries.length === 0 ? (
                <p>No entries yet</p>
              ) : (
                <div className="space-y-3">
                  {entries.map((entry) => {
                    const payment = paymentMap[entry.id]
                    const amountDue = Number(
                      (entry.spots.length * dip.price_per_spot).toFixed(2)
                    )

                    const isOverdue =
                      payment?.due_at &&
                      payment?.status !== 'paid' &&
                      new Date(payment.due_at) < new Date()

                    return (
                      <div key={entry.id} className="border rounded-xl p-4">
                        <div className="grid gap-3 md:grid-cols-5 md:items-center">
                          <div>
                            <p className="font-semibold">{entry.entrant_name}</p>
                            <p className="text-sm text-gray-600">
                              Spots: {entry.spots.join(', ')}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-gray-500">Amount due</p>
                            <p className="font-medium">${amountDue}</p>
                          </div>

                          <div>
                            <p className="text-sm text-gray-500">Status</p>
                            <p className="font-medium">
                              {payment?.status || entry.payment_status}
                              {isOverdue ? ' (overdue)' : ''}
                            </p>
                          </div>

                          <div>
                            <p className="text-sm text-gray-500">Request / due</p>
                            <p className="text-xs text-gray-700">
                              {payment?.requested_at
                                ? new Date(payment.requested_at).toLocaleString()
                                : 'Not requested'}
                            </p>
                            <p className="text-xs text-gray-700">
                              {payment?.due_at
                                ? `Due: ${new Date(payment.due_at).toLocaleString()}`
                                : ''}
                            </p>
                          </div>

                          <div className="md:text-right">
                            <button
                              onClick={() => handleMarkPaid(entry.id)}
                              disabled={entry.payment_status === 'paid'}
                              className="border border-gray-300 rounded-xl px-4 py-2 hover:bg-gray-100 disabled:opacity-50"
                            >
                              Mark Paid
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'result' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border p-5 space-y-4">
              <h2 className="text-xl font-semibold">Result</h2>

              <div className="text-sm space-y-2 text-gray-700">
                <p>
                  <strong>Ready for admin draw:</strong>{' '}
                  {dip.is_ready_for_draw ? 'Yes' : 'No'}
                </p>
                <p>
                  <strong>Draw method:</strong>{' '}
                  {dip.draw_method === 'random_org'
                    ? 'Random.org draw'
                    : dip.draw_method === 'admin_live'
                    ? 'Live admin draw'
                    : 'Not set'}
                </p>
                <p>
                  <strong>Winner:</strong> {dip.winner_name || 'Not recorded'}
                </p>
                <p>
                  <strong>Winning number:</strong>{' '}
                  {dip.winning_number || 'Not recorded'}
                </p>
              </div>

              <input
                type="number"
                placeholder="Winning number"
                className="w-full border rounded-xl p-3"
                value={winningNumberInput}
                onChange={(e) => setWinningNumberInput(e.target.value)}
              />

              <button
                onClick={handleSaveResult}
                className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-4 py-3 rounded-xl"
              >
                Save Result
              </button>

              {resultMessage && <p className="text-sm">{resultMessage}</p>}
            </div>
          </div>
        )}

        <div className="sticky bottom-3">
          <div className="bg-white rounded-2xl shadow-lg border p-3 flex gap-2 justify-between">
            <button
              onClick={() => setActiveTab('entries')}
              className="flex-1 border border-gray-300 rounded-xl py-3 hover:bg-gray-100"
            >
              Add Entry
            </button>
            <button
              onClick={() => setActiveTab('payments')}
              className="flex-1 border border-gray-300 rounded-xl py-3 hover:bg-gray-100"
            >
              Mark Paid
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className="flex-1 border border-gray-300 rounded-xl py-3 hover:bg-gray-100"
            >
              Overview
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}