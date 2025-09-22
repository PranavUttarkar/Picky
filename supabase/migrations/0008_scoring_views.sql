-- View: user_interest_names
create or replace view user_interest_names as
select ui.user_id, array_agg(i.name order by i.name) as names
from user_interests ui
join interests i on i.id = ui.interest_id
group by ui.user_id;

-- Personal event scores
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

-- Group interest aggregation
create or replace view group_interest_names as
select gm.group_id,
       array_agg(distinct i.name order by i.name) as names
from group_members gm
join user_interests ui on ui.user_id = gm.user_id
join interests i on i.id = ui.interest_id
group by gm.group_id;

-- Group event scores
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

-- Index views (materialized alternative can be used later if needed)
-- Restrict direct access to views; prefer RPCs
revoke all on table user_interest_names from public;
revoke all on table group_interest_names from public;
revoke all on table user_event_scores from public;
revoke all on table group_event_scores from public;
-- Secure RPC: personal event scores for current user
create or replace function get_user_event_scores()
returns table(event_id bigint, match_percent int)
language sql
security definer
set search_path = public
as $$
     with names as (
          select coalesce(
               (
                    select array_agg(i.name order by i.name)
                    from user_interests ui
                    join interests i on i.id = ui.interest_id
                    where ui.user_id = auth.uid()
               ),
               (
                    select uit.names from user_interests_temp uit where uit.user_id = auth.uid()
               ),
               array[]::text[]
          ) as arr
     )
     select e.id as event_id,
                    case when cardinality(e.tags) = 0 then 0
                                  else round(100.0 * (
                                             select count(*) from unnest(e.tags) t(tag)
                                             cross join names n
                                             where t.tag = any(n.arr)
                                  ) / greatest(cardinality(e.tags), cardinality((select arr from names))), 0)::int end as match_percent
     from events e
     cross join names n;
$$;

revoke all on function get_user_event_scores() from public;
grant execute on function get_user_event_scores() to anon, authenticated;

-- Secure RPC: group event scores for a group the caller belongs to
create or replace function get_group_event_scores(p_group_id bigint)
returns table(event_id bigint, match_percent int)
language sql
security definer
set search_path = public
as $$
     with names as (
          select coalesce(
               (
                    select array_agg(distinct i.name order by i.name)
                    from group_members gm
                    join user_interests ui on ui.user_id = gm.user_id
                    join interests i on i.id = ui.interest_id
                    where gm.group_id = p_group_id
               ),
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
                    case when cardinality(e.tags) = 0 then 0
                                  else round(100.0 * (
                                             select count(*) from unnest(e.tags) t(tag)
                                             cross join names n
                                             where t.tag = any(n.arr)
                                  ) / greatest(cardinality(e.tags), cardinality((select arr from names))), 0)::int end as match_percent
     from events e
     cross join names n
     where exists (
          select 1 from group_members gm
          where gm.group_id = p_group_id and gm.user_id = auth.uid()
     );
$$;

revoke all on function get_group_event_scores(bigint) from public;
grant execute on function get_group_event_scores(bigint) to anon, authenticated;