-- RPCs for secure deletion of events and polls
-- Provides explicit functions to avoid client direct table deletes and unify authorization logic.

-- Delete event: admin only (is_admin) to preserve existing policy semantics
create or replace function public.delete_event(p_event_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not is_admin(v_uid) then
    raise exception 'not authorized';
  end if;
  delete from events where id = p_event_id;
end; $$;

revoke all on function public.delete_event(bigint) from public;
grant execute on function public.delete_event(bigint) to anon, authenticated;

-- Delete poll: any member of the poll's group OR admin
create or replace function public.delete_poll(p_poll_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_gid bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  select group_id into v_gid from polls where id = p_poll_id;
  if v_gid is null then
    raise exception 'poll not found';
  end if;
  if not ( is_admin(v_uid) OR exists(
      select 1 from group_members gm where gm.group_id = v_gid and gm.user_id = v_uid
    )) then
    raise exception 'not authorized';
  end if;
  delete from polls where id = p_poll_id;
end; $$;

revoke all on function public.delete_poll(bigint) from public;
grant execute on function public.delete_poll(bigint) to anon, authenticated;
