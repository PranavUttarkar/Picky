-- Allow authenticated users to create events and manage only their own
-- This complements the admin policy defined earlier (events_admin_write)

-- Insert: any authenticated user can insert events, but created_by must be themselves
drop policy if exists "events_insert_any" on events;
create policy "events_insert_any" on events
for insert to authenticated
with check (created_by = auth.uid());

-- Update: only the creator can update
drop policy if exists "events_update_own" on events;
create policy "events_update_own" on events
for update to authenticated
using (created_by = auth.uid());

-- Delete: only the creator can delete
drop policy if exists "events_delete_own" on events;
create policy "events_delete_own" on events
for delete to authenticated
using (created_by = auth.uid());
