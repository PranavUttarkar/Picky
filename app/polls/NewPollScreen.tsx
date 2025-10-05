import {
  View,
  Text,
  Pressable,
  Alert,
  FlatList,
  ActivityIndicator,
  TextInput,
  Platform,
  ScrollView,
} from 'react-native';
import { ThreeDButton, ThreeDCard } from '@/components/ThreeD';
import { EventRowCard } from '@/components/EventRowCard';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { getMyGroups } from '@/services/groups';
import { createPollWithOptions } from '@/services/polls';
import {
  getTopUserMatches,
  getTopGroupMatches,
  searchEvents,
  getUpcomingEvents,
} from '@/services/events';
import type { Event } from '@/types/models';
import PollDeadlinePicker from '@/components/PollDeadlinePicker';

export default function NewPollScreen() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ groupId?: string; eventId?: string }>();
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState<number | null>(
    params.groupId ? Number(params.groupId) : null,
  );
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [fallbackUpcoming, setFallbackUpcoming] = useState<any[] | null>(null);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Event[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        router.replace('/onboarding/welcome');
        return;
      }
      const gs = await getMyGroups();
      const evs = groupId ? await getTopGroupMatches(groupId, 4) : await getTopUserMatches(4);
      if (!mounted) return;
      setGroups(gs);
      setTopMatches(evs);
      if (evs.length === 0) {
        try {
          const up = await getUpcomingEvents(3);
          setFallbackUpcoming(up);
        } catch {
          setFallbackUpcoming([]);
        }
      } else {
        setFallbackUpcoming(null);
      }
      if (!groupId && gs.length) setGroupId(gs[0].id);
      if (params.eventId) {
        const eid = Number(params.eventId);
        if (!Number.isNaN(eid)) setSelected(new Set([eid]));
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  // Refetch top matches on group change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const evs = groupId ? await getTopGroupMatches(groupId, 4) : await getTopUserMatches(4);
        if (!cancelled) {
          setTopMatches(evs);
          if (evs.length === 0) {
            try {
              const up = await getUpcomingEvents(3);
              setFallbackUpcoming(up);
            } catch {
              setFallbackUpcoming([]);
            }
          } else {
            setFallbackUpcoming(null);
          }
        }
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 3) {
      setResults([]);
      setHasMore(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const first = await searchEvents(search, 0, 20);
        setResults(first);
        setHasMore(first.length === 20);
      } catch {}
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await searchEvents(search, results.length, 20);
      setResults((prev) => [...prev, ...next]);
      setHasMore(next.length === 20);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCreate = async () => {
    try {
      if (!groupId) {
        Alert.alert('No group selected', 'Create or join a group first to start a poll.');
        return;
      }
      const ids = Array.from(selected);
      setCreating(true);
      const pollId = await createPollWithOptions(groupId, ids, {
        title: title?.trim() || null,
        deadlineAt,
        mode: 'single',
      });
      router.replace(`/polls/${pollId}`);
    } catch (e: any) {
      Alert.alert('Create poll failed', e.message ?? String(e));
    } finally {
      setCreating(false);
    }
  };

  const selectedCount = selected.size;
  const showSearchResults = search.trim().length >= 3;

  return (
    <GradientBackground variant="dim">
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <GradientHeader title="New Poll" />

        {/* Optional title */}
        <Text style={{ color: c.muted, marginBottom: 6 }}>Title (optional)</Text>
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 10,
            paddingHorizontal: 10,
            marginBottom: 12,
          }}
        >
          <TextInput
            placeholder="e.g., Saturday Night Plans"
            placeholderTextColor={c.muted}
            value={title}
            onChangeText={setTitle}
            style={{ color: c.text, paddingVertical: 10 }}
          />
        </View>

        {/* Deadline picker */}
        {/* <PollDeadlinePicker value={deadlineAt} onChange={setDeadlineAt} colorPalette={c} /> */}

        <Text style={{ color: c.muted, marginBottom: 6 }}>Group</Text>
        <View style={{ backgroundColor: c.card, borderRadius: 10, padding: 10, marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {groups.map((g) => (
              <Pressable
                key={g.id}
                onPress={() => setGroupId(g.id)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 8,
                  backgroundColor: groupId === g.id ? c.primary : c.background,
                }}
              >
                <Text style={{ color: c.text }}>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Create Poll Button */}
        <View style={{ marginBottom: 16 }}>
          {creating ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                justifyContent: 'center',
                backgroundColor: c.card,
                padding: 16,
                borderRadius: 12,
              }}
            >
              <ActivityIndicator color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Creating…</Text>
            </View>
          ) : (
            <ThreeDButton
              title={
                selectedCount === 1
                  ? 'Create Yes/No Poll'
                  : selectedCount > 1
                  ? `Create Poll (${selectedCount} selected)`
                  : selectedCount === 0
                  ? 'Select events to create poll'
                  : 'Create Poll'
              }
              onPress={onCreate}
              style={{
                alignSelf: 'center',
                opacity: selectedCount === 0 ? 0.6 : 1,
              }}
            />
          )}
        </View>

        {/* Top matches */}
        <Text style={{ color: c.muted, marginBottom: 6 }}>
          {groupId ? 'Select to Poll between top matches for this group' : 'Your top matches'}
        </Text>
        {topMatches.length === 0 ? (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: c.muted, marginBottom: 8 }}>
              No personalized matches yet. Here are a few upcoming events:
            </Text>
            {fallbackUpcoming === null ? (
              <Text style={{ color: c.muted }}>Loading…</Text>
            ) : fallbackUpcoming?.length ? (
              fallbackUpcoming?.map((item: any) => {
                const sel = selected.has(item.id);
                return (
                  <View
                    key={item.id}
                    style={{
                      marginBottom: 8,
                      borderWidth: sel ? 2 : 1,
                      borderColor: sel ? c.primary : '#00000020',
                      borderRadius: 12,
                      overflow: 'hidden',
                    }}
                  >
                    <EventRowCard
                      event={item}
                      isSaved={false}
                      onToggleSave={() => {}}
                      onOpenDetails={() => {}}
                      onPoll={() => toggle(item.id)}
                      pollButtonTitle={sel ? 'Unselect' : 'Select'}
                    />
                    {sel && (
                      <View
                        style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          backgroundColor: c.primary,
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 12,
                        }}
                      >
                        <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>
                          Selected
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <Text style={{ color: c.muted }}>No upcoming events found.</Text>
            )}
          </View>
        ) : (
          <View style={{ marginBottom: 12 }}>
            {topMatches.map((item: any) => {
              const sel = selected.has(item.id);
              return (
                <View
                  key={item.id}
                  style={{
                    marginBottom: 8,
                    borderWidth: sel ? 2 : 1,
                    borderColor: sel ? c.primary : '#00000020',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <EventRowCard
                    event={item}
                    isSaved={false}
                    onToggleSave={() => {}}
                    onOpenDetails={() => {}}
                    onPoll={() => toggle(item.id)}
                    pollButtonTitle={sel ? 'Unselect' : 'Select'}
                    matchPercent={item.match_percent}
                  />
                  {sel && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: c.primary,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>
                        Selected
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Quick actions */}
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
          <ThreeDButton title="Browse" onPress={() => router.push('/(tabs)/home')} />
        </View>

        {/* Search input */}
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 10,
            paddingHorizontal: 10,
            marginBottom: 8,
          }}
        >
          <TextInput
            placeholder="Search events to add (min 3 chars)"
            placeholderTextColor={c.muted}
            value={search}
            onChangeText={setSearch}
            style={{ color: c.text, paddingVertical: 10 }}
          />
        </View>

        {selectedCount === 1 ? (
          <Text style={{ color: c.muted, marginBottom: 8 }}>
            A single selection makes a Yes/No poll for that event.
          </Text>
        ) : null}

        {/* Search results */}
        {showSearchResults ? (
          <View>
            {results.map((item) => {
              const sel = selected.has(item.id);
              return (
                <View
                  key={item.id}
                  style={{
                    marginBottom: 8,
                    borderWidth: sel ? 2 : 1,
                    borderColor: sel ? c.primary : '#00000020',
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}
                >
                  <EventRowCard
                    event={item}
                    isSaved={false}
                    onToggleSave={() => {}}
                    onOpenDetails={() => {}}
                    onPoll={() => toggle(item.id)}
                    pollButtonTitle={sel ? 'Unselect' : 'Select'}
                  />
                  {sel && (
                    <View
                      style={{
                        position: 'absolute',
                        top: 8,
                        right: 8,
                        backgroundColor: c.primary,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 12,
                      }}
                    >
                      <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>
                        Selected
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
            {hasMore && (
              <Pressable
                onPress={loadMore}
                disabled={loadingMore}
                style={{
                  backgroundColor: c.card,
                  padding: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginBottom: 8,
                }}
              >
                {loadingMore ? (
                  <ActivityIndicator color={c.text} />
                ) : (
                  <Text style={{ color: c.text, fontWeight: '700' }}>Load More</Text>
                )}
              </Pressable>
            )}
          </View>
        ) : (
          <Text style={{ color: c.muted }}>Search to add more events.</Text>
        )}
      </ScrollView>
    </GradientBackground>
  );
}
