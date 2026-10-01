// Single source of truth for a wrap's cover photo.
// Rule: the cover is always the photo at sort_order 0 (the first photo).
// is_primary is kept in sync on save but is never used to pick the cover.

type OrderedImage = {
  id: string
  sort_order: number
}

// Photos in display order. Ties on sort_order are broken by id so the
// result is the same no matter what order Supabase or the cache returns.
export function sortWrapImages<T extends OrderedImage>(images?: T[] | null): T[] {
  return [...(images || [])].sort(
    (a, b) => a.sort_order - b.sort_order || String(a.id).localeCompare(String(b.id))
  )
}

export function getCoverImage<T extends OrderedImage>(images?: T[] | null): T | null {
  return sortWrapImages(images)[0] || null
}
