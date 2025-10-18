import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import GradientHeader from '@/components/GradientHeader';
import { supabase } from '@/services/supabase';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, useCallback, memo, useRef } from 'react';
import { router } from 'expo-router';

// Hoisted components to avoid remounting on each keystroke
function Container({ children }: { children: React.ReactNode }) {
  return (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 16 }}>
      <AnimatedPage variant="pop" style={{ flex: 1 }}>
        {children}
      </AnimatedPage>
    </GradientBackground>
  );
}

const TagList = memo(function TagList({
  tags,
  onRemove,
}: {
  tags: string[];
  onRemove: (t: string) => void;
}) {
  const c = useThemeColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 10,
      }}
    >
      {tags.map((tag) => (
        <View
          key={tag}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 10,
            paddingVertical: 4,
            backgroundColor: c.primary,
            borderRadius: 999,
            gap: 4,
          }}
        >
          <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>{tag}</Text>
          <Pressable
            onPress={() => onRemove(tag)}
            accessibilityLabel={`Remove ${tag}`}
            style={{ paddingHorizontal: 4, paddingVertical: 2 }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>×</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
});

export default function Profile() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  // Legacy CSV representation kept for backwards compat (used only when loading)
  const [interestsCsv, setInterestsCsv] = useState('');
  // Normalized tag list state
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const lastSavedRef = useRef<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!mounted) return;
      setAuthed(!!user);
      setEmail(user?.email ?? null);
      if (user) {
        // Load interests
        setLoadingInterests(true);
        const { data } = await supabase
          .from('user_interests_temp')
          .select('names')
          .eq('user_id', user.id)
          .maybeSingle();
        const names: string[] = ((data?.names as any) ?? []).map((n: string) => n.toLowerCase());
        setInterestsCsv(names.join(', '));
        setTags(names);
        lastSavedRef.current = names;
        setLoadingInterests(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setAuthed(!!sess);
      setEmail(sess?.user?.email ?? null);
      if (sess?.user) {
        (async () => {
          setLoadingInterests(true);
          const { data } = await supabase
            .from('user_interests_temp')
            .select('names')
            .eq('user_id', sess.user!.id)
            .maybeSingle();
          const names: string[] = ((data?.names as any) ?? []).map((n: string) => n.toLowerCase());
          setInterestsCsv(names.join(', '));
          setTags(names);
          lastSavedRef.current = names;
          setLoadingInterests(false);
        })();
      } else {
        setInterestsCsv('');
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  // (Container hoisted to top-level to avoid remount on local state changes)

  // Ensure tag list uniqueness & cap
  const normalized = useCallback(
    (items: string[]) =>
      items
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .filter((v, i, a) => a.indexOf(v) === i)
        .slice(0, 24),
    [],
  );

  const addTagsFromInput = useCallback(
    (raw: string) => {
      if (!raw) return;
      const split = raw
        .split(/[\n,]/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      if (!split.length) return;
      setTags((prev) => normalized([...prev, ...split]));
    },
    [normalized],
  );

  const removeTag = useCallback((t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  }, []);

  const saveInterests = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      return;
    }
    const arr = normalized(tags);
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from('user_interests_temp')
      .upsert({ user_id: user.id, names: arr });
    if (error) {
      setSaveMsg(error.message);
    } else {
      setSaveMsg(`Saved ${arr.length} interest${arr.length === 1 ? '' : 's'}.`);
      lastSavedRef.current = arr;
    }
    setSaving(false);
  }, [normalized, tags]);

  // Debounced autosave when tags change, avoiding initial hydration saves
  useEffect(() => {
    // Skip while loading initial interests
    if (loadingInterests) return;

    const current = normalized(tags);
    const prev = lastSavedRef.current;
    const equal = current.length === prev.length && current.every((v, i) => v === prev[i]);
    if (equal) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void saveInterests();
    }, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [tags, loadingInterests, normalized, saveInterests]);

  // Memoized handlers to keep TextInput from causing broad re-renders
  const handleChangeText = useCallback(
    (val: string) => {
      if (/\[\n,\]/.test(val)) {
        addTagsFromInput(val);
        setNewTagInput('');
      } else {
        setNewTagInput(val);
      }
    },
    [addTagsFromInput],
  );

  const handleSubmitEditing = useCallback(
    (e: any) => {
      const text = e?.nativeEvent?.text ?? newTagInput;
      if (text) {
        addTagsFromInput(text);
        setNewTagInput('');
      }
    },
    [addTagsFromInput, newTagInput],
  );

  // (TagList hoisted to top-level to avoid remount on local state changes)

  return (
    <Container>
      <GradientHeader title="Your Profile" />
      {authed === false && (
        <>
          <Text style={{ color: c.muted, marginBottom: 12 }}>You’re not signed in.</Text>
          <Pressable
            onPress={() => router.push('/onboarding/welcome')}
            style={{
              backgroundColor: c.primary,
              padding: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign up or sign in"
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Sign up or sign in</Text>
          </Pressable>
        </>
      )}

      {authed && (
        <>
          {email ? (
            <Text style={{ color: c.muted, marginBottom: 12 }}>Signed in as {email}</Text>
          ) : null}
          {/* Saved events button moved below interests section */}
          <Pressable
            onPress={() => supabase.auth.signOut()}
            style={{
              backgroundColor: c.primary,
              padding: 12,
              borderRadius: 12,
              alignItems: 'center',
            }}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Sign out</Text>
          </Pressable>
          {/* Interests Editor (inline tags) */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
              Your interests
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
              Add interests separated by commas. Press Enter or type a comma to turn text into a
              tag. Tap a tagʼs × to remove it. Up to 24.
            </Text>
            {loadingInterests ? (
              <View
                style={{
                  backgroundColor: '#00000015',
                  padding: 16,
                  borderRadius: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <ActivityIndicator />
                <Text style={{ color: c.muted }}>Loading interests…</Text>
              </View>
            ) : (
              <View>
                <TagList tags={tags} onRemove={removeTag} />
                <TextInput
                  value={newTagInput}
                  onChangeText={handleChangeText}
                  onSubmitEditing={handleSubmitEditing}
                  placeholder={tags.length ? 'Add another interest' : 'Add an interest'}
                  placeholderTextColor={c.muted}
                  style={{
                    backgroundColor: '#00000015',
                    color: c.text,
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  blurOnSubmit={false}
                  returnKeyType="done"
                />
                {tags.length ? (
                  <Pressable
                    onPress={() => setTags([])}
                    style={{ marginTop: 8, alignSelf: 'flex-start', padding: 4 }}
                    accessibilityLabel="Clear all interests"
                  >
                    <Text style={{ color: c.muted, fontSize: 12 }}>Clear all</Text>
                  </Pressable>
                ) : null}
              </View>
            )}

            {saveMsg ? (
              <Text
                style={{ color: saveMsg.startsWith('Saved') ? c.muted : '#ff6666', marginTop: 8 }}
              >
                {saveMsg}
              </Text>
            ) : null}
            {saving ? (
              <View
                style={{
                  marginTop: 10,
                  backgroundColor: '#00000015',
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ color: c.muted }}>Saving…</Text>
              </View>
            ) : null}

            {/* Saved events button moved here (swap with deprecated Save Interests) */}
            <Pressable
              onPress={() => router.push('/(tabs)/saved')}
              style={{
                marginTop: 14,
                backgroundColor: c.accent,

                padding: 12,
                borderRadius: 12,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Open saved events"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="bookmark" size={18} color={c.text} />
                <Text style={{ color: c.text, fontWeight: '700' }}>View Saved</Text>
              </View>
            </Pressable>
            {/* My Events (created by me) */}
            <Pressable
              onPress={() => router.push('/(tabs)/my-events')}
              style={{
                marginTop: 10,
                backgroundColor: '#00000030',
                padding: 12,
                borderRadius: 12,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="View events you've created"
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="create" size={18} color={c.text} />
                <Text style={{ color: c.text, fontWeight: '700' }}>My Events</Text>
              </View>
            </Pressable>
          </View>
        </>
      )}
    </Container>
  );
}
