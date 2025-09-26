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
	  - Loads upcoming events from `events` (chronological).
	  - Search box: supports plain text and `#tag` filters; also provides tag chips (multi-select AND logic).
	  - Modes: View All (chronological) vs Personalized (sorted by match%). Personalized uses `rpc('get_user_event_scores')` when available; otherwise falls back to a local overlap estimate.
	  - Save/Unsave: persists to `saved_events` (auth required).
	  - Details: modal with time, location, tags, description, add-to-calendar shortcut, and RSVP link.
	  - Admin tools: if `users.is_admin = true`, shows expandable CRUD form to create/update/delete real events.
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

### Editing interests after onboarding

Users can edit interests anytime from the Profile tab via a comma‑separated list (CSV). Example:

```
Music, Food, Tech, Outdoors
```

Rules:
1. Commas or newlines both separate interests.
2. Empty tokens ignored; duplicates removed (first occurrence kept).
3. Client caps list at 24 items for safety.
4. Saves with an `upsert` into `user_interests_temp.names`.

Future ideas: autosuggest popular tags, trending interests, per-interest delete chips, or normalization into a join table.

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

---

## Quickstart

1) Install

```powershell
npm i
```

2) Configure env (.env)

```
EXPO_PUBLIC_SUPABASE_URL=your-project-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

3) Apply migrations (in Supabase SQL Editor)

Files in `supabase/migrations` in order. Promote an admin if needed:

```sql
update users set is_admin = true where email = 'you@example.com';
```

4) Run

```powershell
npm run start
```

## Documentation

Deep-dive docs are in the `docs/` folder:

- `docs/architecture.md` — App layers and data flow
- `docs/data-model.md` — Tables, views, RPCs, indices
- `docs/supabase-policies.md` — RLS and admin rights
- `docs/frontend-home-feed.md` — Feed, filters, personalization, admin UI
- `docs/admin-flows.md` — Event CRUD and delete confirmation modal
- `docs/scoring.md` — Personalization and server RPCs
- `docs/development.md` — Dev setup, scripts, migrations
- `docs/troubleshooting.md` — Common issues and fixes

### Feed Row Card Layout (Update)

The main event feed now uses a compact horizontal row card component (`EventRowCard`) instead of tall vertical cards. Benefits:
- Consistent height for smoother, more predictable scrolling.
- Denser information (title, time, location, tags, actions) in one row.
- Thumbnail (first image) at fixed size for visual alignment.
- Match % badge shown when available.

Actions preserved: save/unsave, open details, start poll, (admin) edit/delete. Full description still accessible via details modal.

If you’re looking for how the admin delete confirmation works, see `docs/admin-flows.md`.

## Deployment (Vercel)

This project is configured for a static export of the Expo (web) bundle and deployment on Vercel with client‑side routing handled by `expo-router`.

Key points:
- We export to a static directory (`dist/`). The `app.config.ts` sets `web.output = 'static'` so `expo export --platform web` writes HTML/JS assets there.
- `vercel.json` uses `@vercel/static-build` with `distDir: "dist"` and adds a filesystem handler plus a catch‑all route: any non-file path (e.g. `/`, `/(tabs)/home`, `/onboarding/welcome`) falls back to `index.html` so the SPA router can resolve it.
- Without the `{ "handle": "filesystem" }` entry, all asset requests might also be routed through `index.html`, or if missing the catch‑all, reloading a nested route (like `/home`) would 404 because Vercel would look for a physical folder. The updated config avoids both issues.

### Deploy Steps
1. Ensure environment variables (Supabase URL and anon key) are configured in Vercel Project Settings using the `EXPO_PUBLIC_*` names.
2. Commit the updated `vercel.json` and push to the `main` branch (or your deployment branch).
3. In Vercel, set the Build Command to rely on the package `build` script (auto-detected) or manually specify:
	```
	npm run build
	```
4. Output directory: leave empty (Vercel reads `distDir` from `vercel.json`).
5. Trigger a deploy. You should see `expo export --platform web` run, producing `dist/`.
6. After deployment, test deep links by directly loading URLs like:
	- `/`
	- `/(tabs)/home` (internal path that redirects from index)
	- `/onboarding/welcome`
	- `/polls/new`

If any path 404s, verify the deployed `vercel.json` in the build output (Project → Deployments → View Source) matches the repo version and that the build actually produced `dist/index.html`.

### Local Production Preview
To simulate the static export locally:
```powershell
npm run build
```
Then serve the `dist` folder with any static server (for example using `npx serve dist`) and test reloading nested routes.

### Common Issues
- 404 on refresh of nested route: missing catch‑all route → ensure `vercel.json` has the routes array with `{ "handle": "filesystem" }` followed by the wildcard mapping.
- Wrong output folder (empty deploy): make sure `distDir` matches the folder produced by Expo export (`dist`).
- Stale assets after deploy: Vercel caches aggressively; force a redeploy or append a cache-busting query parameter during testing.

### Custom Domains & HTTPS
Once verified, attach your custom domain in Vercel. HTTPS is automatic; no extra configuration needed for SPA routing.

---

## Branding assets (icons/favicons)

Place your branding assets in `assets/branding/`:

- App icon (native): update `expo.icon` in `app.json` to point to your PNG (e.g., `./assets/branding/app-icon.png`).
- Android adaptive icon: update `expo.android.adaptiveIcon.foregroundImage` (e.g., `./assets/branding/adaptive-foreground.png`).
- Splash screen: update `expo.splash.image` (e.g., `./assets/branding/splash.png`).
- Web favicons: create files in `assets/branding/` (e.g., `favicon.ico`, `favicon-192.png`, `favicon-512.png`) and configure via `app.config.ts` `web.favicon` or a custom `index.html` in Expo web if needed.

Example `app.json` snippet:

```json
{
	"expo": {
		"icon": "./assets/branding/app-icon.png",
		"android": {
			"adaptiveIcon": {
				"foregroundImage": "./assets/branding/adaptive-foreground.png",
				"backgroundColor": "#111827"
			}
		},
		"splash": {
			"image": "./assets/branding/splash.png",
			"resizeMode": "contain",
			"backgroundColor": "#111827"
		}
	}
}
```