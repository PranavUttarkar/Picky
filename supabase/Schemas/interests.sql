create table public.interests (
  id bigserial not null,
  name text not null,
  constraint interests_pkey primary key (id),
  constraint interests_name_key unique (name)
) TABLESPACE pg_default;