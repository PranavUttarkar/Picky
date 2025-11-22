import { supabase } from '@/services/supabase';
import type { Event } from '@/types/models';
import { triggerGroupDecisionNotification } from '@/utils/notifications';

export type PollOptionView =
  | ({
      kind: 'event';
      poll_id: number;
      id: number; // event_id
      votes: number;
      event?: Pick<
        Event,
        'id' | 'title' | 'date_time' | 'location' | 'image_url' | 'tags' | 'rsvp_url'
      >;
      match_percent?: number;
      // For rating mode aggregates
      love_it?: number;
      fine?: number;
      not_for_me?: number;
    })
  | ({
      kind: 'text';
      poll_id: number;
      id: number; // text_option_id
      votes: number;
      text: string;
    });

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
    
    // Trigger notification for new group decision
    await triggerGroupDecisionNotification();
    
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
    
    // Trigger notification for new group decision
    await triggerGroupDecisionNotification();
    
    return data as number;
  }
}

// Create a custom text poll with free-text options
export async function createTextPoll(
  groupId: number,
  texts: string[],
  opts?: { title?: string | null; deadlineAt?: string | null }
): Promise<number> {
  const cleaned = texts
    .map((t) => t?.trim())
    .filter((t): t is string => !!t && t.length > 0);
  if (cleaned.length === 0) throw new Error('Provide at least one option');
  const { data, error } = await supabase.rpc('create_text_poll', {
    p_group_id: groupId,
    p_texts: cleaned,
    p_title: opts?.title ?? null,
    p_deadline_at: opts?.deadlineAt ?? null,
  });
  if (error) throw error;
  await triggerGroupDecisionNotification();
  return data as number;
}

export async function closePoll(pollId: number): Promise<void> {
  const { error } = await supabase.rpc('close_poll', { p_poll_id: pollId });
  if (error) throw error;
}

export async function getPoll(pollId: number): Promise<{ poll: any; options: PollOptionView[]; myVote?: number | null; myRatings?: Record<number, number>; totalMembers: number; respondedCount: number; waiting?: Array<{ id: string; name?: string | null }>; commitments?: string[]; finalEvent?: any; foodDetails?: Record<number, any>; }> {
  const user = (await supabase.auth.getUser()).data.user;
  const [
    { data: poll },
    { data: options },
    { data: textOptions },
    { data: myVote },
    { data: myTextVote },
    { data: groupIdRow },
    { data: myRatingsRows },
    { data: commitmentRows },
    { data: finalEvent },
  ] = await Promise.all([
    supabase.from('polls').select('*').eq('id', pollId).single(),
    supabase
      .from('poll_options')
      .select(
        'poll_id,event_id,votes, event:events(id,title,description,image_url,date_time,location,tags,rsvp_url)'
      )
      .eq('poll_id', pollId)
      .order('votes', { ascending: false }),
    supabase
      .from('poll_text_options')
      .select('id,poll_id,text,votes')
      .eq('poll_id', pollId)
      .order('votes', { ascending: false }),
    user
      ? supabase
          .from('poll_votes')
          .select('event_id')
          .eq('poll_id', pollId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('poll_text_votes')
          .select('text_option_id')
          .eq('poll_id', pollId)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('polls').select('group_id').eq('id', pollId).single(),
    user ? supabase.from('poll_ratings').select('event_id,rating').eq('poll_id', pollId).eq('user_id', user.id) : Promise.resolve({ data: [] }),
    supabase.from('poll_commitments').select('user_id').eq('poll_id', pollId),
    supabase.from('polls').select('final_event_id, event:events!polls_final_event_id_fkey(id,title,description,image_url,date_time,location,tags,rsvp_url)').eq('id', pollId).maybeSingle(),
  ]);

  // Compute group match % for event options
  let eventOptionsWithMatch: any[] = options ?? [];
  try {
    const gid = (groupIdRow as any)?.group_id ?? (poll as any)?.group_id;
    if (gid && (eventOptionsWithMatch?.length ?? 0) > 0) {
      const { data: scores } = await supabase.rpc('get_group_event_scores', { p_group_id: gid });
      const scoreMap = new Map<number, number>((scores ?? []).map((s: any) => [Number(s.event_id), Number(s.match_percent ?? 0)]));
      eventOptionsWithMatch = (eventOptionsWithMatch as any[]).map((o: any) => ({
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
        // Count a user as responded only if they rated all options
        const { data: ratingsRows } = await supabase.from('poll_ratings').select('user_id,event_id').eq('poll_id', pollId);
        const byUser = new Map<string, Set<number>>();
        for (const row of ((ratingsRows as any[]) ?? [])) {
          const uid = String(row.user_id);
          const eid = Number(row.event_id);
          const set = byUser.get(uid) ?? new Set<number>();
          set.add(eid);
          byUser.set(uid, set);
        }
        const optionCount = ((options as any[]) ?? []).length;
        responderIds = Array.from(byUser.entries())
          .filter(([, set]) => set.size >= optionCount && optionCount > 0)
          .map(([uid]) => uid);
      } else {
        // include NULL event_id rows (explicit No responses) as participation
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
    eventOptionsWithMatch = (eventOptionsWithMatch as any[]).map((o: any) => ({
      ...o,
      ...(aggMap.get(Number(o.event?.id ?? o.event_id)) ?? {}),
    }));
  }

  const commitmentIds = ((commitmentRows as any[]) ?? []).map((r: any) => r.user_id);
  const resolvedFinalEvent = (finalEvent as any)?.event ?? undefined;
  // Normalize to unified option view
  const normalizedEventOptions: PollOptionView[] = (eventOptionsWithMatch as any[]).map((o: any) => ({
    kind: 'event',
    poll_id: Number(o.poll_id),
    id: Number(o.event_id),
    votes: Number(o.votes ?? 0),
    event: o.event,
    match_percent: o.match_percent,
    love_it: (o as any).love_it,
    fine: (o as any).fine,
    not_for_me: (o as any).not_for_me,
  }));
  const normalizedTextOptions: PollOptionView[] = ((textOptions as any[]) ?? []).map((t: any) => ({
    kind: 'text',
    poll_id: Number(t.poll_id),
    id: Number(t.id),
    votes: Number(t.votes ?? 0),
    text: String(t.text ?? ''),
  }));
  const unifiedOptions: PollOptionView[] = [...normalizedEventOptions, ...normalizedTextOptions];

  // Server-side prefetch of FOOD|<place_id> text options to avoid client churn.
  let foodDetails: Record<number, any> | undefined = undefined;
  try {
    const placeIdMap: Record<string, number[]> = {}; // place_id -> [textOptionIds]
    const parseFoodToken = (t: string): string | null => {
      const s = (t || '').trim();
      if (!s.startsWith('FOOD|')) return null;
      const parts = s.split('|');
      if (parts.length < 2) return null;
      const pid = parts[1]?.trim();
      return pid || null;
    };
    for (const opt of normalizedTextOptions) {
      const pid = parseFoodToken((opt as any).text);
      if (!pid) continue;
      (placeIdMap[pid] = placeIdMap[pid] || []).push(opt.id);
    }
    const placeIds = Object.keys(placeIdMap);
    if (placeIds.length) {
      // Lightweight select (subset of columns) to reduce payload
      const { data: rows } = await supabase
        .from('restaurants')
        .select('place_id, restaurant_name, description, address, city, category, price_range, review_points, main_image, image_1, image_2, image_3')
        .in('place_id', placeIds);
      foodDetails = {};
      for (const r of (rows as any[]) ?? []) {
        const pid = String(r.place_id);
        const images = [r.main_image, r.image_1, r.image_2, r.image_3].filter(Boolean);
        const payload = {
          place_id: pid,
          restaurant_name: r.restaurant_name ?? 'Restaurant',
          description: r.description ?? null,
          address: r.address ?? null,
          city: r.city ?? null,
          category: r.category ?? null,
          price_range: r.price_range ?? null,
          review_points: r.review_points != null ? String(r.review_points) : null,
          images,
        };
        for (const textOptionId of placeIdMap[pid] || []) {
          foodDetails[textOptionId] = payload;
        }
      }
    }
  } catch {
    // Silent failure; client will fallback to lazy fetch.
  }
  // myVote: prefer whichever exists
  const myUnifiedVote = (myVote as any)?.event_id ?? (myTextVote as any)?.text_option_id ?? null;
  return {
    poll,
    options: unifiedOptions,
    myVote: myUnifiedVote,
    myRatings,
    totalMembers,
    respondedCount,
    waiting,
    commitments: commitmentIds,
    finalEvent: resolvedFinalEvent,
    foodDetails,
  };
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

export async function recordNoVote(pollId: number): Promise<void> {
  const { error } = await supabase.rpc('record_no_vote', { p_poll_id: pollId });
  if (error) throw error;
}

export function onPollRealtime(pollId: number, onChange: () => void) {
  const channel = supabase
    .channel(`poll-${pollId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_votes', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_options', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_text_votes', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_text_options', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_ratings', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'poll_commitments', filter: `poll_id=eq.${pollId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'polls', filter: `id=eq.${pollId}` }, onChange)
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
    // If rating aggregates exist (event-only), weigh them: love_it=2, fine=1, not_for_me=-1
    const aScore = (a as any).love_it != null || (a as any).fine != null || (a as any).not_for_me != null
      ? ((a as any).love_it ?? 0) * 2 + ((a as any).fine ?? 0) * 1 - ((a as any).not_for_me ?? 0)
      : 0;
    const bScore = (b as any).love_it != null || (b as any).fine != null || (b as any).not_for_me != null
      ? ((b as any).love_it ?? 0) * 2 + ((b as any).fine ?? 0) * 1 - ((b as any).not_for_me ?? 0)
      : 0;
    const r = bScore - aScore;
    if (r !== 0) return r;
    return ((b as any).match_percent ?? 0) - ((a as any).match_percent ?? 0);
  })[0];
}

export async function castRating(pollId: number, eventId: number, rating: -1 | 0 | 1 | null): Promise<void> {
  const { error } = await supabase.rpc('cast_rating', { p_poll_id: pollId, p_event_id: eventId, p_rating: rating });
  if (error) throw error;
}

export async function commitPoll(pollId: number, eventId: number): Promise<void> {
  const { error } = await supabase.rpc('commit_poll', { p_poll_id: pollId, p_event_id: eventId });
  if (error) throw error;
}

export async function toggleCommitment(pollId: number): Promise<void> {
  const { error } = await supabase.rpc('toggle_commitment', { p_poll_id: pollId });
  if (error) throw error;
}

// Add a new option (event) to an existing poll. Requires user to be a group member (enforced by RLS via poll_options policies).
export async function addPollOption(pollId: number, eventId: number): Promise<void> {
  const { error } = await supabase.from('poll_options').insert({ poll_id: pollId, event_id: eventId });
  if (error) throw error;
}

export async function addTextPollOption(pollId: number, text: string): Promise<void> {
  const { error } = await supabase.rpc('add_text_option', { p_poll_id: pollId, p_text: text });
  if (error) throw error;
}

export async function castTextVote(pollId: number, textOptionId: number): Promise<void> {
  const { error } = await supabase.rpc('cast_text_vote', { p_poll_id: pollId, p_text_option_id: textOptionId });
  if (error) throw error;
}

export async function postStatusUpdate(pollId: number, kind: 'late_10' | 'note', message?: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('poll_status_updates').insert({ poll_id: pollId, user_id: user.id, kind, message: message ?? null });
  if (error) throw error;
}

export async function submitFeedback(pollId: number, rating: number, comment?: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('post_event_feedback').upsert({ poll_id: pollId, user_id: user.id, rating, comment: comment ?? null }, { onConflict: 'poll_id,user_id' });
  if (error) throw error;
}

export async function deletePoll(pollId: number): Promise<void> {
  const { error } = await supabase.rpc('delete_poll', { p_poll_id: pollId });
  if (error) throw error;
}
