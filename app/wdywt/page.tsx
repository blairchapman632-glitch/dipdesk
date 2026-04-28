'use client'

import AppLayout from '@/app/components/AppLayout'
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const WDYWT_CACHE_KEY = 'dipdesk_wdywt_posts'

type WDYWTPost = {
  id: string
  user_id: string
  photo_url: string
  thumbnail_url: string | null
  caption: string | null
  created_at: string
  profiles: {
    full_name: string | null
    username: string | null
    avatar_url: string | null
  } | null
  wdywt_likes: { id: string }[]
  wdywt_comments: { id: string }[]
}

function timeAgo(dateString: string) {
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const diff = Math.max(1, Math.floor((now - then) / 1000))
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function getDisplayName(post: WDYWTPost) {
  const p = post.profiles
  if (p?.full_name?.trim()) return p.full_name.split(' ')[0]
  if (p?.username?.trim()) return p.username
  return 'Someone'
}

async function fetchPosts(): Promise<WDYWTPost[]> {
  const { data, error } = await supabase
    .from('wdywt_posts')
    .select(`
      id,
      user_id,
      photo_url,
      thumbnail_url,
      caption,
      created_at,
      wdywt_likes ( id ),
      wdywt_comments ( id )
    `)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error || !data || data.length === 0) return []

  const userIds = [...new Set(data.map((p: any) => p.user_id))]
  const { data: profileData } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', userIds)

  const profileMap: Record<string, any> = {}
  ;(profileData || []).forEach((p: any) => { profileMap[p.id] = p })

  return data.map((post: any) => ({
    ...post,
    profiles: profileMap[post.user_id] || null,
    wdywt_likes: post.wdywt_likes || [],
    wdywt_comments: post.wdywt_comments || [],
  }))
}

export default function WDYWTPage() {
  const router = useRouter()
  const [posts, setPosts] = useState<WDYWTPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const scrollRef = useRef<number>(0)
  const [isPostModalOpen, setIsPostModalOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [isPosting, setIsPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [hasPostedToday, setHasPostedToday] = useState(false)
  const [toast, setToast] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())
const [commentingPost, setCommentingPost] = useState<WDYWTPost | null>(null)
  const [comments, setComments] = useState<{id: string, user_id: string, content: string, created_at: string, profiles: {full_name: string | null, username: string | null, avatar_url: string | null} | null}[]>([])
  const [commentText, setCommentText] = useState('')
  const [loadingComments, setLoadingComments] = useState(false)
  const [postingComment, setPostingComment] = useState(false)
  const commentCacheRef = useRef<Record<string, typeof comments>>({})
  useEffect(() => {
    // Load current user from profile cache instantly
    const cachedProfile = localStorage.getItem('dipdesk_dashboard_profile')
    if (cachedProfile) {
      try {
        const p = JSON.parse(cachedProfile)
        if (p.id) setCurrentUserId(p.id)
      } catch {}
    }

    // Load posted today from cache instantly
    const cachedPostedToday = localStorage.getItem('wdywt_posted_today')
    if (cachedPostedToday) {
      try {
        const { posted, date } = JSON.parse(cachedPostedToday)
        const today = new Date().toISOString().slice(0, 10)
        if (date === today) setHasPostedToday(posted)
        else localStorage.removeItem('wdywt_posted_today')
      } catch {}
    }

    const cached = localStorage.getItem(WDYWT_CACHE_KEY)
    if (cached) {
      try {
        const parsed = JSON.parse(cached)
        setPosts(parsed)
        setLoading(false)
      } catch {}
    }

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id || null)

      // Check if user has already posted today
      if (user) {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()
        const { count } = await supabase
          .from('wdywt_posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd)
        const posted = (count || 0) > 0
        setHasPostedToday(posted)
        localStorage.setItem('wdywt_posted_today', JSON.stringify({ posted, date: new Date().toISOString().slice(0, 10) }))
      }

      const result = await fetchPosts()
      setPosts(result)
      localStorage.setItem(WDYWT_CACHE_KEY, JSON.stringify(result))
      localStorage.setItem(WDYWT_CACHE_KEY + '_time', String(Date.now()))
      setLoading(false)
    }

    const handleScroll = () => { scrollRef.current = window.scrollY }
    window.addEventListener('scroll', handleScroll)

    const savedScroll = sessionStorage.getItem('wdywt_scroll')
    if (savedScroll) {
      setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 50)
      sessionStorage.removeItem('wdywt_scroll')
    }

    load()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      sessionStorage.setItem('wdywt_scroll', String(scrollRef.current))
    }
  }, [])

  async function handlePost() {
    if (!photoFile || !currentUserId) return
    setIsPosting(true)
    setPostError('')

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

    const { count } = await supabase
      .from('wdywt_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', currentUserId)
      .gte('created_at', todayStart)
      .lte('created_at', todayEnd)

    if (count && count > 0) {
      setPostError('You have already posted today. Come back tomorrow!')
      setIsPosting(false)
      return
    }

    let file = photoFile
    try {
      const { default: imageCompression } = await import('browser-image-compression')
      file = await imageCompression(photoFile, {
        maxSizeMB: 1,
        maxWidthOrHeight: 1080,
        useWebWorker: true,
      })
    } catch {}

    const ext = file.name.split('.').pop() || 'jpg'
    const fileName = `${currentUserId}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('wdywt-photos')
      .upload(fileName, file)

    if (uploadError) {
      setPostError('Upload failed. Please try again.')
      setIsPosting(false)
      return
    }

    const { data: urlData } = supabase.storage
      .from('wdywt-photos')
      .getPublicUrl(fileName)

    let thumbUrl = urlData.publicUrl
    try {
      const { default: imageCompression } = await import('browser-image-compression')
      const thumb = await imageCompression(photoFile, {
        maxSizeMB: 0.1,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      })
      const thumbName = `${currentUserId}/thumb_${Date.now()}.${ext}`
      const { error: thumbError } = await supabase.storage
        .from('wdywt-photos')
        .upload(thumbName, thumb)
      if (!thumbError) {
        const { data: thumbUrlData } = supabase.storage
          .from('wdywt-photos')
          .getPublicUrl(thumbName)
        thumbUrl = thumbUrlData.publicUrl
      }
    } catch {}

    const { error: insertError } = await supabase
      .from('wdywt_posts')
      .insert({
        user_id: currentUserId,
        photo_url: urlData.publicUrl,
        thumbnail_url: thumbUrl,
        caption: caption.trim() || null,
      })

    if (insertError) {
      setPostError('Could not save post. Please try again.')
      setIsPosting(false)
      return
    }

    setCaption('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setIsPostModalOpen(false)
    setIsPosting(false)
    setHasPostedToday(true)
    localStorage.setItem('wdywt_posted_today', JSON.stringify({ posted: true, date: new Date().toISOString().slice(0, 10) }))

    const result = await fetchPosts()
    setPosts(result)
    localStorage.setItem(WDYWT_CACHE_KEY, JSON.stringify(result))
    localStorage.setItem(WDYWT_CACHE_KEY + '_time', String(Date.now()))
  }
async function handleComment() {
    if (!commentText.trim() || !currentUserId || !commentingPost || postingComment) return
    setPostingComment(true)

    const { data, error } = await supabase
      .from('wdywt_comments')
      .insert({
        post_id: commentingPost.id,
        user_id: currentUserId,
        content: commentText.trim(),
      })
      .select('id, user_id, content, created_at')
      .single()

    if (!error && data) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .eq('id', currentUserId)
        .single()

      const newComments = [...comments, { ...data, profiles: profileData || null }]
      setComments(newComments)
      commentCacheRef.current[commentingPost.id] = newComments
      sessionStorage.setItem(`wdywt_comments_${commentingPost.id}`, JSON.stringify(newComments))
      setCommentText('')

      setPosts(prev => prev.map(p => p.id === commentingPost.id
        ? { ...p, wdywt_comments: [...p.wdywt_comments, { id: data.id }] }
        : p))

      if (commentingPost.user_id !== currentUserId) {
        await supabase.from('notifications').insert({
          recipient_user_id: commentingPost.user_id,
          actor_user_id: currentUserId,
          type: 'comment',
        })
      }
    }

    setPostingComment(false)
  }
  return (
    <AppLayout>
      <div className="mx-auto max-w-lg space-y-4">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">WDYWT</h1>
            <p className="text-sm text-gray-500">What did you wear today?</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (hasPostedToday) {
                setToast("You've already posted today. Come back tomorrow!")
                setTimeout(() => setToast(''), 3000)
                return
              }
              setIsPostModalOpen(true)
            }}
            className="rounded-xl bg-gradient-to-r from-pink-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm"
          >
            {hasPostedToday ? '✓ Posted' : '+ Post'}
          </button>
        </div>

        {loading && posts.length === 0 ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-3xl border bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-full bg-gray-200" />
                  <div className="space-y-1">
                    <div className="h-3 w-24 rounded bg-gray-200" />
                    <div className="h-3 w-16 rounded bg-gray-100" />
                  </div>
                </div>
                <div className="aspect-square w-full rounded-2xl bg-gray-200" />
              </div>
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-3xl border border-dashed p-12 text-center">
            <p className="text-gray-500 font-medium">No posts yet</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to share what you wore today</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <article
                key={post.id}
                className="overflow-hidden rounded-3xl border bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 p-4 pb-3">
                  <button
                    type="button"
                    onClick={() => router.push(`/user/${post.user_id}`)}
                    className="shrink-0 group"
                  >
                    {post.profiles?.avatar_url ? (
                      <img
                        src={post.profiles.avatar_url}
                        alt={getDisplayName(post)}
                        className="h-10 w-10 rounded-full object-cover ring-2 ring-pink-100 group-hover:ring-pink-400 group-hover:scale-110 transition duration-200"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-sm font-bold text-white ring-2 ring-pink-100 group-hover:ring-pink-400 group-hover:scale-110 transition duration-200">
                        {getDisplayName(post)[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/user/${post.user_id}`)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-semibold text-gray-900 text-sm hover:text-pink-500 transition">
                      {getDisplayName(post)}
                    </p>
                    <p className="text-xs text-pink-400">View collection →</p>
                  </button>

                  {post.user_id === currentUserId && (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(post.id)}
                      className="shrink-0 rounded-full p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 transition"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>

                <div className="relative aspect-square w-full bg-gray-100">
                  <img
                    src={post.photo_url}
                    alt={post.caption || 'WDYWT post'}
                    loading="lazy"
                    className="h-full w-full object-cover object-top"
                  />
                </div>

                <div className="flex items-center gap-4 px-4 pt-3 pb-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!currentUserId) return
                      const isLiked = likedPosts.has(post.id)
                      if (isLiked) {
                        await supabase.from('wdywt_likes').delete()
                          .eq('post_id', post.id).eq('user_id', currentUserId)
                        setLikedPosts(prev => { const next = new Set(prev); next.delete(post.id); return next })
                        setPosts(prev => prev.map(p => p.id === post.id
                          ? { ...p, wdywt_likes: p.wdywt_likes.filter(l => l.id !== currentUserId) }
                          : p))
                      } else {
                        const { data } = await supabase.from('wdywt_likes')
                          .insert({ post_id: post.id, user_id: currentUserId }).select('id').single()
                        if (data) {
                          setLikedPosts(prev => new Set(prev).add(post.id))
                          setPosts(prev => prev.map(p => p.id === post.id
                            ? { ...p, wdywt_likes: [...p.wdywt_likes, { id: data.id }] }
                            : p))
                          if (post.user_id !== currentUserId) {
                            await supabase.from('notifications').insert({
                              recipient_user_id: post.user_id,
                              actor_user_id: currentUserId,
                              type: 'like',
                            })
                          }
                        }
                      }
                    }}
                    className="flex items-center gap-1.5 text-sm transition"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={likedPosts.has(post.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-5 w-5 ${likedPosts.has(post.id) ? 'text-pink-500' : 'text-gray-600'}`}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                    <span className={likedPosts.has(post.id) ? 'text-pink-500 font-semibold' : 'text-gray-600'}>
                      {post.wdywt_likes?.length || 0}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setCommentingPost(post)
                      setCommentText('')
                      const sessionCached = sessionStorage.getItem(`wdywt_comments_${post.id}`)
                      if (commentCacheRef.current[post.id]) {
                        setComments(commentCacheRef.current[post.id])
                        setLoadingComments(false)
                      } else if (sessionCached) {
                        try {
                          const parsed = JSON.parse(sessionCached)
                          setComments(parsed)
                          commentCacheRef.current[post.id] = parsed
                          setLoadingComments(false)
                        } catch {
                          setLoadingComments(true)
                        }
                      } else {
                        setLoadingComments(true)
                      }
                      const { data } = await supabase
                        .from('wdywt_comments')
                        .select('id, user_id, content, created_at')
                        .eq('post_id', post.id)
                        .order('created_at', { ascending: true })
                      if (data && data.length > 0) {
                        const userIds = [...new Set(data.map((c: any) => c.user_id))]
                        const { data: profileData } = await supabase
                          .from('profiles')
                          .select('id, full_name, username, avatar_url')
                          .in('id', userIds)
                        const profileMap: Record<string, any> = {}
                        ;(profileData || []).forEach((p: any) => { profileMap[p.id] = p })
                        const normalized = data.map((c: any) => ({ ...c, profiles: profileMap[c.user_id] || null }))
                        setComments(normalized)
                        commentCacheRef.current[post.id] = normalized
                        sessionStorage.setItem(`wdywt_comments_${post.id}`, JSON.stringify(normalized))
                      } else {
                        setComments([])
                        commentCacheRef.current[post.id] = []
                        sessionStorage.setItem(`wdywt_comments_${post.id}`, JSON.stringify([]))
                      }
                      setLoadingComments(false)
                    }}
                    className="flex items-center gap-1.5 text-sm text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    <span>{post.wdywt_comments?.length || 0}</span>
                  </button>
                </div>

                {post.caption && (
                  <div className="px-4 pb-4 pt-1">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold text-gray-900 mr-1">{getDisplayName(post)}</span>
                      {post.caption}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
{commentingPost && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
            onClick={() => { setCommentingPost(null); setComments([]) }}
          >
            <div
              className="w-full max-w-lg rounded-t-3xl bg-white shadow-2xl max-h-[80vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-bold text-gray-900">Comments</h3>
                <button
                  type="button"
                  onClick={() => { setCommentingPost(null); setComments([]) }}
                  className="text-sm text-gray-500"
                >
                  Close
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                {loadingComments ? (
                  <p className="text-sm text-gray-400 text-center py-4">Loading...</p>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No comments yet. Be the first!</p>
                ) : (
                  comments.map((comment) => {
                    const name = comment.profiles?.full_name?.split(' ')[0] || comment.profiles?.username || 'Someone'
                    return (
                      <div key={comment.id} className="flex items-start gap-3">
                        {comment.profiles?.avatar_url ? (
                          <img src={comment.profiles.avatar_url} alt={name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xs font-bold text-white">
                            {name[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                        <div>
                          <p className="text-sm text-gray-900">
                            <span className="font-semibold mr-1">{name}</span>
                            {comment.content}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">{timeAgo(comment.created_at)}</p>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="border-t px-4 py-3 flex items-center gap-3">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-full border border-gray-200 px-4 py-2 text-sm outline-none focus:border-pink-300"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (commentText.trim() && currentUserId && !postingComment) {
                        handleComment()
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!commentText.trim() || postingComment || !currentUserId}
                  onClick={handleComment}
                  className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Post
                </button>
              </div>
            </div>
          </div>
        )}
        {isPostModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-4"
            onClick={() => { if (!isPosting) setIsPostModalOpen(false) }}
          >
            <div
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">WDYWT</h2>
                <button
                  type="button"
                  onClick={() => setIsPostModalOpen(false)}
                  disabled={isPosting}
                  className="rounded-full border px-3 py-1 text-sm text-gray-600 disabled:opacity-50"
                >
                  Close
                </button>
              </div>

              {!photoPreview ? (
                <label className="flex h-40 w-full cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 hover:border-pink-300 hover:bg-pink-50 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 text-gray-300 mb-2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                  <p className="text-sm font-semibold text-gray-500">Tap to add photo</p>
                  <p className="text-xs text-gray-400 mt-1">Choose from camera or library</p>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setPhotoFile(file)
                      setPhotoPreview(URL.createObjectURL(file))
                    }}
                  />
                </label>
              ) : (
                <div className="relative h-64 w-full overflow-hidden rounded-2xl bg-black">
                  <img src={photoPreview} alt="Preview" className="h-full w-full object-contain" />
                  <button
                    type="button"
                    onClick={() => { setPhotoFile(null); setPhotoPreview(null) }}
                    className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white"
                  >
                    Change
                  </button>
                </div>
              )}

              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="What are you wearing today? Add details about your wrap..."
                rows={3}
                maxLength={300}
                className="mt-4 w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm text-gray-700 outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100 resize-none"
              />
              <p className="mt-1 text-right text-xs text-gray-400">{caption.length}/300</p>

              {postError && (
                <p className="mt-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600">
                  {postError}
                </p>
              )}

              <button
                type="button"
                disabled={!photoFile || isPosting}
                onClick={handlePost}
                className="mt-4 w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-50 transition"
              >
                {isPosting ? 'Posting...' : 'Share WDYWT'}
              </button>
            </div>
          </div>
        )}

      </div>
{confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete post?</h3>
            <p className="text-sm text-gray-500 mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold text-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = confirmDelete
                  setConfirmDelete(null)
                  await supabase.from('wdywt_posts').delete().eq('id', id)
                  const updated = posts.filter(p => p.id !== id)
                  setPosts(updated)
                  setHasPostedToday(false)
                  localStorage.removeItem('wdywt_posted_today')
                  localStorage.setItem(WDYWT_CACHE_KEY, JSON.stringify(updated))
                  setToast('Post deleted')
                  setTimeout(() => setToast(''), 3000)
                }}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2">
          <div className="rounded-2xl border border-white/20 bg-gray-900/90 px-5 py-3 text-sm font-semibold text-white shadow-2xl backdrop-blur">
            {toast}
          </div>
        </div>
      )}
    </AppLayout>
  )
}