import { supabase } from '@/services/supabase';
import type { Event } from '@/types/models';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

// Shared limiters for this service
const createEventLimiter = createRateLimiter({ ...RateLimitPresets.create, key: 'events:create' });
const searchEventLimiter = createRateLimiter({ ...RateLimitPresets.search, key: 'events:search' });
const uploadImageLimiter = createRateLimiter({ ...RateLimitPresets.upload, key: 'events:upload' });
const updateEventLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, key: 'events:update' });

export type ScoredEvent = Event & { match_percent?: number };
// ... rest of imports/types ...

// Standard event select with creator info
const EVENT_SELECT_WITH_CREATOR = `
  id, title, description, image_url, image_urls, date_time, end_time, location, tags,
  visibility, capacity, allow_join_requests, rsvp_required, created_by,
  creator:users!created_by(id, username, display_name, avatar_url, account_type)
`;

export async function getTopUserMatches(limit = 4): Promise<ScoredEvent[]> {
  const nowIso = new Date().toISOString();
  const { data: scores, error: scoreErr } = await supabase.rpc('get_user_event_scores');
  if (scoreErr) throw scoreErr;
  const filtered = (scores ?? [])
    .filter((s: any) => (s.match_percent ?? 0) > 0)
    .sort((a: any, b: any) => (b.match_percent ?? 0) - (a.match_percent ?? 0))
    .slice(0, limit);
  const ids = filtered.map((s: any) => Number(s.event_id));
  if (ids.length === 0) return [];
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select(EVENT_SELECT_WITH_CREATOR)
    .in('id', ids)
    .gte('date_time', nowIso);
  if (evErr) throw evErr;
  const scoreMap = new Map<number, number>(filtered.map((s: any) => [Number(s.event_id), Number(s.match_percent ?? 0)]));
  const byId = new Map<number, Event>((events ?? []).map((e: any) => [Number(e.id), e as Event]));
  const ordered: ScoredEvent[] = ids
    .map((id: number) => byId.get(id))
    .filter(Boolean)
    .map((e: any) => ({ ...(e as Event), match_percent: scoreMap.get(Number(e!.id)) }));
  return ordered;
}

export async function getTopGroupMatches(groupId: number, limit = 4): Promise<ScoredEvent[]> {
  const nowIso = new Date().toISOString();
  const { data: scores, error: scoreErr } = await supabase.rpc('get_group_event_scores', { p_group_id: groupId });
  if (scoreErr) throw scoreErr;
  const filtered = (scores ?? [])
    .filter((s: any) => (s.match_percent ?? 0) > 0)
    .sort((a: any, b: any) => (b.match_percent ?? 0) - (a.match_percent ?? 0))
    .slice(0, limit);
  const ids = filtered.map((s: any) => Number(s.event_id));
  if (ids.length === 0) return [];
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select(EVENT_SELECT_WITH_CREATOR)
    .in('id', ids)
    .gte('date_time', nowIso);
  if (evErr) throw evErr;
  const scoreMap = new Map<number, number>(filtered.map((s: any) => [Number(s.event_id), Number(s.match_percent ?? 0)]));
  const byId = new Map<number, Event>((events ?? []).map((e: any) => [Number(e.id), e as Event]));
  const ordered: ScoredEvent[] = ids
    .map((id: number) => byId.get(id))
    .filter(Boolean)
    .map((e: any) => ({ ...(e as Event), match_percent: scoreMap.get(Number(e!.id)) }));
  return ordered;
}

export async function searchEvents(query: string, offset = 0, limit = 20): Promise<Event[]> {
  return searchEventLimiter.execute(async () => {
    const nowIso = new Date().toISOString();
    const q = query.trim();
    if (q.length < 3) return [];
    const like = `%${q}%`;
    const { data, error } = await supabase
      .from('events')
      .select(EVENT_SELECT_WITH_CREATOR)
      .gte('date_time', nowIso)
      .or(`title.ilike.${like},description.ilike.${like},location.ilike.${like}`)
      .order('date_time', { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    return (data ?? []) as Event[];
  });
}

// Generic upcoming events (no matching filter) for fallback suggestions
export async function getUpcomingEvents(limit = 5): Promise<Event[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT_WITH_CREATOR)
    .gte('date_time', nowIso)
    .order('date_time', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Event[];
}

// Paginated list of events (for discover tab)
export async function listEvents(offset = 0, limit = 20): Promise<Event[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
    .select(EVENT_SELECT_WITH_CREATOR)
    .eq('visibility', 'public')
    .gte('date_time', nowIso)
    .order('date_time', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function deleteEvent(eventId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_event', { p_event_id: eventId });
  if (error) throw error;
}

// New: Creator-friendly CRUD using RLS (owner can update/delete)
export type EventInput = {
  title: string;
  description?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  // Optional storage paths for cleanup; not persisted on Event type by default
  image_storage_paths?: string[] | null;
  date_time: string; // ISO
  end_time?: string | null; // ISO optional end time
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  tags?: string[] | null;
  rsvp_url?: string | null;
  // Organizer features
  visibility?: 'public' | 'private';
  capacity?: number | null;
  allow_join_requests?: boolean;
  rsvp_required?: boolean; // Whether RSVP is required to attend
};

export async function createEvent(input: EventInput): Promise<Event> {
  return createEventLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) throw new Error('Not authenticated');
    
    // Check if user is suspended or banned (client-side check for better UX)
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('is_suspended, is_banned, suspended_until, is_admin')
      .eq('id', user.id)
      .single();
    
    if (userError) throw userError;
    
    if (userData?.is_banned) {
      throw new Error('Your account has been banned. You cannot create events.');
    }
    
    if (userData?.is_suspended) {
      const suspendedUntil = userData.suspended_until;
      if (suspendedUntil && new Date(suspendedUntil) > new Date()) {
        throw new Error(`Your account is suspended until ${new Date(suspendedUntil).toLocaleDateString()}. You cannot create events.`);
      } else if (!suspendedUntil) {
        throw new Error('Your account is suspended. You cannot create events.');
      }
    }
    
    // Check daily event limit for non-admin users
    if (!userData?.is_admin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Use RPC function for accurate count (handles timezone properly)
      const { data: countData, error: countError } = await supabase.rpc('count_user_events_today', {
        u: user.id,
      });
      
      if (countError) {
        // Fallback to direct query if RPC fails (for backwards compatibility)
        const { count, error: fallbackError } = await supabase
          .from('events')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .gte('created_at', today.toISOString())
          .lt('created_at', tomorrow.toISOString());
        
        if (fallbackError) throw fallbackError;
        
        if ((count ?? 0) >= 10) {
          throw new Error('You have reached the daily limit of 10 events. Please try again tomorrow.');
        }
      } else {
        const count = typeof countData === 'number' ? countData : Number(countData) || 0;
        if (count >= 10) {
          throw new Error('You have reached the daily limit of 10 events. Please try again tomorrow.');
        }
      }
    }
    
    const image_urls = input.image_urls && input.image_urls.length ? input.image_urls : (input.image_url ? [input.image_url] : null);
    const image_url = image_urls && image_urls.length ? image_urls[0] : (input.image_url ?? null);
    const { data, error } = await supabase
      .from('events')
      .insert({ 
        ...input, 
        image_urls, 
        image_url, 
        created_by: user.id,
        visibility: input.visibility ?? 'public',
        capacity: input.capacity ?? null,
        allow_join_requests: input.allow_join_requests ?? true,
        rsvp_required: input.rsvp_required ?? false,
      })
      .select('id,title,description,image_url,image_urls,date_time,end_time,location,latitude,longitude,tags,rsvp_url,created_by,visibility,capacity,allow_join_requests,rsvp_required')
      .single();
    if (error) {
      // Handle RLS policy rejection
      if (error.message?.includes('can_user_create_events') || error.code === '42501') {
        throw new Error('You are not allowed to create events. Your account may be suspended or banned.');
      }
      throw error;
    }
    return data as Event;
  });
}

export async function updateEvent(eventId: number, input: Partial<EventInput>): Promise<Event> {
  return updateEventLimiter.execute(async () => {
    const image_urls = input.image_urls && input.image_urls.length ? input.image_urls : (input.image_url ? [input.image_url] : undefined);
    const image_url = image_urls && image_urls.length ? image_urls[0] : input.image_url;
    const payload = { ...input } as any;
    if (image_urls !== undefined) payload.image_urls = image_urls;
    if (image_url !== undefined) payload.image_url = image_url;
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', eventId)
      .select('id,title,description,image_url,image_urls,date_time,end_time,location,latitude,longitude,tags,rsvp_url,created_by,visibility,capacity,allow_join_requests,rsvp_required')
      .single();
    if (error) throw error;
    return data as Event;
  });
}

export async function deleteEventDirect(eventId: number): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  if (error) throw error;
}

// Upload one or more local image URIs to Supabase Storage and return public URLs
// Accepts Expo file URIs (content://, file://) or web data URLs; caller should cap at 3
export async function uploadEventImages(uris: string[]): Promise<string[]> {
  return uploadImageLimiter.execute(async () => {
    if (!uris.length) return [];
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');
    const userId = auth.user.id;
    const out: string[] = [];
    for (const [idx, uri] of uris.entries()) {
      if (!uri) continue;
      // Fetch the file as a Blob (Expo/React Native supports fetch for file URIs)
      const res = await fetch(uri);
      const blob = await res.blob();
      const extGuess = (blob.type && blob.type.split('/')[1]) || 'jpg';
      const fileName = `${userId}/${Date.now()}_${idx}.${extGuess}`;
      const { data, error } = await supabase.storage
        .from('event-images')
        .upload(fileName, blob, {
          contentType: blob.type || 'image/jpeg',
          upsert: false,
        });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('event-images').getPublicUrl(data.path);
      out.push(pub.publicUrl);
    }
    return out;
  });
}

// Also export a variant that returns both URLs and storage paths to support cleanup
export async function uploadEventImagesWithPaths(uris: string[]): Promise<{ urls: string[]; paths: string[] }> {
  return uploadImageLimiter.execute(async () => {
    if (!uris.length) return { urls: [], paths: [] };
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');
    const userId = auth.user.id;
    const urls: string[] = [];
    const paths: string[] = [];
    for (const [idx, uri] of uris.entries()) {
      if (!uri) continue;
      const res = await fetch(uri);
      const blob = await res.blob();
      const extGuess = (blob.type && blob.type.split('/')[1]) || 'jpg';
      const fileName = `${userId}/${Date.now()}_${idx}.${extGuess}`;
      const { data, error } = await supabase.storage.from('event-images').upload(fileName, blob, {
        contentType: blob.type || 'image/jpeg',
        upsert: false,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from('event-images').getPublicUrl(data.path);
      urls.push(pub.publicUrl);
      paths.push(data.path);
    }
    return { urls, paths };
  });
}

export async function deleteEventImages(paths: string[]): Promise<void> {
  if (!paths?.length) return;
  const { error } = await supabase.storage.from('event-images').remove(paths);
  if (error) throw error;
}
