-- Friends System Migration
-- Adds friendship, following, blocking, and user settings functionality

-- Add new fields to users table
alter table users 
add column if not exists username text unique,
add column if not exists display_name text,
add column if not exists account_type text default 'personal' check (account_type in ('personal', 'organization'));

-- Create index for username lookups
create index if not exists idx_users_username on users(username);

-- Friendships table for mutual friend relationships
create table if not exists friendships (
  id bigserial primary key,
  requester_id uuid references users(id) on delete cascade,
  addressee_id uuid references users(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint friendships_no_self_friend check (requester_id != addressee_id),
  constraint friendships_unique unique (requester_id, addressee_id)
);

-- User follows table for organization accounts
create table if not exists user_follows (
  id bigserial primary key,
  follower_id uuid references users(id) on delete cascade,
  followed_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint follows_no_self_follow check (follower_id != followed_id),
  constraint follows_unique unique (follower_id, followed_id)
);

-- Blocked users table
create table if not exists blocked_users (
  id bigserial primary key,
  blocker_id uuid references users(id) on delete cascade,
  blocked_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  constraint blocks_no_self_block check (blocker_id != blocked_id),
  constraint blocks_unique unique (blocker_id, blocked_id)
);

-- User settings for privacy controls
create table if not exists user_settings (
  user_id uuid primary key references users(id) on delete cascade,
  show_activity_to_friends boolean default true,
  show_activity_to_followers boolean default true,
  allow_friend_requests boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create indexes for efficient queries
create index if not exists idx_friendships_requester on friendships(requester_id);
create index if not exists idx_friendships_addressee on friendships(addressee_id);
create index if not exists idx_friendships_status on friendships(status);
create index if not exists idx_user_follows_follower on user_follows(follower_id);
create index if not exists idx_user_follows_followed on user_follows(followed_id);
create index if not exists idx_blocked_users_blocker on blocked_users(blocker_id);
create index if not exists idx_blocked_users_blocked on blocked_users(blocked_id);

-- Function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Triggers for updated_at
create trigger update_friendships_updated_at
  before update on friendships
  for each row execute function update_updated_at_column();

create trigger update_user_settings_updated_at
  before update on user_settings
  for each row execute function update_updated_at_column();

-- RPC function to send friend request
create or replace function send_friend_request(p_addressee_username text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid := auth.uid();
  v_addressee_id uuid;
  v_friendship_id bigint;
  v_existing_status text;
begin
  if v_requester_id is null then
    raise exception 'not authenticated';
  end if;

  -- Find addressee by username
  select id into v_addressee_id 
  from users 
  where username = p_addressee_username;
  
  if v_addressee_id is null then
    raise exception 'user not found';
  end if;

  if v_requester_id = v_addressee_id then
    raise exception 'cannot send friend request to yourself';
  end if;

  -- Check if users are blocked
  if exists (
    select 1 from blocked_users 
    where (blocker_id = v_requester_id and blocked_id = v_addressee_id)
       or (blocker_id = v_addressee_id and blocked_id = v_requester_id)
  ) then
    raise exception 'cannot send friend request to blocked user';
  end if;

  -- Check if friendship already exists
  select status into v_existing_status
  from friendships
  where (requester_id = v_requester_id and addressee_id = v_addressee_id)
     or (requester_id = v_addressee_id and addressee_id = v_requester_id);

  if v_existing_status is not null then
    if v_existing_status = 'accepted' then
      raise exception 'already friends';
    elsif v_existing_status = 'pending' then
      raise exception 'friend request already pending';
    end if;
  end if;

  -- Insert friend request
  insert into friendships (requester_id, addressee_id, status)
  values (v_requester_id, v_addressee_id, 'pending')
  returning id into v_friendship_id;

  return v_friendship_id;
end;
$$;

-- RPC function to respond to friend request
create or replace function respond_to_friend_request(p_friendship_id bigint, p_response text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_addressee_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_response not in ('accepted', 'declined') then
    raise exception 'invalid response';
  end if;

  -- Check if user is the addressee of this request
  select addressee_id into v_addressee_id
  from friendships
  where id = p_friendship_id and status = 'pending';

  if v_addressee_id is null then
    raise exception 'friend request not found or already processed';
  end if;

  if v_addressee_id != v_user_id then
    raise exception 'not authorized to respond to this request';
  end if;

  -- Update friendship status
  update friendships
  set status = p_response, updated_at = now()
  where id = p_friendship_id;

  return true;
end;
$$;

-- RPC function to search users by username
create or replace function search_users_by_username(p_query text, p_limit int default 10)
returns table(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  account_type text,
  is_friend boolean,
  is_blocked boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  select 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.account_type,
    case when f.status = 'accepted' then true else false end as is_friend,
    case when b.blocked_id is not null then true else false end as is_blocked
  from users u
  left join friendships f on (
    (f.requester_id = v_user_id and f.addressee_id = u.id) or
    (f.requester_id = u.id and f.addressee_id = v_user_id)
  ) and f.status = 'accepted'
  left join blocked_users b on b.blocker_id = v_user_id and b.blocked_id = u.id
  where u.username ilike '%' || p_query || '%'
    and u.id != v_user_id
    and u.username is not null
  order by 
    case when u.username ilike p_query || '%' then 1 else 2 end,
    u.username
  limit p_limit;
end;
$$;

-- RPC function to get user's friends
create or replace function get_user_friends()
returns table(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  account_type text,
  friendship_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  return query
  select 
    u.id,
    u.username,
    u.display_name,
    u.avatar_url,
    u.account_type,
    f.created_at as friendship_created_at
  from friendships f
  join users u on (
    case 
      when f.requester_id = v_user_id then u.id = f.addressee_id
      else u.id = f.requester_id
    end
  )
  where (f.requester_id = v_user_id or f.addressee_id = v_user_id)
    and f.status = 'accepted'
    and not exists (
      select 1 from blocked_users b 
      where b.blocker_id = v_user_id and b.blocked_id = u.id
    )
  order by f.created_at desc;
end;
$$;

-- RPC function to block/unblock user
create or replace function toggle_user_block(p_username text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocker_id uuid := auth.uid();
  v_blocked_id uuid;
  v_is_blocked boolean;
begin
  if v_blocker_id is null then
    raise exception 'not authenticated';
  end if;

  -- Find user by username
  select id into v_blocked_id 
  from users 
  where username = p_username;
  
  if v_blocked_id is null then
    raise exception 'user not found';
  end if;

  if v_blocker_id = v_blocked_id then
    raise exception 'cannot block yourself';
  end if;

  -- Check if already blocked
  select true into v_is_blocked
  from blocked_users
  where blocker_id = v_blocker_id and blocked_id = v_blocked_id;

  if v_is_blocked then
    -- Unblock user
    delete from blocked_users
    where blocker_id = v_blocker_id and blocked_id = v_blocked_id;
    return false; -- now unblocked
  else
    -- Block user and remove any existing friendship
    insert into blocked_users (blocker_id, blocked_id)
    values (v_blocker_id, v_blocked_id);
    
    -- Remove friendship if exists
    delete from friendships
    where (requester_id = v_blocker_id and addressee_id = v_blocked_id)
       or (requester_id = v_blocked_id and addressee_id = v_blocker_id);
    
    return true; -- now blocked
  end if;
end;
$$;

-- Grant permissions
revoke all on function send_friend_request(text) from public;
grant execute on function send_friend_request(text) to anon, authenticated;

revoke all on function respond_to_friend_request(bigint, text) from public;
grant execute on function respond_to_friend_request(bigint, text) to anon, authenticated;

revoke all on function search_users_by_username(text, int) from public;
grant execute on function search_users_by_username(text, int) to anon, authenticated;

revoke all on function get_user_friends() from public;
grant execute on function get_user_friends() to anon, authenticated;

revoke all on function toggle_user_block(text) from public;
grant execute on function toggle_user_block(text) to anon, authenticated;
