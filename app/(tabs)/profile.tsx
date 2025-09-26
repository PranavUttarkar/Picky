import { View, Text, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { supabase } from '@/services/supabase';
import { useEffect, useState, useCallback } from 'react';
import { router } from 'expo-router';

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
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <GradientBackground contentContainerStyle={{ flex: 1, padding: 16 }}>
      {children}
    </GradientBackground>
  );

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
    if (arr.length < 1) {
      setSaveMsg('Add at least 1 interest (comma separated).');
      return;
    }
    setSaving(true);
    setSaveMsg(null);
    const { error } = await supabase
      .from('user_interests_temp')
      .upsert({ user_id: user.id, names: arr });
    if (error) {
      setSaveMsg(error.message);
    } else {
      setSaveMsg(`Saved ${arr.length} interest${arr.length === 1 ? '' : 's'}.`);
    }
    setSaving(false);
  }, [normalized, tags]);

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
                        onPress={() => removeTag(tag)}
                        accessibilityLabel={`Remove ${tag}`}
                        style={{ paddingHorizontal: 4, paddingVertical: 2 }}
                      >
                        <Text style={{ color: '#000', fontWeight: '700' }}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
                <TextInput
                  value={newTagInput}
                  onChangeText={(val) => {
                    // If user typed a comma or newline, commit accumulated input
                    if (/[\n,]/.test(val)) {
                      addTagsFromInput(val);
                      setNewTagInput('');
                    } else {
                      setNewTagInput(val);
                    }
                  }}
                  onSubmitEditing={() => {
                    addTagsFromInput(newTagInput);
                    setNewTagInput('');
                  }}
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
            <Pressable
              onPress={saveInterests}
              disabled={saving || loadingInterests}
              style={{
                marginTop: 14,
                backgroundColor: saving || loadingInterests ? c.muted : c.primary,
                padding: 12,
                borderRadius: 12,
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Save interests"
            >
              <Text style={{ color: '#000', fontWeight: '700' }}>
                {saving ? 'Saving…' : 'Save interests'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </Container>
  );
}
