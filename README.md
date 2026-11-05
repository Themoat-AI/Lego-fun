# Lego Fun

A live, guest-access LEGO club workspace built with Next.js, TypeScript, and Supabase. It includes anonymous Supabase Auth sessions (no email required), persistent profiles, clubs, posts, chat, daily signups, realtime updates, and private video storage. The database starts empty; the app contains no seeded mock data or demo fallback.

## Configure Supabase

1. Create a Supabase project.
2. In **Project Settings → API**, copy the Project URL and public anon/publishable key. Never use a service-role key in the browser or commit secrets.
3. Run both SQL files, in filename order, in the Supabase SQL Editor:
   - `supabase/migrations/20261105000000_live_workspace.sql`
   - `supabase/migrations/20261106000000_guest_invite_codes.sql`
4. In **Authentication → Providers → Anonymous**, enable anonymous sign-ins. The app does not require email authentication. A guest account is tied to its browser session and may not be recoverable if browser data is cleared.
5. Set the Supabase Auth site URL to your Vercel domain and add your production domain and `http://localhost:3000` as allowed URLs if needed.
6. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` and Vercel environment variables, then redeploy.
7. Run `npm install` and `npm run dev` for local testing.

Create a club and share its invite code only with people you trust. Club posts, chat, and video files remain limited to club members by row-level security. No sample content is inserted.

## Features and safety notes

- Anonymous sign-in; no email address is requested. Guest access still uses Supabase Auth so database policies can identify each session.
- Persistent profiles, clubs, membership, posts, messages, daily signup records, and media metadata.
- Club membership and daily signup caps are enforced in database functions.
- Live feed, chat, membership, and media-list refreshes via Supabase Realtime.
- Private video bucket, member-only reads, signed links, MIME allowlist, and 50 MB limit.
- Shareable invite codes allow trusted guests to join without making clubs or their content publicly browseable.

Guest sessions are not recoverable across lost browser sessions. For children, adult moderation, reporting, consent, and privacy review are still necessary; technical access controls are not legal advice or a child-safety certification. This repository change cannot create Supabase credentials or change Vercel settings for you.
