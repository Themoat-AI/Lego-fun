# Lego Fun

A live, guardian-managed LEGO club workspace built with Next.js, TypeScript, and Supabase. It includes authenticated profiles, clubs, member limits, build-day signups, a realtime feed and chat, and private video storage. The app contains no seeded sample records and does not fall back to mock data.

## Configure Supabase

1. Create a Supabase project.
2. In **Project Settings → API**, copy the project URL and the public anon/publishable key. Never use a service-role key in the browser or commit secrets.
3. Run `supabase/migrations/20261105000000_live_workspace.sql` in the Supabase SQL editor, or apply it using the Supabase CLI.
4. In Supabase Auth settings, configure the site URL and redirect URLs for localhost and your production domain. Keep email confirmation enabled and use a guardian-managed email account. Configure SMTP for reliable production confirmation email.
5. For local development, copy `.env.example` to `.env.local` and set:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
6. In Vercel, add the same two public Supabase values to the Production (and Preview, if wanted) environment, then redeploy.
7. Install and run:

```bash
npm install
npm run dev
```

The schema is initially empty: create an account and club in the app. No mock records are supplied. Accounts are intended to be controlled by a parent/guardian; do not collect children's email addresses or sensitive personal information.

## Live features and access controls

- Supabase Auth email/password sign-up and sign-in; guardian email confirmation depends on your Supabase Auth settings.
- Persistent profiles, clubs, membership, posts, messages, and daily signup records.
- Row Level Security restricts club content to members; membership and daily signup limits are enforced by database RPCs so concurrent requests cannot bypass the limits.
- Realtime updates for the feed, chat, membership, and media list. The migration adds the tables to the `supabase_realtime` publication.
- Private `org-media` storage bucket, member-only object reads, signed video links, MP4/MOV/WebM allowlist, and 50 MB upload cap.
- No Firebase dependency and no mock-data fallback.

## Production checklist

Before inviting families, review child privacy and consent requirements applicable to your location and use case, establish adult moderation/reporting and account-removal processes, test RLS with separate accounts, and configure backups, SMTP, and Supabase/Vercel billing limits. This software's technical controls are not legal advice or a child-safety certification. Real-time status and uploads require the Supabase project setup above; this GitHub change cannot create credentials or change your Vercel project settings for you.
