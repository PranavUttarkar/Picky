-- Enable RLS
alter table users enable row level security;
alter table user_interests enable row level security;
alter table user_interests_temp enable row level security;
alter table saved_events enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table events enable row level security;
alter table interests enable row level security;

-- Public read tables
create policy "read_events_all" on events for select using (true);
create policy "read_interests_all" on interests for select using (true);

-- Users: self management, public read basic
create policy "users_select_authenticated" on users for select to authenticated using (true);
create policy "users_upsert_self" on users for insert with check (id = auth.uid());
create policy "users_update_self" on users for update using (id = auth.uid());

-- user_interests_temp: self only
create policy "uit_select_self" on user_interests_temp for select using (user_id = auth.uid());
create policy "uit_upsert_self" on user_interests_temp for insert with check (user_id = auth.uid());
create policy "uit_update_self" on user_interests_temp for update using (user_id = auth.uid());

-- user_interests: self
create policy "ui_select_self" on user_interests for select using (user_id = auth.uid());
create policy "ui_insert_self" on user_interests for insert with check (user_id = auth.uid());
create policy "ui_delete_self" on user_interests for delete using (user_id = auth.uid());

-- saved_events: self
create policy "se_select_self" on saved_events for select using (user_id = auth.uid());
create policy "se_insert_self" on saved_events for insert with check (user_id = auth.uid());
create policy "se_delete_self" on saved_events for delete using (user_id = auth.uid());

-- groups: members or creator can read; anyone authenticated can create
create policy "groups_insert_any" on groups for insert to authenticated with check (true);
create policy "groups_select_members" on groups for select to authenticated using (
  created_by = auth.uid() or exists(select 1 from group_members gm where gm.group_id = id and gm.user_id = auth.uid())
);

-- group_members: self visible; allow joining self
create policy "gm_select_self_or_group" on group_members for select to authenticated using (user_id = auth.uid());
create policy "gm_insert_self" on group_members for insert to authenticated with check (user_id = auth.uid());
create policy "gm_delete_self" on group_members for delete to authenticated using (user_id = auth.uid());

-- polls: members can read/create
create policy "polls_select_group_members" on polls for select to authenticated using (
  exists(select 1 from group_members gm where gm.group_id = polls.group_id and gm.user_id = auth.uid())
);
create policy "polls_insert_group_members" on polls for insert to authenticated with check (
  exists(select 1 from group_members gm where gm.group_id = polls.group_id and gm.user_id = auth.uid())
);

-- poll_options: members can read/insert/update
create policy "po_select_group_members" on poll_options for select to authenticated using (
  exists(select 1 from polls p join group_members gm on gm.group_id = p.group_id where p.id = poll_options.poll_id and gm.user_id = auth.uid())
);
create policy "po_insert_group_members" on poll_options for insert to authenticated with check (
  exists(select 1 from polls p join group_members gm on gm.group_id = p.group_id where p.id = poll_options.poll_id and gm.user_id = auth.uid())
);
create policy "po_update_group_members" on poll_options for update to authenticated using (
  exists(select 1 from polls p join group_members gm on gm.group_id = p.group_id where p.id = poll_options.poll_id and gm.user_id = auth.uid())
);
