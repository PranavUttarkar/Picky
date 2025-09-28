-- Onboarding preferences data model
-- Stores interests, TAMU-major-related selections, food restrictions, and quick preference flags

create table if not exists public.user_onboarding (
  user_id uuid primary key references public.users(id) on delete cascade,
  interests text[] not null default '{}',
  majors text[] not null default '{}',
  custom_interests text[] not null default '{}',
  food_restrictions text[] not null default '{}',
  preferences jsonb not null default '{}'::jsonb,
  completed_at timestamptz
);

alter table public.user_onboarding enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_onboarding' and policyname = 'uobo_select_own'
  ) then
    create policy uobo_select_own on public.user_onboarding
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_onboarding' and policyname = 'uobo_insert_own'
  ) then
    create policy uobo_insert_own on public.user_onboarding
      for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'user_onboarding' and policyname = 'uobo_update_own'
  ) then
    create policy uobo_update_own on public.user_onboarding
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
