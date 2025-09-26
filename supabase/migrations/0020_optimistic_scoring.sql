-- Optimistic scoring rollout (v3)
-- Introduces optimistic_match_percent with coverage + affinity + dice + any-match floor + recency boost.
-- Does not drop previous functions (improved_match_percent) for rollback safety.

create or replace function optimistic_match_percent(event_tags text[], interest_names text[], event_time timestamptz)
returns int
language plpgsql
as $$
declare
  inter_count int := 0;
  a_count int := coalesce(cardinality(event_tags), 0); -- event tag count
  b_count int := coalesce(cardinality(interest_names), 0); -- interest count
  coverage numeric := 0; -- inter/a
  affinity numeric := 0; -- inter / sqrt(a*b)
  dice numeric := 0; -- 2*inter/(a+b)
  any_match numeric := 0;
  raw numeric := 0; -- 0..1 before scaling
  now_ts timestamptz := now();
  horizon_days int := 14;
  days_ahead int := 0;
  recency numeric := 0; -- 1 today -> 0 at horizon
  tag text;
  adjusted numeric := 0;
begin
  if a_count = 0 or b_count = 0 then
    return 0;
  end if;

  foreach tag in array event_tags loop
    if tag = any(interest_names) then
      inter_count := inter_count + 1;
    end if;
  end loop;

  if inter_count = 0 then
    return 0;
  end if;

  coverage := inter_count::numeric / greatest(1,a_count);
  affinity := inter_count::numeric / nullif(sqrt(a_count::numeric * b_count::numeric),0);
  dice := (2 * inter_count)::numeric / nullif(a_count + b_count,0);
  any_match := 1; -- since inter_count > 0

  raw := 0.55 * coverage + 0.25 * affinity + 0.15 * dice + 0.05 * any_match;
  if raw < 0.15 then
    raw := 0.15; -- optimistic floor on any overlap
  end if;

  if event_time is not null and event_time >= now_ts then
    days_ahead := greatest(0, least(horizon_days, floor(extract(epoch from (event_time - now_ts)) / 86400)));
    recency := (horizon_days - days_ahead)::numeric / horizon_days; -- 1..0
    raw := raw * (0.9 + 0.1 * recency); -- up to +10% relative
  end if;

  adjusted := raw;
  return greatest(0, least(100, round(adjusted * 100)))::int;
end;
$$;

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
