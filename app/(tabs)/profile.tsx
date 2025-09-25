import { View, Text, Pressable } from 'react-native';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import { supabase } from '@/services/supabase';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';

export default function Profile() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!mounted) return;
      setAuthed(!!user);
      setEmail(user?.email ?? null);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setAuthed(!!sess);
      setEmail(sess?.user?.email ?? null);
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
        </>
      )}
    </Container>
  );
}
