-- NOT YET APPLIED!!

-- Enforce a minimum 50% match score for all events
-- This adjusts the existing improved_match_percent function to floor results at 50.
-- Note: This reduces discriminative power for very weak matches; consider UI labeling accordingly.

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
  final_score int := 0;
  tag text;
  now_ts timestamptz := now();
  days_ahead int := 0;
  horizon_days int := 14; -- two-week horizon
begin
  if a_count = 0 or b_count = 0 then
    -- Previously 0, now floored to 50
    return 50;
  end if;

  -- intersection count
  foreach tag in array event_tags loop
    if tag = any(interest_names) then
      inter_count := inter_count + 1;
    end if;
  end loop;

  if inter_count = 0 then
    return 50; -- floor
  end if;

  dice := (2.0 * inter_count) / (a_count + b_count); -- 0..1
  coverage := inter_count::numeric / a_count; -- 0..1

  if b_count > 12 then
    diversity_penalty := 12.0 / b_count;
  end if;

  if event_time is not null and event_time >= now_ts then
    days_ahead := greatest(0, least(horizon_days, floor(extract(epoch from (event_time - now_ts)) / 86400)));
    recency_boost := (horizon_days - days_ahead)::numeric / horizon_days;
  end if;

  raw := 0.65 * dice + 0.25 * coverage + 0.10 * recency_boost;
  adjusted := raw * diversity_penalty;
  final_score := greatest(0, least(100, round(adjusted * 100)))::int;

  if final_score < 50 then
    final_score := 50;
  end if;

  return final_score;
end;
$$;

-- No changes needed to views or RPCs; they call this function name.
