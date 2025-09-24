-- Finalize polls, commitments, status updates, and feedback

-- Winner selection on poll
alter table if exists polls add column if not exists final_event_id bigint references events(id);

-- Commit poll: set final_event_id and close (authorized: poll creator, group owner, or admin)
create or replace function public.commit_poll(p_poll_id bigint, p_event_id bigint)
returns void language plpgsql security definer set search_path = public as $$
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
  update polls set is_active = false, final_event_id = p_event_id where id = p_poll_id;
end;$$;

revoke all on function public.commit_poll(bigint, bigint) from public;
grant execute on function public.commit_poll(bigint, bigint) to anon, authenticated;

-- Commitments: thumbs-up confirmations
create table if not exists poll_commitments (
  poll_id bigint references polls(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (poll_id, user_id)
);

alter table poll_commitments enable row level security;
drop policy if exists "pc_select_group_members" on poll_commitments;
create policy "pc_select_group_members" on poll_commitments for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_commitments.poll_id
  )
);
drop policy if exists "pc_upsert_self" on poll_commitments;
create policy "pc_upsert_self" on poll_commitments for insert to authenticated with check (
  user_id = auth.uid() and exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_commitments.poll_id
  )
);
create policy "pc_delete_self" on poll_commitments for delete to authenticated using (user_id = auth.uid());

create or replace function public.toggle_commitment(p_poll_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if exists (select 1 from poll_commitments where poll_id = p_poll_id and user_id = v_uid) then
    delete from poll_commitments where poll_id = p_poll_id and user_id = v_uid;
  else
    insert into poll_commitments(poll_id, user_id) values (p_poll_id, v_uid);
  end if;
end;$$;

revoke all on function public.toggle_commitment(bigint) from public;
grant execute on function public.toggle_commitment(bigint) to anon, authenticated;

-- Lightweight status updates (e.g., running late)
create table if not exists poll_status_updates (
  id bigserial primary key,
  poll_id bigint references polls(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  kind text not null check (kind in ('late_10','note')),
  message text,
  created_at timestamptz default now()
);

alter table poll_status_updates enable row level security;
create policy "psu_select_group_members" on poll_status_updates for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = poll_status_updates.poll_id
  )
);
create policy "psu_insert_self" on poll_status_updates for insert to authenticated with check (user_id = auth.uid());

-- Post-activity feedback
create table if not exists post_event_feedback (
  poll_id bigint references polls(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  comment text,
  created_at timestamptz default now(),
  primary key (poll_id, user_id)
);

alter table post_event_feedback enable row level security;
create policy "pef_select_group_members" on post_event_feedback for select to authenticated using (
  exists(
    select 1 from polls p
    join group_members gm on gm.group_id = p.group_id and gm.user_id = auth.uid()
    where p.id = post_event_feedback.poll_id
  )
);
create policy "pef_upsert_self" on post_event_feedback for insert to authenticated with check (user_id = auth.uid());
create policy "pef_update_self" on post_event_feedback for update to authenticated using (user_id = auth.uid());
