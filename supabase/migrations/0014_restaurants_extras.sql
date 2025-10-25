-- Add extra CSV columns to restaurants
begin;

alter table public.restaurants
  add column if not exists google_id text,
  add column if not exists delivery text,
  add column if not exists description text;

commit;
