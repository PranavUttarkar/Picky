-- NOTE: We cannot self-reference group_members in the USING clause because RLS
-- would recurse, producing: "infinite recursion detected in policy" (42P17).
-- Fix: create a SECURITY DEFINER helper function that runs with table owner
-- privileges (bypassing RLS) to check membership, then call that in the policy.

-- Drop any previous attempt at the select policy
DROP POLICY IF EXISTS "gm_select_group_members" ON group_members;
DROP POLICY IF EXISTS "gm_select_self_or_group" ON group_members;

-- Helper function to test membership without triggering recursive RLS evaluation
create or replace function public.is_group_member(p_group_id bigint)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists(
    select 1 from group_members gm
    where gm.group_id = p_group_id and gm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_group_member(bigint) from public;
grant execute on function public.is_group_member(bigint) to anon, authenticated;

-- New policy: any member of the group can see all membership rows of that group
CREATE POLICY "gm_select_group_members" ON group_members
FOR SELECT TO authenticated
USING ( public.is_group_member(group_id) );

-- (retain existing insert/delete self policies defined earlier migrations)
