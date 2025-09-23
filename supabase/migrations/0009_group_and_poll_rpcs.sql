-- Group and Poll RPCs, plus helpers
-- Requires pgcrypto (available on Supabase)
create extension if not exists pgcrypto;

-- Helper: simple uppercase hex code generator
create or replace function public.generate_code(p_len int default 8)
returns text
language sql
stable
as $$
  select upper(substr(encode(gen_random_bytes(16), 'hex'), 1, greatest(4, least(p_len, 32))));
$$;

-- RPC: Create group with invite code, and add creator as member
-- Returns: group_id, invite_code
create or replace function public.create_group(p_name text)
returns table(group_id bigint, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
  v_group_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Generate unique code with retry on collision
  for i in 1..10 loop
    begin
      v_code := generate_code(8);
      insert into groups(name, created_by, invite_code)
      values (p_name, v_uid, v_code)
      returning id into v_group_id;
      exit; -- success
    exception when unique_violation then
      -- collision on invite_code, try again
      continue;
    end;
  end loop;

  if v_group_id is null then
    raise exception 'failed to create group after retries';
  end if;

  -- Add creator as member (idempotent via PK)
  insert into group_members(group_id, user_id)
  values (v_group_id, v_uid)
  on conflict do nothing;

  group_id := v_group_id;
  invite_code := v_code;
  return next;
end;$$;

revoke all on function public.create_group(text) from public;
grant execute on function public.create_group(text) to anon, authenticated;

-- RPC: Join group by invite code (case-insensitive)
-- Returns: group_id
create or replace function public.join_group_by_code(p_code text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_group_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_group_id from groups where upper(invite_code) = upper(p_code);
  if v_group_id is null then
    raise exception 'invalid invite code';
  end if;

  insert into group_members(group_id, user_id)
  values (v_group_id, v_uid)
  on conflict do nothing;

  return v_group_id;
end;$$;

revoke all on function public.join_group_by_code(text) from public;
grant execute on function public.join_group_by_code(text) to anon, authenticated;

-- RPC: Regenerate a group's invite code (owner or admin only)
-- Returns: new invite_code
create or replace function public.regenerate_group_invite_code(p_group_id bigint)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Authorization: group owner or admin
  if not exists (
    select 1 from groups g
    where g.id = p_group_id and (g.created_by = v_uid or is_admin(v_uid))
  ) then
    raise exception 'not authorized';
  end if;

  -- Generate unique code with retry on collision
  for i in 1..10 loop
    begin
      v_code := generate_code(8);
      update groups set invite_code = v_code where id = p_group_id;
      exit; -- success
    exception when unique_violation then
      continue;
    end;
  end loop;

  if v_code is null then
    raise exception 'failed to regenerate invite code after retries';
  end if;
  return v_code;
end;$$;

revoke all on function public.regenerate_group_invite_code(bigint) from public;
grant execute on function public.regenerate_group_invite_code(bigint) to anon, authenticated;

-- RPC: Create poll with options atomically
-- Returns: poll_id
create or replace function public.create_poll_with_options(p_group_id bigint, p_event_ids bigint[])
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

  insert into polls(group_id, created_by, is_active)
  values (p_group_id, v_uid, true)
  returning id into v_poll_id;

  -- Insert options
  insert into poll_options(poll_id, event_id)
  select v_poll_id, unnest(p_event_ids);

  return v_poll_id;
end;$$;

revoke all on function public.create_poll_with_options(bigint, bigint[]) from public;
grant execute on function public.create_poll_with_options(bigint, bigint[]) to anon, authenticated;

-- RPC: Close poll (creator or group owner or admin)
create or replace function public.close_poll(p_poll_id bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not exists (
    select 1
    from polls p
    join groups g on g.id = p.group_id
    where p.id = p_poll_id and (p.created_by = v_uid or g.created_by = v_uid or is_admin(v_uid))
  ) then
    raise exception 'not authorized';
  end if;

  update polls set is_active = false where id = p_poll_id;
end;$$;

revoke all on function public.close_poll(bigint) from public;
grant execute on function public.close_poll(bigint) to anon, authenticated;

-- Helpful index for vote tally queries
create index if not exists idx_poll_votes_poll on poll_votes(poll_id);
