import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { joinGroupByCode } from '@/services/groups';

export default function InviteRoute() {
  const c = useThemeColors();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [status, setStatus] = useState<'checking' | 'needs-auth' | 'joining' | 'done' | 'error'>(
    'checking',
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const invite = (code || '').toString().trim();
      if (!invite) {
        setError('Missing invite code');
        setStatus('error');
        return;
      }
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        // store pending invite and send to sign up
        try {
          await AsyncStorage.setItem('pending_invite_code', invite);
        } catch {}
        setStatus('needs-auth');
        router.replace('/onboarding/welcome?mode=signUp');
        return;
      }
      try {
        setStatus('joining');
        const groupId = await joinGroupByCode(invite);
        setStatus('done');
        router.replace(`/groups/${groupId}`);
      } catch (e: any) {
        setError(e?.message ?? 'Invalid or expired invite');
        setStatus('error');
      }
    })();
  }, [code]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: c.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {status === 'checking' || status === 'joining' ? (
        <>
          <ActivityIndicator color={c.primary} />
          <Text style={{ color: c.muted, marginTop: 12 }}>
            {status === 'checking' ? 'Checking invite…' : 'Joining group…'}
          </Text>
        </>
      ) : status === 'needs-auth' ? (
        <>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 18, textAlign: 'center' }}>
            Create an account to join this group
          </Text>
          <Pressable
            onPress={() => router.replace('/onboarding/welcome?mode=signUp')}
            style={{ marginTop: 12, backgroundColor: c.primary, padding: 12, borderRadius: 10 }}
          >
            <Text style={{ color: '#000', fontWeight: '700' }}>Continue</Text>
          </Pressable>
        </>
      ) : status === 'error' ? (
        <>
          <Text style={{ color: c.accent, marginBottom: 12 }}>
            {error ?? 'Something went wrong'}
          </Text>
          <Pressable onPress={() => router.replace('/(tabs)/home')}>
            <Text style={{ color: c.primary, textDecorationLine: 'underline' }}>Go Home</Text>
          </Pressable>
        </>
      ) : (
        <Text style={{ color: c.text }}>Redirecting…</Text>
      )}
    </View>
  );
}
