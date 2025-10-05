-- Implement 50% baseline scoring with additive interest matching and recency bonuses
-- All events start at 50% baseline, then add interest matching (up to +30%) and recency bonus (up to +20%)

-- Update improved scoring to use 50% baseline + additive bonuses
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
  
  -- Scoring components
  baseline numeric := 50.0; -- 50% baseline for all events
  interest_bonus numeric := 0.0; -- 0-30% based on tag matching
  recency_bonus numeric := 0.0; -- 0-20% based on how soon event is
  
  -- Interest matching calculations
  dice numeric := 0;
  coverage numeric := 0;
  diversity_penalty numeric := 1;
  
  -- Recency calculations
  tag text;
  now_ts timestamptz := now();
  days_ahead int := 0;
  horizon_days int := 14; -- two-week horizon
  
  final_score numeric := 0;
begin
  -- Everyone gets baseline 50%
  final_score := baseline;
  
  -- Add interest bonus if there are tags and interests to compare
  if a_count > 0 and b_count > 0 then
    -- Count tag intersections (lowercased)
    foreach tag in array event_tags_lc loop
      if tag = any(interest_names_lc) then
        inter_count := inter_count + 1;
      end if;
    end loop;
    
    -- If there are matching interests, calculate bonus (0-30%)
    if inter_count > 0 then
      dice := (2 * inter_count)::numeric / nullif(a_count + b_count, 0);
      coverage := inter_count::numeric / greatest(1, a_count);
      
      -- Diversity penalty: dampen huge interest sets
      diversity_penalty := 1 / greatest(1::numeric, ln(greatest(2, b_count)));
      
      -- Interest bonus: blend dice and coverage, apply diversity penalty, scale to 0-30%
      interest_bonus := (0.7 * dice + 0.3 * coverage) * diversity_penalty * 30.0;
      interest_bonus := greatest(0, least(30, interest_bonus));
      
      final_score := final_score + interest_bonus;
    end if;
  end if;
  
  -- Add recency bonus (0-20%) for events happening soon
  if event_time is not null and event_time > now_ts then
    days_ahead := least(horizon_days, greatest(0, (extract(epoch from (event_time - now_ts)) / 86400)::int));
    -- Linear decay: 20% bonus today, 0% at 14+ days
    recency_bonus := (horizon_days - days_ahead)::numeric / horizon_days * 20.0;
    recency_bonus := greatest(0, least(20, recency_bonus));
    
    final_score := final_score + recency_bonus;
  end if;
  
  -- Cap at 100% and return as integer
  return greatest(50, least(100, round(final_score)))::int;
end;
$$;

-- Update optimistic scoring to use 50% baseline + additive bonuses
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
  
  -- Scoring components
  baseline numeric := 50.0; -- 50% baseline for all events
  interest_bonus numeric := 0.0; -- 0-35% based on tag matching (slightly higher than improved)
  recency_bonus numeric := 0.0; -- 0-15% based on how soon event is
  
  -- Interest matching calculations
  coverage numeric := 0;
  affinity numeric := 0;
  dice numeric := 0;
  
  -- Recency calculations
  tag text;
  now_ts timestamptz := now();
  days_ahead int := 0;
  horizon_days int := 14;
  
  final_score numeric := 0;
begin
  -- Everyone gets baseline 50%
  final_score := baseline;
  
  -- Add interest bonus if there are tags and interests to compare
  if a_count > 0 and b_count > 0 then
    -- Count tag intersections (lowercased)
    foreach tag in array event_tags_lc loop
      if tag = any(interest_names_lc) then
        inter_count := inter_count + 1;
      end if;
    end loop;
    
    -- If there are matching interests, calculate bonus (0-35%)
    if inter_count > 0 then
      coverage := inter_count::numeric / greatest(1, a_count);
      affinity := inter_count::numeric / nullif(sqrt(a_count::numeric * b_count::numeric), 0);
      dice := (2 * inter_count)::numeric / nullif(a_count + b_count, 0);
      
      -- Optimistic blend with higher weights, scale to 0-35%
      interest_bonus := (0.4 * coverage + 0.35 * affinity + 0.25 * dice) * 35.0;
      interest_bonus := greatest(0, least(35, interest_bonus));
      
      final_score := final_score + interest_bonus;
    end if;
  end if;
  
  -- Add recency bonus (0-15%) for events happening soon
  if event_time is not null and event_time > now_ts then
    days_ahead := least(horizon_days, greatest(0, (extract(epoch from (event_time - now_ts)) / 86400)::int));
    -- Linear decay: 15% bonus today, 0% at 14+ days
    recency_bonus := (horizon_days - days_ahead)::numeric / horizon_days * 15.0;
    recency_bonus := greatest(0, least(15, recency_bonus));
    
    final_score := final_score + recency_bonus;
  end if;
  
  -- Cap at 100% and return as integer
  return greatest(50, least(100, round(final_score)))::int;
end;
$$;

-- Update basic view scoring to use 50% baseline
create or replace view user_event_scores as
select uin.user_id,
       e.id as event_id,
       case when cardinality(e.tags) = 0 or cardinality(uin.names) = 0 then 50
            else greatest(50, least(100, round(50.0 + 30.0 * (
                 select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                 where t.tag = any(lower_text_array(uin.names))
            ) / greatest(cardinality(e.tags), cardinality(uin.names)))))::int end as match_percent
from events e
cross join user_interest_names uin;

create or replace view group_event_scores as
select gin.group_id,
       e.id as event_id,
       case when cardinality(e.tags) = 0 or cardinality(gin.names) = 0 then 50
            else greatest(50, least(100, round(50.0 + 30.0 * (
                 select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                 where t.tag = any(lower_text_array(gin.names))
            ) / greatest(cardinality(e.tags), cardinality(gin.names)))))::int end as match_percent
from events e
cross join group_interest_names gin;

-- Update the basic fallback in RPCs to use 50% baseline
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
                case when cardinality(e.tags) = 0 or cardinality(n.arr) = 0 then 50
                     else greatest(50, least(100, round(50.0 + 30.0 * (
                            select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                            where t.tag = any(lower_text_array(n.arr))
                     ) / greatest(cardinality(e.tags), cardinality(n.arr)))))::int end
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
                case when cardinality(e.tags) = 0 or cardinality(n.arr) = 0 then 50
                     else greatest(50, least(100, round(50.0 + 30.0 * (
                            select count(*) from unnest(lower_text_array(e.tags)) t(tag)
                            where t.tag = any(lower_text_array(n.arr))
                     ) / greatest(cardinality(e.tags), cardinality(n.arr)))))::int end
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