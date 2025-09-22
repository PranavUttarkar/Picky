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
- Apply SQL in `supabase/migrations/*.sql` to your Supabase project (SQL Editor), in order by filename.
- Order (recommended): `0001_init.sql` → `0002_views.sql` → `0003_alter_events_rsvp.sql` → `0004_alter_groups_invite.sql` → `0005_rls.sql` → `0006_admin_and_indices.sql` → `0007_polls_votes.sql` → `0008_scoring_views.sql`.
- After applying, create at least one user via the app, then promote to admin:

```sql
update users set is_admin = true where email = 'you@tamu.edu';
```

Notes
- Magic link auth restricted in UI to `@tamu.edu` emails. You can skip onboarding during development.
- Interests picker currently writes to `user_interests_temp`. You can later map to `interests` and `user_interests` via a function/trigger.
- This scaffold includes Home, Groups, Saved, Profile tabs and onboarding flow.

Scoring RPCs
- Personal feed scores: call `rpc('get_user_event_scores')` to get rows `{ event_id, match_percent }` for the current user.
- Group feed scores: call `rpc('get_group_event_scores', { p_group_id: '<group uuid>' })` to get rows `{ event_id, match_percent }` for that group (caller must be a member).

Example (TypeScript)
```ts
const { data: personalScores, error } = await supabase.rpc('get_user_event_scores');
const { data: groupScores } = await supabase.rpc('get_group_event_scores', { p_group_id: groupId });
```

Next steps
- Implement groups listing, polls creation and realtime voting
- Add event details screen and calendar integration
- Add push notifications using Expo Notifications
# Picky