-- Picky Recommendations Table
-- Stores AI-powered recommendations triggered by group members
-- These are visible to all group members in the chat

create table if not exists public.picky_recommendations (
  id bigserial primary key,
  group_id bigint not null references public.groups(id) on delete cascade,
  triggered_by uuid not null references auth.users(id) on delete cascade,
  trigger_message_id bigint references public.group_messages(id) on delete set null,
  recommendation_type text not null check (recommendation_type in ('events', 'food')),
  recommendations jsonb not null default '[]'::jsonb,
  requested_count int not null default 3,
  actual_count int not null default 0,
  created_at timestamptz not null default now()
);

-- Indices for performance
create index if not exists idx_picky_recommendations_group_id on public.picky_recommendations(group_id);
create index if not exists idx_picky_recommendations_created_at on public.picky_recommendations(created_at desc);
create index if not exists idx_picky_recommendations_triggered_by on public.picky_recommendations(triggered_by);

-- RLS Policies for picky_recommendations
alter table public.picky_recommendations enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists "Users can view Picky recommendations in their groups" on public.picky_recommendations;
drop policy if exists "Users can create Picky recommendations in their groups" on public.picky_recommendations;

-- Users can view Picky recommendations in groups they're a member of
create policy "Users can view Picky recommendations in their groups"
  on public.picky_recommendations for select
  using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = picky_recommendations.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Users can create Picky recommendations in groups they're a member of
create policy "Users can create Picky recommendations in their groups"
  on public.picky_recommendations for insert
  with check (
    auth.uid() = triggered_by
    and exists (
      select 1 from public.group_members
      where group_members.group_id = picky_recommendations.group_id
        and group_members.user_id = auth.uid()
    )
  );

-- Enable realtime for picky_recommendations (ignore if already added)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' 
    and tablename = 'picky_recommendations'
  ) then
    alter publication supabase_realtime add table public.picky_recommendations;
  end if;
end $$;

-- Add comment for documentation
comment on table public.picky_recommendations is 'Stores Picky AI recommendations triggered in group chats. Recommendations are visible to all group members.';
comment on column public.picky_recommendations.recommendation_type is 'Type of recommendation: events or food';
comment on column public.picky_recommendations.recommendations is 'JSONB array containing the recommendation data including id, title/name, image_url, match_percent, etc.';
