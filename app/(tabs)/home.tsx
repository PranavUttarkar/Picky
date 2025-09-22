import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  SafeAreaView,
  Alert,
  Linking,
} from 'react-native';
import dayjs from 'dayjs';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/services/supabase';
import { router } from 'expo-router';
import type { Event } from '@/types/models';

// Event type shared from types/models

export default function Home() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const listRef = useRef<FlatList<Event>>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [myTags, setMyTags] = useState<string[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState<number[]>([]);
  const [query, setQuery] = useState('');
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [mode, setMode] = useState<'all' | 'personalized'>('all');
  const [isAdmin, setIsAdmin] = useState(false);

  // Modal state for event details
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Admin form state
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fImage, setFImage] = useState('');
  const [fDateTime, setFDateTime] = useState(
    dayjs().add(1, 'day').hour(18).minute(0).second(0).toISOString(),
  );
  const [fLocation, setFLocation] = useState('');
  const [fTagsCsv, setFTagsCsv] = useState('');
  const [fRsvp, setFRsvp] = useState('');

  // Generate a healthy set of dummy events (negative IDs) to fill the feed
  const makeDummyEvents = (): Event[] => {
    const now = dayjs();
    const cities = [
      'Downtown Campus',
      'Riverside Park',
      'Innovation Hub',
      'Student Union',
      'Community Center',
      'Main Quad',
      'Arts Hall',
      'Stadium Plaza',
      'Library Lawn',
      'Tech Commons',
    ];
    const tagSets: string[][] = [
      ['Music', 'Nightlife'],
      ['Sports', 'Outdoors'],
      ['Food', 'Culture'],
      ['Tech', 'Career'],
      ['Volunteering', 'Wellness'],
      ['Art', 'Culture'],
      ['Gaming', 'Tech'],
      ['Outdoors', 'Wellness'],
      ['Music', 'Art'],
      ['Sports', 'Career'],
      ['Food', 'Nightlife'],
      ['Tech', 'Innovation'],
      ['Volunteering', 'Community'],
      ['Art', 'Wellness'],
      ['Gaming', 'Nightlife'],
      ['Outdoors', 'Culture'],
      ['Career', 'Tech'],
      ['Wellness', 'Yoga'],
      ['Music', 'Festival'],
      ['Food', 'Farmers Market'],
    ];
    const titles = [
      'Sunset Acoustic Jam',
      'Intramural Soccer Finals',
      'Street Foods Around the World',
      'AI Study Group + Pizza',
      'Community Clean-up Drive',
      'Gallery Night: Student Art',
      'LAN Party Showdown',
      'Sunrise Yoga in the Quad',
      'Open Mic Night',
      'Career Fair Prep Workshop',
      'Night Market & Bites',
      'Hack Night: Build & Ship',
      'Food Bank Volunteering',
      'Mindfulness & Sketching',
      'Retro Games & Chips',
      'Trail Run Meetup',
      'Resume Review Roundtable',
      'Wellness Wednesday',
      'Campus Music Fest Preview',
      'Local Farmers Market Trip',
    ];
    const desc =
      'This is a placeholder event to help you explore the app while we load fresh events.';
    const dummies: Event[] = titles.map((t, i) => {
      const dt = now
        .add(i + 1, 'day')
        .hour(18)
        .minute(0)
        .second(0);
      return {
        id: -1 - i, // negative IDs to avoid collisions with real events
        title: t,
        description: desc,
        image_url: `https://picsum.photos/seed/picky${i + 1}/800/500`,
        date_time: dt.toISOString(),
        location: cities[i % cities.length],
        tags: tagSets[i % tagSets.length],
      };
    });
    return dummies;
  };

  const loadEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true });
    const real = (data ?? []) as Event[];
    const MIN = 16;
    if (real.length >= MIN) {
      setEvents(real);
    } else {
      const dummies = makeDummyEvents();
      const need = Math.max(0, MIN - real.length);
      const toAdd = dummies.slice(0, need);
      setEvents([...real, ...toAdd]);
    }
  };

  useEffect(() => {
    // Load events initially
    loadEvents();
    // Load user-specific info
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return; // guests can still see events; just skip personalized data
      // Admin detection
      const { data: urow } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin(!!urow?.is_admin);

      const { data } = await supabase
        .from('user_interests_temp')
        .select('names')
        .eq('user_id', user.id)
        .maybeSingle();
      setMyTags(data?.names ?? []);

      const se = await supabase.from('saved_events').select('event_id').eq('user_id', user.id);
      setSaved((se.data ?? []).map((r: any) => r.event_id));

      // Fetch personal scoring from Supabase RPC (secure function)
      const { data: rpcScores } = await supabase.rpc('get_user_event_scores');
      if (rpcScores) {
        const map: Record<number, number> = {};
        for (const row of rpcScores as any[]) {
          map[Number(row.event_id)] = Number(row.match_percent);
        }
        setScores(map);
      }
    })();
  }, []);
  const requireAuth = async (): Promise<boolean> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      return false;
    }
    return true;
  };

  const toggleSave = async (id: number) => {
    // Disable save for dummy items
    if (id < 0) return;
    const authed = await requireAuth();
    if (!authed) return;
    const user = (await supabase.auth.getUser()).data.user!;
    if (saved.includes(id)) {
      await supabase.from('saved_events').delete().eq('user_id', user.id).eq('event_id', id);
      setSaved((s) => s.filter((x) => x !== id));
    } else {
      await supabase.from('saved_events').insert({ user_id: user.id, event_id: id });
      setSaved((s) => [...s, id]);
    }
  };

  const match = (eventId: number, tags?: string[]) => {
    // Prefer server-computed score when available
    const fromServer = scores[eventId];
    if (typeof fromServer === 'number') return fromServer;
    // Fallback local estimate if RPC not available yet
    if (!tags || tags.length === 0 || myTags.length === 0) return 0;
    const overlap = tags.filter((t) => myTags.includes(t)).length;
    const pct = Math.round((overlap / Math.max(tags.length, myTags.length)) * 100);
    return Math.max(0, Math.min(100, pct));
  };

  // Parse query to extract hashtags as tag filters and plain text terms
  const parseQuery = (q: string) => {
    const tags: string[] = [];
    const words: string[] = [];
    for (const token of q.split(/\s+/).filter(Boolean)) {
      if (token.startsWith('#') && token.length > 1) {
        tags.push(token.slice(1).toLowerCase());
      } else {
        words.push(token.toLowerCase());
      }
    }
    return { tags, words };
  };

  const { tags: queryTags, words: queryWords } = parseQuery(query);

  // Build tag universe from currently loaded events
  const allTags: string[] = Array.from(
    new Set(events.flatMap((e) => (e.tags ?? []).map((t) => t))),
  ).sort((a, b) => a.localeCompare(b));

  // Derived filtered list based on text and tag filters
  const filteredBase = events.filter((e) => {
    // Tag match: all queryTags must be present (case-insensitive)
    const lowerEventTags = (e.tags ?? []).map((t) => t.toLowerCase());
    if (queryTags.length) {
      const et = (e.tags ?? []).map((t) => t.toLowerCase());
      for (const t of queryTags) if (!et.includes(t)) return false;
    }
    // Also apply active tag chip filters (AND logic)
    if (activeTags.length) {
      for (const t of activeTags.map((t) => t.toLowerCase()))
        if (!lowerEventTags.includes(t)) return false;
    }
    // Text match on title/description/location
    if (queryWords.length) {
      const hay = `${e.title} ${e.description ?? ''} ${e.location ?? ''}`.toLowerCase();
      for (const w of queryWords) if (!hay.includes(w)) return false;
    }
    return true;
  });

  // Apply mode-specific sorting/filtering
  const filtered = [...filteredBase].sort((a, b) => {
    if (mode === 'personalized') {
      return match(b.id, b.tags) - match(a.id, a.tags);
    }
    // Default: chronological by date_time
    return dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf();
  });

  // Admin: reset form helper
  const resetForm = () => {
    setEditingId(null);
    setFTitle('');
    setFDesc('');
    setFImage('');
    setFDateTime(dayjs().add(1, 'day').hour(18).minute(0).second(0).toISOString());
    setFLocation('');
    setFTagsCsv('');
    setFRsvp('');
  };

  const upsertEvent = async () => {
    // Basic validation
    if (!fTitle.trim()) {
      Alert.alert('Missing title', 'Please provide a title for the event.');
      return;
    }
    const dtIso = dayjs(fDateTime).isValid()
      ? dayjs(fDateTime).toISOString()
      : dayjs().add(1, 'day').toISOString();
    const tags = fTagsCsv
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Not signed in', 'You must be signed in as admin.');
      return;
    }
    const payload: any = {
      title: fTitle.trim(),
      description: fDesc.trim() || null,
      image_url: fImage.trim() || null,
      date_time: dtIso,
      location: fLocation.trim() || null,
      tags,
      rsvp_url: fRsvp.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingId);
      if (error) {
        Alert.alert('Update failed', error.message);
        return;
      }
    } else {
      const { error } = await supabase.from('events').insert({ ...payload, created_by: user.id });
      if (error) {
        Alert.alert('Create failed', error.message);
        return;
      }
    }
    resetForm();
    await loadEvents();
    Alert.alert('Success', editingId ? 'Event updated' : 'Event created');
  };

  const deleteEvent = async (id: number) => {
    Alert.alert('Delete event?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('events').delete().eq('id', id);
          if (error) {
            Alert.alert('Delete failed', error.message);
            return;
          }
          await loadEvents();
        },
      },
    ]);
  };

  const onOpenDetails = async (item: Event) => {
    // If it's a real event, fetch full row to include RSVP etc.
    if (item.id > 0) {
      const { data } = await supabase.from('events').select('*').eq('id', item.id).maybeSingle();
      if (data) {
        setSelectedEvent(data as Event);
        setDetailsOpen(true);
        return;
      }
    }
    setSelectedEvent(item);
    setDetailsOpen(true);
  };

  const prefillForEdit = (e: Event) => {
    if (e.id <= 0) return;
    setAdminOpen(true);
    setEditingId(e.id);
    setFTitle(e.title);
    setFDesc(e.description ?? '');
    setFImage(e.image_url ?? '');
    setFDateTime(e.date_time);
    setFLocation(e.location ?? '');
    setFTagsCsv((e.tags ?? []).join(', '));
    setFRsvp(e.rsvp_url ?? '');
    // Scroll to top to reveal the admin panel
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  };

  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    scheme === 'light' ? (
      <LinearGradient
        colors={["#e9fdf5", "#f9fafb"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <View style={{ flex: 1, padding: 12 }}>{children}</View>
      </LinearGradient>
    ) : (
      <View style={{ flex: 1, backgroundColor: c.background, padding: 12 }}>{children}</View>
    );

  return (
    <Container>
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(e) => String(e.id)}
        ListHeaderComponent={() => (
          <View style={{ paddingBottom: 12 }}>
            {/* Admin panel */}
            {isAdmin ? (
              <View
                style={{
                  backgroundColor: c.card,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#00000020',
                }}
              >
                <Pressable onPress={() => setAdminOpen((v) => !v)}>
                  <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
                    Admin: Manage Events {adminOpen ? '▲' : '▼'}
                  </Text>
                </Pressable>
                {adminOpen ? (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    {editingId ? (
                      <Text style={{ color: c.muted }}>Editing event #{editingId}</Text>
                    ) : null}
                    <TextInput
                      placeholder="Title"
                      placeholderTextColor={c.muted}
                      value={fTitle}
                      onChangeText={setFTitle}
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Description"
                      placeholderTextColor={c.muted}
                      value={fDesc}
                      onChangeText={setFDesc}
                      multiline
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                        minHeight: 60,
                      }}
                    />
                    <TextInput
                      placeholder="Image URL"
                      placeholderTextColor={c.muted}
                      value={fImage}
                      onChangeText={setFImage}
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Date/time ISO (e.g. 2025-09-22T18:00:00Z)"
                      placeholderTextColor={c.muted}
                      value={fDateTime}
                      onChangeText={setFDateTime}
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                      }}
                      autoCapitalize="none"
                    />
                    <TextInput
                      placeholder="Location"
                      placeholderTextColor={c.muted}
                      value={fLocation}
                      onChangeText={setFLocation}
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                      }}
                    />
                    <TextInput
                      placeholder="Tags (comma-separated)"
                      placeholderTextColor={c.muted}
                      value={fTagsCsv}
                      onChangeText={setFTagsCsv}
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                      }}
                      autoCapitalize="none"
                    />
                    <TextInput
                      placeholder="RSVP URL (optional)"
                      placeholderTextColor={c.muted}
                      value={fRsvp}
                      onChangeText={setFRsvp}
                      style={{
                        color: c.text,
                        backgroundColor: '#00000010',
                        padding: 10,
                        borderRadius: 8,
                      }}
                      autoCapitalize="none"
                    />
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={upsertEvent}
                        style={{
                          backgroundColor: c.primary,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: '#000', fontWeight: '700' }}>
                          {editingId ? 'Update Event' : 'Create Event'}
                        </Text>
                      </Pressable>
                      {editingId ? (
                        <Pressable
                          onPress={resetForm}
                          style={{
                            backgroundColor: '#00000030',
                            paddingHorizontal: 12,
                            paddingVertical: 10,
                            borderRadius: 10,
                          }}
                        >
                          <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    {/* Quick list to edit/delete */}
                    <View style={{ marginTop: 8, gap: 8 }}>
                      {events
                        .filter((e) => e.id > 0)
                        .slice(0, 8)
                        .map((e) => (
                          <View
                            key={e.id}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Text style={{ color: c.text }}>
                              #{e.id} · {e.title}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              <Pressable
                                onPress={() => {
                                  setEditingId(e.id);
                                  setFTitle(e.title);
                                  setFDesc(e.description ?? '');
                                  setFImage(e.image_url ?? '');
                                  setFDateTime(e.date_time);
                                  setFLocation(e.location ?? '');
                                  setFTagsCsv((e.tags ?? []).join(', '));
                                  setFRsvp(e.rsvp_url ?? '');
                                }}
                                style={{
                                  backgroundColor: '#00000030',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                }}
                              >
                                <Text style={{ color: c.text }}>Edit</Text>
                              </Pressable>
                              <Pressable
                                onPress={() => deleteEvent(e.id)}
                                style={{
                                  backgroundColor: '#ff444433',
                                  paddingHorizontal: 10,
                                  paddingVertical: 6,
                                  borderRadius: 8,
                                }}
                              >
                                <Text style={{ color: '#ff5555' }}>Delete</Text>
                              </Pressable>
                            </View>
                          </View>
                        ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Search input with hashtag support */}
            <View
              style={{
                backgroundColor: c.card,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginBottom: 12,
                borderWidth: 1,
                borderColor: '#00000020',
              }}
            >
              <TextInput
                placeholder="Search events or use #tags"
                placeholderTextColor={c.muted}
                value={query}
                onChangeText={setQuery}
                style={{ color: c.text, fontSize: 16 }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Mode toggle */}
            <View
              style={{
                flexDirection: 'row',
                gap: 6,
                marginBottom: 12,
                backgroundColor: c.card,
                padding: 6,
                borderRadius: 12,
              }}
            >
              {[
                { key: 'all', label: 'View All' },
                { key: 'personalized', label: 'Personalized Feed' },
              ].map((opt) => {
                const active = mode === (opt.key as any);
                return (
                  <Pressable
                    key={opt.key}
                    onPress={() => setMode(opt.key as any)}
                    style={{
                      backgroundColor: active ? c.primary : 'transparent',
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: active ? '#000' : c.text, fontWeight: '700' }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Tag chips */}
            {allTags.length ? (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {allTags.map((t) => {
                  const active = activeTags.includes(t);
                  return (
                    <Pressable
                      key={t}
                      onPress={() =>
                        setActiveTags((prev) =>
                          prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
                        )
                      }
                      style={{
                        backgroundColor: active ? c.primary : '#00000020',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: active ? '#000' : c.text, fontSize: 12 }}>{t}</Text>
                    </Pressable>
                  );
                })}
                {(activeTags.length || query.length) ? (
                  <Pressable
                    onPress={() => {
                      setActiveTags([]);
                      setQuery('');
                    }}
                    style={{
                      backgroundColor: '#00000030',
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: c.text, fontSize: 12 }}>Clear filters</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {/* Results info */}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <Text style={{ color: c.muted }}>
                Showing {filtered.length} {filtered.length === 1 ? 'event' : 'events'}
              </Text>
              {mode === 'personalized' ? (
                <Text style={{ color: c.muted }}>Sorted by match</Text>
              ) : (
                <Text style={{ color: c.muted }}>Soonest first</Text>
              )}
            </View>
          </View>
        )}
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        ListEmptyComponent={
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <Text style={{ color: c.muted, marginBottom: 8 }}>No events match your filters</Text>
            <Pressable
              onPress={() => {
                setQuery('');
                setActiveTags([]);
                setMode('all');
              }}
              style={{
                backgroundColor: c.primary,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '700' }}>Reset filters</Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpenDetails(item)}
            style={{
              backgroundColor: c.card,
              borderRadius: 16,
              overflow: 'hidden',
              opacity: item.id < 0 ? 0.98 : 1,
            }}
          >
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 160 }} />
            ) : null}
            <View style={{ padding: 12 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{item.title}</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {dayjs(item.date_time).format('ddd, MMM D • h:mm A')} • {item.location}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {(item.tags ?? []).map((t) => (
                  <View
                    key={t}
                    style={{
                      backgroundColor: '#00000020',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: c.text, fontSize: 12 }}>{t}</Text>
                  </View>
                ))}
              </View>
              <View
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>
                  Match {match(item.id, item.tags)}%
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    onPress={() => toggleSave(item.id)}
                    style={{
                      backgroundColor: c.primary,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 10,
                      opacity: item.id < 0 ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700' }}>
                      {saved.includes(item.id) ? 'Saved' : 'Save'}
                    </Text>
                  </Pressable>
                  {item.id > 0 ? (
                    <Pressable
                      onPress={async () => {
                        const authed = await requireAuth();
                        if (!authed) return;
                        router.push({
                          pathname: '/polls/new',
                          params: { fromEvent: item.id },
                        });
                      }}
                      style={{
                        backgroundColor: '#00000030',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: c.text, fontWeight: '700' }}>Poll</Text>
                    </Pressable>
                  ) : (
                    <View
                      style={{
                        backgroundColor: '#00000020',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderRadius: 10,
                      }}
                    >
                      <Text style={{ color: c.muted, fontWeight: '700' }}>Demo</Text>
                    </View>
                  )}
                  {isAdmin && item.id > 0 ? (
                    <>
                      <Pressable
                        onPress={() => prefillForEdit(item)}
                        style={{
                          backgroundColor: '#00000030',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: c.text, fontWeight: '700' }}>Edit</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => deleteEvent(item.id)}
                        style={{
                          backgroundColor: '#ff444433',
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 10,
                        }}
                      >
                        <Text style={{ color: '#ff5555', fontWeight: '700' }}>Delete</Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          </Pressable>
        )}
  />

      {/* Event Details Modal */}
      <Modal
        visible={detailsOpen}
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <View style={{ padding: 12 }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
                  Event details
                </Text>
                <Pressable
                  onPress={() => setDetailsOpen(false)}
                  style={{
                    backgroundColor: '#00000020',
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ color: c.text }}>Close</Text>
                </Pressable>
              </View>
            </View>
            {selectedEvent?.image_url ? (
              <Image
                source={{ uri: selectedEvent.image_url }}
                style={{ width: '100%', height: 220 }}
              />
            ) : null}
            <View style={{ padding: 16 }}>
              <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>
                {selectedEvent?.title}
              </Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>
                {selectedEvent ? dayjs(selectedEvent.date_time).format('ddd, MMM D • h:mm A') : ''}
                {selectedEvent?.location ? ` • ${selectedEvent.location}` : ''}
              </Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 8,
                }}
              >
                {(selectedEvent?.tags ?? []).map((t) => (
                  <View
                    key={t}
                    style={{
                      backgroundColor: '#00000020',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: c.text, fontSize: 12 }}>{t}</Text>
                  </View>
                ))}
              </View>
              {selectedEvent?.description ? (
                <Text style={{ color: c.text, marginTop: 12 }}>{selectedEvent.description}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                {selectedEvent?.id && selectedEvent.id > 0 ? (
                  <Pressable
                    onPress={() => {
                      // simple add-to-calendar using ICS deep link (fallback)
                      const title = encodeURIComponent(selectedEvent!.title);
                      const start = dayjs(selectedEvent!.date_time).toISOString();
                      const end = dayjs(selectedEvent!.date_time).add(2, 'hour').toISOString();
                      const details = encodeURIComponent(selectedEvent!.description ?? '');
                      const location = encodeURIComponent(selectedEvent!.location ?? '');
                      const href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start
                        .replace(/[-:\.]/g, '')
                        .replace('.000Z', 'Z')}/${end
                        .replace(/[-:\.]/g, '')
                        .replace('.000Z', 'Z')}&details=${details}&location=${location}`;
                      Linking.openURL(href);
                    }}
                    style={{
                      backgroundColor: c.primary,
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: '#000', fontWeight: '700' }}>Add to calendar</Text>
                  </Pressable>
                ) : null}
                {selectedEvent?.rsvp_url ? (
                  <Pressable
                    onPress={() => Linking.openURL(String(selectedEvent!.rsvp_url))}
                    style={{
                      backgroundColor: '#00000030',
                      padding: 12,
                      borderRadius: 12,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>Open RSVP link</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </Container>
  );
}
