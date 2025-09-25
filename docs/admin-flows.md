# Admin Flows

Admins can create, update, and delete events directly from the Home screen.

## Admin detection
- On load, the app queries `users.is_admin` for the current user. If `true`, admin UI is visible.

## Create/Update Event
- Expand the "Admin: Manage Events" panel.
- Fill in fields: title, description, up to 3 image URLs, date & time, location, tags (comma-separated), RSVP URL.
- Date & Time:
  - Mobile (iOS/Android): tap the date or time boxes to open native pickers.
  - Web: enter `YYYY-MM-DD` and `HH:MM` (24h). Example: `2025-09-30` + `18:30`.
  - Stored in UTC as an ISO timestamp (`events.date_time`).
- "Create Event" inserts a new row with `created_by = auth.uid()`.
- When editing an existing event, fields are prefilled and the action becomes "Update Event".

## Quick edit/delete list
- The panel shows a short list of recent events with inline "Edit" and "Delete" actions.
- "Edit" pre-fills the form and scrolls to the top.

## Delete confirmation
- Pressing any delete button (card or admin panel list) opens a confirmation modal:
  - Title: "Delete event?"
  - Text: "This action cannot be undone."
  - Buttons: `Cancel` and `Delete` (disabled while deleting)
- On confirm, the app calls Supabase `delete` on `events` with the selected `id`, refreshes the feed, and shows a small success alert.

## Security
- RLS policy `events_admin_write` (see `docs/supabase-policies.md`) restricts write access to admins.
- The client also checks `isAdmin` before showing admin controls and before executing delete.
