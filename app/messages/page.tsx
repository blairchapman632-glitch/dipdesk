'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/app/components/AppLayout'
import Link from 'next/link'

interface Conversation {
  id: string
  participant_1_id: string
  participant_2_id: string
  last_message: string | null
  last_message_at: string
  has_unread?: boolean
  other_user?: {
    id: string
    full_name: string
    avatar_url: string | null
  }
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showNewMessage, setShowNewMessage] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [userResults, setUserResults] = useState<{id: string, full_name: string, avatar_url: string | null}[]>([])
  const CACHE_KEY = 'wrapapp_conversations_cache'

  useEffect(() => {
    // Show cached conversations instantly
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) {
      try {
        setConversations(JSON.parse(cached))
        setLoading(false)
      } catch {}
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      // Only show spinner if no cache
      if (!cached) setLoading(true)
      await fetchConversations(user.id)
    }
    init()
  }, [])

  const fetchConversations = async (userId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_1_id.eq.${userId},participant_2_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })

    if (error) {
      console.error('Error fetching conversations:', error)
      setLoading(false)
      return
    }

    if (!data || data.length === 0) {
      setConversations([])
      setLoading(false)
      return
    }

    // Collect all other user IDs in one go
    const otherUserIds = data.map((conv) =>
      conv.participant_1_id === userId ? conv.participant_2_id : conv.participant_1_id
    )

    // Fetch profiles and unread messages in parallel
    const [{ data: profiles }, { data: unreadData }] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', otherUserIds),
      supabase
        .from('messages')
        .select('conversation_id')
        .eq('read', false)
        .neq('sender_id', userId)
        .in('conversation_id', data.map(c => c.id))
    ])

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    const unreadConvIds = new Set((unreadData || []).map(m => m.conversation_id))

    const enriched = data.map((conv) => {
      const otherUserId = conv.participant_1_id === userId
        ? conv.participant_2_id
        : conv.participant_1_id
      return {
        ...conv,
        other_user: profileMap[otherUserId] || undefined,
        has_unread: unreadConvIds.has(conv.id)
      }
    })

    setConversations(enriched)
    localStorage.setItem(CACHE_KEY, JSON.stringify(enriched))
    setLoading(false)
  }

  // Message preview without a leading/trailing quote mark (straight or curly)
  const cleanPreview = (text: string | null | undefined) =>
    (text || '').trim().replace(/^["'“”‘’]+/, '').replace(/["'“”‘’]+$/, '').trim()

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (days === 1) return 'Yesterday'
    if (days < 7) return date.toLocaleDateString([], { weekday: 'short' })
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          {/* Same small round pink icon button as WDYWT's + Post */}
          <button
            type="button"
            onClick={() => setShowNewMessage(true)}
            aria-label="New message"
            title="New message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>

        {/* Search */}
        <div className="pb-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search conversations..."
            className="w-full bg-gray-100 rounded-full px-4 py-2 text-[16px] outline-none text-gray-900 placeholder-gray-400"
          />
        </div>

        {/* New message modal */}
        {showNewMessage && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-lg p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-gray-900 text-lg">New Message</h2>
                <button onClick={() => { setShowNewMessage(false); setUserSearch(''); setUserResults([]) }} className="text-gray-400 hover:text-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                value={userSearch}
                onChange={async (e) => {
                  setUserSearch(e.target.value)
                  const term = e.target.value.trim()
                  if (!term) { setUserResults([]); return }
                  const { data } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .ilike('full_name', `%${term}%`)
                    .neq('id', currentUserId)
                    .limit(8)
                  setUserResults(data || [])
                }}
                placeholder="Search for a user..."
                className="w-full bg-gray-100 rounded-full px-4 py-2 text-[16px] outline-none text-gray-900 placeholder-gray-400 mb-3"
                autoFocus
              />
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userResults.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={async () => {
                      const { data: existing } = await supabase
                        .from('conversations')
                        .select('id')
                        .or(`and(participant_1_id.eq.${currentUserId},participant_2_id.eq.${user.id}),and(participant_1_id.eq.${user.id},participant_2_id.eq.${currentUserId})`)
                        .maybeSingle()

                      if (existing) {
                        setShowNewMessage(false)
                        window.location.href = `/messages/${existing.id}`
                        return
                      }

                      const { data: newConv } = await supabase
                        .from('conversations')
                        .insert({
                          participant_1_id: currentUserId,
                          participant_2_id: user.id,
                          last_message: null,
                          last_message_at: new Date().toISOString()
                        })
                        .select('id')
                        .single()

                      if (newConv) {
                        setShowNewMessage(false)
                        window.location.href = `/messages/${newConv.id}`
                      }
                    }}
                    className="flex items-center gap-3 w-full p-2 rounded-xl hover:bg-gray-50 active:bg-gray-100"
                  >
                    <div className="w-10 h-10 rounded-full bg-pink-100 overflow-hidden flex-shrink-0">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-pink-500 font-semibold">
                          {user.full_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    <span className="font-semibold text-gray-900 text-sm">{user.full_name}</span>
                  </button>
                ))}
                {userSearch.trim() && userResults.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No users found</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-gray-900 font-semibold text-lg">No messages yet</p>
            <p className="text-gray-500 text-sm mt-1">
              Start a conversation by visiting someone's profile
            </p>
          </div>
        ) : (
          <div className="-mx-3 flex flex-col sm:mx-0">
            {conversations
              .filter(conv => !searchTerm.trim() || conv.other_user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || conv.last_message?.toLowerCase().includes(searchTerm.toLowerCase()))
              .map((conv) => (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition hover:bg-gray-50 active:bg-gray-100"
              >
                {/* Avatar */}
                <div className="h-[52px] w-[52px] rounded-full bg-pink-100 flex-shrink-0 overflow-hidden">
                  {conv.other_user?.avatar_url ? (
                    <img
                      src={conv.other_user.avatar_url}
                      alt={conv.other_user.full_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-pink-500 font-semibold text-lg">
                      {conv.other_user?.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>

                {/* Text: name bold, preview one grey line, date small grey on the right */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[15px] font-bold text-gray-900">
                      {conv.other_user?.full_name || 'Unknown user'}
                    </span>
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <p className={`min-w-0 flex-1 truncate text-sm ${conv.has_unread ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                      {cleanPreview(conv.last_message) || 'No messages yet'}
                    </p>
                    {/* Unread: pink dot */}
                    {conv.has_unread && <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-pink-600" aria-label="Unread" />}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}