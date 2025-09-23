# Frontend: Home Feed

This document describes how the `Home` screen implements the event feed, filtering, personalization, and admin tools.

Source: `app/(tabs)/home.tsx`

## Key features
- Search bar supporting free text and `#tag` tokens
- Tag chips: selectable filters (AND logic)
- Two modes:
  - `View All`: chronological by `date_time`
  - `Personalized`: sorted by match percent (RPC or local fallback)
- Pagination and caching with demo fillers when content is sparse
- Event details modal with add-to-calendar and RSVP link
- Admin panel: create/update/delete events with a confirmation modal for delete

## Data and state
- `events`: list of `Event` objects (real and demo)
- `scores`: map of `event_id -> match_percent` from RPC
- `saved`: list of saved event IDs
- `query`, `activeTags`, `mode`
- Admin form state for upsert
- `selectedEvent`, `detailsOpen` for the modal
- Delete confirmation: `confirmDeleteOpen`, `deleteTargetId`, `isDeleting`

## Filtering
- Query is split into hashtags (`#tag`) and words
- A candidate event matches if:
  - Includes all query tags AND all selected tag chips
  - And its title/description/location contains all search words

## Personalization
- If `scores[eventId]` exists from `get_user_event_scores`, use that value.
- Else compute a simple overlap `match = round(overlap(tags, myTags)/max(len(tags), len(myTags)) * 100)`.

## Admin tools
- Visible only if `users.is_admin = true`
- CRUD form with fields: title, description, image URL, date/time, location, tags, RSVP URL
- Date/time inputs adjust for web vs native (text inputs on web; `@react-native-community/datetimepicker` on native)
- Upsert writes to `events` (admin policy required)
- Delete flow:
  - Clicking delete opens a confirmation `Modal` (cross-platform)
  - Confirm triggers `.delete().eq('id', id)`; refreshes the list and shows a success alert
  - Dummy events (negative IDs) cannot be deleted

## Performance notes
- `FlatList` with windowing settings and memoized list header/components
- Negative-ID demo items let the UI feel populated without faking saves/polls
