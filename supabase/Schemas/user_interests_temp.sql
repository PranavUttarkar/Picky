create table public.user_interests_temp (
  user_id uuid not null,
  names text[] null,
  constraint user_interests_temp_pkey primary key (user_id)
) TABLESPACE pg_default;