'use client'

import { useEffect, useState, useRef } from 'react'
import imageCompression from 'browser-image-compression'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import AppLayout from '@/app/components/AppLayout'

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  image_url: string | null
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
  const [sendingImage, setSendingImage] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const inputRef = useRef<HTMLInputElement>(null)
  const MESSAGES_CACHE_KEY = `wrapapp_messages_${id}`
  const USER_CACHE_KEY = `wrapapp_thread_user_${id}`

  useEffect(() => {
    // Pre-fill message from URL if coming from Contact Seller
    const params = new URLSearchParams(window.location.search)
    const prefill = params.get('prefill')
    if (prefill) {
      setNewMessage(decodeURIComponent(prefill))
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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
        const newMsg = payload.new as Message
        setMessages(prev => {
          // Skip if message already exists (optimistic or duplicate)
          if (prev.some(m => m.id === newMsg.id)) return prev
          // Replace optimistic message if same sender and content
          const optimisticIndex = prev.findIndex(
            m => m.id.startsWith('temp-') &&
            m.sender_id === newMsg.sender_id &&
            m.content === newMsg.content
          )
          if (optimisticIndex !== -1) {
            const updated = [...prev]
            updated[optimisticIndex] = newMsg
            localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(updated))
            return updated
          }
          const updated = [...prev, newMsg]
          localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(updated))
          return updated
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [id])

  

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

    // Update unread badge instantly
    const cached = localStorage.getItem('dipdesk_unread_messages')
    const current = cached ? JSON.parse(cached) : 0
    const newCount = Math.max(0, current - 1)
    localStorage.setItem('dipdesk_unread_messages', JSON.stringify(newCount))

    // Force AppLayout to re-read the count
    window.dispatchEvent(new Event('storage'))
  }
const sendImage = async (file: File) => {
    if (!currentUserId || sendingImage) return
    setSendingImage(true)

    try {
      file = await imageCompression(file, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
      })
    } catch {}

    const fileExt = file.name.split('.').pop() || 'jpg'
    const fileName = `${currentUserId}/${Date.now()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('message-images')
      .upload(fileName, file)

    if (uploadError) {
      setSendingImage(false)
      return
    }

    const { data } = supabase.storage
      .from('message-images')
      .getPublicUrl(fileName)

    const imageUrl = data.publicUrl

    // Optimistically add image message
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: id as string,
      sender_id: currentUserId,
      content: '📷 Photo',
      image_url: imageUrl,
      created_at: new Date().toISOString(),
      read: false,
    }
    setMessages(prev => {
      const updated = [...prev, optimisticMessage]
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(updated))
      return updated
    })

    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: currentUserId,
      content: '📷 Photo',
      image_url: imageUrl,
    })

    await supabase.from('conversations').update({
      last_message: '📷 Photo',
      last_message_at: new Date().toISOString()
    }).eq('id', id)

    setSendingImage(false)
  }
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserId || sending) return
    setSending(true)

    const content = newMessage.trim()
    setNewMessage('')

    // Optimistically add message to UI instantly
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: id as string,
      sender_id: currentUserId,
      content,
      image_url: null,
      created_at: new Date().toISOString(),
      read: false,
    }
    setMessages(prev => {
      const updated = [...prev, optimisticMessage]
      localStorage.setItem(MESSAGES_CACHE_KEY, JSON.stringify(updated))
      return updated
    })

    const { error } = await supabase
      .from('messages')
      .insert({
        conversation_id: id,
        sender_id: currentUserId,
        content
      })

    if (!error) {
      // Update conversation preview cache instantly
      const convCache = localStorage.getItem('wrapapp_conversations_cache')
      if (convCache) {
        try {
          const convs = JSON.parse(convCache)
          const updated = convs.map((c: any) =>
            c.id === id
              ? { ...c, last_message: content, last_message_at: new Date().toISOString() }
              : c
          )
          localStorage.setItem('wrapapp_conversations_cache', JSON.stringify(updated))
        } catch {}
      }

      await supabase
        .from('conversations')
        .update({
          last_message: content,
          last_message_at: new Date().toISOString()
        })
        .eq('id', id)

      // Send push notification to recipient
      if (otherUser?.id) {
        const myProfile = localStorage.getItem('dipdesk_dashboard_profile')
        const myName = myProfile ? JSON.parse(myProfile)?.full_name?.split(' ')[0] || 'Someone' : 'Someone'
        fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_ids: [otherUser.id],
            title: `💬 ${myName} sent you a message`,
            body: content,
            url: `/messages/${id}`,
          }),
        }).catch(() => {})
      }
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

  const formatDateGroup = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === now.toDateString()) return 'Today'
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return date.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })
  }

  return (
    <AppLayout hideHeader={false}>
      <div className="fixed inset-x-0 top-0 bottom-[72px] md:bottom-0 md:static md:h-[calc(100vh-80px)] max-w-lg md:mx-auto flex flex-col bg-gray-50">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white flex-shrink-0 sticky top-0 z-10 mt-0">
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

          <span className="font-semibold text-gray-900 flex-1">
            {otherUser?.full_name || 'Loading...'}
          </span>

          <button
            type="button"
            onClick={async () => {
              const confirmed = window.confirm('Delete this conversation?')
              if (!confirmed) return

              await supabase
                .from('conversations')
                .delete()
                .eq('id', id)

              // Clear cache
              localStorage.removeItem(MESSAGES_CACHE_KEY)
              localStorage.removeItem(USER_CACHE_KEY)
              const convCache = localStorage.getItem('wrapapp_conversations_cache')
              if (convCache) {
                try {
                  const convs = JSON.parse(convCache)
                  localStorage.setItem('wrapapp_conversations_cache', JSON.stringify(
                    convs.filter((c: any) => c.id !== id)
                  ))
                } catch {}
              }

              router.push('/messages')
            }}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-hide flex flex-col-reverse" style={{ scrollbarWidth: 'none' }}>
          <div className="flex flex-col space-y-2">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <p className="text-gray-400 text-sm">No messages yet. Say hi! 👋</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUserId
              const isUnread = !isMe && !msg.read
              const prevMsg = messages[index - 1]
              const isFirstUnread = isUnread && (index === 0 || prevMsg?.read || prevMsg?.sender_id === currentUserId)

              const msgDate = new Date(msg.created_at).toDateString()
              const prevDate = prevMsg ? new Date(prevMsg.created_at).toDateString() : null
              const showDateGroup = msgDate !== prevDate

              return (
                <div key={msg.id}>
                  {showDateGroup && (
                    <div className="flex items-center gap-2 my-3">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400 font-semibold px-2">
                        {formatDateGroup(msg.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  {isFirstUnread && (
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-pink-200" />
                      <span className="text-xs text-pink-400 font-semibold">New messages</span>
                      <div className="flex-1 h-px bg-pink-200" />
                    </div>
                  )}
                  <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {msg.image_url ? (
                      <div className="max-w-[75%]">
                        <img
                          src={msg.image_url}
                          alt="Photo"
                          className="rounded-2xl object-cover cursor-pointer max-w-[220px]"
                          onClick={() => window.open(msg.image_url!, '_blank')}
                        />
                        <p className={`text-xs mt-1 px-1 ${isMe ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    ) : (
                      <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-pink-500 text-white rounded-br-sm'
                          : isUnread
                          ? 'bg-white border border-pink-200 text-gray-900 rounded-bl-sm shadow-sm'
                          : 'bg-gray-100 text-gray-900 rounded-bl-sm'
                      }`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isMe ? 'text-pink-100' : 'text-gray-400'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
          </div>
        </div>

        {/* Input bar */}
        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3 flex items-center gap-2">
          {/* Image button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendingImage}
            className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:bg-pink-200 transition-colors"
          >
            {sendingImage ? (
              <div className="w-4 h-4 border-2 border-pink-400 border-t-pink-600 rounded-full animate-spin" />
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) sendImage(file)
            }}
          />

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