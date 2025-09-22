-- Votes table: one vote per user per poll
create table if not exists poll_votes (
  poll_id bigint references polls(id) on delete cascade,
  event_id bigint references events(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (poll_id, user_id)
);

-- Enable RLS and policies for poll_votes
alter table poll_votes enable row level security;
drop policy if exists "pv_select_group_members" on poll_votes;
create policy "pv_select_group_members" on poll_votes for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_votes.poll_id
  )
);
drop policy if exists "pv_insert_self_group_member" on poll_votes;
create policy "pv_insert_self_group_member" on poll_votes for insert to authenticated with check (
  auth.uid() = user_id and exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_votes.poll_id
  )
);
drop policy if exists "pv_delete_self" on poll_votes;
create policy "pv_delete_self" on poll_votes for delete to authenticated using (user_id = auth.uid());

-- Keep poll_options.votes in sync with poll_votes
create or replace function public.update_poll_option_counts() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    update poll_options set votes = votes + 1 where poll_id = new.poll_id and event_id = new.event_id;
    return new;
  elsif tg_op = 'DELETE' then
    update poll_options set votes = greatest(votes - 1, 0) where poll_id = old.poll_id and event_id = old.event_id;
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists trg_poll_votes_counts_ins on poll_votes;
create trigger trg_poll_votes_counts_ins after insert on poll_votes
for each row execute function public.update_poll_option_counts();

drop trigger if exists trg_poll_votes_counts_del on poll_votes;
create trigger trg_poll_votes_counts_del after delete on poll_votes
for each row execute function public.update_poll_option_counts();

-- Cast a vote (replaces previous vote for the poll)
create or replace function public.cast_vote(p_poll_id bigint, p_event_id bigint)
returns void language plpgsql security definer as $$
declare
  v_uid uuid := auth.uid();
  v_old_event bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  -- ensure user is group member of poll's group
  if not exists (
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = v_uid
    where p.id = p_poll_id
  ) then
    raise exception 'not authorized';
  end if;
  -- get existing vote
  select event_id into v_old_event from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  if v_old_event is not null and v_old_event = p_event_id then
    return; -- no-op
  end if;
  -- swap vote atomically
  if v_old_event is not null then
    delete from poll_votes where poll_id = p_poll_id and user_id = v_uid;
  end if;
  insert into poll_votes(poll_id, event_id, user_id) values (p_poll_id, p_event_id, v_uid);
end; $$;
