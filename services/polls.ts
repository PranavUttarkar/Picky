import { supabase } from '@/services/supabase';
import type { Event } from '@/types/models';

export interface PollOptionView {
  poll_id: number;
  event_id: number;
  votes: number;
  event?: Pick<Event, 'id' | 'title' | 'date_time' | 'location' | 'image_url' | 'tags' | 'rsvp_url'>;
  match_percent?: number;
  // For rating mode aggregates
  love_it?: number;
  fine?: number;
  not_for_me?: number;
}

export async function createPollWithOptions(groupId: number, eventIds: number[], opts?: { title?: string | null; deadlineAt?: string | null; mode?: 'single' | 'rating' }): Promise<number> {
  // Try v2 (with title/deadline/mode). If DB isn't migrated yet, fall back to v1.
  try {
    const { data, error } = await supabase.rpc('create_poll_with_options_v2', {
      p_group_id: groupId,
      p_event_ids: eventIds,
      p_title: opts?.title ?? null,
      p_deadline_at: opts?.deadlineAt ?? null,
      p_mode: opts?.mode ?? 'single',
    });
    if (error) throw error;
    return data as number;
  } catch (e: any) {
    const code = e?.code as string | undefined;
    const msg = (e?.message as string | undefined)?.toLowerCase() || '';
    const shouldFallback = code === '42703' /* undefined column */
      || code === '42883' /* undefined function */
      || msg.includes('column "title"')
      || msg.includes('column "deadline_at"')
      || msg.includes('column "mode"')
      || msg.includes('create_poll_with_options_v2');
    if (!shouldFallback) throw e;
    console.warn('create_poll_with_options_v2 unavailable, falling back to create_poll_with_options');
    const { data, error } = await supabase.rpc('create_poll_with_options', {
      p_group_id: groupId,
      p_event_ids: eventIds,
    });
    if (error) throw error;
    return data as number;
  }
}

export async function closePoll(pollId: number): Promise<void> {
  const { error } = await supabase.rpc('close_poll', { p_poll_id: pollId });
  if (error) throw error;
}

export async function getPoll(pollId: number): Promise<{ poll: any; options: PollOptionView[]; myVote?: number | null; myRatings?: Record<number, number>; totalMembers: number; respondedCount: number; waiting?: Array<{ id: string; name?: string | null }>; }> {
  const user = (await supabase.auth.getUser()).data.user;
  const [{ data: poll }, { data: options }, { data: myVote }, { data: groupIdRow }, { data: myRatingsRows } ] = await Promise.all([
    supabase.from('polls').select('*').eq('id', pollId).single(),
    supabase.from('poll_options').select('poll_id,event_id,votes, event:events(id,title,description,image_url,date_time,location,tags,rsvp_url)').eq('poll_id', pollId).order('votes', { ascending: false }),
    user ? supabase.from('poll_votes').select('event_id').eq('poll_id', pollId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('polls').select('group_id').eq('id', pollId).single(),
    user ? supabase.from('poll_ratings').select('event_id,rating').eq('poll_id', pollId).eq('user_id', user.id) : Promise.resolve({ data: [] }),
  ]);

  // Compute group match % for options
  let optionsWithMatch: any[] = options ?? [];
  try {
    const gid = (groupIdRow as any)?.group_id ?? (poll as any)?.group_id;
    if (gid && (optionsWithMatch?.length ?? 0) > 0) {
      const { data: scores } = await supabase.rpc('get_group_event_scores', { p_group_id: gid });
      const scoreMap = new Map<number, number>((scores ?? []).map((s: any) => [Number(s.event_id), Number(s.match_percent ?? 0)]));
      optionsWithMatch = (optionsWithMatch as any[]).map((o: any) => ({
        ...o,
        match_percent: scoreMap.get(Number(o.event?.id ?? o.event_id)) ?? undefined,
      }));
    }
  } catch {}

  // Compute response progress
  let totalMembers = 0;
  let respondedCount = 0;
  let waiting: Array<{ id: string; name?: string | null }> | undefined = undefined;
  try {
    const gid = (groupIdRow as any)?.group_id ?? (poll as any)?.group_id;
    if (gid) {
      const { data: memberRows } = await supabase.from('group_members').select('user_id').eq('group_id', gid);
      const memberIds: string[] = ((memberRows as any[]) ?? []).map((r: any) => r.user_id);
      totalMembers = memberIds.length;
      let responderIds: string[] = [];
      if ((poll as any)?.mode === 'rating') {
        const { data: ratingsRows } = await supabase.from('poll_ratings').select('user_id').eq('poll_id', pollId);
        const set = new Set<string>(((ratingsRows as any[]) ?? []).map((r: any) => r.user_id));
        responderIds = Array.from(set);
      } else {
        const { data: votesRows } = await supabase.from('poll_votes').select('user_id').eq('poll_id', pollId);
        const set = new Set<string>(((votesRows as any[]) ?? []).map((r: any) => r.user_id));
        responderIds = Array.from(set);
      }
      respondedCount = responderIds.length;
      const waitingIds = memberIds.filter((id) => !responderIds.includes(id));
      if (waitingIds.length) {
        const { data: waitingUsers } = await supabase.from('users').select('id,name').in('id', waitingIds);
        waiting = ((waitingUsers as any[]) ?? []).map((u: any) => ({ id: u.id, name: u.name }));
      } else {
        waiting = [];
      }
    }
  } catch {}

  // Aggregate ratings by event/rating since client SDK lacks group-by typing here
  let myRatings: Record<number, number> | undefined = undefined;
  if ((poll as any)?.mode === 'rating') {
    myRatings = {};
    for (const r of (myRatingsRows as any[]) ?? []) {
      myRatings[Number(r.event_id)] = Number(r.rating);
    }
    // fetch all ratings for this poll and aggregate
    const { data: allRatings } = await supabase.from('poll_ratings').select('event_id,rating').eq('poll_id', pollId);
    const aggMap = new Map<number, { love_it: number; fine: number; not_for_me: number }>();
    for (const row of (allRatings as any[]) ?? []) {
      const eid = Number(row.event_id);
      const rating = Number(row.rating);
      const entry = aggMap.get(eid) ?? { love_it: 0, fine: 0, not_for_me: 0 };
      if (rating === 1) entry.love_it += 1;
      else if (rating === 0) entry.fine += 1;
      else if (rating === -1) entry.not_for_me += 1;
      aggMap.set(eid, entry);
    }
    optionsWithMatch = (optionsWithMatch as any[]).map((o: any) => ({
      ...o,
      ...(aggMap.get(Number(o.event?.id ?? o.event_id)) ?? {}),
    }));
  }

  return { poll, options: (optionsWithMatch as any) ?? [], myVote: (myVote as any)?.event_id ?? null, myRatings, totalMembers, respondedCount, waiting };
}

export async function castVote(pollId: number, eventId: number): Promise<void> {
  const { error } = await supabase.rpc('cast_vote', { p_poll_id: pollId, p_event_id: eventId });
  if (error) throw error;
}

export async function clearMyVote(pollId: number): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('poll_votes').delete().eq('poll_id', pollId).eq('user_id', user.id);
  if (error) throw error;
}

export function onPollRealtime(pollId: number, onChange: () => void) {
  const channel = supabase
    .channel(`poll-${pollId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_ratings', filter: `poll_id=eq.${pollId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}

export function suggestLeader(options: PollOptionView[]): PollOptionView | undefined {
  if (!options?.length) return undefined;
  // Score options by votes first, then match% as tiebreaker
  return [...options].sort((a, b) => {
    const v = (b.votes ?? 0) - (a.votes ?? 0);
    if (v !== 0) return v;
    // If rating aggregates exist, weigh them: love_it=2, fine=1, not_for_me=-1
    const aScore = (a.love_it ?? 0) * 2 + (a.fine ?? 0) * 1 - (a.not_for_me ?? 0);
    const bScore = (b.love_it ?? 0) * 2 + (b.fine ?? 0) * 1 - (b.not_for_me ?? 0);
    const r = bScore - aScore;
    if (r !== 0) return r;
    return (b.match_percent ?? 0) - (a.match_percent ?? 0);
  })[0];
}

export async function castRating(pollId: number, eventId: number, rating: -1 | 0 | 1 | null): Promise<void> {
  const { error } = await supabase.rpc('cast_rating', { p_poll_id: pollId, p_event_id: eventId, p_rating: rating });
  if (error) throw error;
}
