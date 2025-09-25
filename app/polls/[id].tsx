import { View, Text, Pressable, FlatList, Alert, Image, Linking, Modal } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/services/supabase';
import { useLocalSearchParams, router } from 'expo-router';
import {
  castVote,
  closePoll,
  getPoll,
  onPollRealtime,
  clearMyVote,
  suggestLeader,
  castRating,
  commitPoll,
  toggleCommitment,
  addPollOption,
  recordNoVote,
  deletePoll,
} from '@/services/polls';
import { getTopGroupMatches, getTopUserMatches } from '@/services/events';

export default function PollDetails() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollId = Number(id);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [myVote, setMyVote] = useState<number | null | undefined>(undefined);
  const [totalMembers, setTotalMembers] = useState(0);
  const [responded, setResponded] = useState(0);
  const [myRatings, setMyRatings] = useState<Record<number, number> | undefined>(undefined);
  const [waiting, setWaiting] = useState<Array<{ id: string; name?: string | null }> | undefined>(
    undefined,
  );
  const [commitments, setCommitments] = useState<string[] | undefined>(undefined);
  const [finalEvent, setFinalEvent] = useState<any | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [suggested, setSuggested] = useState<any[] | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    const {
      poll,
      options,
      myVote,
      myRatings,
      totalMembers,
      respondedCount,
      waiting,
      commitments,
      finalEvent,
    } = await getPoll(pollId);
    setPoll(poll);
    setOptions(options);
    setMyVote(myVote);
    setMyRatings(myRatings);
    setTotalMembers(totalMembers);
    setResponded(respondedCount);
    setWaiting(waiting);
    setCommitments(commitments);
    setFinalEvent(finalEvent);
    // Load fallback suggestions if no options yet
    if ((options?.length ?? 0) === 0 && poll) {
      try {
        const evs = await (poll.group_id
          ? getTopGroupMatches(poll.group_id, 3)
          : getTopUserMatches(3));
        setSuggested(evs);
      } catch {
        setSuggested([]);
      }
    } else {
      setSuggested(null);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      await load();
      const unsub = onPollRealtime(pollId, () => {
        if (mounted) load();
      });
      return () => unsub();
    })();
    return () => {
      mounted = false;
    };
  }, [pollId]);

  const totalVotes = useMemo(() => options.reduce((sum, o) => sum + (o.votes ?? 0), 0), [options]);
  const leader = useMemo(() => suggestLeader(options), [options]);
  const progressPct = useMemo(
    () => (totalMembers ? Math.round((responded * 100) / totalMembers) : 0),
    [responded, totalMembers],
  );
  const isCommitted = !!finalEvent;

  const onVote = async (eventId: number) => {
    try {
      if (!poll?.is_active) return;
      await castVote(pollId, eventId);
      await load();
    } catch (e: any) {
      Alert.alert('Vote failed', e.message ?? String(e));
    }
  };

  const onClose = async () => {
    try {
      await closePoll(pollId);
      await load();
    } catch (e: any) {
      Alert.alert('Close failed', e.message ?? String(e));
    }
  };

  const onDeletePoll = async () => {
    try {
      setDeleting(true);
      await deletePoll(pollId);
      setDeleteOpen(false);
      Alert.alert('Deleted', 'Poll removed');
      // If we know the group id, route explicitly to its page with a refresh param
      const gid = poll?.group_id;
      if (gid) {
        router.replace(`/groups/${gid}?refresh=1`);
      } else {
        router.back();
      }
    } catch (e: any) {
      Alert.alert('Delete failed', e.message ?? String(e));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1, padding: 16 }}>
        <GradientHeader
          title={poll?.title || `Poll #${pollId}`}
          subtitle={poll?.is_active ? 'Open' : 'Closed'}
          onBack={() => {
            const gid = poll?.group_id;
            if (gid) router.replace(`/(tabs)/groups/${gid}`);
            else router.replace('/(tabs)/groups');
          }}
          backLabel="Back to group"
        />
        <Text style={{ color: c.muted, marginTop: 6 }}>
          {poll?.is_active ? 'Open' : 'Closed'}
          {poll?.deadline_at ? ` • closes ${new Date(poll.deadline_at).toLocaleString()}` : ''}
        </Text>

        {/* Response progress */}
        {totalMembers > 0 ? (
          <View style={{ backgroundColor: c.card, padding: 10, borderRadius: 12, marginTop: 10 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>
              {responded}/{totalMembers} responded ({progressPct}%)
            </Text>
            <View
              style={{
                height: 6,
                backgroundColor: c.background,
                borderRadius: 6,
                marginTop: 6,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: `${progressPct}%`, backgroundColor: c.primary, flex: 1 }} />
            </View>
            {waiting && waiting.length > 0 ? (
              <Text style={{ color: c.muted, marginTop: 6 }}>
                Waiting on {waiting.length} {waiting.length === 1 ? 'person' : 'people'}
              </Text>
            ) : null}
          </View>
        ) : null}

        {poll?.is_active ? (
          <Pressable
            onPress={onClose}
            style={{
              alignSelf: 'flex-start',
              backgroundColor: c.card,
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              marginTop: 12,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>Close Poll</Text>
          </Pressable>
        ) : null}
        {/* Delete poll button (always visible to members; server enforces auth) */}
        <Pressable
          onPress={() => setDeleteOpen(true)}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: c.background,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 10,
            marginTop: 12,
          }}
        >
          <Text style={{ color: '#ff5555', fontWeight: '700' }}>Delete Poll</Text>
        </Pressable>

        {options.length === 1 && poll?.mode !== 'rating' ? (
          <View style={{ marginTop: 20 }}>
            <Pressable
              onPress={() => router.push(`/events/${options[0].event_id}`)}
              style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}
            >
              {options[0].event?.image_url ? (
                <Image
                  source={{ uri: options[0].event.image_url }}
                  style={{ width: '100%', height: 160, borderRadius: 10, marginBottom: 8 }}
                />
              ) : null}
              <Text style={{ color: c.text, fontWeight: '700' }}>
                {options[0].event?.title ?? `Event #${options[0].event_id}`}
              </Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {options[0].event?.date_time
                  ? new Date(options[0].event.date_time).toLocaleString()
                  : ''}
                {options[0].event?.location ? ` • ${options[0].event.location}` : ''}
              </Text>
              {options[0].match_percent != null ? (
                <Text style={{ color: c.muted, marginTop: 4 }}>
                  {options[0].match_percent}% group match
                </Text>
              ) : null}
              {options[0].event?.rsvp_url ? (
                <Pressable
                  onPress={() => {
                    if (options[0].event?.rsvp_url) Linking.openURL(options[0].event.rsvp_url);
                  }}
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: c.background,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    marginTop: 8,
                  }}
                >
                  <Text style={{ color: c.text }}>Open RSVP</Text>
                </Pressable>
              ) : null}
            </Pressable>
            <Text style={{ color: c.text, fontWeight: '700', marginBottom: 12, marginTop: 12 }}>
              Do you want to attend?
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => onVote(options[0].event_id)}
                disabled={!poll?.is_active}
                style={{
                  flex: 1,
                  backgroundColor: myVote === options[0].event_id ? c.primary : c.card,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Yes</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  if (!poll?.is_active) return;
                  try {
                    await recordNoVote(pollId);
                    await load();
                    Alert.alert('Recorded', 'You responded No');
                  } catch (e: any) {
                    Alert.alert('Update failed', e.message ?? String(e));
                  }
                }}
                disabled={!poll?.is_active}
                style={{
                  flex: 1,
                  backgroundColor: myVote == null ? c.accent : c.background,
                  padding: 14,
                  borderRadius: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>No</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginTop: 12 }}>
              <Text style={{ color: c.muted }}>Yes votes: {totalVotes}</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                (No responses are counted as participation but not shown in the bar.)
              </Text>
              {myVote == null ? (
                <Pressable
                  onPress={async () => {
                    try {
                      await clearMyVote(pollId);
                      await load();
                    } catch (e: any) {
                      Alert.alert('Update failed', e.message ?? String(e));
                    }
                  }}
                  style={{ marginTop: 8 }}
                >
                  <Text style={{ color: c.muted, textDecorationLine: 'underline' }}>
                    Clear my No response
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : (
          <FlatList
            style={{ marginTop: 16 }}
            data={options}
            keyExtractor={(o) => String(o.event_id)}
            renderItem={({ item }) => {
              const count = item.votes ?? 0;
              const pct = totalVotes === 0 ? 0 : Math.round((count * 100) / totalVotes);
              const isMine = myVote === item.event_id;
              return (
                <Pressable
                  onPress={() => {
                    if (poll?.mode !== 'rating') onVote(item.event_id);
                  }}
                  disabled={poll?.mode !== 'rating' ? !poll?.is_active : true}
                  style={{
                    backgroundColor: c.card,
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  {item.event?.image_url ? (
                    <Image
                      source={{ uri: item.event.image_url }}
                      style={{ width: '100%', height: 140, borderRadius: 10, marginBottom: 8 }}
                    />
                  ) : null}
                  <Text style={{ color: c.text, fontWeight: '700' }}>
                    {item.event?.title ?? `Event #${item.event_id}`}
                  </Text>
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    {item.event?.date_time ? new Date(item.event.date_time).toLocaleString() : ''}
                    {item.event?.location ? ` • ${item.event.location}` : ''}
                  </Text>
                  {item.match_percent != null ? (
                    <Text style={{ color: c.muted, marginTop: 4 }}>
                      {item.match_percent}% group match
                    </Text>
                  ) : null}
                  {poll?.mode === 'rating' ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                      <Pressable
                        onPress={async () => {
                          try {
                            await castRating(pollId, item.event_id, 1);
                            await load();
                          } catch (e: any) {
                            Alert.alert('Rate failed', e.message ?? String(e));
                          }
                        }}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor:
                            (myRatings?.[item.event_id] ?? 0) === 1 ? c.primary : c.background,
                        }}
                      >
                        <Text style={{ color: c.text }}>Love it ({item.love_it ?? 0})</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          try {
                            await castRating(pollId, item.event_id, 0);
                            await load();
                          } catch (e: any) {
                            Alert.alert('Rate failed', e.message ?? String(e));
                          }
                        }}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor:
                            (myRatings?.[item.event_id] ?? -99) === 0 ? c.primary : c.background,
                        }}
                      >
                        <Text style={{ color: c.text }}>It's fine ({item.fine ?? 0})</Text>
                      </Pressable>
                      <Pressable
                        onPress={async () => {
                          try {
                            await castRating(pollId, item.event_id, -1);
                            await load();
                          } catch (e: any) {
                            Alert.alert('Rate failed', e.message ?? String(e));
                          }
                        }}
                        style={{
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor:
                            (myRatings?.[item.event_id] ?? 0) === -1 ? c.primary : c.background,
                        }}
                      >
                        <Text style={{ color: c.text }}>Not for me ({item.not_for_me ?? 0})</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <View
                      style={{
                        height: 8,
                        backgroundColor: c.background,
                        borderRadius: 6,
                        marginTop: 8,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{
                          width: `${pct}%`,
                          backgroundColor: isMine ? c.primary : c.accent,
                          flex: 1,
                        }}
                      />
                    </View>
                  )}
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}
                  >
                    {poll?.mode === 'rating' ? (
                      <>
                        <Text style={{ color: c.muted }}>
                          Love {item.love_it ?? 0} • Fine {item.fine ?? 0} • Not{' '}
                          {item.not_for_me ?? 0}
                        </Text>
                        {item.event?.rsvp_url ? (
                          <Pressable
                            onPress={() => {
                              if (item.event?.rsvp_url) Linking.openURL(item.event.rsvp_url);
                            }}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              backgroundColor: c.background,
                              borderRadius: 8,
                            }}
                          >
                            <Text style={{ color: c.text }}>RSVP</Text>
                          </Pressable>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <Text style={{ color: c.muted }}>{count} votes</Text>
                        <Text style={{ color: c.muted }}>{pct}%</Text>
                      </>
                    )}
                  </View>
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={{ marginTop: 20 }}>
                <Text style={{ color: c.muted, marginBottom: 12 }}>
                  No options yet. Add some events to get started.
                </Text>
                {poll?.is_active ? (
                  <View>
                    {suggested === null ? (
                      <Text style={{ color: c.muted }}>Loading suggestions…</Text>
                    ) : suggested?.length ? (
                      <View style={{ gap: 8 }}>
                        {suggested.map((e) => (
                          <Pressable
                            key={e.id}
                            disabled={adding}
                            onPress={async () => {
                              try {
                                setAdding(true);
                                await addPollOption(pollId, e.id);
                                await load();
                              } catch (err: any) {
                                Alert.alert('Add failed', err.message ?? String(err));
                              } finally {
                                setAdding(false);
                              }
                            }}
                            style={{
                              backgroundColor: c.card,
                              padding: 12,
                              borderRadius: 12,
                            }}
                          >
                            <Text style={{ color: c.text, fontWeight: '700' }}>{e.title}</Text>
                            <Text style={{ color: c.muted, marginTop: 4 }}>
                              {new Date(e.date_time).toLocaleString()} • {e.location}
                            </Text>
                            {e.match_percent != null ? (
                              <Text style={{ color: c.muted, marginTop: 4 }}>
                                {e.match_percent}% match
                              </Text>
                            ) : null}
                            <Text style={{ color: c.primary, marginTop: 6 }}>Tap to add</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : (
                      <Text style={{ color: c.muted }}>
                        No suggestions. Use the Browse tab to save events.
                      </Text>
                    )}
                    <Pressable
                      onPress={() => router.push('/(tabs)/home')}
                      style={{
                        alignSelf: 'flex-start',
                        backgroundColor: c.background,
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 10,
                        marginTop: 16,
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700' }}>Browse Events</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            }
            ListHeaderComponent={
              leader ? (
                <View
                  style={{
                    backgroundColor: c.card,
                    padding: 12,
                    borderRadius: 12,
                    marginBottom: 10,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '800' }}>Suggested choice</Text>
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    Based on votes and group match,{' '}
                    {leader.event?.title ?? `Event #${leader.event_id}`} is leading.
                  </Text>
                  {poll?.is_active ? (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                      <Pressable
                        onPress={async () => {
                          try {
                            await commitPoll(pollId, leader.event_id);
                            await load();
                          } catch (e: any) {
                            Alert.alert('Commit failed', e.message ?? String(e));
                          }
                        }}
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: c.primary,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: c.text, fontWeight: '700' }}>Commit to this</Text>
                      </Pressable>
                      <Pressable
                        onPress={onClose}
                        style={{
                          alignSelf: 'flex-start',
                          backgroundColor: c.background,
                          paddingVertical: 6,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: c.text, fontWeight: '700' }}>Close poll</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              ) : null
            }
          />
        )}

        {/* Post-commit actions */}
        {isCommitted && finalEvent ? (
          <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginTop: 12 }}>
            <Text style={{ color: c.text, fontWeight: '800' }}>We’re on!</Text>
            <Text style={{ color: c.muted, marginTop: 4 }}>
              {finalEvent.title} at{' '}
              {finalEvent.date_time ? new Date(finalEvent.date_time).toLocaleString() : ''}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Pressable
                onPress={() =>
                  toggleCommitment(pollId)
                    .then(load)
                    .catch((e: any) => Alert.alert('Error', e.message ?? String(e)))
                }
                style={{
                  backgroundColor: c.primary,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>
                  👍 I’m coming ({commitments?.length ?? 0})
                </Text>
              </Pressable>
              {finalEvent.rsvp_url ? (
                <Pressable
                  onPress={() => finalEvent.rsvp_url && Linking.openURL(finalEvent.rsvp_url)}
                  style={{
                    backgroundColor: c.background,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>Book/RSVP</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => {
                  try {
                    if (!finalEvent?.date_time) return;
                    const startIso = new Date(finalEvent.date_time).toISOString();
                    const endIso = new Date(new Date(finalEvent.date_time).getTime() + 2 * 60 * 60 * 1000).toISOString();
                    const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
                    const params = new URLSearchParams({
                      action: 'TEMPLATE',
                      text: finalEvent.title ?? 'Event',
                      details: finalEvent.description ?? '',
                      location: finalEvent.location ?? '',
                    });
                    // Google calendar expects dates=START/END (UTC or local). We'll use UTC Z format.
                    const url = `https://calendar.google.com/calendar/render?${params.toString()}&dates=${fmt(startIso)}/${fmt(endIso)}`;
                    Linking.openURL(url);
                  } catch (e: any) {
                    Alert.alert('Calendar', e.message ?? 'Unable to open calendar');
                  }
                }}
                style={{
                  backgroundColor: c.background,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Add to Calendar</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Feedback UI moved to Group feed (below poll) after event; intentionally removed here */}
      </View>
      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !deleting && setDeleteOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View
            style={{
              backgroundColor: c.card,
              padding: 16,
              borderRadius: 16,
              width: '100%',
              maxWidth: 420,
            }}
          >
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
              Delete this poll?
            </Text>
            <Text style={{ color: c.muted, marginTop: 8 }}>
              This will permanently remove the poll, its options, votes, ratings, commitments, and
              feedback. This action cannot be undone.
            </Text>
            <View
              style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}
            >
              <Pressable
                onPress={() => !deleting && setDeleteOpen(false)}
                style={{
                  backgroundColor: '#00000030',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={onDeletePoll}
                disabled={deleting}
                style={{
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: deleting ? 0.6 : 1,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {deleting ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </GradientBackground>
  );
}
