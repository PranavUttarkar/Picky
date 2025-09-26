-- Apply square root curve to optimistic scoring output.
-- We keep same function name optimistic_match_percent for seamless upgrade.
-- NOTE: Because we redefine the function, previous semantics change globally.
-- Rollback: re-run 0020 or earlier function definition without sqrt.

create or replace function optimistic_match_percent(event_tags text[], interest_names text[], event_time timestamptz)
returns int
language plpgsql
as $$
declare
  inter_count int := 0;
  a_count int := coalesce(cardinality(event_tags), 0);
  b_count int := coalesce(cardinality(interest_names), 0);
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
  any_match := 1;

  raw := 0.55 * coverage + 0.25 * affinity + 0.15 * dice + 0.05 * any_match;
  if raw < 0.15 then
    raw := 0.15;
  end if;

  if event_time is not null and event_time >= now_ts then
    days_ahead := greatest(0, least(horizon_days, floor(extract(epoch from (event_time - now_ts)) / 86400)));
    recency := (horizon_days - days_ahead)::numeric / horizon_days;
    raw := raw * (0.9 + 0.1 * recency);
  end if;

  adjusted := raw; -- 0..~1
  -- Square root curve: lifts low scores proportionally more, compresses near 1.
  curved := sqrt(least(1, greatest(0, adjusted)));

  return greatest(0, least(100, round(curved * 100)))::int;
end;
$$;

-- Views automatically pick up new function behavior (no change needed if already referencing optimistic_match_percent).
-- Re-grant execute to be explicit.
revoke all on function optimistic_match_percent(text[], text[], timestamptz) from public;
grant execute on function optimistic_match_percent(text[], text[], timestamptz) to anon, authenticated;
