-- Optimistic scoring rollout (v3)
-- Updated to ensure only `user_interests` table is used.

-- v3 views using optimistic scoring
create or replace view user_event_scores_v3 as
select uin.user_id,
       e.id as event_id,
       optimistic_match_percent(e.tags, uin.names, e.date_time) as match_percent
from events e
cross join user_interest_names uin;

create or replace view group_event_scores_v3 as
select gin.group_id,
       e.id as event_id,
       optimistic_match_percent(e.tags, gin.names, e.date_time) as match_percent
from events e
cross join group_interest_names gin;

-- Updated RPCs (same names) now referencing new function directly (no need for view indirection here)
create or replace function get_user_event_scores()
returns table(event_id bigint, match_percent int)
language sql
security definer
set search_path = public
as $$
     with names as (
          select array_agg(i.name order by i.name) as arr
          from user_interests ui
          join interests i on i.id = ui.interest_id
          where ui.user_id = auth.uid()
     )
     select e.id as event_id,
            optimistic_match_percent(e.tags, n.arr, e.date_time) as match_percent
     from events e
     cross join names n;
$$;

create or replace function get_group_event_scores(p_group_id bigint)
returns table(event_id bigint, match_percent int)
language sql
security definer
set search_path = public
as $$
     with names as (
          select array_agg(distinct i.name order by i.name) as arr
          from group_members gm
          join user_interests ui on ui.user_id = gm.user_id
          join interests i on i.id = ui.interest_id
          where gm.group_id = p_group_id
     )
     select e.id as event_id,
            optimistic_match_percent(e.tags, n.arr, e.date_time) as match_percent
     from events e
     cross join names n
     where exists (
          select 1 from group_members gm
          where gm.group_id = p_group_id and gm.user_id = auth.uid()
     );
$$;

revoke all on function get_user_event_scores() from public;
revoke all on function get_group_event_scores(bigint) from public;
grant execute on function get_user_event_scores() to anon, authenticated;
grant execute on function get_group_event_scores(bigint) to anon, authenticated;
