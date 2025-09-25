import { supabase } from '@/services/supabase';
import type { Event } from '@/types/models';

export type ScoredEvent = Event & { match_percent?: number };

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
  .select('id,title,description,image_url,image_urls,date_time,location,tags')
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
  .select('id,title,description,image_url,image_urls,date_time,location,tags')
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
  const nowIso = new Date().toISOString();
  const q = query.trim();
  if (q.length < 3) return [];
  const like = `%${q}%`;
  const { data, error } = await supabase
    .from('events')
  .select('id,title,description,image_url,image_urls,date_time,location,tags')
    .gte('date_time', nowIso)
    .or(`title.ilike.${like},description.ilike.${like},location.ilike.${like}`)
    .order('date_time', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as Event[];
}

// Generic upcoming events (no matching filter) for fallback suggestions
export async function getUpcomingEvents(limit = 5): Promise<Event[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('events')
  .select('id,title,description,image_url,image_urls,date_time,location,tags')
    .gte('date_time', nowIso)
    .order('date_time', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Event[];
}

export async function deleteEvent(eventId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_event', { p_event_id: eventId });
  if (error) throw error;
}
