# Architecture Overview

This document explains the structure of the Picky app, the major flows, and how data moves between the client and Supabase.

## High-level stack
- Client: Expo (React Native) with `expo-router`
- Backend: Supabase (Postgres, Auth, Row Level Security, RPCs)
- State: Local React state with light caching in `AsyncStorage`
- Styling: ThemeProvider with light/dark colors and a small 3D component kit

## App structure
- `app/` — Expo Router routes
  - `index.tsx` — boot logic, session load and redirect
  - `(tabs)/_layout.tsx` — bottom tabs shell
  - `(tabs)/home.tsx` — main feed, search/filter, details modal, admin CRUD
  - `(tabs)/*` — groups, saved, profile
  - `events/[id].tsx` — full details (native calendar integration)
  - `onboarding/*` — auth + interests + group join/create
- `services/` — API helpers and Supabase client
- `theme/` — ThemeProvider and color tokens
- `types/` — shared TS models
- `supabase/migrations/` — SQL schema and policies

## Data flow
1. The app loads and restores Supabase session; `ensureProfile()` ensures a `users` row exists.
2. Home feed queries `events` with pagination. If few upcoming events exist, negative-ID demo items are injected to maintain healthy UI density.
3. Personalized mode calls `rpc('get_user_event_scores')` to rank events; fallback matches locally using tag overlap if RPC is unavailable.
4. Saving an event writes to `saved_events`; reads are filtered by user via RLS.
5. Admins (users with `is_admin = true`) see an expandable admin panel in the Home screen to create/update/delete real events.

## Caching and pagination
- `AsyncStorage` cache is used to paint quickly on app load, while fresh pages stream in.
- Pages are fetched via `.range(from, to)` with `PAGE_SIZE`. A `hasMore` flag controls infinite scroll.
- When the feed is short, demo events are appended to keep the UI rich.

## Security
- Row Level Security (RLS) is on by default for all tables.
- Public read of events is allowed; writes are gated by `users.is_admin` via the `events_admin_write` policy.
- User-specific tables (saved events, interests) are scoped to `auth.uid()`.

## Navigation
- `expo-router` organizes stacks and tabs declaratively using the file system.
- The Home screen also opens a React Native `Modal` for event details, avoiding a separate route for lightweight view.
