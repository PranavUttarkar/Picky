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
  castTextVote,
} from '@/services/polls';
import type { PollOptionView } from '@/services/polls';
import type { Event } from '@/types/models';
import { optimisticUpdate } from '@/utils/optimistic';
import { getTopGroupMatches, getTopUserMatches } from '@/services/events';
import SwipeDeck from '@/components/SwipeDeck';
import PollCard from '@/components/PollCard';
import * as Haptics from 'expo-haptics';
import EventRowCard from '@/components/EventRowCard';
import LazyImage from '@/components/LazyImage';
import Chip from '@/components/Chip';
import dayjs from 'dayjs';
import type { Restaurant } from '@/types/models';
import { getRestaurantById, restaurantImages } from '@/services/food';
import FoodRowCard from '@/components/FoodRowCard';
import { Ionicons } from '@expo/vector-icons';

export default function PollDetails() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const { id } = useLocalSearchParams<{ id: string }>();
  const pollId = Number(id);
  const [poll, setPoll] = useState<any>(null);
  const [options, setOptions] = useState<PollOptionView[]>([]);
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
  const [closeOpen, setCloseOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [mode, setMode] = useState<'list' | 'swipe'>('swipe');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  // Map text option id -> restaurant details (for FOOD|<place_id> encoded options)
  const [foodOptions, setFoodOptions] = useState<Record<number, Restaurant | null>>({});
  // Separate lightweight thumb cache to force LazyImage remount when available
  const [foodThumbs, setFoodThumbs] = useState<Record<number, string | null>>({});
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
            if (o.kind !== 'event' || o.id !== eventId) return o;
            const updated = { ...o };
            // Decrement previous bucket
            if (prevRating === 1 && (updated as any).love_it != null)
              (updated as any).love_it = Math.max(0, ((updated as any).love_it || 0) - 1);
            if (prevRating === 0 && (updated as any).fine != null)
              (updated as any).fine = Math.max(0, ((updated as any).fine || 0) - 1);
            if (prevRating === -1 && (updated as any).not_for_me != null)
              (updated as any).not_for_me = Math.max(0, ((updated as any).not_for_me || 0) - 1);
            // Increment new bucket
            if (nextRating === 1) (updated as any).love_it = ((updated as any).love_it || 0) + 1;
            if (nextRating === 0) (updated as any).fine = ((updated as any).fine || 0) + 1;
            if (nextRating === -1)
              (updated as any).not_for_me = ((updated as any).not_for_me || 0) + 1;
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
      waiting: serverWaiting,
      commitments,
      finalEvent,
      foodDetails,
    } = await getPoll(pollId);
    setPoll(poll);
    setOptions(options);
    // If in swipe mode, avoid reordering the stack; keep existing order and append any new ones at the end
    setStableOptions((prev) => {
      if (!prev || mode !== 'swipe') return null;
      const seen = new Set(prev.map((o: any) => o.id));
      const appended = options.filter((o: any) => !seen.has(o.id));
      return [...prev, ...appended];
    });
    setMyVote(myVote);
    // Apply server-side preloaded food details (if present) before stable snapshot lock-in
    if (foodDetails) {
      setFoodOptions((prev) => {
        const merged = { ...prev };
        Object.entries(foodDetails).forEach(([idStr, data]) => {
          const id = Number(idStr);
          merged[id] = {
            restaurant_name: (data as any).restaurant_name,
            description: (data as any).description,
            address: (data as any).address,
            city: (data as any).city,
            category: (data as any).category,
            price_range: (data as any).price_range,
            review_points: (data as any).review_points,
            main_image: (data as any).images?.[0] ?? null,
            image_1: (data as any).images?.[1] ?? null,
            image_2: (data as any).images?.[2] ?? null,
            image_3: (data as any).images?.[3] ?? null,
            place_id: (data as any).place_id,
          } as any; // partial Restaurant
        });
        return merged;
      });
      setFoodThumbs((prev) => {
        const merged = { ...prev };
        Object.entries(foodDetails).forEach(([idStr, data]) => {
          const id = Number(idStr);
          const imgs = (data as any).images as string[] | undefined;
          merged[id] = imgs?.[0] || null;
        });
        return merged;
      });
    }
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
    setCommitments(commitments);
    setFinalEvent(finalEvent);

    // Calculate if I am done based on NEW data
    const newTotalOptions = options.length;
    const newMyRatedCount = merged ? Object.keys(merged).length : 0;
    const newIAmDone =
      poll?.mode === 'rating' && newTotalOptions > 0 && newMyRatedCount >= newTotalOptions;

    // Also check deckFinished state (which persists across loads)
    const effectivelyDone = deckFinished || newIAmDone;

    let finalWaiting = serverWaiting;
    let finalResponded = respondedCount;

    if (effectivelyDone && currentUserId && finalWaiting) {
      const amIWaiting = finalWaiting.some((u) => u.id === currentUserId);
      if (amIWaiting) {
        finalWaiting = finalWaiting.filter((u) => u.id !== currentUserId);
        finalResponded = respondedCount + 1;
      }
    }

    setResponded(finalResponded);
    setWaiting(finalWaiting);

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
      if (mounted) setCurrentUserId(user?.id ?? null);
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
  const parseFoodToken = (t: string): string | null => {
    const s = (t || '').trim();
    if (!s.startsWith('FOOD|')) return null;
    const parts = s.split('|');
    if (parts.length < 2) return null;
    const placeId = parts[1]?.trim();
    return placeId || null;
  };
  const hasTextOptions = useMemo(() => options.some((o) => o.kind === 'text'), [options]);
  const hasFoodTextOptions = useMemo(
    () => options.some((o) => o.kind === 'text' && parseFoodToken((o as any).text)),
    [options],
  );
  const hasNonFoodText = useMemo(
    () => options.some((o) => o.kind === 'text' && !parseFoodToken((o as any).text)),
    [options],
  );
  // Only force list mode when there are non-food free-text options. Food text options support swipe.
  useEffect(() => {
    if (hasNonFoodText) setMode('list');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasNonFoodText]);

  // Prefetch restaurant details for food text options
  useEffect(() => {
    (async () => {
      const foodTexts = options.filter((o) => o.kind === 'text');
      const tasks: Array<Promise<void>> = [];
      for (const o of foodTexts) {
        const text = (o as any).text as string;
        const pid = parseFoodToken(text);
        if (!pid) continue;
        if (foodOptions[o.id] !== undefined) continue; // already loaded
        tasks.push(
          (async () => {
            try {
              const r = await getRestaurantById(pid);
              setFoodOptions((prev) => ({ ...prev, [o.id]: r ?? null }));
              const imgs = r ? restaurantImages(r) : [];
              setFoodThumbs((prev) => ({ ...prev, [o.id]: imgs[0] || null }));
            } catch {
              setFoodOptions((prev) => ({ ...prev, [o.id]: null }));
              setFoodThumbs((prev) => ({ ...prev, [o.id]: null }));
            }
          })(),
        );
      }
      if (tasks.length) await Promise.allSettled(tasks);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.map((o) => (o.kind === 'text' ? (o as any).text : '')).join('|')]);
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
  // Track completion of swipe deck for non-rating polls (esp. food-only polls)
  const [deckFinished, setDeckFinished] = useState(false);
  const allFoodOnly = useMemo(
    () => options.length > 0 && options.every((o) => o.kind === 'text' && parseFoodToken((o as any).text)),
    [options],
  );
  // Auto-close food-only poll on completion to surface winner in group feed
  useEffect(() => {
    (async () => {
      if (!poll?.is_active) return;
      if (poll?.mode === 'rating') return; // rating already auto commits
      if (!deckFinished) return;
      if (!allFoodOnly) return;
      try {
        await closePoll(pollId);
        await load();
      } catch {}
    })();
  }, [deckFinished, allFoodOnly, poll?.is_active, poll?.mode]);

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

  const onVote = async (opt: PollOptionView) => {
    if (!poll?.is_active) return;
    const previous = { myVote, options: [...options] };
    await optimisticUpdate({
      apply: () => {
        setMyVote(opt.id);
        setOptions((opts) =>
          opts.map((o) => (o.id === opt.id ? { ...o, votes: (o.votes ?? 0) + 1 } : o)),
        );
        return previous;
      },
      rollback: (snap) => {
        setMyVote(snap.myVote);
        setOptions(snap.options);
      },
      mutate: async () => {
        if (opt.kind === 'event') await castVote(pollId, opt.id);
        else await castTextVote(pollId, opt.id);
        // Refresh in background (do not block UI)
        scheduleRefresh(250);
      },
    });
  };

  const onClose = async () => {
    try {
      setClosing(true);
      await closePoll(pollId);
      await load();
    } catch (e: any) {
      Alert.alert('Close failed', e.message ?? String(e));
    } finally {
      setClosing(false);
      setCloseOpen(false);
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
        const eventOptions = options.filter((o) => o.kind === 'event');
        if (eventOptions.length === 0) return;
        const allRated = eventOptions.every((o: any) => {
          const total = (o.love_it || 0) + (o.fine || 0) + (o.not_for_me || 0);
          return total >= totalMembers; // allow >= to be safe if duplicates
        });
        if (!allRated) return;
        const leader = suggestLeader(options as PollOptionView[]);
        if (!leader) return;
        // Commit silently if not already committed
        try {
          await commitPoll(pollId, leader.id);
          await load();
        } catch {}
      } catch {}
    })();
  }, [poll?.is_active, poll?.mode, totalMembers, options]);

  const handleDeckComplete = async () => {
    setDeckFinished(true);

    // Optimistic update: if I am in the waiting list, remove me and increment responded
    if (currentUserId && waiting) {
      const amIWaiting = waiting.some((u) => u.id === currentUserId);
      if (amIWaiting) {
        setWaiting((prev) => prev?.filter((u) => u.id !== currentUserId));
        setResponded((prev) => prev + 1);
      }
    }

    // If non-rating poll and I haven't voted (myVote is null), record participation
    if (poll?.mode !== 'rating' && !myVote) {
      try {
        await recordNoVote(pollId);
      } catch (e) {
        console.error('Failed to record no vote', e);
      }
    }

    // Refresh to ensure server state is consistent and trigger any server-side checks
    scheduleRefresh(500);
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
          subtitle={
            poll?.is_active
              ? poll?.mode === 'rating'
                ? 'Swipe right to like, left for no, up for love.'
                : 'Open'
              : 'Closed'
          }
          shareUrl={'https://usepicky.app'}
          onBack={() => {
            const gid = poll?.group_id;
            if (gid) router.replace(`/(tabs)/groups/${gid}`);
            else router.replace('/(tabs)/groups');
          }}
          backLabel="Back to group"
        />
        {/* Task bar: responded count, mode toggle icons, close & delete icons */}
        <View
          style={{
            backgroundColor: c.card,
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            marginTop: 10,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: c.text, fontWeight: '800' }}>
                {responded}/{totalMembers}
              </Text>
              {waiting && waiting.length > 0 ? (
                <Text style={{ color: c.muted, fontSize: 12 }}>Waiting on {waiting.length}</Text>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {/* Mode toggle icons */}
              <Pressable
                onPress={() => setMode('swipe')}
                disabled={hasTextOptions && hasNonFoodText}
                style={{
                  backgroundColor:
                    mode === 'swipe' && !(hasTextOptions && hasNonFoodText)
                      ? c.primary
                      : c.background,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                }}
                accessibilityLabel="Swipe mode"
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={18}
                  color={
                    mode === 'swipe' && !(hasTextOptions && hasNonFoodText) ? c.background : c.text
                  }
                />
              </Pressable>
              <Pressable
                onPress={() => setMode('list')}
                style={{
                  backgroundColor: mode === 'list' ? c.primary : c.background,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                }}
                accessibilityLabel="List mode"
              >
                <Ionicons
                  name="list-outline"
                  size={18}
                  color={mode === 'list' ? c.background : c.text}
                />
              </Pressable>
              {/* Close poll icon */}
              {poll?.is_active ? (
                <Pressable
                  onPress={() => setCloseOpen(true)}
                  style={{
                    backgroundColor: c.background,
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                  }}
                  accessibilityLabel="Close poll"
                >
                  <Ionicons name="close-circle-outline" size={20} color={c.text} />
                </Pressable>
              ) : null}
              {/* Delete poll icon */}
              <Pressable
                onPress={() => setDeleteOpen(true)}
                style={{
                  backgroundColor: c.background,
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                }}
                accessibilityLabel="Delete poll"
              >
                <Ionicons name="trash-outline" size={20} color="#ff5555" />
              </Pressable>
            </View>
          </View>
        </View>

        {/* Results Summary Banner - Shows current leader or winner */}
        {options.length > 0 && (leader || finalEvent) && (
          <View style={{
            backgroundColor: finalEvent ? c.primary + '20' : c.card,
            borderRadius: 12,
            padding: 12,
            marginTop: 10,
            borderWidth: finalEvent ? 2 : 0,
            borderColor: c.primary,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 28 }}>{finalEvent ? '🎉' : '👑'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
                  {finalEvent ? 'WINNER' : 'CURRENT LEADER'}
                </Text>
                <Text style={{ color: c.text, fontSize: 16, fontWeight: '800', marginTop: 2 }} numberOfLines={2}>
                  {finalEvent?.title || (leader?.kind === 'event' ? (leader as any).event?.title : (leader as any)?.text) || 'Unknown'}
                </Text>
                {leader && !finalEvent && totalVotes > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <Text style={{ color: c.primary, fontWeight: '700', fontSize: 13 }}>
                      {leader.votes} vote{leader.votes !== 1 ? 's' : ''}
                    </Text>
                    <Text style={{ color: c.muted, fontSize: 13 }}>
                      ({Math.round((leader.votes / totalVotes) * 100)}%)
                    </Text>
                  </View>
                )}
                {finalEvent?.date_time && (
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                    📅 {dayjs(finalEvent.date_time).format('ddd, MMM D [at] h:mm A')}
                  </Text>
                )}
              </View>
              {finalEvent?.rsvp_url && (
                <Pressable
                  onPress={() => Linking.openURL(finalEvent.rsvp_url)}
                  style={{
                    backgroundColor: c.primary,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>RSVP</Text>
                </Pressable>
              )}
            </View>
            
            {/* Vote distribution summary (when poll is closed or has significant votes) */}
            {!poll?.is_active && options.length > 1 && totalVotes > 0 && (
              <View style={{ marginTop: 12, gap: 6 }}>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>RESULTS</Text>
                {options.slice(0, 4).map((opt) => {
                  const pct = Math.round((opt.votes / totalVotes) * 100);
                  const isWinner = opt.id === leader?.id;
                  return (
                    <View key={opt.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ 
                          height: 20, 
                          backgroundColor: c.background, 
                          borderRadius: 4, 
                          overflow: 'hidden',
                          flexDirection: 'row',
                          alignItems: 'center',
                        }}>
                          <View style={{
                            width: `${pct}%`,
                            height: '100%',
                            backgroundColor: isWinner ? c.primary : c.primary + '40',
                            position: 'absolute',
                          }} />
                          <Text style={{ 
                            color: c.text, 
                            fontSize: 11, 
                            fontWeight: isWinner ? '700' : '500',
                            paddingLeft: 6,
                            flex: 1,
                          }} numberOfLines={1}>
                            {opt.kind === 'event' ? (opt as any).event?.title : (opt as any).text}
                          </Text>
                          <Text style={{ 
                            color: isWinner ? c.primary : c.muted, 
                            fontSize: 11, 
                            fontWeight: '700',
                            paddingRight: 6,
                          }}>
                            {pct}%
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
                {options.length > 4 && (
                  <Text style={{ color: c.muted, fontSize: 11 }}>
                    +{options.length - 4} more options
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Mode toggle and Swipe deck */}
        {/* Mode toggle row moved into task bar above */}

        {mode === 'swipe' && options.length > 0 && !(hasTextOptions && hasNonFoodText) ? (
          <View style={{ flex: 1, marginTop: 16 }}>
            {/* Per-user progress indicator */}
            {poll?.mode === 'rating' ? (
              <Text style={{ color: c.muted, marginBottom: 8 }}>
                You’ve rated {Math.min(myRatedCount, totalOptionsCount)}/{totalOptionsCount}
              </Text>
            ) : null}
            {/* Tips moved to header subtitle/task bar to keep swipe area clean */}
            {!(iAmDone || deckFinished) ? (
              <SwipeDeck
                data={stableOptions ?? options}
                keyExtractor={(o) => String(o.id)}
                renderCard={(item) => (
                  <View
                    style={{
                      backgroundColor: c.card,
                      borderRadius: 16,
                      padding: 10,
                      width: '100%',
                      position: 'relative',
                      alignSelf: 'center',
                      maxWidth: 480,
                    }}
                  >
                    <PollCard
                      option={item}
                      isLeader={!!leader && leader.id === item.id}
                      variant="swipe"
                      foodDetails={foodOptions[item.id] as any}
                      foodThumb={foodThumbs[item.id]}
                      colors={c}
                    />
                  </View>
                )}
                onSwipeRight={async (item) => {
                  // Like
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                  if (poll?.mode === 'rating') {
                    await handleRating(item.id, 1);
                  } else {
                    await onVote(item as any);
                  }
                }}
                onSwipeLeft={async (item) => {
                  // Nope
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  if (poll?.mode === 'rating') {
                    await handleRating(item.id, -1);
                  }
                }}
                onSwipeUp={async (item) => {
                  // Superlike
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
                    () => {},
                  );
                  if (poll?.mode === 'rating') {
                    await handleRating(item.id, 1);
                  } else {
                    await onVote(item as any);
                  }
                }}
                onComplete={handleDeckComplete}
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
                {poll?.mode === 'rating' ? (
                  <Text style={{ color: c.muted, marginTop: 6 }}>Waiting on the group…</Text>
                ) : allFoodOnly ? (
                  <Text style={{ color: c.muted, marginTop: 6 }}>Food poll complete.</Text>
                ) : null}
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
                      {poll?.mode === 'rating' ? 'Current leader' : 'Winner'}
                    </Text>
                    {(() => {
                      const lo = options.find((o) => o.id === leader.id) as any;
                      if (!lo) return null;
                      const isFood = lo.kind === 'text' && parseFoodToken((lo as any).text);
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
                          {lo.kind === 'event' ? (
                            <EventRowCard
                              event={
                                (lo.event ?? {
                                  id: leader.id,
                                  title: `Event #${leader.id}`,
                                  date_time: new Date().toISOString(),
                                }) as any
                              }
                              isSaved={false}
                              onToggleSave={() => {}}
                              onOpenDetails={() => router.push(`/events/${leader.id}`)}
                              matchPercent={(lo as any)?.match_percent}
                            />
                          ) : isFood ? (
                            (() => {
                              const rest = foodOptions[lo.id];
                              if (rest) {
                                return (
                                  <FoodRowCard
                                    item={rest as any}
                                    matchPercent={(lo as any)?.match_percent}
                                  />
                                );
                              }
                              return (
                                <PollCard
                                  option={lo}
                                  isLeader
                                  variant="leader"
                                  foodDetails={foodOptions[lo.id] as any}
                                  foodThumb={foodThumbs[lo.id]}
                                  colors={c}
                                  pollMode={poll?.mode as any}
                                  showDistance={false}
                                />
                              );
                            })()
                          ) : (
                            <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12 }}>
                              <Text style={{ color: c.text, fontWeight: '800' }}>
                                {(lo as any).text || 'Option'}
                              </Text>
                            </View>
                          )}
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
          <View style={{ marginTop: 20 }}>
            {options.length === 0 ? (
              <View>
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
            ) : (
              <View style={{ gap: 18 }}>
                {leader && !hasTextOptions ? (
                  <View
                    style={{
                      backgroundColor: c.card,
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 2,
                      borderColor: c.primary,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '800' }}>Suggested choice 👑</Text>
                    <Text style={{ color: c.muted, marginTop: 4 }}>
                      This option currently leads. It has a crown badge below.
                    </Text>
                    {poll?.is_active ? (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                        <Pressable
                          onPress={async () => {
                            try {
                              await commitPoll(pollId, leader.id);
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
                ) : null}

                {options.map((opt) => {
                  const count = opt.votes ?? 0;
                  const pct = totalVotes ? Math.round((count * 100) / totalVotes) : 0;
                  const isMine = myVote === opt.id;
                  return (
                    <View
                      key={opt.id}
                      style={{
                        backgroundColor: c.card,
                        padding: 12,
                        borderRadius: 16,
                      }}
                    >
                      <PollCard
                        option={opt}
                        isLeader={!!leader && leader.id === opt.id}
                        variant={leader && leader.id === opt.id ? 'leader' : 'list'}
                        foodDetails={foodOptions[opt.id] as any}
                        foodThumb={foodThumbs[opt.id]}
                        colors={c}
                      />
                      {poll?.mode === 'rating' && opt.kind === 'event' ? (
                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
                          <Pressable
                            onPress={() => handleRating(opt.id, 1)}
                            disabled={ratingInFlight.current.has(opt.id)}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              opacity: ratingInFlight.current.has(opt.id) ? 0.6 : 1,
                              backgroundColor:
                                (myRatings?.[opt.id] ?? 0) === 1 ? c.primary : c.background,
                            }}
                            accessibilityLabel={`Love it ${(opt as any).love_it ?? 0}`}
                          >
                            <Text style={{ color: c.text, fontSize: 12 }}>
                              ❤️ {(opt as any).love_it ?? 0}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRating(opt.id, 0)}
                            disabled={ratingInFlight.current.has(opt.id)}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              opacity: ratingInFlight.current.has(opt.id) ? 0.6 : 1,
                              backgroundColor:
                                (myRatings?.[opt.id] ?? -99) === 0 ? c.primary : c.background,
                            }}
                            accessibilityLabel={`It's fine ${(opt as any).fine ?? 0}`}
                          >
                            <Text style={{ color: c.text, fontSize: 12 }}>
                              👍 {(opt as any).fine ?? 0}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => handleRating(opt.id, -1)}
                            disabled={ratingInFlight.current.has(opt.id)}
                            style={{
                              paddingVertical: 4,
                              paddingHorizontal: 8,
                              borderRadius: 8,
                              opacity: ratingInFlight.current.has(opt.id) ? 0.6 : 1,
                              backgroundColor:
                                (myRatings?.[opt.id] ?? 0) === -1 ? c.primary : c.background,
                            }}
                            accessibilityLabel={`Not for me ${(opt as any).not_for_me ?? 0}`}
                          >
                            <Text style={{ color: c.text, fontSize: 12 }}>
                              👎 {(opt as any).not_for_me ?? 0}
                            </Text>
                          </Pressable>
                        </View>
                      ) : poll?.mode !== 'rating' ? (
                        <>
                          <View
                            style={{
                              height: 6,
                              backgroundColor: c.background,
                              borderRadius: 6,
                              marginTop: 10,
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
                              onPress={() => onVote(opt)}
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
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
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
        visible={closeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !closing && setCloseOpen(false)}
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
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Close this poll?</Text>
            <Text style={{ color: c.muted, marginTop: 8 }}>
              Members won’t be able to vote after closing. You can still commit a winner later.
            </Text>
            <View
              style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}
            >
              <Pressable
                onPress={() => !closing && setCloseOpen(false)}
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
                onPress={onClose}
                disabled={closing}
                style={{
                  backgroundColor: c.primary,
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: closing ? 0.6 : 1,
                }}
              >
                <Text style={{ color: c.text, fontWeight: '800' }}>
                  {closing ? 'Closing…' : 'Close poll'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
