-- Ensure case-insensitive tag matching by normalizing to lowercase during scoring
-- Safe to run multiple times; views and functions are replaced idempotently.

-- Helper: lowercase array text[]
create or replace function lower_text_array(arr text[]) returns text[]
language sql immutable strict parallel safe as $$
  select coalesce(array_agg(lower(x) order by lower(x)), array[]::text[])
  from unnest(coalesce(arr, array[]::text[])) t(x);
$$;

-- Update views to compare lowercase tags
create or replace view user_event_scores as
select uin.user_id,
       e.id as event_id,
       case when cardinality(e.tags) = 0 then 0
            else round(100.0 * (
                 select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                 where t.tag = any(lower_text_array(uin.names))
            ) / greatest(cardinality(e.tags), cardinality(uin.names)), 0)::int end as match_percent
from events e
cross join user_interest_names uin;

create or replace view group_event_scores as
select gin.group_id,
       e.id as event_id,
       case when cardinality(e.tags) = 0 then 0
            else round(100.0 * (
                 select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                 where t.tag = any(lower_text_array(gin.names))
            ) / greatest(cardinality(e.tags), cardinality(gin.names)), 0)::int end as match_percent
from events e
cross join group_interest_names gin;

-- Update improved/optimistic scoring functions to lowercase inputs internally
create or replace function improved_match_percent(event_tags text[], interest_names text[], event_time timestamptz)
returns int
language plpgsql
as $$
declare
  event_tags_lc text[] := lower_text_array(event_tags);
  interest_names_lc text[] := lower_text_array(interest_names);
  inter_count int := 0;
  a_count int := coalesce(cardinality(event_tags_lc), 0);
  b_count int := coalesce(cardinality(interest_names_lc), 0);
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

  -- intersection count (lowercased)
  foreach tag in array event_tags_lc loop
    if tag = any(interest_names_lc) then
      inter_count := inter_count + 1;
    end if;
  end loop;

  if inter_count = 0 then
    return 0;
  end if;

  -- base components
  dice := (2 * inter_count)::numeric / nullif(a_count + b_count, 0);
  coverage := inter_count::numeric / greatest(1, a_count);

  -- diversity penalty: dampen huge interest sets
  diversity_penalty := 1 / greatest(1::numeric, ln(greatest(2, b_count)));

  -- recency boost within 14 days
  if event_time is not null and event_time > now_ts then
    days_ahead := least(horizon_days, greatest(0, (extract(epoch from (event_time - now_ts)) / 86400)::int));
    recency_boost := (horizon_days - days_ahead)::numeric / horizon_days; -- 1 today -> 0 at horizon
  end if;

  raw := 0.65 * dice + 0.25 * coverage + 0.10 * recency_boost;
  adjusted := raw * diversity_penalty;
  return greatest(0, least(100, round(adjusted * 100)))::int;
end;
$$;

create or replace function optimistic_match_percent(event_tags text[], interest_names text[], event_time timestamptz)
returns int
language plpgsql
as $$
declare
  event_tags_lc text[] := lower_text_array(event_tags);
  interest_names_lc text[] := lower_text_array(interest_names);
  inter_count int := 0;
  a_count int := coalesce(cardinality(event_tags_lc), 0);
  b_count int := coalesce(cardinality(interest_names_lc), 0);
  coverage numeric := 0;
  affinity numeric := 0;
  dice numeric := 0;
  any_match numeric := 0;
  raw numeric := 0; -- base 0..1 pre-curve
  now_ts timestamptz := now();
  horizon_days int := 14;
  days_ahead int := 0;
  recency numeric := 0;
  tag text;
  adjusted numeric := 0; -- after recency and floor
  curved numeric := 0; -- after sqrt curve
begin
  if a_count = 0 or b_count = 0 then
    return 0;
  end if;

  foreach tag in array event_tags_lc loop
    if tag = any(interest_names_lc) then
      inter_count := inter_count + 1;
    end if;
  end loop;

  if inter_count = 0 then
    return 0;
  end if;

  coverage := inter_count::numeric / greatest(1,a_count);
  affinity := inter_count::numeric / nullif(sqrt(a_count::numeric * b_count::numeric),0);
  dice := (2 * inter_count)::numeric / nullif(a_count + b_count,0);
  any_match := 1;

  raw := 0.55 * coverage + 0.25 * affinity + 0.15 * dice + 0.05 * any_match;
  if raw < 0.15 then
    raw := 0.15;
  end if;

  if event_time is not null and event_time > now_ts then
    days_ahead := least(horizon_days, greatest(0, (extract(epoch from (event_time - now_ts)) / 86400)::int));
    recency := (horizon_days - days_ahead)::numeric / horizon_days; -- 1 today -> 0 at horizon
    raw := raw * (0.9 + 0.1 * recency);
  end if;

  curved := sqrt(greatest(0, least(1, raw)));
  return greatest(0, least(100, round(curved * 100)))::int;
end;
$$;

-- Update RPCs to call functions with lowercase normalization built-in (no change needed)
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
                            select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                            where t.tag = any(lower_text_array(n.arr))
                     ) / greatest(cardinality(e.tags), cardinality(n.arr)), 0)::int end
            end as match_percent
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
                            select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                            where t.tag = any(lower_text_array(n.arr))
                     ) / greatest(cardinality(e.tags), cardinality(n.arr)), 0)::int end
            end as match_percent
     from events e
     cross join names n
     where exists (
          select 1 from group_members gm
          where gm.group_id = p_group_id and gm.user_id = auth.uid()
     );
$$;

revoke all on function get_user_event_scores() from public;
grant execute on function get_user_event_scores() to anon, authenticated;
revoke all on function get_group_event_scores(bigint) from public;
grant execute on function get_group_event_scores(bigint) to anon, authenticated;
