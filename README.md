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
- Firebase Web SDK with Cloud Firestore initialization
- Supabase configuration retained

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file and add the Firebase web-app configuration from Firebase Console → Project settings → Your apps:

```bash
cp .env.example .env.local
```

Set the `NEXT_PUBLIC_FIREBASE_*` values in `.env.local`. These are Firebase web-app configuration values, not service-account credentials. Never put a Firebase Admin service-account private key in a `NEXT_PUBLIC_*` variable or commit it to the repository.

3. Enable Cloud Firestore in the Firebase console, then start the app:

```bash
npm run dev
```

4. Open the app in your browser:

```text
http://localhost:3000
```

Supabase environment variables and status checks remain supported; adding Firebase does not remove Supabase.

## Firebase data and security

The Firebase client and Firestore instance are initialized when the required Firebase web-app config is present. The current page still uses in-memory demo data; organizations, posts, messages, signups, and upload metadata are not yet read from or written to Firestore. Configure Firestore Security Rules and an authentication/membership model before adding persistent user data. Do not use open read/write rules, especially for this kid-focused app. Firebase web configuration is visible to browsers, so access control must be enforced by Security Rules, not by hiding the config.

Cloud Storage uploads are not configured by this change; the current upload control only updates demo state in the browser.
