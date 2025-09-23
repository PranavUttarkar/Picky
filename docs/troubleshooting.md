# Troubleshooting

## Authentication
- Symptom: Actions redirect to onboarding
  - Cause: Not authenticated
  - Fix: Sign in on `/onboarding/welcome`

## Admin controls not visible
- Verify your `users` row has `is_admin = true`.
- Ensure you created the user via the app so a row exists in `users`.

## Events do not load
- Check `events.date_time` is in the future for upcoming queries.
- Verify public select policy is applied (`read_events_all`).

## Delete event fails
- Ensure you are admin.
- Check RLS: `events_admin_write` policy present.
- Inspect network error message from Supabase for details.

## Scoring seems off
- Server-side scores come from `get_user_event_scores()`.
- If unavailable, the app falls back to tag overlap. Add more `tags` or `user_interests_temp.names`.

## Migrations order
- Apply `supabase/migrations` in filename order. Missing columns (like `rsvp_url` or `created_by`) indicate skipped migration.
