import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  useWindowDimensions,
  Alert,
  Platform,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import FoodRowCard from '@/components/FoodRowCard';
import FoodGridCard from '@/components/FoodGridCard';
import { listRestaurants, searchRestaurants, getTopUserRestaurantMatches } from '@/services/food';
import type { Restaurant } from '@/types/models';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { optimisticUpdate } from '@/utils/optimistic';
import { useSavedNotification } from '@/utils/SavedNotificationContext';

export default function FoodExplore() {
  const c = useThemeColors();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const columns = width >= 1280 ? 3 : isWide ? 2 : 1;
  // Grid sizing: cap total grid width, let columns flex equally within it
  const GAP = 12; // gap between columns
  const MAX_COL_WIDTH = 420; // max per-card width
  const MAX_GRID_WIDTH = columns * MAX_COL_WIDTH + GAP * (columns - 1);

  const [mode, setMode] = useState<'all' | 'personalized'>('personalized');
  const [view, setView] = useState<'row' | 'grid'>(isWide ? 'grid' : 'row');
  const [query, setQuery] = useState('');
  const [recommended, setRecommended] = useState<Restaurant[]>([]); // top-N
  const [items, setItems] = useState<Restaurant[]>([]); // paginated rest
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<string[]>([]);
  // Interests and filters (similar to events)
  const [isAuthed, setIsAuthed] = useState(false);
  const [myTags, setMyTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Budget filter: single max budget cap (inclusive). When at CAP means no filter.
  const BUDGET_CAP = 60; // represents 60+ (uncapped)
  const PRESETS = [10, 20, 30, 40, 50, BUDGET_CAP] as const;
  const [maxBudget, setMaxBudget] = useState<number>(BUDGET_CAP); // committed value used for filtering
  const [sliderValue, setSliderValue] = useState<number>(BUDGET_CAP); // live value while dragging
  const budgetFilterActive = maxBudget < BUDGET_CAP;
  const draggingRef = useRef(false);
  const lastValidValueRef = useRef(BUDGET_CAP);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;
  const endReachedDuringMomentum = useRef(true);

  // Location + sorting by distance
  const [sortMode, setSortMode] = useState<'default' | 'nearest'>('default');
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locAttempted, setLocAttempted] = useState(false);
  const [locLoading, setLocLoading] = useState(false);

  const toNum = (v?: string | null): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const haversineKm = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number => {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const ensureLocation = useCallback(async () => {
    if (userLocation || locLoading) return;
    setLocAttempted(true);
    setLocLoading(true);
    try {
      if (
        Platform.OS === 'web' &&
        typeof navigator !== 'undefined' &&
        (navigator as any).geolocation
      ) {
        await new Promise<void>((resolve, reject) => {
          (navigator as any).geolocation.getCurrentPosition(
            (pos: any) => {
              const { latitude, longitude } = pos.coords;
              setUserLocation({ lat: latitude, lon: longitude });
              resolve();
            },
            (err: any) => {
              reject(err);
            },
            { enableHighAccuracy: true, maximumAge: 300000, timeout: 10000 },
          );
        });
      } else {
        // Native: use expo-location (must be installed in the app)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Location: any = await import('expo-location');
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          throw new Error('Location permission denied');
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setUserLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
      }
    } catch (e: any) {
      // Only alert if user switched to nearest sort explicitly
      if (sortMode === 'nearest') {
        Alert.alert(
          'Location not available',
          'Enable location permissions to sort by nearest restaurants.',
        );
      }
    } finally {
      setLocLoading(false);
    }
  }, [userLocation, locLoading, sortMode]);

  // Attempt to fetch location when the tab is focused (one-time)
  useFocusEffect(
    useCallback(() => {
      if (!locAttempted) void ensureLocation();
      // no cleanup needed
    }, [locAttempted, ensureLocation]),
  );

  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      const authed = !!user;
      setIsAuthed(authed);
      if (!user) setMode('all');
      if (user) {
        const { data } = await supabase
          .from('user_food_interests')
          .select('names')
          .eq('user_id', user.id)
          .maybeSingle();
        const names: string[] = ((data?.names as any) ?? []).map((n: string) => n.toLowerCase());
        setMyTags(names);
        setEditTags(names);
        // Load saved restaurants for the user
        const se = await supabase
          .from('saved_restaurants')
          .select('restaurant_id')
          .eq('user_id', user.id);
        setSavedIds(((se.data ?? []) as any[]).map((r: any) => String(r.restaurant_id)));
      }
    })();
  }, []);

  const loadPage = async (p: number) => {
    setLoading(true);
    try {
      const from = p * PAGE_SIZE;
      const base = await listRestaurants(from, PAGE_SIZE);
      setItems((prev) => (p === 0 ? base : [...prev, ...base]));
      setHasMore(base.length === PAGE_SIZE);
      setPage(p + 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial: only load top-N recommended to reduce calls; defer rest to scroll
    (async () => {
      try {
        const top = await getTopUserRestaurantMatches(10);
        setRecommended(top as any);
        // On web, or if content height is too small, onEndReached may not fire.
        // Proactively load first page of the general list once recommendations arrive.
        if (page === 0 && items.length === 0 && query.trim().length < 2) {
          void loadPage(0);
        }
      } catch {}
    })();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      // clear search results, show recommended + lazy rest; don't immediately fetch rest
      setItems([]);
      setPage(0);
      setHasMore(true);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const first = await searchRestaurants(query, 0, 40);
        setItems(first);
        setHasMore(false);
      } catch {}
    }, 300);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query]);

  const onCreatePoll = async () => {
    try {
      const sel = Array.from(selected);
      if (sel.length === 0) {
        Alert.alert('Select at least one', 'Pick one or more restaurants to poll.');
        return;
      }
      // Package selected restaurants into custom poll texts: "Name • Address"
      const texts = items
        .filter((i) => sel.includes(i.id))
        .map((i) => [i.restaurant_name, i.address].filter(Boolean).join(' • '));
      router.push({ pathname: '/polls/new', params: { texts: JSON.stringify(texts) } });
    } catch (e: any) {
      Alert.alert('Could not start poll', e?.message ?? String(e));
    }
  };

  // Combined list: when not searching, show recommended first, then the rest as loaded
  const combined = useMemo(() => {
    if (query.trim().length >= 2) return items; // search results only
    if (mode !== 'personalized') return items; // no recommended section
    const recIds = new Set(recommended.map((r) => r.id));
    const rest = items.filter((i) => !recIds.has(i.id));
    return [...recommended, ...rest];
  }, [items, recommended, mode, query]);

  const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

  const { triggerNotification } = useSavedNotification();

  const requireAuth = async (): Promise<boolean> => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      return false;
    }
    return true;
  };

  const toggleSaveRestaurant = async (id: string) => {
    const ok = await requireAuth();
    if (!ok) return;
    const user = (await supabase.auth.getUser()).data.user!;
    const isSaved = savedSet.has(id);
    await optimisticUpdate({
      apply: () => {
        const prev = savedIds;
        setSavedIds((s) => (isSaved ? s.filter((x) => x !== id) : [...s, id]));
        return prev;
      },
      rollback: (prev) => setSavedIds(prev),
      mutate: async () => {
        if (isSaved) {
          const { error } = await supabase
            .from('saved_restaurants')
            .delete()
            .eq('user_id', user.id)
            .eq('restaurant_id', id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('saved_restaurants')
            .insert({ user_id: user.id, restaurant_id: id });
          if (error) throw error;
          await triggerNotification();
        }
      },
    });
  };

  // Apply filters: tag filters (AND) and max budget cap
  const filteredCombined = useMemo(() => {
    let arr = combined;
    if (activeTags.length) {
      arr = arr.filter((r) => {
        const hay = `${r.restaurant_name} ${r.category ?? ''} ${r.description ?? ''} ${
          r.address ?? ''
        }`.toLowerCase();
        for (const t of activeTags.map((x) => x.toLowerCase())) {
          if (!hay.includes(t)) return false;
        }
        return true;
      });
    }
    if (budgetFilterActive) {
      const parseUpper = (range?: string | null): number | null => {
        if (!range) return null;
        const s = String(range).replace(/[\$\s]/g, '').replace(/[–—]/g, '-');
        if (/[+]/.test(s)) {
          const m = s.match(/(\d+)/);
          return m ? Number(m[1]) : null; // treat $30+ upper as base number
        }
        const nums = s.match(/\d+/g)?.map((n) => Number(n)) ?? [];
        if (nums.length >= 2) return nums[1];
        if (nums.length === 1) return nums[0];
        const dollarCount = (String(range).match(/\$/g) || []).length;
        if (dollarCount) return dollarCount * 10; // $ => 10, $$ => 20 etc.
        return null;
      };
      arr = arr.filter((r) => {
        const upper = parseUpper(r.price_range);
        if (upper == null) return true; // keep items with unknown price
        return upper <= maxBudget;
      });
    }
    return arr;
  }, [combined, activeTags, budgetFilterActive, maxBudget]);

  // Distance-sorted list when enabled and we have a location
  const visibleData = useMemo(() => {
    if (sortMode !== 'nearest' || !userLocation) return filteredCombined;
    const { lat, lon } = userLocation;
    const withDist = filteredCombined.map((r) => {
      const rLat = toNum(r.latitude);
      const rLon = toNum(r.longitude);
      const dist = rLat != null && rLon != null ? haversineKm(lat, lon, rLat, rLon) : Infinity;
      return { r, dist } as const;
    });
    withDist.sort((a, b) => a.dist - b.dist);
    return withDist.map(({ r }) => r);
  }, [filteredCombined, sortMode, userLocation]);

  // Map of restaurant id to distance in miles for display on cards
  const distanceById = useMemo(() => {
    if (!userLocation) return {} as Record<string, number>;
    const { lat, lon } = userLocation;
    const m: Record<string, number> = {};
    for (const r of filteredCombined) {
      const rLat = toNum(r.latitude);
      const rLon = toNum(r.longitude);
      if (rLat != null && rLon != null) {
        const km = haversineKm(lat, lon, rLat, rLon);
        m[r.id] = km * 0.621371; // miles
      }
    }
    return m;
  }, [filteredCombined, userLocation]);

  const normalize = (arr: string[]) =>
    arr
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 24);

  const commitInput = (raw: string) => {
    const parts = raw
      .split(/[\n,]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (!parts.length) return;
    setEditTags((prev) => normalize([...prev, ...parts]));
  };

  const removeTag = (t: string) => setEditTags((prev) => prev.filter((x) => x !== t));

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      setSaving(false);
      return;
    }
    const arr = normalize(editTags);
    const { error } = await supabase
      .from('user_food_interests')
      .upsert({ user_id: user.id, names: arr });
    if (error) setMsg(error.message);
    else {
      setMsg(`Saved ${arr.length} interest${arr.length === 1 ? '' : 's'}.`);
      setMyTags(arr);
      setEditing(false);
    }
    setSaving(false);
  };

  // (Removed quick-add from event interests by request)

  const ListHeader = () => (
    <View>
      {/* Budget (max cap) slider */}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 12,
          marginTop: 10,
          borderWidth: 1,
          borderColor: '#00000020',
          gap: 12,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: c.text, fontWeight: '800' }}>Budget (Max)</Text>
          {budgetFilterActive ? (
            <Pressable
              onPress={() => setMaxBudget(BUDGET_CAP)}
              accessibilityLabel="Clear budget filter"
            >
              <Text style={{ color: c.muted }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <Text style={{ color: c.muted, fontSize: 13 }}>
          {sliderValue >= BUDGET_CAP ? 'Any price' : `Up to $${sliderValue}`}
        </Text>
        <Slider
          style={{ width: '100%', height: 40 }}
          minimumValue={0}
          maximumValue={BUDGET_CAP}
          step={10}
          value={sliderValue}
          onSlidingStart={() => {
            draggingRef.current = true;
          }}
          onValueChange={(v) => {
            const raw = typeof v === 'number' ? v : sliderValue;
            let snapped = Math.min(BUDGET_CAP, Math.max(0, Math.round(raw / 10) * 10));
            // Glitch guard: ignore a solitary 0 emitted at drag start when previous value is high
            if (draggingRef.current && snapped === 0 && lastValidValueRef.current >= 20) {
              return; // ignore spurious zero
            }
            if (snapped !== sliderValue) {
              setSliderValue(snapped);
            }
          }}
          onSlidingComplete={(v) => {
            draggingRef.current = false;
            const snapped = Math.min(BUDGET_CAP, Math.max(0, Math.round(v / 10) * 10));
            setSliderValue(snapped);
            setMaxBudget(snapped);
            lastValidValueRef.current = snapped;
          }}
          minimumTrackTintColor={c.primary}
          maximumTrackTintColor="#00000030"
          thumbTintColor={c.primary}
        />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => {
            const active = sliderValue === p && maxBudget === p;
            const label = p === BUDGET_CAP ? 'Any' : `$${p}`;
            return (
              <Pressable
                key={p}
                onPress={() => {
                  setSliderValue(p);
                  setMaxBudget(p);
                }}
                accessibilityLabel={`Set max budget ${label}`}
                style={{
                  backgroundColor: active ? c.primary : '#00000020',
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  borderRadius: 999,
                }}
              >
                <Text style={{ color: active ? '#000' : c.text, fontSize: 12, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Your food interests (edit + filter chips) */}
      {isAuthed && (myTags.length || editing) ? (
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            padding: 12,
            marginTop: 12,
            borderWidth: 1,
            borderColor: '#00000020',
          }}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text style={{ color: c.text, fontWeight: '800' }}>Your food interests</Text>
            <Pressable
              onPress={() => {
                setEditing((v) => !v);
                setMsg(null);
                setEditTags(myTags);
              }}
              disabled={saving}
              style={{
                backgroundColor: editing ? c.primary : '#00000020',
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: editing ? '#000' : c.text }}>
                {editing ? (saving ? 'Saving…' : 'Editing') : 'Edit'}
              </Text>
            </Pressable>
          </View>
          {editing ? (
            <View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {editTags.map((t) => (
                  <View
                    key={t}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      backgroundColor: c.primary,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>{t}</Text>
                    <Pressable onPress={() => removeTag(t)} accessibilityLabel={`Remove ${t}`}>
                      <Text style={{ color: '#000', fontWeight: '700' }}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
              <TextInput
                value={newTagInput}
                onChangeText={(val) => {
                  if (/[,\n]/.test(val)) {
                    commitInput(val);
                    setNewTagInput('');
                  } else setNewTagInput(val);
                }}
                onSubmitEditing={() => {
                  commitInput(newTagInput);
                  setNewTagInput('');
                }}
                placeholder={
                  editTags.length
                    ? 'Add another cuisine (e.g. mexican)'
                    : 'Add a cuisine (e.g. mexican)'
                }
                placeholderTextColor={c.muted}
                style={{
                  backgroundColor: '#00000020',
                  color: c.text,
                  borderRadius: 8,
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  fontSize: 14,
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable
                  onPress={save}
                  disabled={saving}
                  style={{
                    backgroundColor: saving ? c.muted : c.primary,
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 8,
                  }}
                >
                  <Text style={{ color: '#000', fontWeight: '700' }}>
                    {saving ? 'Saving…' : 'Save'}
                  </Text>
                </Pressable>
                {editTags.length ? (
                  <Pressable
                    onPress={() => setEditTags([])}
                    disabled={saving}
                    style={{
                      backgroundColor: '#00000030',
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: c.text, fontWeight: '700' }}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
              {msg ? (
                <Text
                  style={{
                    marginTop: 6,
                    color: msg.startsWith('Saved') ? c.muted : '#ff6666',
                    fontSize: 12,
                  }}
                >
                  {msg}
                </Text>
              ) : null}
            </View>
          ) : (
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
          )}
        </View>
      ) : null}
    </View>
  );

  return (
    <GradientBackground variant="dim">
      <View style={{ flex: 1, padding: 16 }}>
        <GradientHeader title="Food" />
        <View
          style={{
            backgroundColor: c.card,
            borderRadius: 12,
            paddingHorizontal: 10,
            paddingVertical: 8,
            marginTop: 12,
          }}
        >
          <TextInput
            placeholder="Search restaurants or cuisines"
            placeholderTextColor={c.muted}
            value={query}
            onChangeText={setQuery}
            style={{ color: c.text }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          <Pressable
            onPress={() => setMode('all')}
            style={{
              backgroundColor: mode === 'all' ? c.primary : c.background,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>All</Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('personalized')}
            style={{
              backgroundColor: mode === 'personalized' ? c.primary : c.background,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
            }}
          >
            <Text
              style={{
                color: mode === 'personalized' ? c.background : c.text,
                fontWeight: '700',
              }}
            >
              Personalized
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              const next = sortMode === 'nearest' ? 'default' : 'nearest';
              setSortMode(next);
              if (next === 'nearest' && !userLocation) void ensureLocation();
            }}
            style={{
              backgroundColor: sortMode === 'nearest' ? c.primary : c.background,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
            }}
            accessibilityLabel={
              sortMode === 'nearest' ? 'Disable sorting by nearest' : 'Sort by nearest'
            }
          >
            <Ionicons name="locate" size={16} color={c.text} />
            <Text
              style={{ color: sortMode === 'nearest' ? '#000' : c.text, fontWeight: '700' }}
            >
              Nearest
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setView((v) => (v === 'row' ? 'grid' : 'row'))}
            style={{
              backgroundColor: c.background,
              padding: 8,
              borderRadius: 8,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel={view === 'row' ? 'Switch to grid view' : 'Switch to list view'}
          >
            <Ionicons name={view === 'row' ? 'grid' : 'list'} size={18} color={c.text} />
          </Pressable>
          <Pressable
            onPress={onCreatePoll}
            style={{
              backgroundColor: c.primary,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>
              Poll selected ({selected.size})
            </Text>
          </Pressable>
        </View>

        {view === 'row' ? (
          <FlatList
            data={visibleData}
            key={'row'}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: 40 }}
            style={{ flex: 1 }}
            renderItem={({ item }) => {
              const sel = selected.has(item.id);
              return (
                <FoodRowCard
                  item={item}
                  matchPercent={(item as any).match_percent}
                  onOpenDetails={() => router.push(`/foods/${encodeURIComponent(item.id)}`)}
                  onSelect={() =>
                    setSelected((prev) => {
                      const next = new Set(prev);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                  selected={sel}
                  isSaved={savedSet.has(item.id)}
                  onToggleSave={toggleSaveRestaurant}
                />
              );
            }}
            onEndReachedThreshold={0.2}
            onMomentumScrollBegin={() => {
              endReachedDuringMomentum.current = false;
            }}
            onEndReached={() => {
              const allow = Platform.OS === 'web' || !endReachedDuringMomentum.current;
              if (allow) {
                endReachedDuringMomentum.current = true;
                if (!loading && hasMore && query.trim().length < 2) void loadPage(page);
              }
            }}
          />
        ) : (
          <FlatList
            data={visibleData}
            key={`grid-${columns}`}
            keyExtractor={(i) => i.id}
            numColumns={columns}
            ListHeaderComponent={ListHeader}
            columnWrapperStyle={columns > 1 ? { gap: GAP } : undefined}
            contentContainerStyle={{
              gap: 12,
              paddingTop: 12,
              paddingBottom: 40,
              alignSelf: 'center',
              maxWidth: MAX_GRID_WIDTH,
              width: '100%',
            }}
            style={{ flex: 1 }}
            renderItem={({ item, index }) => {
              const sel = selected.has(item.id);
              const total = visibleData.length;
              const rem = total % columns;
              const isLastPartialRow = columns > 1 && rem !== 0 && index >= total - rem;
              return (
                <View
                  style={
                    isLastPartialRow || total < columns
                      ? { width: MAX_COL_WIDTH, flex: 0 }
                      : { flex: 1 }
                  }
                >
                  <FoodGridCard
                    item={item}
                    matchPercent={(item as any).match_percent}
                    distanceMiles={distanceById[item.id]}
                    onOpenDetails={() => router.push(`/foods/${encodeURIComponent(item.id)}`)}
                    onSelect={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      })
                    }
                    selected={sel}
                    isSaved={savedSet.has(item.id)}
                    onToggleSave={toggleSaveRestaurant}
                  />
                </View>
              );
            }}
            onEndReachedThreshold={0.2}
            onMomentumScrollBegin={() => {
              endReachedDuringMomentum.current = false;
            }}
            onEndReached={() => {
              const allow = Platform.OS === 'web' || !endReachedDuringMomentum.current;
              if (allow) {
                endReachedDuringMomentum.current = true;
                if (!loading && hasMore && query.trim().length < 2) void loadPage(page);
              }
            }}
          />
        )}
      </View>
    </GradientBackground>
  );
}
