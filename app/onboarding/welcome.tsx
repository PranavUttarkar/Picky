import { useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { ensureProfile } from '@/services/profile';
import { useThemeColors } from '@/theme/ThemeProvider';

type Mode = 'signIn' | 'signUp';

export default function Welcome() {
  const c = useThemeColors();
  const [mode, setMode] = useState<Mode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    setInfo(null);
    const trimmedEmail = email.trim().toLowerCase();
    // Allow any email domain
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (mode === 'signUp' && password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);

    try {
      if (mode === 'signIn') {
        const { data, error: err } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (err) throw err;
        if (data.session) {
          await ensureProfile();
          // If user already has interests saved, skip onboarding
          const {
            data: { user },
          } = await supabase.auth.getUser();
          let needsOnboarding = true;
          if (user) {
            const { data: uit } = await supabase
              .from('user_interests_temp')
              .select('names')
              .eq('user_id', user.id)
              .maybeSingle();
            const names = (uit?.names as string[] | null) ?? [];
            needsOnboarding = !Array.isArray(names) || names.length < 2;
          }
          router.replace(needsOnboarding ? '/onboarding/interests' : '/(tabs)/home');
        } else {
          // Rare: no session; show fallback message
          setInfo("Signed in. If you aren't redirected, please try again.");
        }
      } else {
        const { data, error: err } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
        });
        if (err) {
          // Common Supabase message when account exists
          if (err.message?.toLowerCase().includes('already registered')) {
            setError('An account with this email already exists. Try signing in.');
          } else {
            setError(err.message);
          }
        } else if (data.session) {
          // Email confirmations disabled -> session immediately available
          await ensureProfile();
          // New user won't have interests yet; send to interests
          router.replace('/onboarding/interests');
        } else {
          // Email confirmations enabled
          setInfo(
            'We sent a confirmation email. Please verify your address, then come back to sign in.',
          );
        }
      }
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startSignUp = () => {
    setMode('signUp');
    setError(null);
    setInfo(null);
  };
  const startSignIn = () => {
    setMode('signIn');
    setError(null);
    setInfo(null);
  };

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
      <Text
        style={{
          color: c.text,
          fontSize: 36,
          fontWeight: '800',
          marginBottom: 12,
        }}
      >
        Picky
      </Text>
      <Text style={{ color: c.muted, fontSize: 16, marginBottom: 24 }}>
        Discover events. Decide together.
      </Text>

      {/* Simple actions: Create account / Sign in */}
      {/* <View style={{ width: "100%", marginBottom: 8 }}>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
          <Pressable
            onPress={startSignUp}
            style={{
              flex: 1,
              backgroundColor: mode === "signUp" ? c.primary : c.card,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: mode === "signUp" ? "#000" : c.text, fontWeight: "700" }}>
              Create account
            </Text>
          </Pressable>
          <Pressable
            onPress={startSignIn}
            style={{
              flex: 1,
              backgroundColor: mode === "signIn" ? c.primary : c.card,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: mode === "signIn" ? "#000" : c.text, fontWeight: "700" }}>
              Sign in
            </Text>
          </Pressable>
        </View>
      </View> */}

      <TextInput
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        placeholder="your@email.com"
        placeholderTextColor={c.muted}
        keyboardType="email-address"
        style={{
          width: '100%',
          padding: 14,
          backgroundColor: c.card,
          color: c.text,
          borderRadius: 12,
          marginBottom: 12,
        }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={mode === 'signUp' ? 'Create a password' : 'Password'}
        placeholderTextColor={c.muted}
        style={{
          width: '100%',
          padding: 14,
          backgroundColor: c.card,
          color: c.text,
          borderRadius: 12,
          marginBottom: 12,
        }}
      />
      {mode === 'signUp' && (
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Confirm password"
          placeholderTextColor={c.muted}
          style={{
            width: '100%',
            padding: 14,
            backgroundColor: c.card,
            color: c.text,
            borderRadius: 12,
            marginBottom: 12,
          }}
        />
      )}

      {error && <Text style={{ color: c.accent, marginBottom: 8 }}>{error}</Text>}
      {info && <Text style={{ color: c.muted, marginBottom: 8 }}>{info}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{
          width: '100%',
          backgroundColor: c.primary,
          padding: 14,
          borderRadius: 12,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#000', fontWeight: '700' }}>
          {loading
            ? mode === 'signIn'
              ? 'Signing in…'
              : 'Signing up…'
            : mode === 'signIn'
            ? 'Sign In'
            : 'Create account'}
        </Text>
      </Pressable>

      {/* Helper link to switch if needed */}
      <Pressable onPress={mode === 'signIn' ? startSignUp : startSignIn} style={{ marginTop: 16 }}>
        <Text style={{ color: c.muted }}>
          {mode === 'signIn'
            ? "Don't have an account? Create one"
            : 'Already have an account? Sign in'}
        </Text>
      </Pressable>
    </View>
  );
}
