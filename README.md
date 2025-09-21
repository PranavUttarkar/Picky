Picky (Expo + Supabase)
=======================

Mobile app for TAMU students to discover campus events and decide with friends.

Stack
- Expo (React Native, expo-router)
- Supabase (Auth, DB, Storage)

Quick start
1) Install dependencies

```powershell
npm i -g expo-cli ; npm i
```

2) Set env (Expo will read EXPO_PUBLIC_ vars)

Create `app.config.ts` already includes the defaults. To override, add a `.env` and run with `expo start --clear`.

Required:
- `EXPO_PUBLIC_SUPABASE_URL=https://osjqpxscuycbgtbojngb.supabase.co`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY=...anon key...`

3) Run the app

```powershell
npm run start
```

Database schema
- Apply SQL in `supabase/migrations/0001_init.sql` to your Supabase project (SQL Editor).

Notes
- Magic link auth restricted in UI to `@tamu.edu` emails. You can skip onboarding during development.
- Interests picker currently writes to `user_interests_temp`. You can later map to `interests` and `user_interests` via a function/trigger.
- This scaffold includes Home, Groups, Saved, Profile tabs and onboarding flow.

Next steps
- Implement groups listing, polls creation and realtime voting
- Add event details screen and calendar integration
- Add push notifications using Expo Notifications
# Picky