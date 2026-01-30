-- Poll reactions table for group chat reactions
-- Allows users to react to polls with emoji reactions (thumbs_up, thumbs_down, love, meh)

create table if not exists poll_reactions (
  poll_id integer not null references polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('thumbs_up', 'thumbs_down', 'love', 'meh')),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

-- Enable RLS
alter table poll_reactions enable row level security;

-- RLS policies: group members can read/insert/update/delete their own reactions
create policy "pr_select_group_members" on poll_reactions for select to authenticated using (
  exists(
    select 1 from polls p 
    join group_members gm on gm.group_id = p.group_id 
    where p.id = poll_reactions.poll_id 
    and gm.user_id = auth.uid()
  )
);

create policy "pr_insert_own" on poll_reactions for insert to authenticated with check (
  user_id = auth.uid() and
  exists(
    select 1 from polls p 
    join group_members gm on gm.group_id = p.group_id 
    where p.id = poll_reactions.poll_id 
    and gm.user_id = auth.uid()
  )
);

create policy "pr_update_own" on poll_reactions for update to authenticated using (
  user_id = auth.uid()
) with check (
  user_id = auth.uid()
);

create policy "pr_delete_own" on poll_reactions for delete to authenticated using (
  user_id = auth.uid()
);

-- Index for efficient lookups
create index if not exists idx_poll_reactions_poll on poll_reactions(poll_id);
create index if not exists idx_poll_reactions_user on poll_reactions(user_id);
