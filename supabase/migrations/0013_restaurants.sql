-- Restaurants catalog for Food feature
-- Creates table, indexes, and RLS with read for all, write for admins only

begin;

create table if not exists public.restaurants (
  place_id text primary key,
  restaurant_name text not null,
  address text,
  city text,
  state text,
  zipcode text,
  latitude double precision,
  longitude double precision,
  phone text,
  website text,
  category text,
  price_range text,
  review_points numeric,
  reviews integer,
  main_image text,
  image_1 text,
  image_2 text,
  image_3 text,
  page_url text,
  plus_code text,
  plus_code_url text,
  popular_times_monday text,
  popular_times_tuesday text,
  popular_times_wednesday text,
  popular_times_thursday text,
  popular_times_friday text,
  popular_times_saturday text,
  popular_times_sunday text,
  open_time_monday text,
  open_time_tuesday text,
  open_time_wednesday text,
  open_time_thursday text,
  open_time_friday text,
  open_time_saturday text,
  open_time_sunday text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists restaurants_set_updated_at on public.restaurants;
create trigger restaurants_set_updated_at
before update on public.restaurants
for each row execute function public.set_updated_at();

-- Basic indexes for search/sort
create index if not exists restaurants_name_idx on public.restaurants using gin (to_tsvector('english', restaurant_name));
create index if not exists restaurants_cat_idx on public.restaurants using gin (to_tsvector('english', coalesce(category,'')));
create index if not exists restaurants_addr_idx on public.restaurants using gin (to_tsvector('english', coalesce(address,'')));
create index if not exists restaurants_reviews_idx on public.restaurants (reviews desc nulls last);

-- RLS: allow read for all; write for admins
alter table public.restaurants enable row level security;

drop policy if exists restaurants_read_all on public.restaurants;
create policy restaurants_read_all on public.restaurants
  for select
  using (true);

-- assumes public.users table with is_admin boolean
-- Only admins may insert/update/delete

drop policy if exists restaurants_write_admins on public.restaurants;
create policy restaurants_write_admins on public.restaurants
  for all
  using (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and coalesce(u.is_admin, false) = true
    )
  )
  with check (
    exists (
      select 1 from public.users u
      where u.id = auth.uid()
      and coalesce(u.is_admin, false) = true
    )
  );

commit;
