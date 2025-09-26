import { supabase } from '@/services/supabase';
import type { Event } from '@/types/models';

export type DecisionPrefs = {
  budget?: number | null; // 0..100
  time_pref?: 'evening' | 'late' | 'flex' | null;
  radius_miles?: number | null;
  needs?: string[] | null; // codes: veg,noalc,outdoor,dance
  notes?: string | null;
};

export async function upsertDecisionPrefs(pollId: number, prefs: DecisionPrefs): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');
  const payload: any = {
    poll_id: pollId,
    user_id: user.id,
    budget: prefs.budget ?? null,
    time_pref: prefs.time_pref ?? null,
    radius_miles: prefs.radius_miles ?? null,
    needs: prefs.needs ?? null,
    notes: prefs.notes ?? null,
  };
  const { error } = await supabase.from('decision_prefs').upsert(payload, {
    onConflict: 'poll_id,user_id',
  });
  if (error) throw error;
}

export async function getDecisionPrefs(pollId: number): Promise<DecisionPrefs | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from('decision_prefs')
    .select('budget,time_pref,radius_miles,needs,notes')
    .eq('poll_id', pollId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as any) ?? null;
}

// Very simple recommendation pass: use group/user match scoring RPC to fetch top events
export async function getRecommendationsForPoll(pollId: number): Promise<(Event & { match_percent?: number })[]> {
  // We need the group id for this poll
  const { data: poll } = await supabase.from('polls').select('group_id').eq('id', pollId).maybeSingle();
  const gid = (poll as any)?.group_id as number | undefined;
  let scores: any[] | null = null;
  if (gid) {
    const res = await supabase.rpc('get_group_event_scores', { p_group_id: gid });
    scores = res.data as any[];
  } else {
    const res = await supabase.rpc('get_user_event_scores');
    scores = res.data as any[];
  }
  const filtered = (scores ?? [])
    .filter((s: any) => (s.match_percent ?? 0) > 0)
    .sort((a: any, b: any) => (b.match_percent ?? 0) - (a.match_percent ?? 0))
    .slice(0, 5);
  const ids = filtered.map((s: any) => Number(s.event_id));
  if (ids.length === 0) return [];
  const nowIso = new Date().toISOString();
  const { data: events } = await supabase
    .from('events')
    .select('id,title,description,image_url,image_urls,date_time,location,tags')
    .in('id', ids)
    .gte('date_time', nowIso);
  const scoreMap = new Map<number, number>(filtered.map((s: any) => [Number(s.event_id), Number(s.match_percent ?? 0)]));
  return ((events ?? []) as Event[]).map((e: any) => ({ ...e, match_percent: scoreMap.get(Number(e.id)) }));
}
