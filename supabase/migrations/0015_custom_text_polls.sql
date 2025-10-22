-- Custom text options for polls (non-breaking, parallel to event options)

create table  poll_text_options (
  id bigserial primary key,
  poll_id bigint references polls(id) on delete cascade,
  text text not null,
  votes integer default 0
);

alter table poll_text_options enable row level security;

-- Group members can select and insert text options
create policy  "pto_select_group_members" on poll_text_options for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_text_options.poll_id
  )
);
create policy  "pto_insert_group_members" on poll_text_options for insert to authenticated with check (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_text_options.poll_id
  )
);

-- Votes for text options: one vote per user per poll (single-choice)
create table  poll_text_votes (
  poll_id bigint references polls(id) on delete cascade,
  text_option_id bigint references poll_text_options(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (poll_id, user_id)
);

alter table poll_text_votes enable row level security;
create policy  "ptv_select_group_members" on poll_text_votes for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_text_votes.poll_id
  )
);
create policy  "ptv_insert_self_group_member" on poll_text_votes for insert to authenticated with check (
  auth.uid() = user_id and exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_text_votes.poll_id
  )
);
create policy  "ptv_delete_self" on poll_text_votes for delete to authenticated using (user_id = auth.uid());

-- Keep poll_text_options.votes in sync with poll_text_votes
-- Use SECURITY DEFINER so this can update counts even with RLS enforced
create or replace function public.update_poll_text_option_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update poll_text_options set votes = votes + 1 where id = new.text_option_id;
    return new;
  elsif tg_op = 'DELETE' then
    update poll_text_options set votes = greatest(votes - 1, 0) where id = old.text_option_id;
    return old;
  end if;
  return null;
end; $$;

drop trigger if exists trg_poll_text_votes_counts_ins on poll_text_votes;
create trigger trg_poll_text_votes_counts_ins after insert on poll_text_votes
for each row execute function public.update_poll_text_option_counts();

drop trigger if exists trg_poll_text_votes_counts_del on poll_text_votes;
create trigger trg_poll_text_votes_counts_del after delete on poll_text_votes
for each row execute function public.update_poll_text_option_counts();

-- Helpful indexes for performance
create index if not exists idx_poll_text_options_poll_id on poll_text_options(poll_id);
create index if not exists idx_poll_text_votes_poll_id on poll_text_votes(poll_id);
create index if not exists idx_poll_text_votes_text_option_id on poll_text_votes(text_option_id);

-- RPC: create a poll with custom text options (single-choice by default)
create or replace function public.create_text_poll(
  p_group_id bigint,
  p_texts text[],
  p_title text default null,
  p_deadline_at timestamptz default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_poll_id bigint;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from group_members gm where gm.group_id = p_group_id and gm.user_id = v_uid
  ) then
    raise exception 'not authorized';
  end if;
  insert into polls(group_id, created_by, is_active, title, deadline_at, mode)
  values (p_group_id, v_uid, true, p_title, p_deadline_at, 'single')
  returning id into v_poll_id;

  insert into poll_text_options(poll_id, text)
  select v_poll_id, trim(t)
  from unnest(p_texts) as t
  where trim(coalesce(t,'')) <> '';

  return v_poll_id;
end; $$;

revoke all on function public.create_text_poll(bigint, text[], text, timestamptz) from public;
grant execute on function public.create_text_poll(bigint, text[], text, timestamptz) to anon, authenticated;

-- RPC: add a text option to an existing poll
create or replace function public.add_text_option(p_poll_id bigint, p_text text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if not exists (
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = v_uid
    where p.id = p_poll_id
  ) then
    raise exception 'not authorized';
  end if;
  if trim(coalesce(p_text,'')) = '' then
    raise exception 'empty option';
  end if;
  insert into poll_text_options(poll_id, text) values (p_poll_id, trim(p_text));
end; $$;

revoke all on function public.add_text_option(bigint, text) from public;
grant execute on function public.add_text_option(bigint, text) to anon, authenticated;

-- RPC: cast a vote for a text option (replaces previous vote)
create or replace function public.cast_text_vote(p_poll_id bigint, p_text_option_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old bigint;
  v_opt_poll bigint;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  -- ensure membership
  if not exists (
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = v_uid
    where p.id = p_poll_id
  ) then
    raise exception 'not authorized';
  end if;
  -- ensure option belongs to poll
  select poll_id into v_opt_poll from poll_text_options where id = p_text_option_id;
  if v_opt_poll is null or v_opt_poll <> p_poll_id then
    raise exception 'invalid option';
  end if;
  -- swap
  select text_option_id into v_old from poll_text_votes where poll_id = p_poll_id and user_id = v_uid;
  if v_old is not null and v_old = p_text_option_id then return; end if;
  if v_old is not null then
    delete from poll_text_votes where poll_id = p_poll_id and user_id = v_uid;
  end if;
  insert into poll_text_votes(poll_id, text_option_id, user_id) values (p_poll_id, p_text_option_id, v_uid);
end; $$;

revoke all on function public.cast_text_vote(bigint, bigint) from public;
grant execute on function public.cast_text_vote(bigint, bigint) to anon, authenticated;
