-- Group Messages Table
-- Stores all messages in a group chat
create table if not exists public.group_messages (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  deleted_at timestamptz,
  is_edited boolean default false,
  reply_to_id bigint references public.group_messages(id) on delete set null
);

-- Message Reactions Table
-- Stores emoji reactions to messages
create table if not exists public.message_reactions (
  id bigserial primary key,
  message_id bigint not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  unique(message_id, user_id, emoji)
);

-- Indices for performance
create index if not exists idx_group_messages_group_id on public.group_messages(group_id);
create index if not exists idx_group_messages_created_at on public.group_messages(created_at desc);
create index if not exists idx_group_messages_user_id on public.group_messages(user_id);
create index if not exists idx_message_reactions_message_id on public.message_reactions(message_id);
create index if not exists idx_message_reactions_user_id on public.message_reactions(user_id);

-- RLS Policies for group_messages
alter table public.group_messages enable row level security;

-- Users can view messages in groups they're a member of
create policy "Users can view messages in their groups"
  on public.group_messages for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = group_messages.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Users can insert messages in groups they're a member of
create policy "Users can send messages in their groups"
  on public.group_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.group_members
      where group_members.group_id = group_messages.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Users can update their own messages
create policy "Users can update their own messages"
  on public.group_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can delete their own messages (soft delete)
create policy "Users can delete their own messages"
  on public.group_messages for delete
  using (auth.uid() = user_id);

-- RLS Policies for message_reactions
alter table public.message_reactions enable row level security;

-- Users can view reactions on messages they can see
create policy "Users can view reactions on accessible messages"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.group_messages gm
      inner join public.group_members gm2 on gm.group_id = gm2.group_id
      where gm.id = message_reactions.message_id
        and gm2.user_id = auth.uid()
    )
  );

-- Users can add reactions to messages in their groups
create policy "Users can add reactions"
  on public.message_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.group_messages gm
      inner join public.group_members gm2 on gm.group_id = gm2.group_id
      where gm.id = message_reactions.message_id
        and gm2.user_id = auth.uid()
    )
  );

-- Users can remove their own reactions
create policy "Users can remove their own reactions"
  on public.message_reactions for delete
  using (auth.uid() = user_id);
