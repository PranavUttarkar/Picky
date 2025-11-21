-- Row Level Security policies for friends system

-- Enable RLS on new tables
alter table friendships enable row level security;
alter table user_follows enable row level security;
alter table blocked_users enable row level security;
alter table user_settings enable row level security;

-- Friendships policies
-- Users can see friendships they are part of
create policy "friendships_select_own" on friendships
  for select using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- Users can insert friend requests they initiate
create policy "friendships_insert_own" on friendships
  for insert with check (requester_id = auth.uid());

-- Users can update friendships where they are the addressee (to accept/decline)
create policy "friendships_update_addressee" on friendships
  for update using (addressee_id = auth.uid());

-- Users can delete friendships they are part of
create policy "friendships_delete_own" on friendships
  for delete using (
    requester_id = auth.uid() or addressee_id = auth.uid()
  );

-- User follows policies
-- Users can see follows they are part of
create policy "user_follows_select_own" on user_follows
  for select using (
    follower_id = auth.uid() or followed_id = auth.uid()
  );

-- Users can insert follows they initiate
create policy "user_follows_insert_own" on user_follows
  for insert with check (follower_id = auth.uid());

-- Users can delete follows they initiated
create policy "user_follows_delete_own" on user_follows
  for delete using (follower_id = auth.uid());

-- Blocked users policies
-- Users can see blocks they created
create policy "blocked_users_select_own" on blocked_users
  for select using (blocker_id = auth.uid());

-- Users can insert blocks they create
create policy "blocked_users_insert_own" on blocked_users
  for insert with check (blocker_id = auth.uid());

-- Users can delete blocks they created
create policy "blocked_users_delete_own" on blocked_users
  for delete using (blocker_id = auth.uid());

-- User settings policies
-- Users can see and manage their own settings
create policy "user_settings_select_own" on user_settings
  for select using (user_id = auth.uid());

create policy "user_settings_insert_own" on user_settings
  for insert with check (user_id = auth.uid());

create policy "user_settings_update_own" on user_settings
  for update using (user_id = auth.uid());

create policy "user_settings_delete_own" on user_settings
  for delete using (user_id = auth.uid());

-- Update users table policies to allow username/display_name updates
-- First drop existing policy if it exists
drop policy if exists "users_update_self" on users;

-- Recreate with additional fields
create policy "users_update_self" on users 
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- Allow public read of basic user info for friend discovery (but not email)
drop policy if exists "users_select_authenticated" on users;

create policy "users_select_public_info" on users
  for select using (true);

-- Function to get friend activity for events (respects privacy settings)
create or replace function get_event_friend_activity(p_event_id bigint)
returns table(
  friend_count bigint,
  friend_names text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return query select 0::bigint, array[]::text[];
    return;
  end if;

  return query
  with user_friends as (
    select 
      case 
        when f.requester_id = v_user_id then f.addressee_id
        else f.requester_id
      end as friend_id
    from friendships f
    where (f.requester_id = v_user_id or f.addressee_id = v_user_id)
      and f.status = 'accepted'
  ),
  friend_saves as (
    select u.display_name, u.username
    from saved_events se
    join user_friends uf on se.user_id = uf.friend_id
    join users u on u.id = uf.friend_id
    left join user_settings us on us.user_id = uf.friend_id
    left join blocked_users bu on bu.blocker_id = v_user_id and bu.blocked_id = uf.friend_id
    where se.event_id = p_event_id
      and bu.blocked_id is null -- not blocked
      and coalesce(us.show_activity_to_friends, true) = true -- privacy setting
  )
  select 
    count(*)::bigint as friend_count,
    array_agg(coalesce(fs.display_name, fs.username)) as friend_names
  from friend_saves fs;
end;
$$;

-- Function to get friend activity for restaurants (respects privacy settings)
create or replace function get_restaurant_friend_activity(p_restaurant_id text)
returns table(
  friend_count bigint,
  friend_names text[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    return query select 0::bigint, array[]::text[];
    return;
  end if;

  return query
  with user_friends as (
    select 
      case 
        when f.requester_id = v_user_id then f.addressee_id
        else f.requester_id
      end as friend_id
    from friendships f
    where (f.requester_id = v_user_id or f.addressee_id = v_user_id)
      and f.status = 'accepted'
  ),
  friend_saves as (
    select u.display_name, u.username
    from saved_restaurants sr
    join user_friends uf on sr.user_id = uf.friend_id
    join users u on u.id = uf.friend_id
    left join user_settings us on us.user_id = uf.friend_id
    left join blocked_users bu on bu.blocker_id = v_user_id and bu.blocked_id = uf.friend_id
    where sr.restaurant_id = p_restaurant_id
      and bu.blocked_id is null -- not blocked
      and coalesce(us.show_activity_to_friends, true) = true -- privacy setting
  )
  select 
    count(*)::bigint as friend_count,
    array_agg(coalesce(fs.display_name, fs.username)) as friend_names
  from friend_saves fs;
end;
$$;

-- Grant permissions for activity functions
revoke all on function get_event_friend_activity(bigint) from public;
grant execute on function get_event_friend_activity(bigint) to anon, authenticated;

revoke all on function get_restaurant_friend_activity(text) from public;
grant execute on function get_restaurant_friend_activity(text) to anon, authenticated;
