-- Enforce interests source: user_interests_temp only
-- This migration replaces views and RPCs to stop using user_interests (id-based)
-- and rely exclusively on user_interests_temp.names (text[]).

-- View: user_interest_names (from temp only)
create or replace view user_interest_names as
select uit.user_id,
       coalesce(array_agg(distinct t.tag order by t.tag), array[]::text[]) as names
from user_interests_temp uit
cross join lateral unnest(uit.names) t(tag)
group by uit.user_id;

-- View: group_interest_names (from temp only)
create or replace view group_interest_names as
select gm.group_id,
       coalesce(array_agg(distinct t.tag order by t.tag), array[]::text[]) as names
from group_members gm
join user_interests_temp uit on uit.user_id = gm.user_id
cross join lateral unnest(uit.names) t(tag)
group by gm.group_id;

-- Personal event scores (basic)
create or replace view user_event_scores as
select uin.user_id,
       e.id as event_id,
       case when cardinality(e.tags) = 0 then 0
            else round(100.0 * (
                 select count(*) from unnest(e.tags) t(tag)
                 where t.tag = any(uin.names)
            ) / greatest(cardinality(e.tags), cardinality(uin.names)), 0)::int end as match_percent
from events e
cross join user_interest_names uin;

-- Group event scores (basic)
create or replace view group_event_scores as
select gin.group_id,
       e.id as event_id,
       case when cardinality(e.tags) = 0 then 0
            else round(100.0 * (
                 select count(*) from unnest(e.tags) t(tag)
                 where t.tag = any(gin.names)
            ) / greatest(cardinality(e.tags), cardinality(gin.names)), 0)::int end as match_percent
from events e
cross join group_interest_names gin;

-- Keep improved and optimistic scoring functions, but make their RPCs use temp only

-- Updated RPC: personal event scores (improved scoring if available; using optimistic if defined)
create or replace function get_user_event_scores()
returns table(event_id bigint, match_percent int)
language sql
security definer
set search_path = public
as $$
     with names as (
          select coalesce(
               (
                    select coalesce(array_agg(distinct t.tag order by t.tag), array[]::text[])
                    from user_interests_temp uit
                    cross join lateral unnest(uit.names) t(tag)
                    where uit.user_id = auth.uid()
               ),
               array[]::text[]
          ) as arr
     )
     select e.id as event_id,
            case
              when to_regprocedure('optimistic_match_percent(text[],text[],timestamptz)') is not null
                then optimistic_match_percent(e.tags, n.arr, e.date_time)
              when to_regprocedure('improved_match_percent(text[],text[],timestamptz)') is not null
                then improved_match_percent(e.tags, n.arr, e.date_time)
              else
                case when cardinality(e.tags) = 0 then 0
                     else round(100.0 * (
                            select count(*) from unnest(e.tags) t(tag)
                            where t.tag = any(n.arr)
                     ) / greatest(cardinality(e.tags), cardinality(n.arr)), 0)::int end
            end as match_percent
     from events e
     cross join names n;
$$;

revoke all on function get_user_event_scores() from public;
grant execute on function get_user_event_scores() to anon, authenticated;

-- Updated RPC: group event scores (temp only)
create or replace function get_group_event_scores(p_group_id bigint)
returns table(event_id bigint, match_percent int)
language sql
security definer
set search_path = public
as $$
     with names as (
          select coalesce(
               (
                    select coalesce(array_agg(distinct t.tag order by t.tag), array[]::text[])
                    from group_members gm
                    join user_interests_temp uit on uit.user_id = gm.user_id
                    cross join lateral unnest(uit.names) t(tag)
                    where gm.group_id = p_group_id
               ),
               array[]::text[]
          ) as arr
     )
     select e.id as event_id,
            case
              when to_regprocedure('optimistic_match_percent(text[],text[],timestamptz)') is not null
                then optimistic_match_percent(e.tags, n.arr, e.date_time)
              when to_regprocedure('improved_match_percent(text[],text[],timestamptz)') is not null
                then improved_match_percent(e.tags, n.arr, e.date_time)
              else
                case when cardinality(e.tags) = 0 then 0
                     else round(100.0 * (
                            select count(*) from unnest(e.tags) t(tag)
                            where t.tag = any(n.arr)
                     ) / greatest(cardinality(e.tags), cardinality(n.arr)), 0)::int end
            end as match_percent
     from events e
     cross join names n
     where exists (
          select 1 from group_members gm
          where gm.group_id = p_group_id and gm.user_id = auth.uid()
     );
$$;

revoke all on function get_group_event_scores(bigint) from public;
grant execute on function get_group_event_scores(bigint) to anon, authenticated;
