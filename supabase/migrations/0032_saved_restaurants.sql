-- Saved restaurants table and RLS policies

begin;

create table if not exists public.saved_restaurants (
  user_id uuid references public.users(id) on delete cascade,
  restaurant_id text references public.restaurants(place_id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, restaurant_id)
);

-- Index to speed up queries by user
create index if not exists idx_saved_restaurants_user on public.saved_restaurants(user_id);

-- Enable RLS and restrict to self
alter table public.saved_restaurants enable row level security;

-- Select own
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saved_restaurants' and policyname = 'sr_select_self'
  ) then
    create policy sr_select_self on public.saved_restaurants for select using (user_id = auth.uid());
  end if;
end $$;

-- Insert own
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saved_restaurants' and policyname = 'sr_insert_self'
  ) then
    create policy sr_insert_self on public.saved_restaurants for insert with check (user_id = auth.uid());
  end if;
end $$;

-- Delete own
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'saved_restaurants' and policyname = 'sr_delete_self'
  ) then
    create policy sr_delete_self on public.saved_restaurants for delete using (user_id = auth.uid());
  end if;
end $$;

commit;
