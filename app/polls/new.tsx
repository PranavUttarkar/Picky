import { View, Text, Pressable, Alert, FlatList, ActivityIndicator, TextInput } from 'react-native';
import { ThreeDButton, ThreeDCard } from '@/components/ThreeD';
import { useThemeColors } from '@/theme/ThemeProvider';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { getMyGroups } from '@/services/groups';
import { createPollWithOptions } from '@/services/polls';
import { getTopUserMatches, getTopGroupMatches, searchEvents } from '@/services/events';
import type { Event } from '@/types/models';

export default function NewPoll() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ groupId?: string; eventId?: string }>();
  const [groups, setGroups] = useState<any[]>([]);
  const [groupId, setGroupId] = useState<number | null>(
    params.groupId ? Number(params.groupId) : null,
  );
  const [topMatches, setTopMatches] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Event[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
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
      if (!groupId && gs.length) setGroupId(gs[0].id);
      if (params.eventId) {
        const eid = Number(params.eventId);
        if (!Number.isNaN(eid)) setSelected(new Set([eid]));
      }
    })();
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
        if (!cancelled) setTopMatches(evs);
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
      if (ids.length < 1) {
        Alert.alert(
          'Pick events',
          'Select at least 1 event. If you pick 1, the poll will be Yes/No for that event.',
        );
        return;
      }
      setCreating(true);
      const pollId = await createPollWithOptions(groupId, ids);
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
    <View style={{ flex: 1, backgroundColor: c.background, padding: 16 }}>
      <Text style={{ color: c.text, fontWeight: '800', fontSize: 18, marginBottom: 12 }}>
        New Poll
      </Text>

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

      {/* Top matches */}
      <Text style={{ color: c.muted, marginBottom: 6 }}>
        {groupId ? 'Top matches for this group' : 'Your top matches'}
      </Text>
      {topMatches.length === 0 ? (
        <Text style={{ color: c.muted, marginBottom: 12 }}>No matches yet. Try searching.</Text>
      ) : (
        <View style={{ marginBottom: 12 }}>
          {topMatches.map((item: any) => {
            const sel = selected.has(item.id);
            return (
              <Pressable
                key={item.id}
                onPress={() => toggle(item.id)}
                style={{
                  marginBottom: 8,
                }}
              >
                <ThreeDCard
                  style={{
                    borderWidth: sel ? 2 : 1,
                    borderColor: sel ? c.primary : '#00000020',
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    {new Date(item.date_time).toLocaleString()} • {item.location}
                  </Text>
                  {item.match_percent != null ? (
                    <Text style={{ color: c.muted, marginTop: 4 }}>
                      {item.match_percent}% match
                    </Text>
                  ) : null}
                  {sel ? <Text style={{ color: c.primary, marginTop: 6 }}>Selected</Text> : null}
                </ThreeDCard>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Quick actions */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <ThreeDButton title="View Saved" onPress={() => router.push('/(tabs)/saved')} />
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

      {/* Search results */}
      {showSearchResults ? (
        <FlatList
          data={results}
          keyExtractor={(e) => String(e.id)}
          contentContainerStyle={{ paddingBottom: 120 }}
          onEndReachedThreshold={0.5}
          onEndReached={loadMore}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={c.text} />
              </View>
            ) : null
          }
          renderItem={({ item }) => {
            const sel = selected.has(item.id);
            return (
              <Pressable
                onPress={() => toggle(item.id)}
                style={{
                  marginBottom: 8,
                }}
              >
                <ThreeDCard
                  style={{
                    borderWidth: sel ? 2 : 1,
                    borderColor: sel ? c.primary : '#00000020',
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>{item.title}</Text>
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    {new Date(item.date_time).toLocaleString()} • {item.location}
                  </Text>
                  {sel ? <Text style={{ color: c.primary, marginTop: 6 }}>Selected</Text> : null}
                </ThreeDCard>
              </Pressable>
            );
          }}
        />
      ) : (
        <Text style={{ color: c.muted }}>Search to add more events.</Text>
      )}
      {/* Sticky bottom action bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: c.background,
          borderTopWidth: 1,
          borderTopColor: '#00000020',
          padding: 12,
        }}
      >
        {creating ? (
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}
          >
            <ActivityIndicator color={c.text} />
            <Text style={{ color: c.text, fontWeight: '700' }}>Creating…</Text>
          </View>
        ) : (
          <ThreeDButton
            title={
              selectedCount < 1
                ? 'Select at least 1 event'
                : selectedCount === 1
                ? 'Create Yes/No Poll'
                : `Create Poll (${selectedCount} selected)`
            }
            onPress={onCreate}
            disabled={selectedCount < 1}
            style={{ opacity: selectedCount < 1 ? 0.6 : 1, alignSelf: 'center' }}
          />
        )}
      </View>
    </View>
  );
}
