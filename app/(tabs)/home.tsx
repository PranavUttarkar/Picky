import { memo, useEffect, useMemo, useRef, useState } from 'react';
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
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ThreeDButton, ThreeDCard } from '@/components/ThreeD';
import dayjs from 'dayjs';
import LazyImage from '@/components/LazyImage';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Chip from '@/components/Chip';
import { supabase } from '@/services/supabase';
import { sanitizeEventImageUrls } from '@/utils/images';
import { router } from 'expo-router';
import type { Event } from '@/types/models';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';

type AdminHeaderProps = {
  c: ReturnType<typeof useThemeColors>;
  isAdmin: boolean;
  adminOpen: boolean;
  setAdminOpen: React.Dispatch<React.SetStateAction<boolean>>;
  editingId: number | null;
  fTitle: string;
  setFTitle: (v: string) => void;
  fDesc: string;
  setFDesc: (v: string) => void;
  fImage1: string;
  setFImage1: (v: string) => void;
  fImage2: string;
  setFImage2: (v: string) => void;
  fImage3: string;
  setFImage3: (v: string) => void;
  fDateTime: string;
  setFDateTime: (v: string) => void;
  fLocation: string;
  setFLocation: (v: string) => void;
  fTagsCsv: string;
  setFTagsCsv: (v: string) => void;
  fRsvp: string;
  setFRsvp: (v: string) => void;
  showDatePicker: boolean;
  setShowDatePicker: (v: boolean) => void;
  showTimePicker: boolean;
  setShowTimePicker: (v: boolean) => void;
  upsertEvent: (values?: {
    title: string;
    desc: string;
    image: string;
    dateTime: string;
    location: string;
    tagsCsv: string;
    rsvp: string;
    editingId?: number | null;
  }) => void | Promise<void>;
  resetForm: () => void;
  events: Event[];
  deleteEvent: (id: number) => void;
};

const AdminHeader = memo(function AdminHeader(props: AdminHeaderProps) {
  const {
    c,
    isAdmin,
    adminOpen,
    setAdminOpen,
    editingId,
    fTitle,
    setFTitle,
    fDesc,
    setFDesc,
    fImage1,
    setFImage1,
    fImage2,
    setFImage2,
    fImage3,
    setFImage3,
    fDateTime,
    setFDateTime,
    fLocation,
    setFLocation,
    fTagsCsv,
    setFTagsCsv,
    fRsvp,
    setFRsvp,
    showDatePicker,
    setShowDatePicker,
    showTimePicker,
    setShowTimePicker,
    upsertEvent,
    resetForm,
    events,
    deleteEvent,
  } = props;

  // Local admin form state to avoid re-rendering parent on each keystroke
  const [titleLocal, setTitleLocal] = useState(fTitle);
  const [descLocal, setDescLocal] = useState(fDesc);
  const [image1Local, setImage1Local] = useState(fImage1);
  const [image2Local, setImage2Local] = useState(fImage2);
  const [image3Local, setImage3Local] = useState(fImage3);
  const [dateTimeLocal, setDateTimeLocal] = useState(fDateTime);
  const [locationLocal, setLocationLocal] = useState(fLocation);
  const [tagsCsvLocal, setTagsCsvLocal] = useState(fTagsCsv);
  const [rsvpLocal, setRsvpLocal] = useState(fRsvp);

  useEffect(() => {
    setTitleLocal(fTitle);
    setDescLocal(fDesc);
    setImage1Local(fImage1);
    setImage2Local(fImage2);
    setImage3Local(fImage3);
    setDateTimeLocal(fDateTime);
    setLocationLocal(fLocation);
    setTagsCsvLocal(fTagsCsv);
    setRsvpLocal(fRsvp);
  }, [editingId, fTitle, fDesc, fImage1, fImage2, fImage3, fDateTime, fLocation, fTagsCsv, fRsvp]);

  return (
    <View style={{ paddingBottom: 12 }}>
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
            Admin: Manage Events: {adminOpen ? '▲' : '▼'}
          </Text>
        </Pressable>
        {adminOpen ? (
          <View style={{ marginTop: 8, gap: 8 }}>
            {editingId ? <Text style={{ color: c.muted }}>Editing event #{editingId}</Text> : null}
            <TextInput
              placeholder="Title"
              placeholderTextColor={c.muted}
              value={titleLocal}
              onChangeText={setTitleLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoComplete="off"
              blurOnSubmit={false}
            />
            <TextInput
              placeholder="Description"
              placeholderTextColor={c.muted}
              value={descLocal}
              onChangeText={setDescLocal}
              multiline
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                padding: 10,
                borderRadius: 8,
                minHeight: 60,
              }}
              autoComplete="off"
              blurOnSubmit={false}
            />
            <View style={{ gap: 6 }}>
              {[
                {
                  label: 'Image 1 URL (cover)',
                  value: image1Local,
                  setter: setImage1Local,
                },
                {
                  label: 'Image 2 URL',
                  value: image2Local,
                  setter: setImage2Local,
                },
                {
                  label: 'Image 3 URL',
                  value: image3Local,
                  setter: setImage3Local,
                },
              ].map((cfg, idx) => (
                <TextInput
                  key={idx}
                  placeholder={cfg.label}
                  placeholderTextColor={c.muted}
                  value={cfg.value}
                  onChangeText={cfg.setter}
                  style={{
                    color: c.text,
                    backgroundColor: '#00000010',
                    padding: 10,
                    borderRadius: 8,
                  }}
                  autoComplete="off"
                  blurOnSubmit={false}
                />
              ))}
              <Text style={{ color: c.muted, fontSize: 11 }}>
                Provide up to 3 images. First acts as card cover; others appear as thumbnails /
                gallery.
              </Text>
            </View>
            {Platform.OS === 'web' ? null : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    flex: 1,
                    backgroundColor: '#00000010',
                    padding: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>
                    {dayjs(dateTimeLocal).format('YYYY-MM-DD')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  style={{
                    flex: 1,
                    backgroundColor: '#00000010',
                    padding: 10,
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: c.text, fontWeight: '700' }}>
                    {dayjs(dateTimeLocal).format('h:mm A')}
                  </Text>
                </Pressable>
              </View>
            )}
            {showDatePicker ? (
              <DateTimePicker
                mode="date"
                value={new Date(dateTimeLocal)}
                onChange={(evt, selectedDate) => {
                  setShowDatePicker(false);
                  if (!selectedDate) return;
                  const current = dayjs(dateTimeLocal);
                  const merged = current
                    .year(selectedDate.getFullYear())
                    .month(selectedDate.getMonth())
                    .date(selectedDate.getDate());
                  setDateTimeLocal(merged.toISOString());
                }}
              />
            ) : null}
            {showTimePicker ? (
              <DateTimePicker
                mode="time"
                value={new Date(dateTimeLocal)}
                onChange={(evt, selectedTime) => {
                  setShowTimePicker(false);
                  if (!selectedTime) return;
                  const current = dayjs(dateTimeLocal);
                  const merged = current
                    .hour(selectedTime.getHours())
                    .minute(selectedTime.getMinutes())
                    .second(0)
                    .millisecond(0);
                  setDateTimeLocal(merged.toISOString());
                }}
              />
            ) : null}
            <TextInput
              placeholder="Location"
              placeholderTextColor={c.muted}
              value={locationLocal}
              onChangeText={setLocationLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoComplete="off"
              blurOnSubmit={false}
            />
            <TextInput
              placeholder="Tags (comma-separated)"
              placeholderTextColor={c.muted}
              value={tagsCsvLocal}
              onChangeText={setTagsCsvLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoCapitalize="none"
              autoComplete="off"
              blurOnSubmit={false}
            />
            <TextInput
              placeholder="RSVP URL (optional)"
              placeholderTextColor={c.muted}
              value={rsvpLocal}
              onChangeText={setRsvpLocal}
              style={{ color: c.text, backgroundColor: '#00000010', padding: 10, borderRadius: 8 }}
              autoCapitalize="none"
              autoComplete="off"
              blurOnSubmit={false}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ThreeDButton
                title={editingId ? 'Update Event' : 'Create Event'}
                onPress={() =>
                  upsertEvent({
                    title: titleLocal,
                    desc: descLocal,
                    image: image1Local, // backward compat single field
                    dateTime: dateTimeLocal,
                    location: locationLocal,
                    tagsCsv: tagsCsvLocal,
                    rsvp: rsvpLocal,
                    editingId,
                  })
                }
              />
              {editingId ? <ThreeDButton title="Cancel" onPress={resetForm} /> : null}
            </View>
            <View style={{ marginTop: 8, gap: 8 }}>
              {events
                .filter((e: any) => e.id > 0)
                .slice(0, 8)
                .map((e: any) => (
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
                          setFTitle(e.title);
                          setFDesc(e.description ?? '');
                          const imgs = (e as any).image_urls ?? [];
                          setFImage1(imgs[0] || e.image_url || '');
                          setFImage2(imgs[1] || '');
                          setFImage3(imgs[2] || '');
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
    </View>
  );
});

type FiltersTopBarProps = {
  c: ReturnType<typeof useThemeColors>;
  query: string;
  setQuery: (v: string) => void;
  mode: 'all' | 'personalized';
  setMode: React.Dispatch<React.SetStateAction<'all' | 'personalized'>>;
};

const FiltersTopBar = memo(function FiltersTopBar({
  c,
  query,
  setQuery,
  mode,
  setMode,
}: FiltersTopBarProps) {
  return (
    <View style={{ paddingBottom: 12 }}>
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
    </View>
  );
});

type FiltersScrollableProps = {
  c: ReturnType<typeof useThemeColors>;
  myTags: string[];
  activeTags: string[];
  setActiveTags: React.Dispatch<React.SetStateAction<string[]>>;
  allTags: string[];
  query: string;
  setQuery: (v: string) => void;
  filteredCount: number;
  mode: 'all' | 'personalized';
};

const FiltersScrollable = memo(function FiltersScrollable({
  c,
  myTags,
  activeTags,
  setActiveTags,
  allTags,
  query,
  setQuery,
  filteredCount,
  mode,
}: FiltersScrollableProps) {
  return (
    <View style={{ paddingBottom: 12 }}>
      {myTags.length ? (
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '800' }}>Your interests</Text>
            <Pressable
              onPress={() => router.push('/onboarding/interests')}
              style={{
                backgroundColor: '#00000020',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: c.text }}>Edit</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {myTags.map((t, i) => {
              const active = activeTags.includes(t);
              return (
                <Pressable
                  key={`${t}-${i}`}
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
                  <Text style={{ color: active ? '#000' : c.text, fontSize: 12 }}>#{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {allTags.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {allTags.map((t, i) => {
            const active = activeTags.includes(t);
            return (
              <Pressable
                key={`${t}-${i}`}
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
          {activeTags.length || query.length ? (
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

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
        <Text style={{ color: c.muted }}>
          Showing {filteredCount} {filteredCount === 1 ? 'event' : 'events'}
        </Text>
        {mode === 'personalized' ? (
          <Text style={{ color: c.muted }}>Sorted by match</Text>
        ) : (
          <Text style={{ color: c.muted }}>Soonest first</Text>
        )}
      </View>
    </View>
  );
});

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
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modal state for event details
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Confirm delete modal state
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  // Track which card is expanded; collapsed shows truncated description + hint
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Admin form state
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fImage1, setFImage1] = useState('');
  const [fImage2, setFImage2] = useState('');
  const [fImage3, setFImage3] = useState('');
  const [fDateTime, setFDateTime] = useState(
    dayjs().add(1, 'day').hour(18).minute(0).second(0).toISOString(),
  );
  const [fLocation, setFLocation] = useState('');
  const [fTagsCsv, setFTagsCsv] = useState('');
  const [fRsvp, setFRsvp] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const makeDummyEvents = (): Event[] => {
    const titles = [
      'Campus Mixer Night',
      'Tech Talk & Pizza',
      'Outdoor Movie',
      'Art & Coffee',
      'Startup Pitch Jam',
      'Game Night Social',
      'Mindfulness Workshop',
      'Live Music on the Lawn',
      'Career Fair Warmup',
      'Community Volunteering',
      'Robotics Demo Day',
      'Open Mic Evening',
      'Photography Walk',
    ];
    const locations = ['Riverside Park', 'Innovation Hub', 'Student Union', 'Main Quad'];
    const tagPool = [
      'tech',
      'music',
      'food',
      'networking',
      'wellness',
      'art',
      'sports',
      'career',
      'community',
    ];
    const now = dayjs();
    const list: Event[] = [] as Event[];
    for (let i = 0; i < 24; i++) {
      const id = -1 - i;
      const title = titles[i % titles.length];
      const location = locations[i % locations.length];
      const date_time = now
        .add(i + 1, 'day')
        .hour(18)
        .minute(0)
        .second(0)
        .toISOString();
      const tags = [tagPool[i % tagPool.length], tagPool[(i + 3) % tagPool.length]];
      list.push({
        id,
        title,
        description: null,
        image_url: null,
        date_time,
        location,
        tags,
        rsvp_url: null,
      } as unknown as Event);
    }
    return list;
  };

  // Pagination + caching
  const PAGE_SIZE = 10;
  const CACHE_KEY = 'events_cache_v1';
  const MIN_FEED = 12; // ensure at least this many items by adding placeholders

  const saveCache = async (items: Event[]) => {
    try {
      const payload = { ts: Date.now(), items };
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const loadCache = async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.items)) {
        setEvents(parsed.items as Event[]);
      }
    } catch {}
  };

  const fetchPage = async (pageIndex: number): Promise<Event[]> => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('events')
      .select('id,title,description,image_url,date_time,location,tags')
      .gte('date_time', new Date().toISOString())
      .order('date_time', { ascending: true })
      .range(from, to);
    if (error) return [] as Event[];
    return (data ?? []) as Event[];
  };

  const loadFirstPage = async () => {
    setIsFetching(true);
    try {
      const first = await fetchPage(0);
      const dummiesAll = makeDummyEvents();
      if (first.length === 0) {
        // No real upcoming events; show a healthy set of dummies to demo UX
        const dummies = dummiesAll.slice(0, MIN_FEED);
        setEvents(dummies);
        setHasMore(false);
      } else {
        const hasMoreNow = first.length === PAGE_SIZE;
        let initial: Event[] = first as Event[];
        if (!hasMoreNow && first.length < MIN_FEED) {
          const existingIds = new Set((first as any[]).map((e) => e.id));
          const toAdd = dummiesAll
            .filter((d) => !existingIds.has(d.id))
            .slice(0, MIN_FEED - first.length);
          initial = [...first, ...toAdd] as Event[];
        }
        setEvents(initial);
        setHasMore(hasMoreNow);
        await saveCache(first);
      }
      setPage(1);
    } finally {
      setIsFetching(false);
    }
  };

  const loadNextPage = async () => {
    if (isFetching || !hasMore) return;
    setIsFetching(true);
    try {
      const next = await fetchPage(page);
      if (next.length === 0) {
        setHasMore(false);
        // Top-up with placeholders if needed
        setEvents((prev) => {
          const merged = [...prev] as Event[];
          const dummiesAll = makeDummyEvents();
          const existingIds = new Set((merged as any[]).map((e) => e.id));
          const needed = Math.max(0, MIN_FEED - merged.length);
          const toAdd = dummiesAll.filter((d) => !existingIds.has(d.id)).slice(0, needed);
          return [...merged, ...toAdd] as Event[];
        });
      } else {
        setEvents((prev) => {
          const negatives = prev.filter((e: any) => e.id < 0) as Event[];
          const realMap = new Map<number, Event>();
          // include previous real events
          for (const e of prev) if ((e as any).id > 0) realMap.set((e as any).id, e);
          // include new page real events
          for (const e of next as any[])
            if ((e as any).id > 0) realMap.set((e as any).id, e as Event);
          let realList = Array.from(realMap.values());
          // Optionally keep chronological order for base data
          realList = realList.sort(
            (a: any, b: any) => dayjs(a.date_time).valueOf() - dayjs(b.date_time).valueOf(),
          );
          let final = [...negatives, ...realList] as Event[];
          if (next.length < PAGE_SIZE) {
            const dummiesAll = makeDummyEvents();
            const existingIds = new Set((final as any[]).map((e) => e.id));
            const needed = Math.max(0, MIN_FEED - final.length);
            const toAdd = dummiesAll.filter((d) => !existingIds.has(d.id)).slice(0, needed);
            final = [...final, ...toAdd] as Event[];
          }
          // Save only real events to cache
          saveCache(final.filter((e: any) => e.id > 0));
          return final;
        });
        if (next.length < PAGE_SIZE) setHasMore(false);
        setPage((p) => p + 1);
      }
    } finally {
      setIsFetching(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    setPage(0);
    setHasMore(true);
    await loadFirstPage();
    setRefreshing(false);
  };

  useEffect(() => {
    // Load cached first for instant paint, then fetch
    loadCache().finally(() => {
      loadFirstPage();
    });
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
    new Set(events.flatMap((e: any) => (e.tags ?? []).map((t: string) => t))),
  ).sort((a, b) => a.localeCompare(b));

  // Derived filtered list based on text and tag filters
  const filteredBase = events.filter((e: any) => {
    // Tag match: all queryTags must be present (case-insensitive)
    const lowerEventTags = (e.tags ?? []).map((t: string) => t.toLowerCase());
    if (queryTags.length) {
      const et = (e.tags ?? []).map((t: string) => t.toLowerCase());
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
  const filtered = [...filteredBase].sort((a: any, b: any) => {
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
    setFImage1('');
    setFImage2('');
    setFImage3('');
    setFDateTime(dayjs().add(1, 'day').hour(18).minute(0).second(0).toISOString());
    setFLocation('');
    setFTagsCsv('');
    setFRsvp('');
  };

  const upsertEvent = async (values?: {
    title: string;
    desc: string;
    image: string;
    dateTime: string;
    location: string;
    tagsCsv: string;
    rsvp: string;
    editingId?: number | null;
  }) => {
    // Basic validation
    const titleVal = values?.title ?? fTitle;
    const descVal = values?.desc ?? fDesc;
    const imageVal = values?.image ?? fImage1; // legacy single field
    const dateTimeVal = values?.dateTime ?? fDateTime;
    const locationVal = values?.location ?? fLocation;
    const tagsCsvVal = values?.tagsCsv ?? fTagsCsv;
    const rsvpVal = values?.rsvp ?? fRsvp;
    const editingIdVal = values?.editingId ?? editingId;

    if (!titleVal.trim()) {
      Alert.alert('Missing title', 'Please provide a title for the event.');
      return;
    }
    const dtIso = dayjs(dateTimeVal).isValid()
      ? dayjs(dateTimeVal).toISOString()
      : dayjs().add(1, 'day').toISOString();
    const tags = tagsCsvVal
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
    const { cleaned: imageUrls, errors: imageErrors } = sanitizeEventImageUrls([
      fImage1,
      fImage2,
      fImage3,
    ]);
    if (imageErrors.length) {
      Alert.alert('Image issues', imageErrors.join('\n'));
    }
    const payload: any = {
      title: titleVal.trim(),
      description: descVal.trim() || null,
      image_url: imageVal.trim() || null,
      image_urls: imageUrls.length ? imageUrls : null,
      date_time: dtIso,
      location: locationVal.trim() || null,
      tags,
      rsvp_url: rsvpVal.trim() || null,
    };
    if (editingIdVal) {
      const { error } = await supabase.from('events').update(payload).eq('id', editingIdVal);
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
    await onRefresh();
    Alert.alert('Success', editingIdVal ? 'Event updated' : 'Event created');
  };

  // Open cross-platform confirmation modal
  const deleteEvent = (id: number) => {
    if (id <= 0) return; // ignore dummy events
    setDeleteTargetId(id);
    setConfirmDeleteOpen(true);
  };

  const performDelete = async () => {
    if (!deleteTargetId) return;
    if (!isAdmin) {
      Alert.alert('Not allowed', 'Only admins can delete events.');
      setConfirmDeleteOpen(false);
      setDeleteTargetId(null);
      return;
    }
    try {
      setIsDeleting(true);
      const { error } = await supabase.from('events').delete().eq('id', deleteTargetId);
      if (error) {
        Alert.alert('Delete failed', error.message);
        return;
      }
      setConfirmDeleteOpen(false);
      setDeleteTargetId(null);
      await onRefresh();
      Alert.alert('Deleted', 'The event was deleted.');
    } finally {
      setIsDeleting(false);
    }
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
    const imgs = (e as any).image_urls ?? [];
    setFImage1(imgs[0] || e.image_url || '');
    setFImage2(imgs[1] || '');
    setFImage3(imgs[2] || '');
    setFDateTime(e.date_time);
    setFLocation(e.location ?? '');
    setFTagsCsv((e.tags ?? []).join(', '));
    setFRsvp(e.rsvp_url ?? '');
    // Scroll to top to reveal the admin panel
    listRef.current?.scrollToOffset?.({ offset: 0, animated: true });
  };

  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 12 }}>
      {children}
    </GradientBackground>
  );

  // Admin header memo: only depends on admin form state, not search
  const adminHeader = useMemo(
    () => (
      <AdminHeader
        c={c}
        isAdmin={isAdmin}
        adminOpen={adminOpen}
        setAdminOpen={setAdminOpen}
        editingId={editingId}
        fTitle={fTitle}
        setFTitle={setFTitle}
        fDesc={fDesc}
        setFDesc={setFDesc}
        fImage1={fImage1}
        setFImage1={setFImage1}
        fImage2={fImage2}
        setFImage2={setFImage2}
        fImage3={fImage3}
        setFImage3={setFImage3}
        fDateTime={fDateTime}
        setFDateTime={setFDateTime}
        fLocation={fLocation}
        setFLocation={setFLocation}
        fTagsCsv={fTagsCsv}
        setFTagsCsv={setFTagsCsv}
        fRsvp={fRsvp}
        setFRsvp={setFRsvp}
        showDatePicker={showDatePicker}
        setShowDatePicker={setShowDatePicker}
        showTimePicker={showTimePicker}
        setShowTimePicker={setShowTimePicker}
        upsertEvent={upsertEvent}
        resetForm={resetForm}
        events={events}
        deleteEvent={deleteEvent}
      />
    ),
    [
      c,
      isAdmin,
      adminOpen,
      editingId,
      fTitle,
      fDesc,
      fImage1,
      fImage2,
      fImage3,
      fDateTime,
      fLocation,
      fTagsCsv,
      fRsvp,
      showDatePicker,
      showTimePicker,
      events,
    ],
  );

  // Filters: top bar outside list, interests/tags/results inside list header
  const filtersTopBar = useMemo(
    () => <FiltersTopBar c={c} query={query} setQuery={setQuery} mode={mode} setMode={setMode} />,
    [c, query, mode],
  );

  const filtersScrollable = useMemo(
    () => (
      <FiltersScrollable
        c={c}
        myTags={myTags}
        activeTags={activeTags}
        setActiveTags={setActiveTags}
        allTags={allTags}
        query={query}
        setQuery={setQuery}
        filteredCount={filtered.length}
        mode={mode}
      />
    ),
    [c, myTags, activeTags, allTags, query, filtered.length, mode],
  );

  // Gradient bordered match badge
  const MatchBadge: React.FC<{ value: number }> = ({ value }) => (
    <LinearGradient
      colors={['#34d399', '#3b82f6']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ padding: 1.5, borderRadius: 999 }}
    >
      <View
        style={{
          backgroundColor: scheme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.6)',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.text, fontWeight: '800' }}>Match {value}%</Text>
      </View>
    </LinearGradient>
  );

  return (
    <Container>
      {adminHeader}
      {filtersTopBar}
      <FlatList
        ref={listRef}
        data={filtered}
        keyExtractor={(e: any) => String(e.id)}
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        ListHeaderComponent={filtersScrollable}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReachedThreshold={0.25}
        onEndReached={loadNextPage}
        initialNumToRender={8}
        windowSize={10}
        removeClippedSubviews={false}
        ListEmptyComponent={
          <View style={{ paddingTop: 48, alignItems: 'center' }}>
            <Text style={{ color: c.muted, marginBottom: 8 }}>No events match your filters</Text>
            <ThreeDButton
              title="Reset filters"
              onPress={() => {
                setQuery('');
                setActiveTags([]);
                setMode('all');
              }}
            />
          </View>
        }
        renderItem={({ item }) => {
          const savedState = saved.includes(item.id);
          const disabled = item.id < 0;
          const isExpanded = expandedId === item.id;
          const fullDesc = item.description ?? '';
          const truncated = fullDesc.length > 50 ? fullDesc.slice(0, 50) + '…' : fullDesc;

          const IconButton: React.FC<{
            name: keyof typeof Ionicons.glyphMap;
            label: string;
            onPress?: () => void | Promise<void>;
            color?: string;
            disabled?: boolean;
          }> = ({ name, label, onPress, color, disabled: dis }) => (
            <Pressable
              onPress={dis ? undefined : onPress}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: '#00000020',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: dis ? 0.4 : 1,
              }}
            >
              <Ionicons name={name} size={22} color={color || c.text} />
            </Pressable>
          );

          return (
            <View
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                opacity: item.id < 0 ? 0.98 : 1,
              }}
            >
              <ThreeDCard>
                {/* Multi-image cover: show first image full, up to 2 more as stacked thumbnails */}
                {(() => {
                  const imgs: string[] = (item as any).image_urls?.length
                    ? (item as any).image_urls
                    : item.image_url
                    ? [item.image_url]
                    : [];
                  if (!imgs.length) return null;
                  const cover = imgs[0];
                  const extras = imgs.slice(1, 3);
                  return (
                    <View style={{ position: 'relative' }}>
                      <LazyImage
                        uri={cover}
                        width={'100%'}
                        height={160}
                        borderRadius={16}
                        accessibilityLabel={`Cover image for ${item.title}`}
                        style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
                      />
                      {extras.length ? (
                        <View
                          style={{
                            position: 'absolute',
                            right: 8,
                            bottom: 8,
                            flexDirection: 'row',
                            gap: 6,
                          }}
                        >
                          {extras.map((u, i) => (
                            <LazyImage
                              key={i}
                              uri={u}
                              width={44}
                              height={44}
                              borderRadius={8}
                              style={{ borderWidth: 1, borderColor: '#ffffff55' }}
                              accessibilityLabel={`Additional image ${i + 2} for ${item.title}`}
                            />
                          ))}
                          {imgs.length > 3 ? (
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 8,
                                backgroundColor: '#00000070',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                                +{imgs.length - 3}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ) : null}
                    </View>
                  );
                })()}
                <View style={{ padding: 12 }}>
                  <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>
                    {item.title}
                  </Text>
                  <Text style={{ color: c.muted, marginTop: 4 }}>
                    {dayjs(item.date_time).format('ddd, MMM D • h:mm A')} • {item.location}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {(item.tags ?? []).map((t: string, i: number) => (
                      <Chip key={`${t}-${i}`} label={t} />
                    ))}
                  </View>
                  {fullDesc.length ? (
                    <Pressable
                      onPress={() => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        setExpandedId((prev) => (prev === item.id ? null : item.id));
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isExpanded ? 'Collapse description' : 'Expand description'
                      }
                      style={{ marginTop: 10 }}
                    >
                      <View style={{ position: 'relative' }}>
                        <Text style={{ color: c.text }}>
                          {isExpanded ? fullDesc : truncated || ''}
                        </Text>
                        {!isExpanded && fullDesc.length > truncated.length ? (
                          <LinearGradient
                            colors={
                              scheme === 'light'
                                ? ['rgba(255,255,255,0)', 'rgba(255,255,255,0.92)']
                                : ['rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']
                            }
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: 50,
                            }}
                            pointerEvents="none"
                          />
                        ) : null}
                      </View>
                    </Pressable>
                  ) : null}
                  {/* Actions row always visible */}
                  <View
                    style={{
                      marginTop: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <MatchBadge value={match(item.id, item.tags)} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      {item.id > 0 ? (
                        <ThreeDButton
                          title="Poll"
                          onPress={async () => {
                            const authed = await requireAuth();
                            if (!authed) return;
                            router.push({ pathname: '/polls/new', params: { fromEvent: item.id } });
                          }}
                        />
                      ) : null}
                      <IconButton
                        name={savedState ? 'bookmark' : 'bookmark-outline'}
                        label={savedState ? 'Saved' : 'Save event'}
                        onPress={() => toggleSave(item.id)}
                        disabled={disabled}
                        color={savedState ? c.primary : c.text}
                      />
                      {isAdmin && item.id > 0 ? (
                        <>
                          <IconButton
                            name="pencil"
                            label="Edit event"
                            onPress={() => prefillForEdit(item)}
                          />
                          <IconButton
                            name="trash"
                            label="Delete event"
                            onPress={() => deleteEvent(item.id)}
                          />
                        </>
                      ) : null}
                      <IconButton
                        name="expand-outline"
                        label="View full details"
                        onPress={() => onOpenDetails(item)}
                      />
                    </View>
                  </View>
                </View>
              </ThreeDCard>
            </View>
          );
        }}
      />

      {/* Event Details Modal */}
      <Modal
        visible={detailsOpen}
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
          <BlurView
            intensity={30}
            tint={scheme === 'dark' ? 'dark' : 'light'}
            style={{ padding: 12 }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Event details</Text>
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
          </BlurView>
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            {(() => {
              const imgs: string[] = (selectedEvent as any)?.image_urls?.length
                ? (selectedEvent as any).image_urls
                : selectedEvent?.image_url
                ? [selectedEvent.image_url]
                : [];
              if (!imgs.length) return null;
              return (
                <ScrollView
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  style={{ width: '100%', maxHeight: 240 }}
                >
                  {imgs.map((u, i) => (
                    <LazyImage
                      key={i}
                      uri={u}
                      width={320}
                      height={220}
                      borderRadius={12}
                      style={{ marginRight: 8 }}
                      accessibilityLabel={`Gallery image ${i + 1} for ${selectedEvent?.title}`}
                    />
                  ))}
                </ScrollView>
              );
            })()}
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
                {(selectedEvent?.tags ?? []).map((t, i) => (
                  <View
                    key={`${t}-${i}`}
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

      {/* Confirm Delete Modal */}
      <Modal
        visible={confirmDeleteOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isDeleting && setConfirmDeleteOpen(false)}
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
              borderRadius: 16,
              padding: 16,
              width: '100%',
              maxWidth: 420,
              borderWidth: 1,
              borderColor: '#00000020',
            }}
          >
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Delete event?</Text>
            <Text style={{ color: c.muted, marginTop: 8 }}>
              This action cannot be undone. Are you sure you want to permanently delete this event?
            </Text>
            <View
              style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}
            >
              <Pressable
                onPress={() => !isDeleting && setConfirmDeleteOpen(false)}
                style={{
                  backgroundColor: '#00000020',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={performDelete}
                disabled={isDeleting}
                style={{
                  backgroundColor: '#ef4444',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                  opacity: isDeleting ? 0.6 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Confirm delete"
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>
                  {isDeleting ? 'Deleting…' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}
