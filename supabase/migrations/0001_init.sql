-- Enable extensions
create extension if not exists "uuid-ossp";

-- Tables
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text,
  email text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

create table if not exists interests (
  id bigserial primary key,
  name text unique not null
);

create table if not exists user_interests (
  user_id uuid references users(id) on delete cascade,
  interest_id bigint references interests(id) on delete cascade,
  primary key (user_id, interest_id)
);

create table if not exists events (
  id bigserial primary key,
  title text not null,
  description text,
  image_url text,
  date_time timestamptz not null,
  location text,
  tags text[] default '{}'
);

create table if not exists groups (
  id bigserial primary key,
  name text not null,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

create table if not exists group_members (
  group_id bigint references groups(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  primary key (group_id, user_id)
);

create table if not exists polls (
  id bigserial primary key,
  group_id bigint references groups(id) on delete cascade,
  created_by uuid references users(id),
  created_at timestamptz default now(),
  is_active boolean default true
);

create table if not exists poll_options (
  poll_id bigint references polls(id) on delete cascade,
  event_id bigint references events(id) on delete cascade,
  votes integer default 0,
  primary key (poll_id, event_id)
);

-- Saved events helper
create table if not exists saved_events (
  user_id uuid references users(id) on delete cascade,
  event_id bigint references events(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, event_id)
);

-- Seed interests
insert into interests(name) values
('Music'),('Sports'),('Food'),('Nightlife'),('Tech'),('Volunteering'),('Art'),('Career'),('Gaming'),('Outdoors'),('Culture'),('Wellness')
on conflict (name) do nothing;

-- TEMP table used by the app until we map to RLS and ids
create table if not exists user_interests_temp (
  user_id uuid primary key,
  names text[]
);
