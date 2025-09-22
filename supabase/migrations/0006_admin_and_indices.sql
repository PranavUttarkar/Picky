-- Admin role and event ownership + performance indices

-- Mark admins in users
alter table if exists users add column if not exists is_admin boolean not null default false;

-- Track who created events
alter table if exists events add column if not exists created_by uuid references users(id);

-- Indices for performance
create index if not exists idx_events_datetime on events(date_time);
create index if not exists idx_events_tags on events using gin (tags);
create index if not exists idx_group_members_user on group_members(user_id);
create index if not exists idx_group_members_group on group_members(group_id);
create index if not exists idx_polls_group on polls(group_id);
create index if not exists idx_poll_options_poll on poll_options(poll_id);
create index if not exists idx_saved_events_user on saved_events(user_id);

-- Admin helper and policies (depends on users.is_admin)
create or replace function is_admin(u uuid)
returns boolean language sql immutable as $$
	select coalesce((select is_admin from users where id = u), false);
$$;

-- events: admins can insert/update/delete; public read already exists
drop policy if exists "events_admin_write" on events;
create policy "events_admin_write" on events for all to authenticated using (is_admin(auth.uid())) with check (is_admin(auth.uid()));
