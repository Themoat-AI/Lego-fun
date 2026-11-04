# Lego Fun

A kid-friendly LEGO organization app with:

- Username creation and kid-safe validation
- LEGO organizations for clubs and teams
- Daily signup tracking with a max of 15 people per day
- Project and part requests
- Classroom-style live stream feed
- Team chat for organizations
- Google Drive-style shared media library for uploaded videos
- Supabase and Firebase status checks, with safe demo mode if credentials are missing

## Stack

- Next.js
- TypeScript
- React
- CSS modules via global stylesheet

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start the app:

```bash
npm run dev
```

3. Open the app in your browser:

```text
http://localhost:3000
```

## Environment variables

Copy the example file and add your real credentials:

```bash
cp .env.example .env.local
```

Optional values used by the app for Supabase and Firebase readiness checks:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`

If the credentials are not filled in, the app stays in safe demo mode instead of crashing.

## Notes

This is a polished front-end prototype focused on the requested product flow. It is designed to be expanded with real Supabase auth, chat tables, Firebase Firestore, and Google Drive API integration once credentials are added.
