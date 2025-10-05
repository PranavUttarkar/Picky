# Scoring and Personalization

Picky supports a personalized feed using server-side RPCs and a local fallback.

## Server-side RPCs
- `get_user_event_scores()`
  - Returns rows `{ event_id, match_percent }` for the authenticated user
  - Implemented with 50% baseline + additive bonuses (migration `0026_baseline_50_percent_scoring.sql`)

- `get_group_event_scores(p_group_id bigint)`
  - Returns scores for a specific group the caller is a member of

Client usage example:
```ts
const { data: personalScores, error } = await supabase.rpc('get_user_event_scores');
const { data: groupScores } = await supabase.rpc('get_group_event_scores', { p_group_id: groupId });
```

## Baseline + Additive Scoring (v3)
**NEW APPROACH:** All events now start at 50% baseline, with bonuses added on top:

- **Baseline:** 50% for all events (positive user experience)
- **Interest Bonus:** 0-30% added when event tags match user interests
- **Recency Bonus:** 0-15% added for events happening soon (within 14 days)
- **Final Score:** 50% + interest_bonus + recency_bonus (capped at 100%)

This replaces the previous v2 approach and ensures all events feel relevant while still rewarding good matches.

## Previous Improved Scoring (v2) - Deprecated
The original overlap formula `|A ∩ B| / max(|A|, |B|)` was pessimistic when interest sets were large or uneven. The new model blends multiple factors:

Components (all 0..1):
- Dice overlap: `dice = 2 * |A ∩ B| / (|A| + |B|)`
- Coverage: `coverage = |A ∩ B| / |A|`
- Recency boost: Linear decay from 1 (today) down to 0 at 14 days out
- Diversity penalty: Damps very large interest arrays: `penalty = 1` if |B| <= 12 else `12 / |B|`

Formula:
```
raw = 0.65 * dice + 0.25 * coverage + 0.10 * recency_boost
adjusted = raw * diversity_penalty
base_match_percent = round(adjusted * 100)
```

### Minimum score floor (>= 50%)
As of migration `0019_min_score_floor.sql`, all events are floored to a minimum `match_percent` of 50. Reasons:
- Avoid discouraging users with very low percentages
- Present a simpler “relative strength” scale above a baseline of 50

Trade-offs:
- Reduces discriminatory power at the low end (scores 0-49 now compressed to 50)
- Sorting still works (strong matches rise above 50) but distribution is narrower
- Consider UI copy like "50%+" baseline or hidden for near-baseline matches

## Local fallback
When RPC data is unavailable (first load or guest), the app still computes the simple overlap score. Note: both event tags and user interest tags are normalized to lowercase before comparison to ensure case-insensitive matching.

- `overlap = count(tags ∩ myTags)`
- `match = round( overlap / max(len(tags), len(myTags)) * 100 )`

(This does NOT currently apply the 50% floor; you may optionally align it.)

## Case-insensitive tags
- All scoring paths (server-side views/functions and client fallback) lower-case tags during matching.
- Event creation UI also lower-cases tags upon insert/update.
- This prevents mismatches like "Tech" vs "tech" and keeps counts consistent.

## Display
- Match badge shows `Match {value}%` with a gradient border.
- In Personalized mode, the feed sorts by descending `match` value.

## Future ideas
- A/B test weight coefficients (and evaluate necessity of 50% floor)
- Add negative signals (explicit dislikes)
- Introduce tag specificity weighting (rarer tags worth more)
- Use exponential time decay instead of linear
- Calibrate floor adaptively (e.g., per-user percentile mapping)
