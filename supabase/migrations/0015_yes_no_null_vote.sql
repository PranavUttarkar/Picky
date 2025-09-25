-- Support explicit 'No' (or acknowledgement) responses in single-option (Yes/No) polls
-- Represent a 'No' response as a poll_votes row with event_id NULL.
-- Update cast_vote to always replace any existing response (including NULL) safely.
-- Add record_no_vote RPC.

-- Replace cast_vote with simplified logic that deletes existing row first unless same event
create or replace function public.cast_vote(p_poll_id bigint, p_event_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old_event bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = v_uid
    where p.id = p_poll_id
  ) then
    raise exception 'not authorized';
  end if;
  select event_id into v_old_event from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  if v_old_event is not null and v_old_event = p_event_id then
    return; -- already voted for this event
  end if;
  -- remove any prior response (including NULL event_id row)
  delete from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  insert into poll_votes(poll_id, event_id, user_id) values (p_poll_id, p_event_id, v_uid);
end; $$;

revoke all on function public.cast_vote(bigint, bigint) from public;
grant execute on function public.cast_vote(bigint, bigint) to anon, authenticated;

-- New RPC: record a 'No' response (NULL event) for a poll
create or replace function public.record_no_vote(p_poll_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = v_uid
    where p.id = p_poll_id
  ) then
    raise exception 'not authorized';
  end if;
  -- replace any existing row with a NULL event_id row
  delete from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  insert into poll_votes(poll_id, event_id, user_id) values (p_poll_id, null, v_uid);
end; $$;

revoke all on function public.record_no_vote(bigint) from public;
grant execute on function public.record_no_vote(bigint) to anon, authenticated;
