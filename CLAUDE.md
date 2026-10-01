# WrapApp (dipdesk) — Claude Code instructions

## Start of every session
- Read SESSION_NOTES.md (repo root) to see where we left off.

## Trigger words
- "commit" = commit and push all changes with a short message.
- "notes" = add a dated entry to the top of SESSION_NOTES.md (create it if it doesn't exist). Briefly cover: what was changed this session (files and features), anything untested or unfinished, any bugs or issues found, and any decisions made. Short, plain English. Newest entry at the top.

## How we work
- Blair plans in a separate Claude chat and sends you build prompts. Your job is building and editing files directly.
- Always read the actual files before editing. Never guess existing code.
- For bigger batches of changes, keep going and only stop when something needs Blair to test or make a decision.
- Ask ONE question at a time, short and direct.
- Check your work before finishing (re-read changed files, run a type check / build where useful, fix any errors).
- At the end, give a short plain-English summary of what changed and what Blair should test, on desktop and on mobile.

## Running and committing
- Blair runs `npm run dev` himself in the VS Code terminal. Don't leave a dev server running. Local preview is http://localhost:3000.
- Only commit/push when Blair says "commit".
- Vercel auto-deploys from main after a push.

## Conventions
- VS Code autosave is ON.
- Terminal is Windows PowerShell: chain commands with `;` never `&&`.
- Secrets go in .env.local and Vercel env vars, never committed.
- Database changes: don't run them yourself. Give Blair SQL to paste into the Supabase SQL editor.
- Supabase .neq() drops null rows — account for nulls.
- Compare UUIDs with String(), never Number().
- Node.js 24.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS, Supabase (auth, database, storage), Vercel.
- Flow: local folder → GitHub (blairchapman632-glitch/dipdesk) → Vercel.
- Live site: https://wrapapp.com.au

## About the project
- WrapApp, repo name dipdesk. A mobile-first social platform for babywearing wrap collectors — "Letterboxd for wrap lovers": collection, showcase, discovery, community, with buying/selling as a secondary layer. A social alternative to WrapTrack.
- Users are wrap collectors, mostly on phones. Mobile must be fully functional. When designing, think how Instagram would do it.
- Main pages: Dashboard (own collection + activity feed), Explore (feed, users, wraps, active dips), Wishlist/ISO, Messages, Tools, Profile (user/[id]), Dips (create-dip, dips/[id]), Admin.
- Built features: collection management with photos, likes, follows, ISO/wishlist, messaging, notifications (incl. push), dips with multi-user dibs (dibs table; dibs_user_id on wraps is legacy/unused), dip-live notifications, Google Sheets dip sync.

## Speed rules (apply to every page)
- Cache-first: read from localStorage and show instantly, then refresh from Supabase silently in the background.
- Never show a spinner if cached data exists.
- Never wait for auth before showing cached content.
- Run Supabase queries in parallel with Promise.all; combine queries where possible.
- Cache every result immediately after fetching.

## Hard rules
- All inputs use text-[16px] (prevents iOS zoom), never text-sm.
- No Supabase join syntax (e.g. profiles(full_name)) unless the foreign key is configured — use separate queries and merge with a map.
- Profile updates need the service role key (anon key fails silently).
- When data isn't loading, check the select string for missing fields first.
- Never suggest localStorage.clear() as a fix.

## Never touch (unless the task is specifically about it)
- Database: don't delete tables/columns or change existing data without asking.
- Secrets: never edit or commit .env.local.
- Working systems: dip flow, Google Sheets sync, push notifications.
- Auth/login: don't change how sign-in works.
