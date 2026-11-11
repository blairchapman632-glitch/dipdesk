'use client'

// A collector's WDYWT posts as a 3-column square photo grid (Instagram-style).
// Tapping a photo opens the post sheet (likes / comments). Cache-first: shows the
// cached posts instantly, then refreshes in the background. Bump refreshKey to re-fetch.

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import WdywtPostSheet, { type WdywtSheetPost } from './WdywtPostSheet'

const cacheKey = (userId: string) => `dipdesk_user_wdywt_${userId}`

export default function WdywtGrid({
  userId,
  currentUserId,
  ownerName,
  refreshKey = 0,
}: {
  userId: string
  currentUserId: string | null
  ownerName: string
  refreshKey?: number
}) {
  const [posts, setPosts] = useState<WdywtSheetPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [openPostId, setOpenPostId] = useState<string | null>(null)

  function savePosts(update: (prev: WdywtSheetPost[]) => WdywtSheetPost[]) {
    setPosts((prev) => {
      const next = update(prev)
      try { localStorage.setItem(cacheKey(userId), JSON.stringify(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    try {
      const cached = localStorage.getItem(cacheKey(userId))
      if (cached) {
        const parsed = JSON.parse(cached) as WdywtSheetPost[]
        // Older caches have no like user ids or thumbnails; they're replaced by the fetch below
        setPosts(parsed.map((p) => ({ ...p, user_id: p.user_id ?? userId, thumbnail_url: p.thumbnail_url ?? null })))
        setLoaded(true)
      }
    } catch {}

    async function load() {
      const { data } = await supabase
        .from('wdywt_posts')
        .select('id, user_id, photo_url, thumbnail_url, caption, created_at, wdywt_likes(id, user_id), wdywt_comments(id)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (cancelled || !data) return
      const next = data.map((p) => ({ ...p, wdywt_likes: p.wdywt_likes || [], wdywt_comments: p.wdywt_comments || [] }))
      setPosts(next)
      setLoaded(true)
      try { localStorage.setItem(cacheKey(userId), JSON.stringify(next)) } catch {}
    }
    void load()
    return () => { cancelled = true }
  }, [userId, refreshKey])

  const openPost = posts.find((p) => p.id === openPostId) || null

  return (
    <>
      {!loaded ? (
        <div className="grid grid-cols-3 gap-0.5">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="aspect-square animate-pulse bg-gray-200" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="text-sm text-gray-500">No WDYWT posts yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 md:gap-1">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              onClick={() => setOpenPostId(post.id)}
              className="relative aspect-square overflow-hidden bg-gray-100"
              aria-label={post.caption || 'WDYWT post'}
            >
              <img
                src={post.thumbnail_url || post.photo_url}
                alt={post.caption || 'WDYWT'}
                loading="lazy"
                className="h-full w-full object-cover object-top"
              />
            </button>
          ))}
        </div>
      )}

      {openPost && (
        <WdywtPostSheet
          post={openPost}
          ownerName={ownerName}
          currentUserId={currentUserId}
          onClose={() => setOpenPostId(null)}
          onUpdate={(updated) => savePosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
          onDelete={(id) => savePosts((prev) => prev.filter((p) => p.id !== id))}
        />
      )}
    </>
  )
}
