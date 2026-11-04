# Lego Fun

Next.js app using Supabase for authentication, organization data, realtime chat/feed updates, and private video storage. The UI contains no seeded/mock organizations, messages, posts, or media.

## Configure Supabase

1. Create a Supabase project.
2. In its SQL Editor, run `supabase/schema.sql` in full. This provisions tables, RLS policies, membership/signup RPCs, a private media bucket, and Realtime publication entries.
3. In Supabase Auth settings, configure email confirmation and production SMTP. Keep public signups appropriately restricted; use caregiver-managed accounts and review consent/privacy obligations before processing children's data.
4. Copy `.env.example` to `.env.local` and set the Project URL and anon/publishable key from Supabase Project Settings → API. Never use a service-role key in the browser or a `NEXT_PUBLIC_*` variable.
5. In Vercel, import the repository with the **Next.js** preset and root directory. Add the same two public Supabase variables to Preview and Production environment settings. Use Node.js 20+. Deploy after the schema and auth settings are ready.

Vercel cannot create or infer the Supabase project or credentials. Until those external steps are completed, the app intentionally displays setup instructions rather than falling back to fake data.

## Local development

```bash
npm install
cp .env.example .env.local
# set the Supabase values in .env.local
npm run dev
```

Validation scripts: `npm run lint`, `npm run typecheck`, `npm run build`.

## Features and limitations

- Caregiver email/password sign-up/sign-in uses Supabase Auth.
- Authenticated members can create/join organizations; RLS protects org data.
- Posts and team chat are persisted in Postgres and refreshed through Supabase Realtime.
- Daily signup limits are enforced transactionally by a database RPC, not only in the UI.
- Private video files are uploaded to Supabase Storage with a 100 MB limit and access is provided using short-lived signed URLs.
- Admin moderation, reporting/blocking, parental consent/age assurance, retention/deletion workflows, custom SMTP, rate limiting, and legal/privacy review still need to be planned and configured for an actual child-directed service. Do not claim regulatory compliance from this starter schema alone.
