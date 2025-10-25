import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  useWindowDimensions,
  Alert,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import FoodRowCard from '@/components/FoodRowCard';
import FoodGridCard from '@/components/FoodGridCard';
import { listRestaurants, searchRestaurants, getTopUserRestaurantMatches } from '@/services/food';
import type { Restaurant } from '@/types/models';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';

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
  // Interests and filters (similar to events)
  const [isAuthed, setIsAuthed] = useState(false);
  const [myTags, setMyTags] = useState<string[]>([]);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Budget slider: 4 stops (0:$1-10, 1:$10-20, 2:$20-30, 3:$30+); null = no filter
  const [priceStep, setPriceStep] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 20;

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

  // Apply filters: tag filters (AND) and price tiers (OR)
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
    if (priceStep != null) {
      const bucketOf = (range?: string | null): number | null => {
        if (!range) return null;
        const s = String(range)
          .replace(/[\$\s]/g, '')
          .replace(/[–—]/g, '-');
        if (/[+]/.test(s)) return 3; // $30+
        const nums = s.match(/\d+/g)?.map((n) => Number(n)) ?? [];
        if (nums.length >= 2) {
          const mid = (nums[0] + nums[1]) / 2;
          if (mid < 10.5) return 0;
          if (mid < 20.5) return 1;
          if (mid < 30.5) return 2;
          return 3;
        } else if (nums.length === 1) {
          const n = nums[0];
          if (n <= 10) return 0;
          if (n <= 20) return 1;
          if (n <= 30) return 2;
          return 3;
        }
        // Fallback: also support legacy dollar signs like '$$'
        const dollarCount = (String(range).match(/\$/g) || []).length;
        if (dollarCount) return Math.max(0, Math.min(3, dollarCount - 1));
        return null;
      };
      arr = arr.filter((r) => {
        const b = bucketOf(r.price_range);
        return b === priceStep;
      });
    }
    return arr;
  }, [combined, activeTags, priceStep]);

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
      {/* Budget slider (4 stops) */}
      <View
        style={{
          backgroundColor: c.card,
          borderRadius: 12,
          padding: 12,
          marginTop: 10,
          borderWidth: 1,
          borderColor: '#00000020',
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text style={{ color: c.text, fontWeight: '800' }}>Budget</Text>
          {priceStep != null ? (
            <Pressable onPress={() => setPriceStep(null)} accessibilityLabel="Clear budget filter">
              <Text style={{ color: c.muted }}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={{ marginTop: 10 }}>
          {/* Track */}
          <View style={{ height: 24, justifyContent: 'center' }}>
            <View style={{ height: 4, backgroundColor: '#00000030', borderRadius: 999 }} />
            {/* Stops */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingHorizontal: 2,
              }}
            >
              {[0, 1, 2, 3].map((i) => {
                const active = priceStep === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setPriceStep((prev) => (prev === i ? null : i))}
                    accessibilityLabel={`Select budget ${
                      i === 0 ? '$1-10' : i === 1 ? '$10-20' : i === 2 ? '$20-30' : '$30+'
                    }`}
                    style={{
                      width: 28,
                      height: 28,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginHorizontal: -2,
                    }}
                  >
                    <View
                      style={{
                        width: active ? 14 : 10,
                        height: active ? 14 : 10,
                        borderRadius: 999,
                        backgroundColor: active ? c.primary : '#00000060',
                        borderWidth: active ? 2 : 0,
                        borderColor: active ? '#00000080' : 'transparent',
                      }}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
          {/* Labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {['$1-10', '$10-20', '$20-30', '$30+'].map((label, idx) => (
              <Text
                key={label}
                style={{
                  color: priceStep === idx ? c.text : c.muted,
                  fontSize: 12,
                  fontWeight: priceStep === idx ? '800' : '600',
                }}
              >
                {label}
              </Text>
            ))}
          </View>
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
            data={filteredCombined}
            key={'row'}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ gap: 10, paddingTop: 12, paddingBottom: 40 }}
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
                />
              );
            }}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (!loading && hasMore && query.trim().length < 2) loadPage(page);
            }}
          />
        ) : (
          <FlatList
            data={filteredCombined}
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
            renderItem={({ item, index }) => {
              const sel = selected.has(item.id);
              const total = filteredCombined.length;
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
                  />
                </View>
              );
            }}
            onEndReachedThreshold={0.6}
            onEndReached={() => {
              if (!loading && hasMore && query.trim().length < 2) loadPage(page);
            }}
          />
        )}
      </View>
    </GradientBackground>
  );
}
