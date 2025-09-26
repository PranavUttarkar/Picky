-- Decision Room: participant preferences per poll
create table if not exists public.decision_prefs (
  poll_id bigint not null references public.polls(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  budget int, -- 0..100 scale
  time_pref text check (time_pref in ('evening','late','flex')),
  radius_miles int,
  needs text[], -- codes like 'veg','noalc','outdoor','dance'
  notes text,
  updated_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.decision_prefs enable row level security;

-- Only the user themselves can upsert/read their prefs for polls they are a member of via group
create policy decision_prefs_insert on public.decision_prefs
  for insert to authenticated with check (auth.uid() = user_id);

create policy decision_prefs_update on public.decision_prefs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy decision_prefs_sel 
on public.decision_prefs
  for select using (
    auth.uid() = user_id
  );
