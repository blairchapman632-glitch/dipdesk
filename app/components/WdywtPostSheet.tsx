'use client'

// One WDYWT post in a sheet: photo (double-tap to like), like + comment counts, caption,
// comments and a comment box. Owners can delete. Used by the profile WDYWT grids and the
// Home Following feed (moved here from the user profile page).

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { likeWdywtPost, unlikeWdywtPost } from '@/lib/wdywtLikes'
import { askConfirm, showToast } from './Toast'
import { useLockBodyScroll } from './useLockBodyScroll'
import DoubleTapLike from './DoubleTapLike'

export type WdywtSheetPost = {
  id: string
  user_id: string
  photo_url: string
  thumbnail_url: string | null
  caption: string | null
  created_at: string
  wdywt_likes: { id: string; user_id?: string }[]
  wdywt_comments: { id: string }[]
}

type Comment = {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles: { full_name: string | null; username: string | null; avatar_url: string | null } | null
}

function timeAgo(dateString: string) {
  const diff = Math.max(1, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000))
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function hasLikedPost(post: WdywtSheetPost, currentUserId: string | null) {
  return !!currentUserId && post.wdywt_likes.some((like) => String(like.user_id) === String(currentUserId))
}

export default function WdywtPostSheet({
  post,
  ownerName,
  currentUserId,
  onClose,
  onUpdate,
  onDelete,
}: {
  post: WdywtSheetPost
  ownerName: string
  currentUserId: string | null
  onClose: () => void
  onUpdate: (post: WdywtSheetPost) => void
  onDelete?: (postId: string) => void
}) {
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [sending, setSending] = useState(false)
  const [likeBusy, setLikeBusy] = useState(false)

  useLockBodyScroll(true)

  const isLiked = hasLikedPost(post, currentUserId)
  const isOwner = !!currentUserId && String(currentUserId) === String(post.user_id)

  // Comments: cached instantly, then fresh
  useEffect(() => {
    let cancelled = false
    try {
      const cached = sessionStorage.getItem(`wdywt_comments_${post.id}`)
      if (cached) {
        setComments(JSON.parse(cached))
        setCommentsLoading(false)
      }
    } catch {}

    async function load() {
      const { data } = await supabase
        .from('wdywt_comments')
        .select('id, user_id, content, created_at')
        .eq('post_id', post.id)
        .order('created_at', { ascending: true })
      if (cancelled) return
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map((c) => c.user_id))]
        const { data: profileData } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds)
        if (cancelled) return
        const profileMap: Record<string, Comment['profiles']> = {}
        ;(profileData || []).forEach((p) => { profileMap[p.id] = p })
        const normalized = data.map((c) => ({ ...c, profiles: profileMap[c.user_id] || null }))
        setComments(normalized)
        try { sessionStorage.setItem(`wdywt_comments_${post.id}`, JSON.stringify(normalized)) } catch {}
      } else {
        setComments([])
      }
      setCommentsLoading(false)
    }
    void load()
    return () => { cancelled = true }
  }, [post.id])

  // Like from the heart (toggles) or a double-tap (only ever likes).
  // The count and heart change straight away; undone if the save fails.
  async function setLiked(next: boolean) {
    if (!currentUserId || likeBusy || next === isLiked) return
    setLikeBusy(true)
    const before = post
    if (next) {
      onUpdate({ ...post, wdywt_likes: [...post.wdywt_likes, { id: `me-${Date.now()}`, user_id: currentUserId }] })
      const result = await likeWdywtPost(post, currentUserId)
      if (result === 'failed') onUpdate(before)
    } else {
      onUpdate({ ...post, wdywt_likes: post.wdywt_likes.filter((like) => String(like.user_id) !== String(currentUserId)) })
      const ok = await unlikeWdywtPost(post.id, currentUserId)
      if (!ok) onUpdate(before)
    }
    setLikeBusy(false)
  }

  async function sendComment() {
    if (!commentText.trim() || !currentUserId || sending) return
    setSending(true)
    const { data, error } = await supabase
      .from('wdywt_comments')
      .insert({ post_id: post.id, user_id: currentUserId, content: commentText.trim() })
      .select('id, user_id, content, created_at')
      .single()
    if (!error && data) {
      const { data: me } = await supabase.from('profiles').select('id, full_name, username, avatar_url').eq('id', currentUserId).single()
      const next = [...comments, { ...data, profiles: me || null }]
      setComments(next)
      try { sessionStorage.setItem(`wdywt_comments_${post.id}`, JSON.stringify(next)) } catch {}
      setCommentText('')
      onUpdate({ ...post, wdywt_comments: [...post.wdywt_comments, { id: data.id }] })
      if (post.user_id !== currentUserId) {
        await supabase.from('notifications').insert({
          recipient_user_id: post.user_id,
          actor_user_id: currentUserId,
          type: 'comment',
          wdywt_post_id: post.id,
        })
      }
    }
    setSending(false)
  }

  async function deletePost() {
    if (!(await askConfirm({ title: 'Delete post?', message: 'This cannot be undone.', confirmLabel: 'Delete' }))) return
    const { error } = await supabase.from('wdywt_posts').delete().eq('id', post.id)
    if (error) {
      showToast('Could not delete the post')
      return
    }
    onDelete?.(post.id)
    onClose()
    showToast('Post deleted')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="animate-sheet-up w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl max-h-[90dvh] flex flex-col pb-[env(safe-area-inset-bottom)] sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h3 className="font-bold text-gray-900">Post</h3>
          <div className="flex items-center gap-3">
            {isOwner && onDelete && (
              <button type="button" onClick={() => void deletePost()} className="text-sm font-semibold text-red-500">
                Delete
              </button>
            )}
            <button type="button" onClick={onClose} className="text-sm text-gray-500">Close</button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1">
          <DoubleTapLike onDoubleTap={() => void setLiked(true)}>
            <img src={post.photo_url} alt={post.caption || 'WDYWT'} className="w-full aspect-square object-cover object-top" />
          </DoubleTapLike>
          <div className="px-5 py-3">
            <div className="flex items-center gap-4 mb-3">
              <button
                type="button"
                onClick={() => void setLiked(!isLiked)}
                disabled={!currentUserId}
                className="flex items-center gap-1.5 text-sm"
              >
                <svg viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={`h-5 w-5 ${isLiked ? 'text-pink-500' : 'text-gray-600'}`}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                <span className={isLiked ? 'text-pink-500 font-semibold' : 'text-gray-600'}>{post.wdywt_likes.length}</span>
              </button>
              <span className="flex items-center gap-1.5 text-sm text-gray-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {post.wdywt_comments.length}
              </span>
            </div>
            {post.caption && (
              <p className="text-sm text-gray-700 mb-3 break-words">
                <span className="font-semibold text-gray-900 mr-1">{ownerName}</span>
                {post.caption}
              </p>
            )}
            <p className="text-xs text-gray-400 mb-4">{timeAgo(post.created_at)}</p>
            <div className="border-t pt-3 space-y-3">
              {commentsLoading && comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">Loading comments...</p>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-2">No comments yet</p>
              ) : (
                comments.map((comment) => {
                  const name = comment.profiles?.full_name?.split(' ')[0] || comment.profiles?.username || 'Someone'
                  return (
                    <div key={comment.id} className="flex items-start gap-2">
                      {comment.profiles?.avatar_url ? (
                        <img src={comment.profiles.avatar_url} alt={name} className="h-7 w-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-xs font-bold text-white">{name[0]?.toUpperCase() || '?'}</div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 break-words"><span className="font-semibold mr-1">{name}</span>{comment.content}</p>
                        <p className="text-xs text-gray-400">{timeAgo(comment.created_at)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
        {currentUserId && (
          <div className="border-t px-4 py-3 flex items-center gap-3 shrink-0">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 rounded-full border border-gray-200 px-4 py-2 text-[16px] outline-none focus:border-pink-300"
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendComment() } }}
            />
            <button type="button" disabled={!commentText.trim() || sending} onClick={() => void sendComment()} className="rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Post</button>
          </div>
        )}
      </div>
    </div>
  )
}
