-- Improved scoring introducing softer similarity and boosts
-- Components:
--  base_overlap: Dice coefficient between event tags and interest tags (2 * intersection / (|A| + |B|))
--  coverage: intersection / |A| (how much of event's tags are covered by user/group)
--  diversity_penalty: down-weight if interest set is huge (log damping)
--  recency_boost: small boost for events within next 14 days
-- Final formula (0..100):
--  raw = 0.65 * base_overlap + 0.25 * coverage + 0.10 * recency_boost
--  adjusted = raw * diversity_penalty
--  match_percent = round(adjusted * 100)
-- Keeps existing RPC signatures; only underlying views updated via new versions ( suffixed _v2 )
-- We do not drop previous views immediately for rollback safety.

-- Helper function to compute improved score between a text[] of event tags and interest names
create or replace function improved_match_percent(event_tags text[], interest_names text[], event_time timestamptz)
returns int
language plpgsql
as $$
declare
  inter_count int := 0;
  a_count int := coalesce(cardinality(event_tags), 0);
  b_count int := coalesce(cardinality(interest_names), 0);
  dice numeric := 0;
  coverage numeric := 0;
  diversity_penalty numeric := 1;
  recency_boost numeric := 0;
  raw numeric := 0;
  adjusted numeric := 0;
  tag text;
  now_ts timestamptz := now();
  days_ahead int := 0;
  horizon_days int := 14; -- two-week horizon
begin
  if a_count = 0 or b_count = 0 then
    return 0;
  end if;

  -- intersection count
  foreach tag in array event_tags loop
    if tag = any(interest_names) then
      inter_count := inter_count + 1;
    end if;
  end loop;

  if inter_count = 0 then
    return 0;
  end if;

  dice := (2.0 * inter_count) / (a_count + b_count); -- 0..1
  coverage := inter_count::numeric / a_count; -- 0..1

  -- diversity penalty: large interest arrays shouldn't dominate; damp after 12
  if b_count > 12 then
    diversity_penalty := 12.0 / b_count; -- smoothly shrinks toward 0
  end if;

  -- recency boost: events sooner get up to +1, decaying linearly to 0 after horizon
  if event_time is not null and event_time >= now_ts then
    days_ahead := greatest(0, least(horizon_days, floor(extract(epoch from (event_time - now_ts)) / 86400)));
    recency_boost := (horizon_days - days_ahead)::numeric / horizon_days; -- 1 when today, 0 when >= horizon
  end if;

  raw := 0.65 * dice + 0.25 * coverage + 0.10 * recency_boost;
  adjusted := raw * diversity_penalty;
  return greatest(0, least(100, round(adjusted * 100)))::int;
end;
$$;

-- New views using improved scoring
create or replace view user_event_scores_v2 as
select uin.user_id,
       e.id as event_id,
       improved_match_percent(e.tags, uin.names, e.date_time) as match_percent
from events e
cross join user_interest_names uin;

create or replace view group_event_scores_v2 as
select gin.group_id,
       e.id as event_id,
       improved_match_percent(e.tags, gin.names, e.date_time) as match_percent
from events e
cross join group_interest_names gin;

-- Updated RPCs keep names, but now reference v2 views logic inline (cannot change signature)
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
            improved_match_percent(e.tags, n.arr, e.date_time) as match_percent
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
            improved_match_percent(e.tags, n.arr, e.date_time) as match_percent
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
