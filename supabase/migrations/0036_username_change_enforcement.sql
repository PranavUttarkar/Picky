-- Username change enforcement: add timestamp column and RPC function
alter table users add column if not exists username_last_changed timestamptz;

-- Function to securely update username with 7-day cooldown
create or replace function update_username(p_new_username text)
returns void
security definer
set search_path = public
language plpgsql as $$
declare
  v_user_id uuid;
  v_last_changed timestamptz;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select username_last_changed into v_last_changed from users where id = v_user_id;

  -- Enforce 7-day cooldown
  if v_last_changed is not null and v_last_changed > now() - interval '7 days' then
    raise exception 'USERNAME_CHANGE_TOO_SOON';
  end if;

  -- Basic validations
  if length(p_new_username) < 3 then
    raise exception 'USERNAME_TOO_SHORT';
  end if;
  if p_new_username !~ '^[A-Za-z0-9_]+$' then
    raise exception 'USERNAME_INVALID_FORMAT';
  end if;

  -- Uniqueness (case-insensitive)
  if exists(select 1 from users where lower(username) = lower(p_new_username) and id <> v_user_id) then
    raise exception 'USERNAME_TAKEN';
  end if;

  update users set username = lower(p_new_username), username_last_changed = now() where id = v_user_id;
end;$$;

-- Allow authenticated users to execute
grant execute on function update_username(text) to authenticated;
-- (Optional) allow anon if needed for onboarding flows
-- grant execute on function update_username(text) to anon;
