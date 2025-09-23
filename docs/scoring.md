# Scoring and Personalization

Picky supports a personalized feed using server-side RPCs and a local fallback.

## Server-side RPCs
- `get_user_event_scores()`
  - Returns rows `{ event_id, match_percent }` for the authenticated user
  - Implemented in SQL views/functions (see migrations `0008_scoring_views.sql`)

- `get_group_event_scores(p_group_id bigint)`
  - Returns scores for a specific group the caller is a member of

Client usage example:
```ts
const { data: personalScores, error } = await supabase.rpc('get_user_event_scores');
const { data: groupScores } = await supabase.rpc('get_group_event_scores', { p_group_id: groupId });
```

## Local fallback
When RPC data is unavailable (first load or guest), the app computes a simple overlap score:

- `overlap = count(tags ∩ myTags)`
- `match = round( overlap / max(len(tags), len(myTags)) * 100 )`
- Caps between 0 and 100

## Display
- Match badge shows `Match {value}%` with a gradient border.
- In Personalized mode, the feed sorts by descending `match` value.
