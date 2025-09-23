-- Poll enhancements: title, deadline, and v2 RPC for creation

-- Add columns to polls
alter table if exists polls add column if not exists title text;
alter table if exists polls add column if not exists deadline_at timestamptz;

create index if not exists idx_polls_deadline on polls(deadline_at);

-- New RPC with optional title and deadline
create or replace function public.create_poll_with_options_v2(
  p_group_id bigint,
  p_event_ids bigint[],
  p_title text default null,
  p_deadline_at timestamptz default null
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

  insert into polls(group_id, created_by, is_active, title, deadline_at)
  values (p_group_id, v_uid, true, p_title, p_deadline_at)
  returning id into v_poll_id;

  -- Insert options
  insert into poll_options(poll_id, event_id)
  select v_poll_id, unnest(p_event_ids);

  return v_poll_id;
end;$$;

revoke all on function public.create_poll_with_options_v2(bigint, bigint[], text, timestamptz) from public;
grant execute on function public.create_poll_with_options_v2(bigint, bigint[], text, timestamptz) to anon, authenticated;
