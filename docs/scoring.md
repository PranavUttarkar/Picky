# Scoring and Personalization

Picky supports a personalized feed using server-side RPCs and a local fallback.

## Server-side RPCs
- `get_user_event_scores()`
  - Returns rows `{ event_id, match_percent }` for the authenticated user
  - Implemented with improved scoring (migration `0018_improved_scoring.sql`)

- `get_group_event_scores(p_group_id bigint)`
  - Returns scores for a specific group the caller is a member of

Client usage example:
```ts
const { data: personalScores, error } = await supabase.rpc('get_user_event_scores');
const { data: groupScores } = await supabase.rpc('get_group_event_scores', { p_group_id: groupId });
```

## Improved Scoring (v2)
The original overlap formula `|A ∩ B| / max(|A|, |B|)` was pessimistic when interest sets were large or uneven. The new model blends multiple factors:

Components (all 0..1):
- Dice overlap: `dice = 2 * |A ∩ B| / (|A| + |B|)` (treats unequal set sizes more fairly)
- Coverage: `coverage = |A ∩ B| / |A|` (how much of the event's tags are represented)
- Recency boost: Linear decay from 1 (today) down to 0 at 14 days out
- Diversity penalty: Damps very large interest arrays: `penalty = 1` if |B| <= 12 else `12 / |B|`

Formula:
```
raw = 0.65 * dice + 0.25 * coverage + 0.10 * recency_boost
adjusted = raw * diversity_penalty
match_percent = round(adjusted * 100)
```
Why this helps:
- Large interest sets no longer crush scores; Dice + penalty avoid overly small percentages
- Events with few tags get credit when fully covered (coverage term)
- Near-term events appear slightly higher (recency)
- Still bounded 0..100 and backward-compatible field name

## Local fallback
When RPC data is unavailable (first load or guest), the app still computes the simple overlap score:

- `overlap = count(tags ∩ myTags)`
- `match = round( overlap / max(len(tags), len(myTags)) * 100 )`

(Consider upgrading this client-side logic later to mimic server formula if needed.)

## Display
- Match badge shows `Match {value}%` with a gradient border.
- In Personalized mode, the feed sorts by descending `match` value.

## Future ideas
- A/B test weight coefficients
- Add negative signals (explicit dislikes)
- Introduce tag specificity weighting (rarer tags worth more)
- Use exponential time decay instead of linear if needed
