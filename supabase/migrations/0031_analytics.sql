-- In-database analytics storage and summary views

-- Table to store client-side analytics events
create table if not exists analytics_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id uuid null,
  device_id text null,
  platform text null,
  screen text null,
  event text not null,
  properties jsonb not null default '{}'::jsonb
);

alter table analytics_events enable row level security;

-- Set user_id to auth.uid() automatically via trigger (so clients don't need to send it)
create or replace function set_analytics_user()
returns trigger as $$
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_set_analytics_user on analytics_events;
create trigger trg_set_analytics_user
before insert on analytics_events
for each row execute function set_analytics_user();

-- Policies: any authenticated user can insert; only admins can select
drop policy if exists "analytics_insert_authenticated" on analytics_events;
create policy "analytics_insert_authenticated" on analytics_events for insert to authenticated with check (true);

drop policy if exists "analytics_select_admin" on analytics_events;
create policy "analytics_select_admin" on analytics_events for select using (is_admin(auth.uid()));

-- Useful indexes
create index if not exists idx_analytics_events_created_at on analytics_events (created_at desc);
create index if not exists idx_analytics_events_event on analytics_events (event);
create index if not exists idx_analytics_events_screen on analytics_events (screen);
create index if not exists idx_analytics_events_user on analytics_events (user_id);

-- Views for admin dashboards

-- Daily counts per event
create or replace view analytics_events_daily_counts as
select
  date_trunc('day', created_at) as day,
  event,
  count(*) as count
from analytics_events
group by 1, 2
order by day desc, event;

-- Screen views per day
create or replace view analytics_screen_views_daily as
select
  date_trunc('day', created_at) as day,
  coalesce(screen, (properties->>'screen')) as screen,
  count(*) as count
from analytics_events
where event = 'screen_view'
group by 1, 2
order by day desc, count desc;

-- CTA clicks per day by name
create or replace view analytics_cta_daily as
select
  date_trunc('day', created_at) as day,
  coalesce(properties->>'name', 'unknown') as name,
  count(*) as count
from analytics_events
where event = 'cta_click'
group by 1, 2
order by day desc, count desc;

-- Daily active users (based on events logged)
create or replace view analytics_active_users_daily as
select
  date_trunc('day', created_at) as day,
  count(distinct user_id) as users
from analytics_events
where user_id is not null
group by 1
order by day desc;

-- Shares per day
create or replace view analytics_shares_daily as
select
  date_trunc('day', created_at) as day,
  event,
  count(*) as count
from analytics_events
where event in ('share_event','share_group')
group by 1, 2
order by day desc, event;
