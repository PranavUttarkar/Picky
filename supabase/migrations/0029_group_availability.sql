create table if not exists public.group_availability (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_start timestamptz not null,
  created_at timestamptz not null default now(),
  unique (group_id, user_id, slot_start)
);

create index if not exists idx_group_availability_group_slot on public.group_availability (group_id, slot_start);
create index if not exists idx_group_availability_user on public.group_availability (user_id);

alter table public.group_availability enable row level security;

-- Members of a group can view availability for that group
create policy sel_group_availability_members_only
  on public.group_availability
  for select
  using (
    exists (
      select 1 from public.group_members gm
      where gm.group_id = group_availability.group_id
        and gm.user_id = auth.uid()
    )
  );

-- Only the current user can insert their availability for groups they belong to
create policy ins_group_availability_self_only
  on public.group_availability
  for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_availability.group_id
        and gm.user_id = auth.uid()
    )
  );

-- Only the current user can delete their availability
create policy del_group_availability_self_only
  on public.group_availability
  for delete
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.group_members gm
      where gm.group_id = group_availability.group_id
        and gm.user_id = auth.uid()
    )
  );
