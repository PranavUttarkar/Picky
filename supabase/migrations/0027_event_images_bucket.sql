-- Create a public bucket for event images and add storage policies
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'event-images') then
    insert into storage.buckets (id, name, public) values ('event-images', 'event-images', true);
  end if;
end $$;

-- Public read for objects in the event-images bucket
drop policy if exists "event_images_public_read" on storage.objects;
create policy "event_images_public_read" on storage.objects
for select
using (bucket_id = 'event-images');

-- Authenticated users can upload to the event-images bucket
drop policy if exists "event_images_authenticated_insert" on storage.objects;
create policy "event_images_authenticated_insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'event-images');

-- Only the uploader (owner) can update their own objects in the event-images bucket
drop policy if exists "event_images_update_own" on storage.objects;
create policy "event_images_update_own" on storage.objects
for update to authenticated
using (
  bucket_id = 'event-images'
  and (
    owner = auth.uid()
    or exists (
      select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true
    )
  )
);

-- Only the uploader (owner) can delete their own objects in the event-images bucket
drop policy if exists "event_images_delete_own" on storage.objects;
create policy "event_images_delete_own" on storage.objects
for delete to authenticated
using (
  bucket_id = 'event-images'
  and (
    owner = auth.uid()
    or exists (
      select 1 from public.users u where u.id = auth.uid() and coalesce(u.is_admin, false) = true
    )
  )
);
