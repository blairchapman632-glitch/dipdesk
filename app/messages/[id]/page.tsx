'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/app/components/AppLayout'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  read: boolean
}

interface OtherUser {
  id: string
  full_name: string
  avatar_url: string | null
}

export default function ConversationPage() {
  const { id } = useParams()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [otherUser, setOtherUser] = useState<OtherUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const MESSAGES_CACHE_KEY = `wrapapp_messages_${id}`
  const USER_CACHE_KEY = `wrapapp_thread_user_${id}`

  useEffect(() => {
    // Load from cache instantly
    const cachedMessages = localStorage.getItem(MESSAGES_CACHE_KEY)
    const cachedUser = localStorage.getItem(USER_CACHE_KEY)
    const cachedCurrentUser = localStorage.getItem('wrapapp_current_user_id')

    if (cachedCurrentUser) {
      try {
        setCurrentUserId(JSON.parse(cachedCurrentUser))
      } catch {}
    }

    if (cachedMessages) {
      try {
        setMessages(JSON.parse(cachedMessages))
        setLoading(false)
      } catch {}
    }

    if (cachedUser) {
      try {
        setOtherUser(JSON.parse(cachedUser))
      } catch {}
    }

    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentUserId(user.id)
      localStorage.setItem('wrapapp_current_user_id', JSON.stringify(user.id))
      await Promise.all([
        fetchConversation(user.id),
        fetchMessages(),
      ])
      markMessagesRead(user.id)
    }
    init()
  }, [id])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const fetchConversation = async (userId: string) => {
    const { data: conv } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (!conv) return

    const otherUserId = conv.participant_1_id === userId
      ? conv.participant_2_id
      : conv.participant_1_id

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('id', otherUserId)
      .single()

    if (profile) {
      setOtherUser(profile)
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(profile))
    }
  }

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })

    if (!error) {
      setMessages(data || [])
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(data || []))
    }
    setLoading(false)
  }

  const markMessagesRead = async (userId: string) => {
    await supabase
      .from('messages')
      .update({ read: true })
      .eq('conversation_id', id)
      .neq('sender_id', userId)
  }

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || sending) return
    setSending(true)

    const content = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: currentUserId,
        content
      })

    if (!error) {
      await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString()
        })
        .eq('id', id)
    }

    setSending(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto flex flex-col h-[calc(100vh-64px)]">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0">
          <Link
            href="/messages"
            className="flex items-center gap-1 text-pink-500 hover:text-pink-600 font-semibold text-sm pr-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>

          <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {otherUser?.avatar_url ? (
              <img src={otherUser.avatar_url} alt={otherUser.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 font-semibold">
                {otherUser?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
          </div>

          <span className="font-semibold text-gray-900">
            {otherUser?.full_name || 'Loading...'}
          </span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 text-sm">No messages yet. Say hi! 👋</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.sender_id === currentUserId
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                    isMe
                      ? 'bg-pink-500 text-white rounded-br-sm'
                      : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                  }`}>
                    <p>{msg.content}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-pink-100' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-3">
          <input
            ref={inputRef}
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none text-gray-900 placeholder-gray-400"
          />
          <button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending}
            className="w-9 h-9 bg-pink-500 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>

      </div>
    </AppLayout>
  )
}