import type { Event } from '@/types/models';

export function eventHasImage(event: Pick<Event, 'image_url' | 'image_urls'>): boolean {
  return Boolean(
    event.image_url?.trim() || event.image_urls?.some((url) => Boolean(url?.trim())),
  );
}
