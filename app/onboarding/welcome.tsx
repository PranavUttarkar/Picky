import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';
import { ensureProfile } from '@/services/profile';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Spacing, BorderRadius, Typography, Colors } from '@/theme/designTokens';

type Mode = 'signIn' | 'signUp';

export default function Welcome() {
  const c = useThemeColors();
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = params.mode === 'signIn' ? 'signIn' : 'signUp';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Check auth state to decide whether to allow sign-up UI
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const authed = !!user;
      setIsAuthed(authed);
      // If already signed in, ensure we are not in sign-up mode
      if (authed && mode === 'signUp') setMode('signIn');
    })();
  }, []);

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
    // Prevent creating accounts if already signed in
    if (isAuthed && mode === 'signUp') {
      setInfo('You are already signed in.');
      setMode('signIn');
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
          router.replace(needsOnboarding ? '/onboarding/profile-setup' : '/(tabs)/home');
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
          // New user needs to set up profile first
          router.replace('/onboarding/profile-setup');
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
    if (isAuthed) {
      setInfo('You are already signed in.');
      setMode('signIn');
    } else {
      setMode('signUp');
    }
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
        padding: Spacing.lg,
      }}
    >
      {/* Back button to return to Home */}
      <Pressable
        onPress={() => router.replace('/home')}
        style={{ position: 'absolute', top: Spacing['2xl'], left: Spacing.lg, padding: Spacing.sm }}
        accessibilityRole="button"
        accessibilityLabel="Go back to Home"
      >
        <Text style={{ color: c.primary, fontWeight: Typography.fontWeight.bold, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>Back</Text>
      </Pressable>
      <Text
        style={{
          color: c.text,
          fontSize: 42,
          lineHeight: 50,
          fontWeight: Typography.fontWeight.regular,
          marginBottom: Spacing.md,
          // @ts-ignore - font loaded globally
          fontFamily: Typography.fontFamily.brand,
        }}
      >
        Picky!
      </Text>
      <Text style={{ 
        color: c.muted, 
        fontSize: Typography.scale.heading3.fontSize, 
        lineHeight: Typography.scale.heading3.lineHeight, 
        fontFamily: Typography.fontFamily.body,
        fontWeight: Typography.fontWeight.medium,
        marginBottom: Spacing['2xl'],
        textAlign: 'center',
      }}>
        Find it All. Decide Fast. Have Fun Together.
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
          padding: Spacing.md - 2,
          backgroundColor: c.card,
          color: c.text,
          borderRadius: BorderRadius.md,
          marginBottom: Spacing.md - 4,
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
        }}
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder={mode === 'signUp' && !isAuthed ? 'Create a password' : 'Password'}
        placeholderTextColor={c.muted}
        style={{
          width: '100%',
          padding: Spacing.md - 2,
          backgroundColor: c.card,
          color: c.text,
          borderRadius: BorderRadius.md,
          marginBottom: Spacing.md - 4,
          fontSize: Typography.scale.body.fontSize,
          fontFamily: Typography.fontFamily.body,
        }}
      />
      {mode === 'signUp' && !isAuthed && (
        <TextInput
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          placeholder="Confirm password"
          placeholderTextColor={c.muted}
          style={{
            width: '100%',
            padding: Spacing.md - 2,
            backgroundColor: c.card,
            color: c.text,
            borderRadius: BorderRadius.md,
            marginBottom: Spacing.md - 4,
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
          }}
        />
      )}

      {error && <Text style={{ color: Colors.light.accent.warning, marginBottom: Spacing.sm, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>{error}</Text>}
      {info && <Text style={{ color: c.muted, marginBottom: Spacing.sm, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>{info}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={loading}
        style={{
          width: '100%',
          backgroundColor: c.primary,
          padding: Spacing.md - 2,
          borderRadius: BorderRadius.md,
          alignItems: 'center',
        }}
      >
        {(() => {
          const label = (() => {
            if (loading) {
              if (mode === 'signIn') return 'Signing in…';
              return isAuthed ? 'Continuing…' : 'Signing up…';
            }
            if (mode === 'signIn') return 'Sign In';
            return isAuthed ? 'Sign In' : 'Create account';
          })();
          return <Text style={{ color: '#FFFFFF', fontWeight: Typography.fontWeight.bold, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>{label}</Text>;
        })()}
      </Pressable>

      {/* Helper link to switch if needed; hide Create link for signed-in users */}
      {mode === 'signIn' ? (
        !isAuthed ? (
          <Pressable onPress={startSignUp} style={{ marginTop: Spacing.md }}>
            <Text style={{ textDecorationLine: 'underline', color: c.muted, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>
              {"Don't have an account? Create one"}
            </Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: Spacing.md }}>
            <Text style={{ color: c.muted, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>You are signed in. Continue to Home</Text>
          </Pressable>
        )
      ) : (
        <Pressable onPress={startSignIn} style={{ marginTop: Spacing.md }}>
          <Text style={{ textDecorationLine: 'underline', color: c.muted, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body }}>
            Already have an account? Sign in
          </Text>
        </Pressable>
      )}
    </View>
  );
}
