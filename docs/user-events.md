# User-created events

This app now supports any authenticated user creating events from the Events tab via a modal. Users can also edit or delete only their own events. Admins retain full control.

Key points:
- Add event: Events tab > Add Event button (top right) opens a modal form.
- Edit/delete: On each event card, creators see edit/delete icons on their own events. Admins see the same for all events.
- Data model: `events.created_by` stores the UUID of the user who created the event.
- RLS: Policies allow any authenticated user to insert events and to update/delete rows where `created_by = auth.uid()`. Admins bypass via `is_admin`.

Migrations:
- `0026_events_user_crud.sql` adds the RLS policies for insert/update/delete. Apply migrations to your Supabase project to enable this behavior.

Client services:
- `services/events.ts` adds `createEvent`, `updateEvent`, and `deleteEventDirect` (owner-only) while keeping `delete_event` RPC for admin deletes.

UI:
- `app/(tabs)/events.tsx` fetches `created_by` and conditionally exposes edit/delete actions and a new Add/Edit Event modal.
- Users can now paste image URLs or pick photos to upload. Picked photos are uploaded to the `event-images` storage bucket and their public URLs are saved on the event.

Troubleshooting:
- If owners cannot edit/delete, ensure the 0026 migration is applied and the session user is authenticated. Confirm `events.created_by` is set on inserted rows.
- If admins cannot delete via UI, ensure the RPC `delete_event` exists (migration `0016_event_and_poll_delete.sql`) and that `users.is_admin` is set.
- If image uploads fail: ensure the `0027_event_images_bucket.sql` migration is applied, that the `event-images` bucket exists and is public, and that you’ve granted media library permissions in the OS. On web, multiple selection requires a modern browser.
