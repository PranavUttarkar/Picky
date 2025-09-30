import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  Image,
  Linking,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { useEffect, useMemo, useState, useRef } from 'react';
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
import type { PollOptionView } from '@/services/polls';
import type { Event } from '@/types/models';
import { optimisticUpdate } from '@/utils/optimistic';
import { getTopGroupMatches, getTopUserMatches } from '@/services/events';
import SwipeDeck from '@/components/SwipeDeck';
import * as Haptics from 'expo-haptics';
import EventRowCard from '@/components/EventRowCard';

export default function PollDetails() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollId = Number(id);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  // Keep a stable snapshot for swipe mode to avoid flicker on quick refreshes/reordering
  const [stableOptions, setStableOptions] = useState<any[] | null>(null);
  const [myVote, setMyVote] = useState<number | null | undefined>(undefined);
  const [totalMembers, setTotalMembers] = useState(0);
  const [responded, setResponded] = useState(0);
  const [myRatings, setMyRatings] = useState<Record<number, number> | undefined>(undefined);
  // Track optimistic ratings to prevent temporary drops due to eventual consistency
  const optimisticRatingsRef = useRef<Map<number, { rating: -1 | 0 | 1 | null; ts: number }>>(
    new Map(),
  );
  const [waiting, setWaiting] = useState<Array<{ id: string; name?: string | null }> | undefined>(
    undefined,
  );
  const [commitments, setCommitments] = useState<string[] | undefined>(undefined);
  const [finalEvent, setFinalEvent] = useState<any | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [suggested, setSuggested] = useState<any[] | null>(null);
  const [suggestSelected, setSuggestSelected] = useState<Set<number>>(new Set());
  const [addingMany, setAddingMany] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mode, setMode] = useState<'list' | 'swipe'>('swipe');
  // When mode switches to swipe or poll id changes, set stableOptions from current options
  useEffect(() => {
    if (mode === 'swipe') {
      setStableOptions(options);
    } else {
      setStableOptions(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pollId]);
  // Prevent concurrent rating mutations per event
  const ratingInFlight = useRef<Set<number>>(new Set());
  // Debounced refresh to reduce backend chatter during swipes
  const refreshTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefresh = (ms = 500) => {
    if (refreshTimeout.current) clearTimeout(refreshTimeout.current);
    refreshTimeout.current = setTimeout(() => {
      load().catch(() => {});
    }, ms);
  };

  const handleRating = async (eventId: number, target: -1 | 0 | 1) => {
    if (poll?.mode !== 'rating' || ratingInFlight.current.has(eventId)) return;
    ratingInFlight.current.add(eventId);
    const previous = { myRatings: { ...(myRatings || {}) }, options: [...options] };
    const prevRating = previous.myRatings[eventId];
    // Toggle off if the same rating pressed again
    const nextRating: -1 | 0 | 1 | null = prevRating === target ? null : target;
    await optimisticUpdate({
      apply: () => {
        // Update myRatings optimistically
        setMyRatings((r) => {
          const clone = { ...(r || {}) } as Record<number, number>;
          if (nextRating === null) delete clone[eventId];
          else clone[eventId] = nextRating;
          return clone;
        });
        // Record optimistic rating with short TTL (e.g., 4s)
        optimisticRatingsRef.current.set(eventId, { rating: nextRating, ts: Date.now() });
        // Adjust aggregate counts
        setOptions((opts) =>
          opts.map((o) => {
            if (o.event_id !== eventId) return o;
            const updated = { ...o };
            // Decrement previous bucket
            if (prevRating === 1 && updated.love_it != null)
              updated.love_it = Math.max(0, (updated.love_it || 0) - 1);
            if (prevRating === 0 && updated.fine != null)
              updated.fine = Math.max(0, (updated.fine || 0) - 1);
            if (prevRating === -1 && updated.not_for_me != null)
              updated.not_for_me = Math.max(0, (updated.not_for_me || 0) - 1);
            // Increment new bucket
            if (nextRating === 1) updated.love_it = (updated.love_it || 0) + 1;
            if (nextRating === 0) updated.fine = (updated.fine || 0) + 1;
            if (nextRating === -1) updated.not_for_me = (updated.not_for_me || 0) + 1;
            return updated;
          }),
        );
        return previous;
      },
      rollback: (snap) => {
        setMyRatings(snap.myRatings);
        setOptions(snap.options);
      },
      mutate: async () => {
        await castRating(pollId, eventId, nextRating);
        // Throttle reloads; realtime will also trigger this
        scheduleRefresh(600);
      },
    })
      .catch((e) => {
        Alert.alert('Rate failed', (e as any)?.message ?? String(e));
      })
      .finally(() => {
        ratingInFlight.current.delete(eventId);
      });
  };

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
    // If in swipe mode, avoid reordering the stack; keep existing order and append any new ones at the end
    setStableOptions((prev) => {
      if (!prev || mode !== 'swipe') return null;
      const seen = new Set(prev.map((o: any) => o.event_id));
      const appended = options.filter((o: any) => !seen.has(o.event_id));
      return [...prev, ...appended];
    });
    setMyVote(myVote);
    // Merge server myRatings with recent optimistic entries to avoid temporary drops
    const merged: Record<number, number> = {};
    for (const k of Object.keys(myRatings || {})) merged[Number(k)] = (myRatings as any)[k];
    const now = Date.now();
    for (const [eid, entry] of optimisticRatingsRef.current.entries()) {
      const { rating, ts } = entry;
      if (now - ts > 4000) continue; // expired
      if (rating === null) delete merged[eid];
      else merged[eid] = rating;
      // If server already reflects the same rating, drop the optimistic entry
      if ((myRatings as any)?.[eid] === rating) {
        optimisticRatingsRef.current.delete(eid);
      }
    }
    setMyRatings(merged);
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
        setSuggestSelected(new Set());
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
        if (mounted) scheduleRefresh(700);
      });
      return () => unsub();
    })();
    return () => {
      mounted = false;
      if (refreshTimeout.current) {
        clearTimeout(refreshTimeout.current);
        refreshTimeout.current = null;
      }
      optimisticRatingsRef.current.clear();
    };
  }, [pollId]);

  const totalVotes = useMemo(() => options.reduce((sum, o) => sum + (o.votes ?? 0), 0), [options]);
  const leader = useMemo(() => suggestLeader(options), [options]);
  const progressPct = useMemo(
    () => (totalMembers ? Math.round((responded * 100) / totalMembers) : 0),
    [responded, totalMembers],
  );
  const isCommitted = !!finalEvent;
  const myRatedCount = useMemo(() => {
    if (!poll || poll.mode !== 'rating' || !myRatings) return 0;
    return Object.keys(myRatings).length;
  }, [poll, myRatings]);
  const totalOptionsCount = useMemo(() => options.length, [options]);
  const iAmDone = useMemo(
    () => poll?.mode === 'rating' && totalOptionsCount > 0 && myRatedCount >= totalOptionsCount,
    [poll?.mode, myRatedCount, totalOptionsCount],
  );

  // When poll is committed (finalEvent set), ensure winner is saved for all members
  useEffect(() => {
    (async () => {
      try {
        if (!finalEvent || !poll?.group_id) return;
        const gid = poll.group_id as number;
        // Fetch members
        const { data: members } = await supabase
          .from('group_members')
          .select('user_id')
          .eq('group_id', gid);
        const userIds: string[] = ((members as any[]) ?? []).map((m: any) => m.user_id);
        if (!userIds.length) return;
        // Insert saved_events for each member idempotently
        // Note: Supabase upsert on composite PK requires onConflict
        try {
          await Promise.all(
            userIds.map(async (uid) => {
              const { error } = await supabase
                .from('saved_events')
                .upsert(
                  { user_id: uid, event_id: finalEvent.id },
                  { onConflict: 'user_id,event_id' },
                );
              if (error) throw error;
            }),
          );
        } catch (e) {
          // Likely RLS prevents writing for other users; ensure current user at least gets it
          try {
            const me = (await supabase.auth.getUser()).data.user;
            if (me?.id) {
              await supabase
                .from('saved_events')
                .upsert(
                  { user_id: me.id, event_id: finalEvent.id },
                  { onConflict: 'user_id,event_id' },
                );
            }
          } catch {}
        }
      } catch {
        // best-effort; ignore failures
      }
    })();
  }, [finalEvent, poll?.group_id]);

  const onVote = async (eventId: number) => {
    if (!poll?.is_active) return;
    const previous = { myVote, options: [...options] };
    await optimisticUpdate({
      apply: () => {
        setMyVote(eventId);
        setOptions((opts) =>
          opts.map((o) => (o.event_id === eventId ? { ...o, votes: (o.votes ?? 0) + 1 } : o)),
        );
        return previous;
      },
      rollback: (snap) => {
        setMyVote(snap.myVote);
        setOptions(snap.options);
      },
      mutate: async () => {
        await castVote(pollId, eventId);
        // Refresh in background (do not block UI)
        scheduleRefresh(250);
      },
    });
  };

  const onClose = async () => {
    try {
      await closePoll(pollId);
      await load();
    } catch (e: any) {
      Alert.alert('Close failed', e.message ?? String(e));
    }
  };

  // Auto-commit for rating mode when all members have rated every option
  useEffect(() => {
    (async () => {
      try {
        if (!poll?.is_active) return;
        if (poll?.mode !== 'rating') return;
        if (totalMembers <= 0) return;
        if (!options?.length) return;
        // For each option, count total ratings received (sum of buckets)
        const allRated = options.every((o) => {
          const total = (o.love_it || 0) + (o.fine || 0) + (o.not_for_me || 0);
          return total >= totalMembers; // allow >= to be safe if duplicates
        });
        if (!allRated) return;
        const leader = suggestLeader(options as PollOptionView[]);
        if (!leader) return;
        // Commit silently if not already committed
        try {
          await commitPoll(pollId, leader.event_id);
          await load();
        } catch {}
      } catch {}
    })();
  }, [poll?.is_active, poll?.mode, totalMembers, options]);

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

  // Confetti when transitioning to committed
  const prevCommittedRef = useRef<boolean>(false);
  useEffect(() => {
    const committed = !!finalEvent;
    if (committed && !prevCommittedRef.current) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
    prevCommittedRef.current = committed;
  }, [finalEvent]);

  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1, padding: 16 }}>
        <GradientHeader
          title={poll?.title || `Poll #${pollId}`}
          subtitle={poll?.is_active ? 'Open' : 'Closed'}
          shareUrl={'https://usepicky.app'}
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

        {/* Mode toggle and Swipe deck */}
        {options.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            <Pressable
              onPress={() => setMode('swipe')}
              style={{
                backgroundColor: mode === 'swipe' ? c.primary : c.background,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>Swipe</Text>
            </Pressable>
            <Pressable
              onPress={() => setMode('list')}
              style={{
                backgroundColor: mode === 'list' ? c.primary : c.background,
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>List</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'swipe' && options.length > 0 ? (
          <View style={{ flex: 1, marginTop: 16 }}>
            {/* Per-user progress indicator */}
            {poll?.mode === 'rating' ? (
              <Text style={{ color: c.muted, marginBottom: 8 }}>
                You’ve rated {Math.min(myRatedCount, totalOptionsCount)}/{totalOptionsCount}
              </Text>
            ) : null}
            {/* Swipe tips */}
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 10,
                padding: 8,
                borderWidth: 1,
                borderColor: '#00000020',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: c.text, fontSize: 12 }}>
                Swipe right to like, left for no, up for love.
              </Text>
            </View>
            {!iAmDone ? (
              <SwipeDeck
                data={stableOptions ?? options}
                keyExtractor={(o) => String(o.event_id)}
                renderCard={(item) => (
                  <View
                    style={{
                      backgroundColor: c.card,
                      borderRadius: 16,
                      padding: 12,
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {item.event?.image_url ? (
                      <Image
                        source={{ uri: item.event.image_url }}
                        style={{ width: '100%', height: 240, borderRadius: 12, marginBottom: 8 }}
                      />
                    ) : null}
                    {/* Crown for leader: tilted top-right overlay */}
                    {leader && leader.event_id === item.event_id ? (
                      <View
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          transform: [{ rotate: '45deg' }],
                          backgroundColor: 'transparent',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                        }}
                        pointerEvents="none"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      >
                        <Text style={{ fontSize: 34 }}>👑</Text>
                      </View>
                    ) : null}
                    <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>
                      {item.event?.title ?? `Event #${item.event_id}`}
                    </Text>
                    <Text style={{ color: c.muted, marginTop: 4 }}>
                      {item.event?.date_time ? new Date(item.event.date_time).toLocaleString() : ''}
                      {item.event?.location ? ` • ${item.event.location}` : ''}
                    </Text>
                    {item.match_percent != null ? (
                      <Text style={{ color: c.muted, marginTop: 4 }}>
                        {item.match_percent}% match for group
                      </Text>
                    ) : null}
                  </View>
                )}
                onSwipeRight={async (item) => {
                  // Like
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  if (poll?.mode === 'rating') {
                    await handleRating(item.event_id, 1);
                  } else {
                    await onVote(item.event_id);
                  }
                }}
                onSwipeLeft={async (item) => {
                  // Nope
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  if (poll?.mode === 'rating') {
                    await handleRating(item.event_id, -1);
                  }
                }}
                onSwipeUp={async (item) => {
                  // Superlike
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                    () => {},
                  );
                  if (poll?.mode === 'rating') {
                    await handleRating(item.event_id, 1);
                  } else {
                    await onVote(item.event_id);
                  }
                }}
                overlayLabels={{
                  like: { text: 'YES', color: '#22c55e' },
                  nope: { text: 'NOPE', color: '#ef4444' },
                  super: { text: 'LOVE', color: '#f59e0b' },
                }}
              />
            ) : (
              <View
                style={{
                  backgroundColor: c.card,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '800' }}>You’re done 🎉</Text>
                <Text style={{ color: c.muted, marginTop: 6 }}>Waiting on the group…</Text>
                {leader ? (
                  <View
                    style={{
                      marginTop: 10,
                      width: '100%',
                      backgroundColor: c.background,
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '800', marginBottom: 6 }}>
                      Current leader
                    </Text>
                    {(() => {
                      const lo = options.find((o) => o.event_id === leader.event_id);
                      const ev = lo?.event;
                      return (
                        <View style={{ position: 'relative' }}>
                          <View
                            style={{
                              position: 'absolute',
                              top: -36,
                              right: -36,
                              transform: [{ rotate: '45deg' }],
                              backgroundColor: 'transparent',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 999,
                              zIndex: 2,
                            }}
                            pointerEvents="none"
                            accessibilityElementsHidden
                            importantForAccessibility="no-hide-descendants"
                          >
                            <Text style={{ fontSize: 34 }}>👑</Text>
                          </View>
                          <EventRowCard
                            event={
                              (ev ?? {
                                id: leader.event_id,
                                title: `Event #${leader.event_id}`,
                                date_time: new Date().toISOString(),
                              }) as any
                            }
                            isSaved={false}
                            onToggleSave={() => {}}
                            onOpenDetails={() => router.push(`/events/${leader.event_id}`)}
                            matchPercent={lo?.match_percent}
                          />
                        </View>
                      );
                    })()}
                  </View>
                ) : null}
              </View>
            )}
          </View>
        ) : null}

        {mode === 'list' ? (
          options.length === 1 && poll?.mode !== 'rating' ? (
            <View style={{ marginTop: 20 }}>
              <EventRowCard
                event={
                  (options[0].event ?? {
                    id: options[0].event_id,
                    title: `Event #${options[0].event_id}`,
                    date_time: new Date().toISOString(),
                  }) as any
                }
                isSaved={false}
                onToggleSave={() => {}}
                onOpenDetails={() => router.push(`/events/${options[0].event_id}`)}
                matchPercent={options[0].match_percent}
              />
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
              <View
                style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginTop: 12 }}
              >
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
              key={`poll-list-${isWide ? 'grid' : 'list'}`}
              numColumns={isWide ? 2 : 1}
              columnWrapperStyle={isWide ? { gap: 12 } : undefined}
              contentContainerStyle={{ gap: 12 }}
              renderItem={({ item }) => {
                const count = item.votes ?? 0;
                const pct = totalVotes === 0 ? 0 : Math.round((count * 100) / totalVotes);
                const isMine = myVote === item.event_id;
                const isLeader = leader && leader.event_id === item.event_id;
                return (
                  <View style={{ marginBottom: isWide ? 0 : 10, flex: isWide ? 1 : undefined }}>
                    <View style={{ position: 'relative' }}>
                      {isLeader ? (
                        <View
                          style={{
                            position: 'absolute',
                            top: -16,
                            right: -16,
                            transform: [{ rotate: '45deg' }],
                            backgroundColor: 'transparent',
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 999,
                            zIndex: 2,
                          }}
                          pointerEvents="none"
                          accessibilityElementsHidden
                          importantForAccessibility="no-hide-descendants"
                        >
                          <Text style={{ fontSize: 24 }}>👑</Text>
                        </View>
                      ) : null}
                      <EventRowCard
                        event={
                          (item.event ?? {
                            id: item.event_id,
                            title: `Event #${item.event_id}`,
                            date_time: new Date().toISOString(),
                          }) as any
                        }
                        isSaved={false}
                        onToggleSave={() => {}}
                        onOpenDetails={() => router.push(`/events/${item.event_id}`)}
                        matchPercent={item.match_percent}
                      />
                    </View>
                    {poll?.mode === 'rating' ? (
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        <Pressable
                          onPress={() => handleRating(item.event_id, 1)}
                          disabled={ratingInFlight.current.has(item.event_id)}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            opacity: ratingInFlight.current.has(item.event_id) ? 0.6 : 1,
                            backgroundColor:
                              (myRatings?.[item.event_id] ?? 0) === 1 ? c.primary : c.background,
                          }}
                          accessibilityLabel={`Love it ${item.love_it ?? 0}`}
                        >
                          <Text style={{ color: c.text, fontSize: 12 }}>
                            ❤️ {item.love_it ?? 0}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleRating(item.event_id, 0)}
                          disabled={ratingInFlight.current.has(item.event_id)}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            opacity: ratingInFlight.current.has(item.event_id) ? 0.6 : 1,
                            backgroundColor:
                              (myRatings?.[item.event_id] ?? -99) === 0 ? c.primary : c.background,
                          }}
                          accessibilityLabel={`It's fine ${item.fine ?? 0}`}
                        >
                          <Text style={{ color: c.text, fontSize: 12 }}>👍 {item.fine ?? 0}</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleRating(item.event_id, -1)}
                          disabled={ratingInFlight.current.has(item.event_id)}
                          style={{
                            paddingVertical: 4,
                            paddingHorizontal: 8,
                            borderRadius: 8,
                            opacity: ratingInFlight.current.has(item.event_id) ? 0.6 : 1,
                            backgroundColor:
                              (myRatings?.[item.event_id] ?? 0) === -1 ? c.primary : c.background,
                          }}
                          accessibilityLabel={`Not for me ${item.not_for_me ?? 0}`}
                        >
                          <Text style={{ color: c.text, fontSize: 12 }}>
                            👎 {item.not_for_me ?? 0}
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <>
                        <View
                          style={{
                            height: 6,
                            backgroundColor: c.background,
                            borderRadius: 6,
                            marginTop: 6,
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
                        <View
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            marginTop: 4,
                          }}
                        >
                          <Text style={{ color: c.muted, fontSize: 12 }}>{count} votes</Text>
                          <Text style={{ color: c.muted, fontSize: 12 }}>{pct}%</Text>
                        </View>
                        {poll?.is_active ? (
                          <Pressable
                            onPress={() => onVote(item.event_id)}
                            style={{
                              alignSelf: 'flex-start',
                              backgroundColor: c.primary,
                              paddingVertical: 6,
                              paddingHorizontal: 10,
                              borderRadius: 8,
                              marginTop: 6,
                            }}
                          >
                            <Text style={{ color: c.text, fontWeight: '700' }}>Vote for this</Text>
                          </Pressable>
                        ) : null}
                      </>
                    )}
                  </View>
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
                          {suggested.map((e) => {
                            const selected = suggestSelected.has(e.id);
                            return (
                              <Pressable
                                key={e.id}
                                onPress={() => {
                                  setSuggestSelected((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(e.id)) next.delete(e.id);
                                    else next.add(e.id);
                                    return next;
                                  });
                                }}
                                style={{ opacity: addingMany ? 0.6 : 1 }}
                              >
                                <EventRowCard
                                  event={e as any}
                                  isSaved={false}
                                  onToggleSave={() => {}}
                                  onOpenDetails={() => router.push(`/events/${e.id}`)}
                                  matchPercent={e.match_percent}
                                />
                                <Text
                                  style={{
                                    color: selected ? c.primary : c.muted,
                                    marginTop: 6,
                                    marginLeft: 6,
                                  }}
                                >
                                  {selected ? 'Selected' : 'Tap to select'}
                                </Text>
                              </Pressable>
                            );
                          })}
                          {suggestSelected.size > 0 ? (
                            <Pressable
                              onPress={async () => {
                                if (addingMany) return;
                                try {
                                  setAddingMany(true);
                                  // Add all selected suggestions
                                  for (const eid of Array.from(suggestSelected)) {
                                    await addPollOption(pollId, eid);
                                  }
                                  setSuggestSelected(new Set());
                                  await load();
                                } catch (err: any) {
                                  Alert.alert('Add failed', err.message ?? String(err));
                                } finally {
                                  setAddingMany(false);
                                }
                              }}
                              style={{
                                alignSelf: 'flex-start',
                                backgroundColor: c.primary,
                                paddingVertical: 8,
                                paddingHorizontal: 12,
                                borderRadius: 10,
                                marginTop: 8,
                                opacity: addingMany ? 0.7 : 1,
                              }}
                            >
                              <Text style={{ color: c.text, fontWeight: '800' }}>
                                {addingMany ? 'Adding…' : `Add selected (${suggestSelected.size})`}
                              </Text>
                            </Pressable>
                          ) : null}
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
                      borderWidth: 2,
                      borderColor: c.primary,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '800' }}>Suggested choice 👑</Text>
                    <Text style={{ color: c.muted, marginTop: 4 }}>
                      This event currently leads. It has a crown badge below.
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
          )
        ) : null}

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
                    const endIso = new Date(
                      new Date(finalEvent.date_time).getTime() + 2 * 60 * 60 * 1000,
                    ).toISOString();
                    const fmt = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
                    const params = new URLSearchParams({
                      action: 'TEMPLATE',
                      text: finalEvent.title ?? 'Event',
                      details: finalEvent.description ?? '',
                      location: finalEvent.location ?? '',
                    });
                    // Google calendar expects dates=START/END (UTC or local). We'll use UTC Z format.
                    const url = `https://calendar.google.com/calendar/render?${params.toString()}&dates=${fmt(
                      startIso,
                    )}/${fmt(endIso)}`;
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
      {/* Simple confetti */}
      {showConfetti ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 48, transform: [{ rotate: '-10deg' }] }}>🎉</Text>
        </View>
      ) : null}

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
