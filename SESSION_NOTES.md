# Session Notes

## 2026-11-08 — Google Sheets: narrower scope + security fixes
**Changed**
- Why: users saw Google's "unverified app / sensitive info" warning because we asked for the `spreadsheets` scope.
- Scope: Sheets connect now asks only for `drive.file` (`app/api/auth/google/route.ts`).
- Paste-your-own-sheet-link inputs removed from the dip page (queue/live card and Settings). The app only uses sheets it creates. The Guide tab sync card's Open ↗ is now a bigger, darker button. Settings shows a read-only "Open Sheet ↗". Live post text is unchanged.
- Sync (`app/api/sheets/sync/route.ts`): every Google call is checked, and failures return a readable message instead of fake success. If the existing sheet gives 403/404 (or has no "Unicorn" tab), it makes a fresh app-owned sheet, shares it view-only, saves the link and carries on. A Google 401 sends the page back to the Connect button.
- Security, sync: the user now comes from their Supabase access token (Authorization header), not the request body. Only the dip owner (`dips.user_id`) or a super_admin can sync; others get 403.
- Security, connect: Connect is now a button that POSTs the access token. The server sets a signed, 10-minute, httpOnly state cookie and returns the Google URL. The callback rejects a mismatched state, saves tokens only to the verified user, and clears the cookie. New helper: `lib/googleOAuthState.ts` (signed with GOOGLE_CLIENT_SECRET).
- The callback no longer wipes an existing refresh token if Google doesn't send a new one.

**To do / untested**
- Not tested in the browser yet (type check passes). Test list: connect, cancel on Google, create sheet, open links (Guide + Settings, logged-out view), re-sync, live post link, old pasted link → new sheet, delete sheet / revoke access → errors show, another user's sync → 403.
- Blair: remove the `spreadsheets` scope from the Google Cloud Console OAuth consent screen too.

**Notes**
- Users who connected earlier keep their old tokens (which still include `spreadsheets`). Nothing breaks; they move to the new scope when they reconnect.
- Dips with an old pasted link get a new sheet on next sync. Live posts already published keep the old link.
- No database changes.
- The state cookie isn't marked "secure" on localhost so dev works over http.

## 2026-10-01 — Cover photo fix
**Changed**
- Bug: wrap covers flipped between two photos. Cause: opening the edit modal marked photo 1 as cover on top of the real cover, so saving stored two covers, and pages picked whichever came back first from Supabase.
- New rule: the cover is always the first photo (sort_order 0). New shared helper `lib/wrapCover.ts` (getCoverImage, sortWrapImages) is now the only place a cover is picked — dashboard, explore, wishlist, profile (tiles and wrap views).
- Every wrap_images query now orders by sort_order, so cached and fresh data match.
- Edit modal (dashboard): tapping a photo moves it to the first spot; Cover badge only on the first photo; remove/upload renumber photos.
- Save no longer deletes all photos and re-inserts. It updates existing rows, inserts new ones, deletes removed ones last. On failure the wrap keeps its photos and an alert shows.
- Replace photo: old saved file is deleted from storage only after save succeeds. Failed replace keeps the original.
- CLAUDE.md: `@AGENTS.md` import restored as first line.

**To do / untested**
- Not tested in the browser yet (type check passes, lint unchanged). Test list: edit modal cover badge, Set as cover moving to front, refresh pages for flipping, price-only edit, remove cover, replace + save, replace + close, new wrap, wishlist cover.
- Cleanup SQL (in chat, 2026-10-01) must be run in Supabase AFTER this deploy is live, and soon after. It moves each wrap's real cover to position 0, renumbers photos, and adds a unique index (one cover per wrap). Creates backup table wrap_images_backup_20261001 — drop it once happy. Then run the check query (all zeros).
- Until the SQL runs, wraps whose real cover isn't photo 1 show photo 1 as cover.

**Notes**
- Earlier claim corrected: replacing an already-saved photo never actually deleted the old file (it was just left orphaned in storage), so it couldn't cause broken photos.
- Removing a photo still leaves its file in storage (unchanged behaviour).
- wrap_images RLS already has an owner UPDATE policy, so no policy change was needed.

## 2026-10-01
- Set up CLAUDE.md with project instructions (workflow, trigger words, conventions, stack, speed rules, hard rules, never-touch list).
- Created this SESSION_NOTES.md file.
- Note: the old CLAUDE.md only contained `@AGENTS.md` (the Next.js version warning). That import was replaced as instructed; AGENTS.md itself is unchanged.
