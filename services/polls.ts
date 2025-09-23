import { supabase } from '@/services/supabase';

export interface PollOptionView {
  poll_id: number;
  event_id: number;
  votes: number;
}

export async function createPollWithOptions(groupId: number, eventIds: number[]): Promise<number> {
  const { data, error } = await supabase.rpc('create_poll_with_options', {
    p_group_id: groupId,
    p_event_ids: eventIds,
  });
  if (error) throw error;
  return data as number;
}

export async function closePoll(pollId: number): Promise<void> {
  const { error } = await supabase.rpc('close_poll', { p_poll_id: pollId });
  if (error) throw error;
}

export async function getPoll(pollId: number): Promise<{ poll: any; options: PollOptionView[]; myVote?: number | null }> {
  const user = (await supabase.auth.getUser()).data.user;
  const [{ data: poll }, { data: options }, { data: myVote }] = await Promise.all([
    supabase.from('polls').select('*').eq('id', pollId).single(),
    supabase.from('poll_options').select('*').eq('poll_id', pollId).order('votes', { ascending: false }),
    user ? supabase.from('poll_votes').select('event_id').eq('poll_id', pollId).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { poll, options: options ?? [], myVote: (myVote as any)?.event_id ?? null };
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
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
