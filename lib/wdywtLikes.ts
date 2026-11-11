// Like / unlike a WDYWT post. Shared by the WDYWT feed, the profile WDYWT grids
// and the Home Following feed so they all notify the same way.

import { supabase } from '@/lib/supabase'

export type LikeResult = 'liked' | 'already-liked' | 'failed'

function myFirstName() {
  try {
    const cached = localStorage.getItem('dipdesk_dashboard_profile')
    return (cached && JSON.parse(cached)?.full_name?.split(' ')[0]) || 'Someone'
  } catch {
    return 'Someone'
  }
}

export async function likeWdywtPost(
  post: { id: string; user_id: string; caption: string | null },
  currentUserId: string
): Promise<LikeResult> {
  const { error } = await supabase.from('wdywt_likes').insert({ post_id: post.id, user_id: currentUserId })
  if (error) {
    // Unique (post_id, user_id): already liked on another device / earlier
    return error.code === '23505' ? 'already-liked' : 'failed'
  }

  if (post.user_id !== currentUserId) {
    await supabase.from('notifications').insert({
      recipient_user_id: post.user_id,
      actor_user_id: currentUserId,
      type: 'like',
      wdywt_post_id: post.id,
    })
    fetch('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_ids: [post.user_id],
        title: `❤️ ${myFirstName()} liked your WDYWT post`,
        body: post.caption || 'Check it out',
        url: '/wdywt',
      }),
    }).catch(() => {})
  }
  return 'liked'
}

export async function unlikeWdywtPost(postId: string, currentUserId: string): Promise<boolean> {
  const { error } = await supabase.from('wdywt_likes').delete().eq('post_id', postId).eq('user_id', currentUserId)
  return !error
}
