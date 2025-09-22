Picky
=====

Discover campus events and decide together with friends. Built with Expo (React Native) and Supabase.

Highlights
- Personalized event feed with tag-based matching and server-side scoring
- Save events, view details, open RSVP, and add to calendar
- Onboarding flow for interests and group creation/join
- Expo Router navigation with bottom tabs and nested stacks

Tech stack
- `expo` + `react-native` + `expo-router`
- `@supabase/supabase-js` for auth and data
- `dayjs` for date/time

Project structure
- `app/` routes (expo-router)
  - `_layout.tsx`: root stack (tabs, event/poll detail, onboarding)
  - `index.tsx`: entry; checks auth and redirects to tabs
  - `(tabs)/_layout.tsx`: bottom tabs (`home`, `groups`, `saved`, `profile`)
  - `(tabs)/home.tsx`: main event feed, admin CRUD, filtering, details modal
  - `(tabs)/groups.tsx`: user’s groups list
  - `(tabs)/saved.tsx`: saved events list
  - `(tabs)/profile.tsx`: simple profile with sign-out
  - `events/[id].tsx`: full event details with calendar + RSVP
  - `polls/[id].tsx`, `polls/new.tsx`: placeholders for poll feature
  - `onboarding/*`: welcome (auth), interests, group create/join
- `services/`
  - `supabase.ts`: client setup (persists session via AsyncStorage)
  - `profile.ts`: `ensureProfile()` upserts `users` row on sign-in
- `theme/ThemeProvider.tsx`: color scheme + safe area provider
- `types/models.ts`: shared TypeScript models
- `supabase/migrations/`: SQL migrations in order

How the app flows today
1) Launch → `app/index.tsx`
	- Loads Supabase session, ensures `users` row via `ensureProfile()`, then redirects to `/(tabs)/home`.
	- If not authenticated, many screens will redirect you to `/onboarding/welcome` when you try to access gated actions.
2) Onboarding
	- `welcome`: Email/password sign up or sign in. On success, `ensureProfile()` then send to `onboarding/interests`.
	- `interests`: Select at least 2 interests. Writes to `user_interests_temp` and proceeds to `onboarding/group`.
	- `group`: Create a group (generates invite code) or join via ID/code; can skip to tabs.
3) Tabs
	- `home`: Event feed
	  - Loads upcoming events from `events`. If too few, injects a set of clearly labeled dummy events (negative IDs) so the UI feels full.
	  - Search box: supports plain text and `#tag` filters; also provides tag chips (multi-select AND logic).
	  - Modes: View All (chronological) vs Personalized (sorted by match%). Personalized uses `rpc('get_user_event_scores')` when available; otherwise falls back to a local overlap estimate.
	  - Save/Unsave: persists to `saved_events` (requires auth; disabled on dummy events).
	  - Details: opens a modal with time, location, tags, description, add-to-calendar shortcut, and RSVP link.
	  - Admin tools: if `users.is_admin = true`, shows an expandable CRUD form to create/update/delete real events.
	- `groups`: Lists groups the user belongs to from `group_members` → `groups`.
	- `saved`: Shows user’s saved events and links to event detail pages.
	- `profile`: Sign out.
4) Detail screens
	- `events/[id]`: Full details; native add-to-calendar (via `expo-calendar`) and open RSVP link.
	- `polls/*`: Placeholders for future voting flows.

Data model (simplified)
- `users (id uuid PK, email text, is_admin bool)`
- `events (id int PK, title text, description text, image_url text, date_time timestamptz, location text, tags text[], rsvp_url text, created_by uuid)`
- `saved_events (user_id uuid, event_id int)`
- `groups (id int PK, name text, invite_code text, created_by uuid)`
- `group_members (group_id int, user_id uuid)`
- `user_interests_temp (user_id uuid, names text[])`
- RPC: `get_user_event_scores()` returns `{ event_id, match_percent }`

Environment setup
1) Install deps

```powershell
npm i
```

2) Configure env vars (Expo reads `EXPO_PUBLIC_*`)
- Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3) Apply database schema
- Run SQL files in `supabase/migrations` in order: `0001_init.sql` → `0008_scoring_views.sql`.
- Optionally promote an admin account:

```sql
update users set is_admin = true where email = 'you@example.com';
```

4) Run the app

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