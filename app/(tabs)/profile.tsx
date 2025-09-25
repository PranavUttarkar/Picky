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
  const [interestsCsv, setInterestsCsv] = useState('');
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
        const names: string[] = (data?.names as any) ?? [];
        setInterestsCsv(names.join(', '));
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
          const names: string[] = (data?.names as any) ?? [];
          setInterestsCsv(names.join(', '));
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

  const parsedInterests = useCallback((): string[] => {
    return interestsCsv
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 24); // safety cap
  }, [interestsCsv]);

  const saveInterests = useCallback(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      router.push('/onboarding/welcome');
      return;
    }
    const arr = parsedInterests();
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
  }, [parsedInterests, interestsCsv]);

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
          {/* Interests CSV Editor */}
          <View style={{ marginTop: 28 }}>
            <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: 6 }}>
              Your interests
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, marginBottom: 8 }}>
              Edit as a comma separated list (e.g. Music, Food, Tech). Duplicates removed
              automatically.
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
              <TextInput
                value={interestsCsv}
                onChangeText={setInterestsCsv}
                placeholder="Add interests separated by commas"
                placeholderTextColor={c.muted}
                multiline
                style={{
                  minHeight: 80,
                  backgroundColor: '#00000015',
                  color: c.text,
                  borderRadius: 12,
                  padding: 12,
                  textAlignVertical: 'top',
                  fontSize: 14,
                }}
              />
            )}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {parsedInterests().map((tag) => (
                <View
                  key={tag}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    backgroundColor: c.primary,
                    borderRadius: 999,
                  }}
                >
                  <Text style={{ color: '#000', fontSize: 12, fontWeight: '700' }}>{tag}</Text>
                </View>
              ))}
            </View>
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
