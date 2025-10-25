import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, ScrollView, Animated } from 'react-native';
import { router } from 'expo-router';
import { useThemeColors } from '@/theme/ThemeProvider';
import { getOnboarding, saveOnboarding } from '@/services/profile';
import { supabase } from '@/services/supabase';

const POPULAR_INTERESTS = [
  'Live Music',
  'Sports',
  'Food',
  'Tech',
  'Hackathons',
  'Art & Museums',
  'Careers',
  'Outdoors',
  'Culture',
  'Fitness',
  'Business',
  'Entrepreneurship',
  'CS',
  'Engineering',
];

// Majors removed per request

const FOOD_RESTRICTIONS = ['Vegetarian', 'Vegan', 'Gluten‑free', 'Dairy‑free', 'Nut‑free'];

// Quick-add cuisines for food interests
const POPULAR_FOOD_INTERESTS = [
  'Mexican',
  'Italian',
  'Chinese',
  'Indian',
  'Thai',
  'Japanese',
  'Mediterranean',
  'Korean',
  'BBQ',
  'Vegan',
  'Vegetarian',
  'Halal',
];

const QUICK_PREFS: { key: string; label: string }[] = [
  { key: 'budget_friendly', label: 'Budget‑friendly' },
  { key: 'outdoorsy', label: 'Outdoorsy' },
  { key: 'indoors', label: 'Indoors' },
  { key: 'morning_person', label: 'Morning' },
  { key: 'family_friendly', label: 'Chill / Low‑key' },
  { key: 'high_energy', label: 'High energy' },
];

export default function Interests() {
  const c = useThemeColors();
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterests, setCustomInterests] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  // majors removed
  const [foods, setFoods] = useState<string[]>([]);
  const [foodInterests, setFoodInterests] = useState<string[]>([]);
  const [foodCustomInput, setFoodCustomInput] = useState('');
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  // Prefill from existing onboarding data, or redirect if already completed
  useEffect(() => {
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const data = await getOnboarding();
      if (data?.completed_at && (data.interests?.length ?? 0) >= 2) {
        router.replace('/(tabs)/home');
        return;
      }
      if (data) {
        setInterests(Array.isArray(data.interests) ? data.interests : []);
        setCustomInterests(Array.isArray(data.custom_interests) ? data.custom_interests : []);
        setFoods(Array.isArray(data.food_restrictions) ? data.food_restrictions : []);
        const p: Record<string, boolean> = {};
        const src = (data.preferences ?? {}) as Record<string, any>;
        QUICK_PREFS.forEach(({ key }) => (p[key] = !!src[key]));
        setPrefs(p);
      }
    })();
  }, []);

  const toggle = (arr: string[], setArr: (v: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((i) => i !== value) : [...arr, value]);
  };

  const onAddCustom = () => {
    const v = customInput.trim();
    if (!v) return;
    if (!customInterests.includes(v)) setCustomInterests([...customInterests, v]);
    if (!interests.includes(v)) setInterests([...interests, v]);
    setCustomInput('');
  };

  const onAddFoodCustom = () => {
    const v = foodCustomInput.trim();
    if (!v) return;
    const next = Array.from(new Set([...foodInterests, v]));
    setFoodInterests(next);
    setFoodCustomInput('');
  };

  const minOk = useMemo(() => interests.length >= 2, [interests.length]);
  const remaining = useMemo(() => Math.max(0, 2 - interests.length), [interests.length]);
  const shake = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 1, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 40, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  };

  const onContinue = async () => {
    if (!minOk || saving) return;
    setSaving(true);
    try {
      await saveOnboarding({
        interests,
        majors: [],
        custom_interests: customInterests,
        food_restrictions: foods,
        preferences: prefs,
        complete: true,
      });
      // Also persist food interests into dedicated table
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const normalized = Array.from(
          new Set(foodInterests.map((s) => s.trim().toLowerCase()).filter(Boolean)),
        ).slice(0, 24);
        await supabase
          .from('user_food_interests')
          .upsert({ user_id: user.id, names: normalized }, { onConflict: 'user_id' });
      }
      router.replace('/onboarding/group');
    } catch (e) {
      // swallow for now
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ padding: 16 }}
    >
      <View style={{ height: 16 }} />
      <Text style={{ color: c.text, fontSize: 24, fontWeight: '800' }}>Let’s personalize!</Text>
      <Text style={{ color: c.muted, marginTop: 4, marginBottom: 12 }}>
        Tap to quick add interests. you can also add custom interests.
      </Text>

      {/* Popular interests */}
      <Text style={{ color: c.text, fontWeight: '800', marginTop: 8, marginBottom: 8 }}>
        Popular interests
      </Text>
      <FlatList
        data={POPULAR_INTERESTS}
        numColumns={3}
        keyExtractor={(i) => i}
        columnWrapperStyle={{ gap: 8 }}
        contentContainerStyle={{ gap: 8 }}
        renderItem={({ item }) => {
          const active = interests.includes(item);
          return (
            <Pressable
              onPress={() => toggle(interests, setInterests, item)}
              style={{
                flex: 1,
                padding: 10,
                borderRadius: 12,
                alignItems: 'center',
                backgroundColor: active ? c.primary : c.card,
                borderWidth: 1,
                borderColor: active ? 'transparent' : c.muted,
              }}
            >
              <Text
                style={{ color: active ? '#000' : c.text, fontWeight: '700', textAlign: 'center' }}
              >
                {item}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Food interests quick add */}
      <Text style={{ color: c.text, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>
        Food interests
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {POPULAR_FOOD_INTERESTS.map((fi) => {
          const active = foodInterests.includes(fi);
          return (
            <Pressable
              key={fi}
              onPress={() => toggle(foodInterests, setFoodInterests, fi)}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? c.primary : c.card,
                borderWidth: 1,
                borderColor: active ? 'transparent' : c.muted,
              }}
            >
              <Text style={{ color: active ? '#000' : c.text }}>{fi}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Add custom food interests */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
          Add custom food interests
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={foodCustomInput}
            onChangeText={setFoodCustomInput}
            placeholder="e.g., ramen, sushi"
            placeholderTextColor={c.muted}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: c.card,
              color: c.text,
              borderRadius: 12,
            }}
            returnKeyType="done"
            onSubmitEditing={onAddFoodCustom}
          />
          <Pressable
            onPress={onAddFoodCustom}
            style={{
              paddingHorizontal: 14,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.primary,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>Add</Text>
          </Pressable>
        </View>
        {foodInterests.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {foodInterests.map((ci) => {
              const active = true; // chips just display added items; tap toggles remove
              return (
                <Pressable
                  key={ci}
                  onPress={() => setFoodInterests((prev) => prev.filter((x) => x !== ci))}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: active ? c.primary : c.card,
                    borderWidth: 1,
                    borderColor: active ? 'transparent' : c.muted,
                  }}
                >
                  <Text style={{ color: active ? '#000' : c.text }}>{ci}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Preferences */}
      <Text style={{ color: c.text, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>
        Preferences
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {QUICK_PREFS.map(({ key, label }) => {
          const active = !!prefs[key];
          return (
            <Pressable
              key={key}
              onPress={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))}
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 999,
                backgroundColor: active ? c.primary : c.card,
              }}
            >
              <Text style={{ color: active ? '#000' : c.text }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Add your own (moved below preferences) */}
      <View style={{ marginTop: 12 }}>
        <Text style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>
          Add custom event interests
        </Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={customInput}
            onChangeText={setCustomInput}
            placeholder="e.g., Salsa dancing"
            placeholderTextColor={c.muted}
            style={{
              flex: 1,
              padding: 12,
              backgroundColor: c.card,
              color: c.text,
              borderRadius: 12,
            }}
            returnKeyType="done"
            onSubmitEditing={onAddCustom}
          />
          <Pressable
            onPress={onAddCustom}
            style={{
              paddingHorizontal: 14,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.primary,
            }}
          >
            <Text style={{ color: '#000', fontWeight: '800' }}>Add</Text>
          </Pressable>
        </View>
        {customInterests.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {customInterests.map((ci) => {
              const active = interests.includes(ci);
              return (
                <Pressable
                  key={ci}
                  onPress={() => toggle(interests, setInterests, ci)}
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 10,
                    borderRadius: 999,
                    backgroundColor: active ? c.primary : c.card,
                  }}
                >
                  <Text style={{ color: active ? '#000' : c.text }}>{ci}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {/* Food restrictions section commented out per request */}
      {false && (
        <>
          <Text style={{ color: c.text, fontWeight: '800', marginTop: 16, marginBottom: 8 }}>
            Food restrictions
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FOOD_RESTRICTIONS.map((f) => {
              const active = foods.includes(f);
              return (
                <Pressable
                  key={f}
                  onPress={() => toggle(foods, setFoods, f)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    backgroundColor: active ? c.primary : c.card,
                  }}
                >
                  <Text style={{ color: active ? '#000' : c.text }}>{f}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {/* Continue */}
      <Animated.View
        style={{
          transform: [
            {
              translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }),
            },
          ],
        }}
      >
        <Pressable
          onPress={() => {
            if (saving) return;
            if (!minOk) {
              triggerShake();
              return;
            }
            onContinue();
          }}
          accessibilityRole="button"
          accessibilityLabel={minOk ? 'Continue' : 'Select at least two interests to continue'}
          accessibilityHint={minOk ? undefined : 'Add more interests to enable this button'}
          accessibilityState={{ disabled: !minOk || saving }}
          style={{
            marginTop: 20,
            backgroundColor: !minOk ? c.muted : c.primary,
            padding: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: saving ? 0.7 : 1,
          }}
        >
          <Text style={{ color: '#000', fontWeight: '800' }}>
            {saving
              ? 'Saving…'
              : minOk
              ? 'Continue'
              : remaining === 1
              ? 'Choose 1 more interest'
              : 'Choose 2+ interests'}
          </Text>
        </Pressable>
      </Animated.View>
      <Text
        style={{
          color: c.muted,
          marginTop: 20,
          marginBottom: 12,
          textAlign: 'center',
          opacity: 0.6,
        }}
      >
        {'(More interests = Better recs!)'}
      </Text>
    </ScrollView>
  );
}
