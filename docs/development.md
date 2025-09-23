# Development Guide

## Prerequisites
- Node.js LTS
- Expo CLI (via `npx expo`)
- A Supabase project with the schema applied

## Install dependencies
```powershell
npm i
```

## Environment
Create `.env` and fill in:
```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Run the app
```powershell
npm run start
```
- Press `w` to open web, or use the Expo Go app / emulators for native.

## Type checking and linting
```powershell
npm run typecheck
npm run lint
```

## Database migrations
Apply SQL files under `supabase/migrations` in order. Use the Supabase SQL Editor:
- `0001_init.sql` → `0008_scoring_views.sql`

Promote an admin user:
```sql
update users set is_admin = true where email = 'you@example.com';
```

## Troubleshooting quick checks
- Ensure `.env` values match your Supabase project.
- Confirm your signed-in user exists in `users` and has `is_admin = true` to see admin tools.
- If events do not show, verify the `events` table contains upcoming rows (by `date_time`).
- If delete fails, check RLS: `events_admin_write` requires admin.
