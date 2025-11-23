create or replace function search_users_by_username(
  p_query text,
  p_limit int default 10
)
returns table(
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  account_type text,
  is_friend boolean,
  is_blocked boolean,
  friendship_status text
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
    case when b.blocked_id is not null then true else false end as is_blocked,
    case
      when f.status = 'accepted' then 'accepted'
      when f.status = 'pending' and f.requester_id = v_user_id then 'pending_outgoing'
      when f.status = 'pending' and f.addressee_id = v_user_id then 'pending_incoming'
      else null
    end as friendship_status
  from users u
  left join lateral (
    select f_inner.requester_id, f_inner.addressee_id, f_inner.status, f_inner.created_at
    from friendships f_inner
    where (f_inner.requester_id = v_user_id and f_inner.addressee_id = u.id)
       or (f_inner.requester_id = u.id and f_inner.addressee_id = v_user_id)
    order by f_inner.created_at desc
    limit 1
  ) f on true
  left join blocked_users b 
    on b.blocker_id = v_user_id and b.blocked_id = u.id
  where u.username ilike '%' || p_query || '%'
    and u.id != v_user_id
    and u.username is not null
  order by 
    case when u.username ilike p_query || '%' then 1 else 2 end,
    u.username
  limit p_limit;
end;
$$;
