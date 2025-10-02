-- Lock down legacy user_interests table so app no longer pulls/pushes here
-- All interest data should flow exclusively via user_interests_temp (text[] names)

-- Revoke all privileges from common roles
revoke all on table user_interests from public;
revoke all on table user_interests from anon;
revoke all on table user_interests from authenticated;

-- Drop RLS policies to prevent any access paths via policies
do $$
begin
  begin execute 'drop policy if exists "ui_select_self" on user_interests'; exception when others then null; end;
  begin execute 'drop policy if exists "ui_insert_self" on user_interests'; exception when others then null; end;
  begin execute 'drop policy if exists "ui_delete_self" on user_interests'; exception when others then null; end;
end $$;

-- Keep RLS enabled (already enabled in earlier migration) so table is inaccessible without explicit policies
alter table if exists user_interests enable row level security;

-- Optional: add a guard rule by denying by default via no permissive policies (implicit with RLS enabled and no policies)

comment on table user_interests is 'Deprecated: Do not use. Interest data is sourced from user_interests_temp.names (text[]). Access revoked.';
