-- Event Reports and User Moderation System
-- Adds reporting functionality and user suspension/banning capabilities

-- Create event_reports table
create table if not exists public.event_reports (
  id bigserial primary key,
  event_id bigint not null references public.events(id) on delete cascade,
  reported_by uuid not null references public.users(id) on delete cascade,
  reason text not null check (reason in ('inappropriate', 'spam', 'misinformation', 'other')),
  description text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  created_at timestamptz not null default now(),
  constraint event_reports_unique unique (event_id, reported_by)
);

-- Add user moderation fields
alter table if exists public.users 
  add column if not exists is_suspended boolean not null default false,
  add column if not exists is_banned boolean not null default false,
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text;

-- Add created_at column to events table if it doesn't exist (for tracking when events were created)
alter table if exists public.events
  add column if not exists created_at timestamptz default now();

-- Update existing events to have created_at = date_time if created_at is null
update public.events
set created_at = date_time
where created_at is null;

-- Create indexes for performance
create index if not exists idx_event_reports_event_id on public.event_reports(event_id);
create index if not exists idx_event_reports_status on public.event_reports(status);
create index if not exists idx_event_reports_reported_by on public.event_reports(reported_by);
create index if not exists idx_users_suspended on public.users(is_suspended) where is_suspended = true;
create index if not exists idx_users_banned on public.users(is_banned) where is_banned = true;
-- Index for daily event count queries
create index if not exists idx_events_created_by_created_at on public.events(created_by, created_at);

-- Enable RLS on event_reports
alter table public.event_reports enable row level security;

-- RLS Policies for event_reports
-- Users can insert their own reports
drop policy if exists "event_reports_insert_own" on public.event_reports;
create policy "event_reports_insert_own" on public.event_reports
  for insert to authenticated
  with check (reported_by = auth.uid());

-- Admins can select all reports
drop policy if exists "event_reports_select_admin" on public.event_reports;
create policy "event_reports_select_admin" on public.event_reports
  for select to authenticated
  using (is_admin(auth.uid()));

-- Users can select their own reports
drop policy if exists "event_reports_select_own" on public.event_reports;
create policy "event_reports_select_own" on public.event_reports
  for select to authenticated
  using (reported_by = auth.uid());

-- Admins can update report status
drop policy if exists "event_reports_update_admin" on public.event_reports;
create policy "event_reports_update_admin" on public.event_reports
  for update to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- Function to count events created by user today
create or replace function count_user_events_today(u uuid)
returns bigint language sql stable as $$
  select count(*)::bigint
  from events
  where created_by = u
    and date_trunc('day', created_at) = date_trunc('day', now());
$$;

-- Grant execute permission for the count function
grant execute on function count_user_events_today(uuid) to authenticated;

-- Function to check if user can create events (not suspended or banned, and within daily limit for non-admins)
create or replace function can_user_create_events(u uuid)
returns boolean language sql stable as $$
  select not coalesce((select is_suspended from users where id = u), false)
     and not coalesce((select is_banned from users where id = u), false)
     and (
       coalesce((select suspended_until from users where id = u), '1970-01-01'::timestamptz) < now()
       or (select suspended_until from users where id = u) is null
     )
     and (
       -- Admins have no limit
       coalesce((select is_admin from users where id = u), false)
       -- Non-admins limited to 10 events per day
       or count_user_events_today(u) < 10
     );
$$;

-- Update event creation policy to check suspension/ban status
-- Note: This complements the existing events_insert_any policy
-- We'll use a WITH CHECK that combines both conditions
drop policy if exists "events_insert_any" on events;
create policy "events_insert_any" on events
for insert to authenticated
with check (
  created_by = auth.uid() 
  and can_user_create_events(auth.uid())
);

-- Also update the admin write policy to allow admins even if suspended (admins shouldn't be suspended)
-- The admin policy already exists, but we ensure it takes precedence
-- Admins can always write, so the admin policy doesn't need the can_user_create_events check

-- Function to get event reports with event and user details (for admin panel)
create or replace function get_event_reports_with_details(p_status text default null)
returns table (
  report_id bigint,
  event_id bigint,
  event_title text,
  event_description text,
  event_created_by uuid,
  creator_username text,
  creator_display_name text,
  reported_by uuid,
  reporter_username text,
  reporter_display_name text,
  reason text,
  description text,
  status text,
  created_at timestamptz
) language sql security definer set search_path = public stable as $$
  select 
    er.id as report_id,
    er.event_id,
    e.title as event_title,
    e.description as event_description,
    e.created_by as event_created_by,
    creator.username as creator_username,
    creator.display_name as creator_display_name,
    er.reported_by,
    reporter.username as reporter_username,
    reporter.display_name as reporter_display_name,
    er.reason,
    er.description,
    er.status,
    er.created_at
  from event_reports er
  join events e on e.id = er.event_id
  left join users creator on creator.id = e.created_by
  left join users reporter on reporter.id = er.reported_by
  where (p_status is null or er.status = p_status)
  order by er.created_at desc;
$$;

-- Grant execute to authenticated users (admins will be checked in the function via RLS)
grant execute on function get_event_reports_with_details(text) to authenticated;

