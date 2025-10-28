# Analytics

This app includes a small, provider-agnostic analytics wrapper at `utils/analytics.ts` to track usage across iOS, Android, and Web without introducing native SDK dependencies. Events are also written to Supabase in an `analytics_events` table for in-database analytics and admin dashboards.

## How it works
- On startup (`app/_layout.tsx`), `initAnalytics()` is called. If `EXPO_PUBLIC_AMPLITUDE_KEY` is set, events are sent to Amplitude via the HTTP API. Otherwise, events are logged to the console (safe no-op).
- A persistent `deviceId` is generated and stored (AsyncStorage on native, localStorage on web).
- `screen_view` is recorded automatically when the route changes.
- User identity is set automatically after authentication; additional traits can be set with `setUserProperties`.
- Each event is also inserted into `analytics_events` (Supabase) with RLS: any authenticated user can insert; only admins can read.

## API
- `initAnalytics({ amplitudeApiKey? })` — initialize provider; called once at app start.
- `identifyUser(userId, traits?)` — associate subsequent events with a user id; traits are merged.
- `setUserProperties(traits)` — update user profile traits (non-sensitive only).
- `trackEvent(name, props?)` — track a custom event.
- `trackScreenView(screen, props?)` — convenience for `screen_view`.
- `trackCTA(name, props?)` — convenience for `cta_click`.
- `setAnalyticsOptOut(flag)` — enable/disable tracking per device (respected on all helpers).

All helpers are best-effort and never throw.

## Event naming conventions
- Use `snake_case` names; keep them product-centric and stable.
- Include minimal, useful properties. Prefer ids and counts, avoid PII. Examples:
  - `app_open` { platform }
  - `screen_view` { screen }
  - `cta_click` { name, ... }
  - `share_event` { event_id, title }
  - `share_group` { invite_code, name }
  - `group_created` { group_id, name_length }
  - `group_joined` { invite_code }
  - `poll_created` { group_id, options_count, mode, has_deadline }
  - `poll_vote_cast` { poll_id, option_event_id }
  - `event_created` { event_id, has_images, tags_count }
  - `availability_replaced` { group_id, slots_count, window_days }

## Adding new instrumentation
- Prefer adding `trackEvent` calls in service functions that encapsulate business actions.
- For UI interactions, use `trackCTA('name', { context })` in `onPress` handlers of meaningful buttons.
- For new screens, you can rely on the global `screen_view`, or add additional context via `trackScreenView('route', { ... })`.

## Provider configuration
- Amplitude: set `EXPO_PUBLIC_AMPLITUDE_KEY` in `.env` (Expo public env) to send events to your Amplitude project. The wrapper uses the HTTP API, so no native SDK is required.
- If no key is set, analytics safely falls back to console logs.

## In-database analytics (Supabase)
- Table: `analytics_events` with columns: created_at, user_id, device_id, platform, screen, event, properties (jsonb). A trigger sets `user_id` from `auth.uid()` automatically.
- RLS Policies: insert allowed for authenticated; select allowed only for admins (based on `users.is_admin` and `is_admin(auth.uid())`).
- Views provided for dashboards:
  - `analytics_events_daily_counts(day, event, count)`
  - `analytics_screen_views_daily(day, screen, count)`
  - `analytics_cta_daily(day, name, count)`
  - `analytics_active_users_daily(day, users)`
  - `analytics_shares_daily(day, event, count)`

Admin UI: `/admin/analytics` shows rollups (last 14 days). The Profile screen links to it for admin users.

## Privacy
- Do not send sensitive data. Favor ids, counts, and coarse-grain properties.
- The wrapper supports a per-device opt-out via `setAnalyticsOptOut(true)`; expose a toggle in settings if needed.
