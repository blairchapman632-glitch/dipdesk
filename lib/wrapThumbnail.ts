// Small copies of wrap photos for grids and tiles (client-side only).
// Each thumbnail sits next to its full photo in the wrap-images bucket:
//   <user>/<name>.jpg  →  <user>/<name>-thumb.jpg
// The URL is saved in wrap_images.thumbnail_url. Pick tile images with
// getCoverThumb / getImageThumb from lib/wrapCover.ts.

import imageCompression from 'browser-image-compression'
import { supabase } from '@/lib/supabase'

const BUCKET = 'wrap-images'

// Longest side 800px: a portrait (3:4) wrap photo comes out about 600px wide,
// sharp enough for a 2–3 column grid on a 3x phone screen.
const THUMB_OPTIONS = {
  maxWidthOrHeight: 800,
  maxSizeMB: 0.15,
  initialQuality: 0.75,
  fileType: 'image/jpeg',
  useWebWorker: true,
}

export function thumbPathFor(fullPath: string) {
  const dot = fullPath.lastIndexOf('.')
  const slash = fullPath.lastIndexOf('/')
  const base = dot > slash ? fullPath.slice(0, dot) : fullPath
  return `${base}-thumb.jpg`
}

// Storage path of a wrap-images URL (thumbnail or full photo)
export function wrapImagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const index = url.indexOf(marker)
  if (index === -1) return null
  const path = url.slice(index + marker.length).split('?')[0]
  return path ? decodeURIComponent(path) : null
}

// Make and upload the thumbnail for a photo that was just uploaded to fullPath.
// Never throws: on any failure it returns null and the tile falls back to the full photo.
export async function uploadWrapThumbnail(
  file: File,
  fullPath: string
): Promise<{ path: string; url: string } | null> {
  try {
    const thumb = await imageCompression(file, THUMB_OPTIONS)
    const path = thumbPathFor(fullPath)
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, thumb, { contentType: 'image/jpeg' })
    if (error) {
      console.error('thumbnail upload error', error)
      return null
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    return { path, url: data.publicUrl }
  } catch (error) {
    console.error('thumbnail error', error)
    return null
  }
}
