-- Add poll mode and rating support

-- Mode on polls: 'single' | 'rating'
alter table if exists polls add column if not exists mode text not null default 'single' check (mode in ('single','rating'));

-- Extend v2 create RPC to accept mode
create or replace function public.create_poll_with_options_v2(
  p_group_id bigint,
  p_event_ids bigint[],
  p_title text default null,
  p_deadline_at timestamptz default null,
  p_mode text default 'single'
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_poll_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Must be group member
  if not exists (select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = v_uid) then
    raise exception 'not authorized';
  end if;

  if p_mode not in ('single','rating') then
    raise exception 'invalid mode';
  end if;

  insert into polls(group_id, created_by, is_active, title, deadline_at, mode)
  values (p_group_id, v_uid, true, p_title, p_deadline_at, p_mode)
  returning id into v_poll_id;

  -- Insert options
  insert into poll_options(poll_id, event_id)
  select v_poll_id, unnest(p_event_ids);

  return v_poll_id;
end;$$;

revoke all on function public.create_poll_with_options_v2(bigint, bigint[], text, timestamptz, text) from public;
grant execute on function public.create_poll_with_options_v2(bigint, bigint[], text, timestamptz, text) to anon, authenticated;

-- Ratings table (for mode='rating')
create table if not exists poll_ratings (
  poll_id bigint references polls(id) on delete cascade,
  event_id bigint references events(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  rating smallint not null check (rating in (-1,0,1)), -- -1:not for me, 0:it's fine, 1:love it
  created_at timestamptz default now(),
  primary key (poll_id, user_id, event_id)
);

alter table poll_ratings enable row level security;

-- RLS: group members can see ratings; users can upsert their own
drop policy if exists "pr_select_group_members" on poll_ratings;
create policy "pr_select_group_members" on poll_ratings for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_ratings.poll_id
  )
);

drop policy if exists "pr_upsert_self" on poll_ratings;
create policy "pr_upsert_self" on poll_ratings for insert to authenticated with check (
  user_id = auth.uid() and exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_ratings.poll_id
  )
);
create policy "pr_update_self" on poll_ratings for update to authenticated using (user_id = auth.uid());
create policy "pr_delete_self" on poll_ratings for delete to authenticated using (user_id = auth.uid());

-- RPC: cast rating (upsert). If p_rating is null, clear rating for that event.
create or replace function public.cast_rating(p_poll_id bigint, p_event_id bigint, p_rating smallint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_mode text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select mode into v_mode from polls where id = p_poll_id;
  if v_mode is null then
    raise exception 'poll not found';
  end if;
  if v_mode <> 'rating' then
    raise exception 'poll is not rating mode';
  end if;
  -- ensure membership
  if not exists (
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = v_uid
    where p.id = p_poll_id
  ) then
    raise exception 'not authorized';
  end if;

  if p_rating is null then
    delete from poll_ratings where poll_id = p_poll_id and event_id = p_event_id and user_id = v_uid;
    return;
  end if;

  if p_rating not in (-1,0,1) then
    raise exception 'invalid rating';
  end if;

  insert into poll_ratings(poll_id, event_id, user_id, rating)
  values (p_poll_id, p_event_id, v_uid, p_rating)
  on conflict (poll_id, user_id, event_id) do update set rating = excluded.rating, created_at = now();
end;$$;

revoke all on function public.cast_rating(bigint, bigint, smallint) from public;
grant execute on function public.cast_rating(bigint, bigint, smallint) to anon, authenticated;
