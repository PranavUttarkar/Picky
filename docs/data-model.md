# Data Model

This is a simplified view of the Postgres schema. See `supabase/migrations/*.sql` for source of truth.

## Tables
- `users`
  - `id uuid` PK
  - `email text` unique, required
  - `name text`, `avatar_url text`
  - `is_admin boolean` (added in `0006`), default false
  - `created_at timestamptz`

- `events`
  - `id bigserial` PK
  - `title text` required
  - `description text`
  - `image_url text`
  - `date_time timestamptz` required
  - `location text`
  - `tags text[]`
  - `rsvp_url text` (added in `0003`)
  - `created_by uuid references users(id)` (added in `0006`)

- `saved_events`
  - `user_id uuid references users(id)`
  - `event_id bigint references events(id)`
  - PK `(user_id, event_id)`

- `groups`
  - `id bigserial` PK
  - `name text` required
  - `invite_code text` (added in `0004`)
  - `created_by uuid references users(id)`

- `group_members`
  - `group_id bigint references groups(id)`
  - `user_id uuid references users(id)`
  - PK `(group_id, user_id)`

- `user_interests_temp`
  - `user_id uuid` PK
  - `names text[]`

- `polls`, `poll_options`, `poll_votes`
  - See `0007_polls_votes.sql` for voting schema.

## Views and RPCs
- Views (`0002_views.sql`, `0008_scoring_views.sql`) support scoring and admin insights.
- RPCs
  - `get_user_event_scores()` → `{ event_id, match_percent }`
  - `get_group_event_scores(p_group_id)` → group-specific scores

## Indices
- `idx_events_datetime` (events.date_time)
- `idx_events_tags` (events.tags GIN)
- Assorted indices for membership and polls
