# Supabase RLS Policies

All core tables have Row Level Security enabled. Policies are defined across `0005_rls.sql` and `0006_admin_and_indices.sql`.

## Public reads
- `events`: `read_events_all` allows `SELECT` to anyone (public catalog of upcoming events).
- `interests`: public select.

## Users
- `users_select_authenticated`: authenticated users can select from `users`.
- `users_upsert_self`, `users_update_self`: users can insert/update their own row.
- Admin flag: `users.is_admin` used by admin policies.

## Events (admin writes)
- Function `is_admin(u uuid): boolean` (in `0006`).
- Policy `events_admin_write`: for all write operations (INSERT/UPDATE/DELETE) on `events` to authenticated users where `is_admin(auth.uid())`.

## Saved events (per-user)
- `se_select_self`, `se_insert_self`, `se_delete_self`: scoped to `user_id = auth.uid()`.

## Groups and polls
- Groups are visible to creators and members (membership check in policy).
- Polls and options are accessible to group members; voting policies live in `0007_polls_votes.sql`.

## Practical notes
- Promote an admin in SQL:
```sql
update users set is_admin = true where email = 'you@example.com';
```
- Since writes to `events` require admin, client code also gates admin UI using `users.is_admin`.
