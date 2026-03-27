'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import AppLayout from '@/app/components/AppLayout'

export default function CreateDip() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [totalSpots, setTotalSpots] = useState('')
  const [pricePerSpot, setPricePerSpot] = useState('')
  const [likesRequired, setLikesRequired] = useState('')
  const [paymentTriggerPercent, setPaymentTriggerPercent] = useState('80')
  const [paymentWindowHours, setPaymentWindowHours] = useState('24')
  const [shippingTimeframeDays, setShippingTimeframeDays] = useState('3')
  const [message, setMessage] = useState('')
  const [creating, setCreating] = useState(false)

  const numericTotalSpots = Number(totalSpots) || 0
  const numericPricePerSpot = Number(pricePerSpot) || 0
  const totalValue = Number((numericTotalSpots * numericPricePerSpot).toFixed(2))

  const calculatedLikes = useMemo(() => {
    if (!numericTotalSpots) return ''
    return String(Math.round(numericTotalSpots * 0.33))
  }, [numericTotalSpots])

  const resolvedLikesRequired =
    likesRequired.trim() !== '' ? Number(likesRequired) : Number(calculatedLikes || 0)

  const handleCreateDip = async () => {
    setMessage('')

    if (!title.trim()) return setMessage('Enter dip title')
    if (!numericTotalSpots || numericTotalSpots < 1)
      return setMessage('Enter valid spots')
    if (!numericPricePerSpot || numericPricePerSpot <= 0)
      return setMessage('Enter valid price')

    setCreating(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setCreating(false)
      return setMessage('Not logged in')
    }

    const { data, error } = await supabase
      .from('dips')
      .insert([
        {
          user_id: user.id,
          title: title.trim(),
          total_spots: numericTotalSpots,
          price_per_spot: numericPricePerSpot,
          total_value: totalValue,
          likes_required: resolvedLikesRequired || null,
          current_likes: 0,
          payment_trigger_percent: Number(paymentTriggerPercent),
          payment_window_hours: Number(paymentWindowHours),
          shipping_timeframe_days: Number(shippingTimeframeDays),
          is_ready_for_draw: false,
          status: 'interest',
          stage: 'interest',
        },
      ])
      .select()
      .single()

    setCreating(false)

    if (error) return setMessage(error.message)

    window.location.href = `/dips/${data.id}`
  }

  return (
    <AppLayout>
      <div className="max-w-2xl">

        <h1 className="text-3xl font-bold mb-6">Create Dip</h1>

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">

          {/* Basic */}
          <div>
            <h2 className="font-semibold mb-3">Basic Info</h2>

            <input
              placeholder="Dip Title"
              className="w-full p-3 border rounded-xl mb-3"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              type="number"
              placeholder="Total Spots"
              className="w-full p-3 border rounded-xl mb-3"
              value={totalSpots}
              onChange={(e) => setTotalSpots(e.target.value)}
            />

            <input
              type="number"
              placeholder="Price Per Spot"
              className="w-full p-3 border rounded-xl"
              value={pricePerSpot}
              onChange={(e) => setPricePerSpot(e.target.value)}
            />
          </div>

          {/* Rules */}
          <div>
            <h2 className="font-semibold mb-3">Rules</h2>

            <input
              type="number"
              placeholder="Likes Required"
              className="w-full p-3 border rounded-xl mb-3"
              value={likesRequired || calculatedLikes}
              onChange={(e) => setLikesRequired(e.target.value)}
            />

            <input
              type="number"
              placeholder="Payment Trigger %"
              className="w-full p-3 border rounded-xl mb-3"
              value={paymentTriggerPercent}
              onChange={(e) => setPaymentTriggerPercent(e.target.value)}
            />

            <input
              type="number"
              placeholder="Payment Window (hours)"
              className="w-full p-3 border rounded-xl mb-3"
              value={paymentWindowHours}
              onChange={(e) => setPaymentWindowHours(e.target.value)}
            />

            <input
              type="number"
              placeholder="Shipping Timeframe (days)"
              className="w-full p-3 border rounded-xl"
              value={shippingTimeframeDays}
              onChange={(e) => setShippingTimeframeDays(e.target.value)}
            />
          </div>

          {/* Summary */}
          <div>
            <h2 className="font-semibold mb-3">Summary</h2>
            <p className="text-sm text-gray-600">
              Total value: ${totalValue.toFixed(2)}
            </p>
          </div>

          <button
            onClick={handleCreateDip}
            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white p-3 rounded-xl"
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create Dip'}
          </button>

          {message && <p className="text-sm text-center">{message}</p>}
        </div>
      </div>
    </AppLayout>
  )
}