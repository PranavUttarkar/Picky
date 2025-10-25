-- Food-specific interests per user
create table if not exists user_food_interests (
  user_id uuid primary key references users(id) on delete cascade,
  names text[]
);

-- Enable RLS
alter table user_food_interests enable row level security;

-- Policies: user can read/update their own
create policy "ufi_select_self" on user_food_interests for select to authenticated using (user_id = auth.uid());
create policy "ufi_upsert_self" on user_food_interests for insert to authenticated with check (user_id = auth.uid());
create policy "ufi_update_self" on user_food_interests for update to authenticated using (user_id = auth.uid());

-- Optional: create a view aggregating group food interests in future if needed
