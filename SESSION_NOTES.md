# Session Notes

## 2026-11-11 — App launch always lands on Home
- `app/components/AppLayout.tsx`: on the first page of a fresh launch (sessionStorage `wrapapp_launched` empty), a bare `/dashboard` (no query string) is replaced with `/explore`, then the flag is set. This fixes old home-screen installs that saved `/dashboard` as start_url (iOS never updates it). It works in the installed app and normal browsers. Links with a query (`?add=1`, `?report=true`, `?google=…`) and all in-app navigation to Profile are untouched.
- `public/sw.js`: the push notification fallback URL is now `/activity` (was `/dashboard`). `app/api/push/route.ts` has the same fallback and was changed to match. Every current caller passes its own url anyway.
- Checked: login, Google sign-in, password reset, `/` when logged in and manifest start_url all go to /explore.
- Side effect: opening wrapapp.com.au/dashboard in a brand-new browser tab also lands on Home (by design, it's a fresh session). Refreshing an existing tab stays on Profile.
- Untested on a device: an old iPhone home-screen install should now open on Home. The new service worker may take one app open to activate.

## 2026-11-10 — Explore filter: "Available" → "For Sale"
- `app/explore/page.tsx`: the filter sheet option is now labelled "For Sale". Label only; the internal value stays `for-sale` and behaviour is unchanged. No other user-facing "Available" text for this filter (the only other "Available" is the username checker, which is unrelated).
- Note: this filter also shows wraps that are in an active dip, not just ones marked for sale (unchanged).

## 2026-11-10 — Profile ISO tab shows the list (not committed yet)
**Changed**
- New shared `app/components/IsoList.tsx`: the whole ISO list moved out of `app/wishlist/page.tsx`, with the logic word for word: data loading, cache keys, tiles, wrap view, like/ISO toggle, notes, Contact Seller. The only differences: it uses the shared toast, and the empty state is now "Nothing on your ISO yet" plus a hint (tap ⭐ on any wrap).
- `/wishlist` is now a thin wrapper with the same heading, card and grid (`layout="page"`).
- Profile ISO tab: the "Open my ISO list" button is gone, and the list shows in the tab (`layout="profile"`: 2 columns on phone, 3 on desktop, like the Collection grid). It only mounts the first time the tab is tapped, so the profile doesn't load ISO data up front. After that it stays mounted but hidden, so switching back is instant. Cache shows first, then a silent refresh.

**Notes**
- Lint flags "setState in effect" in IsoList. That's the original wishlist cache-loading code, unchanged.

## 2026-11-10 — Navigation restructure: Explore = Home, Home = Profile (not committed yet)
**Changed**
- Nav (`app/components/AppLayout.tsx`): phone tabs Home (/explore) · WDYWT · ➕ · Messages · Profile (avatar, /dashboard). ➕ opens a Create sheet: Add a wrap (/dashboard?add=1 or `wrapapp:add-wrap` event), Post WDYWT (/wdywt?post=1 or `wrapapp:post-wdywt` event), Start a dip (/create-dip), Cancel. Desktop: Home, WDYWT, Messages, then ♡, ➕ and avatar. ♡ with unread badge in the phone top bar on every page (except message threads) and the desktop nav → /activity. The badge stays in sync via the `wrapapp:unread` event.
- New `/activity` page: the old Activity column, same data/cache/logic. The dashboard code moved to `app/dashboard/ProfileDashboard.tsx` with `mode='profile'|'activity'`; `dashboard/page.tsx` and `activity/page.tsx` are thin wrappers. Push urls for likes/wishlists → /activity.
- Login, Google sign-in, reset password, `/` when logged in and the PWA start_url all land on /explore.
- Profile (/dashboard): header kept; segmented tabs Collection · For Sale · Dips · ISO. Dips = My Dips + Dip History (incl. unarchive, moved from Settings). ISO links to /wishlist. Collection/Activity switch and Activity column removed; single 960px column.
- Other users' profiles (`app/user/[id]`): same header layout with Follow + Message, tabs Collection · For Sale · Dips (their active dips; tap opens the wrap). Wraps in an active dip get a "🎲 In a dip" badge. Follow updates the follower count instantly. Active dips are now cached. Opening your own /user/[id] redirects to /dashboard.
- Public page (`app/[username]`): profile-style header (wrap/follower/following counts, server-side counts only), tabs Collection · For Sale, "Join WrapApp" + "Log in" at the top, small phone bottom banner "See more collections, join WrapApp". Private profiles unchanged. Logged-in visitors see "My profile".
- Settings (`app/tools`): Dip History removed (now on Profile → Dips), replaced with a one-line pointer. Start a Dip stays.
- `lib/usernames.ts`: 'activity' added to reserved usernames.

**Decisions / notes**
- The WDYWT tab on other people's profiles was dropped (spec listed Collection · For Sale · Dips only). Its data still loads, so it's easy to bring back.
- DB `generate_username` now reserves 'activity' too (SQL run by Blair, checked: "Activity" → activity2).
- Supabase Auth: https://wrapapp.com.au/explore added to the allowed redirect URLs (done by Blair).

**Untested**
- Everything above on a real phone; ➕ options from each page; ♡ badge clearing; the public page logged out.

## 2026-11-10 — Phone fixes batch 4
**Changed**
- WDYWT: back to cards on phone (12px side margin from the page padding, rounded-2xl, light grey border, subtle shadow, photo with rounded top corners, 16px between posts).
- Home filter row: pills h-[34px], text-sm, gap-1.5, px-2.5 (px-3 would total ~355px vs ~351px available at 375px, cutting off "Type"). The pills grow to share spare width but never shrink, so the row still scrolls when "Clear" appears. Inputs under the pills stay 16px.
- Home tabs: iOS-style segmented control (gray-100 rounded-xl track, p-1; selected = white pill, soft shadow, bold dark text; unselected gray-500), grid/heart icons kept, Activity shows a pink count pill when unread > 0. Top-bar ♡ still opens Activity.
- Bottom nav: padding-bottom is now max(6px, safe area) instead of 6px + safe area (that left a big empty white band on iPhones). Nav height = 48px + max(6px, safe), min 60px. Main bottom padding reduced to 5rem + safe area (still clears it). Message thread panel bottom updated to max(60px, 48px + safe area) so its input sits just above the nav. Install banner moved down to match.

**To do**
- Check on the live site on an iPhone: no white band under the nav, all five filter pills visible, Activity tab obvious, message input just above the nav.

## 2026-11-10 — Phone UI polish batch 3
**Changed**
- Top strip: the page didn't fill the screen (no `viewport-fit=cover`) and the html/body were grey (#f9fafb / bg-gray-200) while pages are white, so iOS showed a blurred grey strip behind the status bar. Now: `viewport` export in `app/layout.tsx` (viewportFit cover, themeColor white, colorScheme light), white html/body, manifest theme/background white (the old pink theme-color meta was removed). Safe-area insets are now real on iPhones, so everything padded with env(safe-area-*) now actually gets the padding.
- Phone top bar (AppLayout, md:hidden): sticky, white, grey bottom line, 48px + safe area, "WrapApp" wordmark. New `phoneTopRight` prop; Home passes ♡ (opens Activity, unread badge) and + (Add Wrap). Hidden on message threads (they have their own full-screen header). Message thread panel now sits between the safe-area top and the real nav height. Explore's sticky search bar sticks just below the top bar on phone.
- Home: Instagram tabs (Collection / Activity, icon + text, pink underline, grey divider) replace the gradient pill. "Your Collection" heading removed; "+ Add Wrap" only from md up (phone uses the top-bar +). Activity: "Mark all read · Clear all" small text buttons (Clear all red, confirm sheet). No "ACTIVITY" label (FOR SALE kept). Rows show just the date (for-sale keeps price • date). Line-style gear SVG in the profile buttons.
- Explore: "🎲 Being dipped" is now a small white badge (fuchsia text) top-left like For Sale, stacked above it when both apply. Follow pills smaller and lighter (pink-50 / pink-200 border / pink-600 text, h-7 text-xs); Following = grey.
- WDYWT: title text-xl + small grey subtitle; + Post is a small round pink icon button (✓ when posted today). Posts edge to edge on phone (no rounded card or side margins, thin dividers), card style from sm up.
- Messages list: same title style and round pink + button; plain Instagram-DM rows (no borders/shadows/chevrons), 52px avatars, full name bold, one-line grey preview, small grey date on the right; unread = bold preview + pink dot. Leading/trailing quote marks stripped from previews.

**Not done**
- WDYWT wrap tag: posts have no linked wrap (wdywt_posts has only id, user_id, photo_url, thumbnail_url, caption, created_at), so there's nothing to tag. It needs a wrap_id column + a wrap picker when posting — a separate (DB) change if wanted.

**To do**
- Test on the live site on a phone (incl. installed-to-home-screen mode): no grey strip, top bar under the notch, nothing scrolls sideways at 375px, message thread composer above the nav.

## 2026-11-10 — Phone fixes: Home sideways scroll + easier bottom nav
**Changed**
- Home sideways scroll. Culprit: the Home layout grid (`grid gap-4 xl:grid-cols-[3fr_1fr]`) had a single *auto* column on phones. Auto grid columns grow to the widest unshrinkable content, and the new no-wrap filter-pill row (horizontal scroller) made the column as wide as all the pills together → the page was wider than the screen. Fix: `grid-cols-1` (= minmax(0,1fr)) + `min-w-0` on both sections (`app/dashboard/page.tsx`).
- Safety net: `overflow-x-clip` on the AppLayout wrapper (clip, not hidden, so sticky bars still work; scroll rows still scroll inside themselves).
- Bottom nav (`app/components/AppLayout.tsx`): each tab fills its whole fifth of the bar (full width + height, padding included) with 6px top padding and 6px + safe-area bottom padding. Icons 26px, labels 12px (font-medium; active font-semibold pink). Still no borders/boxes. Main bottom padding is now 7rem + safe area so content clears the taller bar; the install banner moved up to match.

**To do**
- Test on the live site on a phone: Home no longer drags sideways; filter row and Suggested collectors still scroll; nav tabs easy to hit; content not hidden behind the nav.

## 2026-11-10 — Explore + global polish (visual only)
**Changed**
- `app/globals.css`: base-layer rule so a plain `border` is gray-200 (Tailwind v4 defaulted it to currentColor = near-black). Explicit border-* colours still win. Confirmed in the built CSS.
- Explore (`app/explore/page.tsx`):
  - "Collections" → **Suggested collectors** with "See all" (switches to the Users view). Shows people you don't follow (people followed on this visit stay, as "Following"), never yourself, nobody with 0 wraps, up to 10, newest wrap activity first then wrap count. Worked out from data already loaded — no new queries.
  - One horizontal scrolling row (hidden scrollbar) on phone and desktop. Instagram-story items: 64px avatar, name (truncated), wrap count, small Follow pill below. Nothing overlaps the avatar; no card boxes. The section hides when there's nobody to suggest.
  - Searching / Users view shows the same items under "Collectors" (wrapping), with Back on the Users view.
  - Follow/unfollow logic moved into one `toggleFollowUser` (same queries). Toasts now use the shared toast (it was sitting behind the bottom nav).
  - Featured cards: dip banner always "🎲 Being dipped", fixed 28px height. The For Sale badge moves under the banner when both show. Fixed text area (name 1 line, brand 1 line even if empty, owner pill) so cards line up. 2 columns on phone, 3 on desktop.
  - Content capped at 960px, centred. Sticky search bar: solid white, full width, padding, light grey bottom line, grey-tinted search box.
- Widths: profile page (`app/user/[id]`) capped at 960px; Home capped at max-w-6xl (wider because of the desktop Activity column).

**To do / untested**
- Not yet tested on phone/desktop (type check + build pass). Not committed (this and the previous UI batch).

## 2026-11-10 — UI polish batch (visual/UX only; dip pages, auth, push, Sheets untouched)
**Changed**
- Bottom nav (`app/components/AppLayout.tsx`): plain icons + labels on white (no boxes, no pink fill). Active = pink-600 with a bolder icon; inactive gray-500. "Me" avatar gets a pink ring when active. Badges, safe area and 56px tap height kept. Desktop nav: no bordered boxes; active = pink text on a light pink background.
- New shared components:
  - `app/components/Toast.tsx`: `showToast()` / `askConfirm()` (+ `useToast` / `useConfirm`). `<FeedbackHost/>` is mounted once in AppLayout. The confirm is a bottom sheet on phone and a centred card on desktop; red confirm button for deletes, pink for non-destructive.
  - `app/components/useLockBodyScroll.ts`: stops the page scrolling behind open sheets (counts nested sheets).
  - `app/components/Sheet.tsx`: shared classes for full-screen (phone) / centred (desktop) popups + a phone-only "‹ Back" top bar with safe area.
- Every alert()/confirm() outside the dip pages replaced: Dashboard (photo errors, save errors, report copy, delete wrap, delete all notifications, move to Departed, close while uploading/saving), Messages thread (delete conversation), Tools (unarchive dip), Admin (broadcast, deactivate/reactivate). The user profile page uses the shared toast.
- Home (Dashboard): Instagram-style profile header above the Collection/Activity toggle — avatar, name, @username, Wraps / Followers / Following counts, bio + location, then Edit profile / Share / ⚙. Profile + follow counts are cached (`dipdesk_dashboard_follow_counts`) and loaded inside the existing parallel batch (the profile query and the last_active update no longer block). "+ Add Wrap" stays by "Your Collection"; the old Share button was removed.
- Share: copies `wrapapp.com.au/<username>` (falls back to `/user/<id>`). Phones use navigator.share when available, else copy + "Link copied" toast.
- Inputs: every input/select/textarea outside the dip pages and auth pages now uses text-[16px] (29 fixed, incl. the wrap form ones that dropped to 14px at xl). The sign-in and reset-password pages already used 16px via their own CSS and were left alone.
- Tools page reads as Settings: "Settings" heading, Profile / Account / Dips sections, "View my public profile" (→ /username, or /user/<id>), consistent 44–52px rows.
- Popups on phones: wrap view (Dashboard, Explore, profiles, Wishlist), add/edit wrap and the report are full-screen sheets with a "‹ Back" bar. Image previews go edge to edge. The Explore filter sheet and the WDYWT post sheet got safe-area padding + slide-up. Desktop keeps the centred modals. The page behind is scroll-locked. Contents and saving unchanged.
- Filter rows (Dashboard collection + Explore filter sheet): one horizontally scrollable row, pills sized to text (text-sm), "Clear" as the last pill.
- Light-only: removed the dark-mode media query, set `color-scheme: light` (globals.css). Added `.no-scrollbar` and a phone-only slide-up animation.
- Consistency: Dashboard has one primary (pink gradient) and one secondary (outline) button style.

**To do / untested**
- Not yet tested on a phone or desktop (type check + build pass). Test list in chat. Not committed.
- Lint: no new errors from this batch (only a no-img warning on the new header avatar, the same as the rest of the app). The lint now reports some older hook issues further down already-existing components (set-state-in-effect, "accessed before declared"); those are existing code, left alone.

## 2026-11-09 — Security: follows RLS, test table, dips column privacy
**Database (Step A, run)**
- `follows`: RLS turned on. Anyone can read; you can only insert/delete rows where you are the follower (no update policy — the app never updates follows).
- `test` table dropped (unused, 0 rows).
- New owner-only view `my_dips` (`select * from dips where user_id = auth.uid()`), granted to authenticated only.

**Changed (code)**
- Own dips now read from `my_dips`: dip page load (`app/dips/[id]/page.tsx`), Dashboard My Dips (needs likes/status), Tools Dip History (archived, `*`).
- Create dip insert returns only `id` (`.select('id')`) instead of every column.
- Other-user dip reads were already public-columns only (Explore, /user/[id]). The public page uses the server key. All dip updates/deletes filter on `id` only and return nothing.

**To do**
- Step B (NOT yet run — after this deploy is live): revoke SELECT on dips from anon+authenticated, grant public columns only (id, user_id, title, brand, wrap_name, wrap_id, total_spots, price_per_spot, stage, archived, facebook_group, created_at). Optional: drop the weaker duplicate dip policies "Users can insert own dips" / "Users can update own dips" so the wrap-ownership check always applies. SQL is in chat.
- Also still pending from earlier: profiles/wraps Step B (if not yet run).
- After Step B test: follow/unfollow + counts, create a dip and open it, stage changes, save dip details, Dashboard My Dips, Tools Dip History + unarchive, Explore dipping badges/filter, another user's profile "Currently being dipped", public page logged out.
- Note: an admin opening someone else's dip page now gets "Dip not found" (my_dips only returns your own). Nothing links admins there today.
- New dips columns later: recreate `my_dips` and update the Step B grant if public.

## 2026-11-09 — Privacy lockdown (code side): emails + private wrap fields
**Found**
- Anyone (even logged out) could call `set_user_active_status` and ban any user. Fixed by SQL Step A (super_admin check).
- `admin_user_overview` view ran with owner rights and was granted to anon/authenticated, so every email was readable. Replaced by the admin-only function `admin_user_overview()` (Step A). The view is dropped in Step B.
- Every column of profiles and wraps was readable with the public key (RLS `true` can't hide columns).

**Changed (code)**
- Admin page uses `rpc('admin_user_overview')`.
- Own wraps with private fields come from the owner-only view `my_wraps`: Dashboard collection, create-dip wrap tiles, and your own /user/[id] page.
- Other people's wraps select public columns only: Dashboard notification wraps, Explore (3 queries), other users' /user/[id], Wishlist embed. Other profiles now sort by newest (purchase_date is private). Private fields were removed from those pages' Wrap types.
- Hidden from other members: Sold To, Sold Price, On loan / On Holiday With, and purchase date/from/country (Explore sheet, Wishlist sheet, Dashboard read-only view from notifications, other profiles). Sold Date stays public. Owners still see everything on their Dashboard and their own profile.
- Deleted the dead Dashboard community-wraps query (+ its unused profile lookup) and Explore's dead purchase-price ranking.
- Wrap counts use `select('id', { count, head })` instead of `*`.
- Checked every write to wraps/profiles (15 writes: avatar ×4, last_active, username sheet, feedback hub ×2, city/country, name, bio, sign-up insert, wrap update/insert/delete). None returns or filters on private columns; only wrap insert returns, and it returns `id`. Sold/loan/dibs all go through the normal wrap save. RLS policies on other tables only read wraps.id / wraps.user_id (stay public). Triggers don't read private columns. No code change was needed for writes.

**Database**
- Step A (run): set_user_active_status admin check, admin_user_overview() function, my_wraps view, anon revoked on the old view.
- Step B (NOT yet run — run after this deploy is live): drop admin_user_overview view; revoke SELECT on profiles/wraps from anon+authenticated; grant SELECT on public columns only. SQL is in chat.
  - profiles public: id, full_name, username, avatar_url, bio, city, country, role, feedback_hub_link, is_private, created_at
  - wraps public: id, user_id, name, brand, description, colour, size, material, wrap_type, status, is_favourite, for_sale, for_sale_price, for_sale_currency, for_sale_price_is_pm, sold_date, is_private, created_at, updated_at

**To do / untested**
- After Step B, click through the list in chat (Dashboard, Explore, profiles own+other, Wishlist, Create Dip, Tools, Dip page, Admin as admin + as normal user, Messages, WDYWT, public page logged out, sign-up). "permission denied for column" = a select I missed.
- A new wraps column later must be added to the Step B grant (if public), and `my_wraps` must be recreated (its `select *` is fixed when the view is made).
- Still open: `follows` and `test` have RLS off; active dips expose all columns (payment methods, money goal) to anyone.

## 2026-11-09 — Dip Phase 3 (one-page flow, editing, new create), public pages, token security, auto usernames
**Changed**
- Dip page (`app/dips/[id]/page.tsx`) is one page, no tabs: stage bar → sheet card + Random.org reminder → 👉 Next step card → stage content (Likers / spot list + Add Spot / By player view / winner) → 🧰 Tools drawer (Boost, Payment methods, Dip details, Delete) → "← Back a stage".
  - Live has two states via new column `dips.live_approved_at` (null = submitted, waiting for CU admins). Wishlist notifications send at "Admins approved", not at submit.
  - Next step card: one secondary copy button (white, pink border) and one main action button (pink gradient, the strongest button). Actions check the step first using in-app confirm sheets (no browser confirm/alert anywhere on the page).
  - Auto-moves (forward only, right after the change): last spot filled → Full – collecting payments; last player paid → Ready to draw. Toasts confirm.
  - Boost is hidden in Tools until Live is approved (after Live it only appears while a fully-claimed game still needs revealing).
  - Editing: Tools → Dip details is an editable form (name, brand, size, blend, condition, shipping, feedback hub, smoke/pet, likes target, prices, number of spots — can't go below the highest taken spot). Price changes only affect new spots. Tap a spot row → edit sheet (name with suggestions, type, amount, delete). Tap a player row → rename all their spots or pick a spot. All saves trigger the sheet auto-sync.
  - Spot number pickers are 44px grids (no inner scroll boxes).
- Create dip (`app/create-dip/page.tsx`) rewritten as 3 steps: Wrap (collection tiles or "Not in my collection"), Price (money goal → instant suggestion; Adjust prices and Convert currency collapsed), Details (only the name is required). Tap-to-show ⓘ explainers. "Money goal" wording throughout.
- 🎲 Start a Dip button on Tools and the Dashboard. The Dashboard has its own "🎲 My Dips" section, separate from "🔔 Updates".
- Every dip post ends with "🎲 Dip run on WrapApp / See my wrap collection: wrapapp.com.au/[username]" (private profile → just wrapapp.com.au). Not on the admin reveal message or the bare #newinqueue. The old "Managed with WrapApp" line was removed.
- Public collection page `app/[username]/` (server-rendered, cached 60s, service role, safe columns only): profile, active dips, wrap tiles + read-only detail sheet, sticky "Join WrapApp — it's free" on phone, Facebook/OG preview tags. Logged-out Follow/Message/Like → `/?signup=1` (the landing page opens sign-up for that). Private profiles show a "private" page; private and sold wraps are hidden. Old /user/[id] links unchanged.
- Privacy: `profiles.is_private` (Tools → 🌐 My public page) and `wraps.is_private` ("🔒 Hide from my public page" in wrap edit). Both affect logged-out visitors and dip-post links only; logged-in members still see everything.
- Usernames: shared sheet `app/components/UsernameSheet.tsx` (Tools → My public page). Box labelled "Username", starts with the current username, live "Your link" preview, availability check (✓ Available / ✗ Taken / ✗ Not allowed + reason), note that changing it breaks links in past dip posts. Rules in `lib/usernames.ts`: route words reserved for everyone; brand words (wrapapp, wrap.app, dipdesk…) only for super_admin.
- SECURITY: Google tokens moved off `profiles` (they were readable by anyone with the anon key) into `public.google_connections` (RLS on, no policies, server only). New `lib/googleConnections.ts`. The OAuth callback and sheets sync use it. The dip page asks `/api/google/status` (returns connected yes/no only).

**Database (all run in Supabase)**
- `dips.live_approved_at timestamptz` (existing live+ dips backfilled as approved).
- `profiles.username`: lowercase + format check (3–30, a–z 0–9 . _) + unique index on lower(username).
- `profiles.is_private`, `wraps.is_private` (default false).
- `google_connections` table + copy of existing tokens (3 copied).
- Auto usernames: `public.generate_username(display_name, for_user)` + trigger `profiles_set_username`. Run by Claude in chat with one change from my draft: the trigger fires on `update of username, full_name`, and also regenerates the username when the current one is a `wrapperN` placeholder and full_name is set to a real name. Backfill done: 0 missing, 0 bad format. Admin account (720716cf…, super_admin) username set to "wrapapp".

**To do / untested**
- None of Phase 3 is browser-tested yet (type checks pass). Test lists are in chat.
- After this deploy is live, run SQL 3b: re-copy any new Google connections into google_connections, then null `google_access_token / google_refresh_token / google_token_expiry` on profiles. Check the count is 0. (SQL is in chat.)
- Not committed yet — everything since the Google Sheets commit (Phase 1, likers, Phase 2, 3a–3c, tweaks) is uncommitted.
- Still open: emails and all wrap columns (purchase/sold prices) are readable by anyone with the anon key. Tighten next; needs a check of where the app reads email.

**Notes / decisions**
- The public page caches for 60s, so privacy changes can take up to a minute to show. Facebook caches previews; use the Sharing Debugger for links shared before.
- `lib/usernames.ts` reserved lists must be kept in step with the reserved array inside `generate_username`.
- Auto-moves only fire right after adding a spot or marking paid, so going back a stage on purpose isn't undone.
- Super_admin is `profiles.role = 'super_admin'` (not `is_admin`).

## 2026-11-08 — Dip Phase 2: auto Google Sheet, fast names, payments by player
**Changed** (mostly `app/dips/[id]/page.tsx`, plus create-dip wording)
- Auto Google Sheet:
  - A new sheet card above the tabs has Open Sheet ↗ and a status line ("Sheet up to date ✓" / "Updating…" / "Couldn't update sheet — Retry"). The Sync / Create & Sync buttons and the Settings sheet card were removed.
  - The sheet is auto-created on the dip page when the owner is connected and there's no sheet (i.e. right after creating the dip, or after connecting Google). If not connected, one Connect card shows ("Reconnect" if the dip already has a sheet).
  - Auto-sync runs 2s after the last change: add/delete spot, paid, game reveal, winner. Only one sync runs at a time. A pending sync is sent on leave/pagehide. Sync state is saved per dip in localStorage (`dipdesk_dip_sync_<id>`), so a 'dirty' sync catches up on the next visit or after reconnecting.
  - Guards: owner only (the server also checks). A NEW sheet is never created for archived or Drawn dips, enforced by one check inside the sync that reads the latest dip from a ref. Existing sheets on Drawn/archived dips still update.
- Likers: the box keeps focus (keyboard stays up). Adds are instant, then saved in the background. Suggestions after 2 letters come from the seller's last 25 dips (likers + players), are one tap to add, and are cached as `dipdesk_name_history_<userId>`. Duplicate names get a warning, not a block.
- Add Spot: player name suggestions (this dip's liked likers → this dip's players → past players), labelled, one tap fills.
- Spots tab in Full – collecting payments / Ready to draw: 👤 By player view (unpaid first, spot numbers, total owed incl. 🎮 TBD, one Paid button, "Still owed" total at top), with a toggle back to 🎯 All spots. Paid is now optimistic and reverts on error.
- Random.org reminder ("Over $2000 — the draw must use Random.org (+$4.95) and a Google Sheet is required.") on create-dip (calculator + confirm) and on the dip page in Live / Full / Ready to draw.

**To do / untested**
- Phase 2 is not tested in a browser yet (type check passes). Test lists are in chat (incl. archived/Drawn/non-owner sheet checks).
- Phase 1 + likers changes are also still untested.
- Nothing committed yet.

**Notes / decisions**
- Sheet creation lives on the dip page, not create-dip, so two sheets can't be made at once.
- Boost price saves don't trigger a sync (they don't change what's on the sheet).
- Past-name lookup is capped at 25 dips to stay under Supabase's 1000-row default.

## 2026-11-08 — Dip workflow Phase 1 fixes + likers rework
**Changed**
- Investigated the full dip flow (create-dip → archive) as groundwork for a later redesign. Layout and tabs are unchanged for now.
- New `lib/dipStages.ts`: stage values plus friendly labels. "payments" shows as "Full – collecting payments" and "closed" as "Ready to draw" (DB values unchanged). Used on the dip page stage bar, the Dashboard My Dip card, and the Explore/Profile "being dipped" cards.
- create-dip: Facebook Group field removed; new dips save "Chasing Unicorns". Dead game/posts code removed. Price inputs are 16px. Payment trigger saved as 100.
- Dip page (`app/dips/[id]/page.tsx`):
  - Wording follows the CU rules. Payment at 100% (no 80%). Queue = edit the interest post and swap to #newinqueue (copy button copies just the hashtag). Live = a NEW #newlivepost submitted to CU admins (approval can take a week+). "Sheet link in Settings" text removed. All instructions say CU.
  - Game: Copy Game Post now lives in the Active Game card (works after saving). Emoji order is seeded, so preview, copy and reloads match. The Active Game card and Reveal show in any stage once every game spot is claimed. Unrevealed game spots show 🎮 TBD.
  - Bookend spots charge bookend_price_override if set.
  - Winner: out-of-range numbers show an error. An empty winning spot shows "Spot N has no player" and lets the number be re-entered. The winner post only appears with a real player. Archive also saves the winner name.
  - Posts tag full names (@Full Name).
  - Copy failures show a "press and hold the preview" message.
  - Phone: stage bar shows "Stage X of 6: label" plus short 11px labels. Spot rows have Delete on the far left and Paid on the far right (44px), with Paid labelled "all N spots".
  - Speed: dip, spots, likers and game cached in localStorage (`dipdesk_dip_<id>`), shown before paint, refreshed in parallel.
- Likes: the manual Update Likes boxes are removed. The likes count = liker names not marked unliked (top stats box, Likers card, Dashboard card, live post). Tap a name to toggle unliked (crossed out, not counted, never tagged). ✕ deletes. The top likes box turns green with ✓ at the target. The Dashboard counts likers and spots in the background, with cached counts.
- DB (run by Blair in Supabase): `dip_likers.unliked boolean not null default false`, plus an UPDATE RLS policy for dip owners if one was missing.

**To do / untested**
- Phase 1 and the likers changes are not yet tested in a browser (type check passes). Test lists are in chat.
- Confirm the dip_likers UPDATE policy exists (if missing, tapping a name reverts and shows an error).
- Phase 2: dip layout/flow redesign (tabs and stages) still to plan.

**Notes / decisions**
- "Move to Live" still sends wishlist notifications immediately, i.e. when the live post is submitted, not when admins approve it. Decide if that's OK.
- A winning number that points at an empty spot still saves (stage → Drawn), so the seller can fix it after.
- Paid stays per player (marks all of a player's spots), as per the CU rules.
- `dips.current_likes` is no longer read (left in the DB). Existing dips' facebook_group values were not changed (SQL available if wanted).
- On a hard browser refresh the dip page spinner shows until JS loads; in-app navigation shows cached data with no spinner.

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
