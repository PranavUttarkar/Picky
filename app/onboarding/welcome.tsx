import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, Modal, ScrollView, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';
import { ensureProfile } from '@/services/profile';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { Spacing, BorderRadius, Typography, Colors } from '@/theme/designTokens';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

const GOOGLE_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/120px-Google_%22G%22_logo.svg.png';

// Desktop breakpoint for responsive width
const DESKTOP_BREAKPOINT = 768;

// Required for web OAuth redirect
WebBrowser.maybeCompleteAuthSession();

type Mode = 'signIn' | 'signUp';

export default function Welcome() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const formWidth = isDesktop ? Math.min(400, width * 0.6) : '100%';
  const isDark = scheme === 'dark';
  
  const params = useLocalSearchParams<{ mode?: string }>();
  const initialMode: Mode = params.mode === 'signIn' ? 'signIn' : 'signUp';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [isAuthed, setIsAuthed] = useState<boolean>(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'apple' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);

  // Check if Apple Sign In is available (iOS 13+ only)
  useEffect(() => {
    if (Platform.OS === 'ios') {
      AppleAuthentication.isAvailableAsync().then(setAppleAuthAvailable);
    }
  }, []);

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

  // Handle OAuth redirect completion (especially for web)
  // When OAuth redirects back, Supabase automatically parses tokens and establishes session
  // We need to detect this and route the user appropriately
  // Only applies to web - native handles this explicitly after setSession()
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Only handle sign-in events from OAuth (SIGNED_IN covers OAuth completion)
      // Check for OAuth provider to avoid triggering on email/password sign-in
      if (event === 'SIGNED_IN' && session?.user) {
        const provider = session.user.app_metadata?.provider;
        // Only trigger for OAuth providers (google, apple), not email
        if (provider && provider !== 'email') {
          await handleSocialAuthSuccess();
        }
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
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
          // Check if user has completed onboarding (has username)
          const { data: userProfile } = await supabase
            .from('users')
            .select('username')
            .eq('id', data.session.user.id)
            .maybeSingle();
          
          if (userProfile?.username) {
            // Existing user with completed profile - go to home
            router.replace('/(tabs)/home');
          } else {
            // User never completed onboarding - send to profile setup
            router.replace('/onboarding/profile-setup');
          }
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

  // Handle successful social auth and redirect appropriately
  const handleSocialAuthSuccess = async () => {
    await ensureProfile();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    
    if (!user) {
      router.replace('/onboarding/welcome');
      return;
    }
    
    // Check if user has a username (existing user) or not (new user)
    const { data: userProfile } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();
    
    if (userProfile?.username) {
      // Existing user - go straight to home
      router.replace('/(tabs)/home');
    } else {
      // New user - start onboarding
      router.replace('/onboarding/profile-setup');
    }
  };

  // Get the appropriate redirect URL for OAuth
  const getOAuthRedirectUrl = () => {
    if (Platform.OS === 'web') {
      // For web, redirect back to the welcome page so auth listener can handle routing
      const win = typeof globalThis !== 'undefined' ? (globalThis as any).window : undefined;
      if (win?.location?.origin) {
        // Redirect to welcome page - Supabase adds tokens to the URL hash
        return `${win.location.origin}/onboarding/welcome`;
      }
    }
    // For native apps, use the app scheme
    return AuthSession.makeRedirectUri({
      scheme: 'picky',
      path: 'auth/callback',
    });
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setError(null);
      setInfo(null);
      setSocialLoading('google');

      const redirectUrl = getOAuthRedirectUrl();

      const { data, error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: Platform.OS !== 'web',
        },
      });

      if (signInError) throw signInError;

      if (Platform.OS !== 'web' && data?.url) {
        // Open the OAuth URL in a web browser
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        if (result.type === 'success' && result.url) {
          // Extract the tokens from the URL
          const url = new URL(result.url);
          const params = new URLSearchParams(url.hash.substring(1));
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (sessionError) throw sessionError;
            await handleSocialAuthSuccess();
          }
        }
      }
      // For web, the redirect happens automatically
    } catch (e: any) {
      setError(e?.message || 'Failed to sign in with Google');
    } finally {
      setSocialLoading(null);
    }
  };

  // Sign in with Apple (native iOS only)
  const signInWithApple = async () => {
    try {
      setError(null);
      setInfo(null);
      setSocialLoading('apple');

      if (Platform.OS === 'ios') {
        // Native Apple Sign In for iOS
        const credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });

        if (credential.identityToken) {
          const { error: signInError } = await supabase.auth.signInWithIdToken({
            provider: 'apple',
            token: credential.identityToken,
          });

          if (signInError) throw signInError;
          await handleSocialAuthSuccess();
        }
      } else {
        // Web/Android - use OAuth flow
        const redirectUrl = AuthSession.makeRedirectUri({
          scheme: 'picky',
          path: 'auth/callback',
        });

        const { data, error: signInError } = await supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: {
            redirectTo: redirectUrl,
            skipBrowserRedirect: true,
          },
        });

        if (signInError) throw signInError;

        if (data?.url) {
          const result = await WebBrowser.openAuthSessionAsync(
            data.url,
            redirectUrl
          );

          if (result.type === 'success' && result.url) {
            const url = new URL(result.url);
            const params = new URLSearchParams(url.hash.substring(1));
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (sessionError) throw sessionError;
              await handleSocialAuthSuccess();
            }
          }
        }
      }
    } catch (e: any) {
      // Apple sign in cancelled by user
      if (e?.code === 'ERR_CANCELED') {
        return;
      }
      setError(e?.message || 'Failed to sign in with Apple');
    } finally {
      setSocialLoading(null);
    }
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

      {/* Form Container - Responsive Width */}
      <View style={{ width: formWidth, alignItems: 'center' }}>
        {/* Google Sign In Button */}
          <Pressable
            onPress={signInWithGoogle}
            disabled={loading || socialLoading !== null}
            style={{
              width: '100%',
              backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
              paddingVertical: Spacing.md,
              paddingHorizontal: Spacing.lg,
              borderRadius: BorderRadius.lg,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: Spacing.md,
              opacity: loading || socialLoading !== null ? 0.6 : 1,
              borderWidth: 1,
              borderColor: isDark ? '#374151' : '#E5E7EB',
            }}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator size="small" color="#4285F4" />
            ) : (
              <>
                <Image 
                  source={{ uri: GOOGLE_LOGO_URL }}
                  style={{ width: 20, height: 20 }}
                  resizeMode="contain"
                />
                <Text style={{ 
                  color: isDark ? '#F9FAFB' : '#1F2937', 
                  fontWeight: '600', 
                  fontSize: Typography.scale.body.fontSize, 
                  fontFamily: Typography.fontFamily.body,
                }}>
                  Continue with Google
                </Text>
              </>
            )}
          </Pressable>

        {/* OR Divider */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          width: '100%', 
          marginVertical: Spacing.lg,
        }}>
          <View style={{ flex: 1, height: 1, backgroundColor: c.muted, opacity: 0.3 }} />
          <Text style={{ 
            color: c.muted, 
            paddingHorizontal: Spacing.lg, 
            fontSize: Typography.scale.caption.fontSize,
            fontFamily: Typography.fontFamily.body,
          }}>
            or
          </Text>
          <View style={{ flex: 1, height: 1, backgroundColor: c.muted, opacity: 0.3 }} />
        </View>

        {/* Email Input */}
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          placeholder="Enter email address"
          placeholderTextColor={c.muted}
          keyboardType="email-address"
          style={{
            width: '100%',
            padding: Spacing.md,
            backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
            color: c.text,
            borderRadius: BorderRadius.lg,
            marginBottom: Spacing.sm,
            fontSize: Typography.scale.body.fontSize,
            fontFamily: Typography.fontFamily.body,
            borderWidth: 1,
            borderColor: isDark ? '#374151' : '#E5E7EB',
          }}
        />

        {/* Password Input - Only show if email is entered */}
        {email.trim().length > 0 && (
          <>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={mode === 'signUp' && !isAuthed ? 'Create a password' : 'Password'}
              placeholderTextColor={c.muted}
              style={{
                width: '100%',
                padding: Spacing.md,
                backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                color: c.text,
                borderRadius: BorderRadius.lg,
                marginBottom: Spacing.sm,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                borderWidth: 1,
                borderColor: isDark ? '#374151' : '#E5E7EB',
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
                  padding: Spacing.md,
                  backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                  color: c.text,
                  borderRadius: BorderRadius.lg,
                  marginBottom: Spacing.sm,
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  borderWidth: 1,
                  borderColor: isDark ? '#374151' : '#E5E7EB',
                }}
              />
            )}
          </>
        )}

        {/* Error/Info Messages */}
        {error && <Text style={{ color: '#EF4444', marginBottom: Spacing.sm, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body, textAlign: 'center' }}>{error}</Text>}
        {info && <Text style={{ color: c.muted, marginBottom: Spacing.sm, fontSize: Typography.scale.body.fontSize, fontFamily: Typography.fontFamily.body, textAlign: 'center' }}>{info}</Text>}

        {/* Continue Button */}
        <Pressable
          onPress={onSubmit}
          disabled={loading || socialLoading !== null}
          style={{
            width: '100%',
            backgroundColor: isDark ? '#F9FAFB' : '#1F2937',
            paddingVertical: Spacing.md,
            borderRadius: BorderRadius.lg,
            alignItems: 'center',
            opacity: loading || socialLoading !== null ? 0.6 : 1,
          }}
        >
          <Text style={{ 
            color: isDark ? '#1F2937' : '#FFFFFF', 
            fontWeight: '600', 
            fontSize: Typography.scale.body.fontSize, 
            fontFamily: Typography.fontFamily.body 
          }}>
            {loading ? (mode === 'signIn' ? 'Signing in…' : 'Creating account…') : 'Continue'}
          </Text>
        </Pressable>

        {/* Terms & Privacy */}
        <Text style={{
          color: c.muted,
          fontSize: Typography.scale.caption.fontSize,
          fontFamily: Typography.fontFamily.body,
          textAlign: 'center',
          marginTop: Spacing.md,
          lineHeight: Typography.scale.caption.lineHeight,
        }}>
          By continuing, you agree to our{' '}
          <Text 
            style={{ textDecorationLine: 'underline' }}
            onPress={() => router.push('/terms')}
          >
            Terms
          </Text>
          {' '}and{' '}
          <Text
            style={{ textDecorationLine: 'underline' }}
            onPress={() => router.push('/privacy')}
          >
            Privacy Policy
          </Text>.
        </Text>

        {/* Switch mode link */}
        <Pressable 
          onPress={mode === 'signIn' ? startSignUp : startSignIn} 
          style={{ marginTop: Spacing.lg }}
        >
          <Text style={{ 
            color: c.muted, 
            fontSize: Typography.scale.body.fontSize, 
            fontFamily: Typography.fontFamily.body 
          }}>
            {mode === 'signIn' ? "Don't have an account? " : 'Already have an account? '}
            <Text style={{ textDecorationLine: 'underline' }}>
              {mode === 'signIn' ? 'Sign up' : 'Sign in'}
            </Text>
          </Text>
        </Pressable>
      </View>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrivacyModal(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: Spacing.lg,
        }}>
          <View style={{
            backgroundColor: c.background,
            borderRadius: BorderRadius.lg,
            padding: Spacing.lg,
            width: '100%',
            maxHeight: '80%',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: Spacing.lg,
            }}>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.heading3.fontSize,
                fontWeight: Typography.fontWeight.bold,
                fontFamily: Typography.fontFamily.body,
              }}>
                Privacy Policy
              </Text>
              <Pressable
                onPress={() => setShowPrivacyModal(false)}
                style={{ padding: Spacing.sm }}
              >
                <Text style={{
                  color: c.muted,
                  fontSize: Typography.scale.heading3.fontSize,
                  fontWeight: Typography.fontWeight.bold,
                }}>
                  ✕
                </Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                <Text style={{ fontWeight: Typography.fontWeight.bold }}>Last Updated: December 1, 2025</Text>
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                At Picky, we value your trust and are committed to protecting your privacy. We want you to feel comfortable and secure while discovering great experiences with your friends.
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                1. Information We Collect
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                We do not share or sell information you provide directly to us. We collect information you provide when you create an account, and usage data generated when you use our services.
                {'\n\n'}• <Text style={{ fontWeight: Typography.fontWeight.bold }}>Account Information:</Text> Your name, email address, and encrypted password.
                {'\n'}• <Text style={{ fontWeight: Typography.fontWeight.bold }}>Profile & Preferences:</Text> Your interests, dietary preferences, and location settings to help us find the best matches for you.
                {'\n'}• <Text style={{ fontWeight: Typography.fontWeight.bold }}>Activity Data:</Text> Events you save, restaurants you like, and group polls you participate in.
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                2. How We Use Your Information
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                We use your data to make your experience better:
                {'\n\n'}• To provide and improve our discovery and planning services
                {'\n'}• To personalize your event and restaurant recommendations
                {'\n'}• To facilitate group decision-making with your friends
                {'\n'}• To communicate with you about your account and updates
                {'\n'}• To analyze usage patterns and improve our platform
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                3. Third-Party Sharing & Protection
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                We may use third-party services (such as analytics tools) to improve our app. We ensure that any third-party partner, subsidiary, or related entity with access to user data provides the same or equal level of data protection as stated in this Privacy Policy and required by applicable guidelines. We do not sell your personal data to advertisers.
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                4. Data Retention & Deletion
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                We retain your personal information only for as long as your account is active or as needed to provide you with our services. You can request deletion of your account and associated data at any time through the app settings. Upon deletion, your personal data will be removed from our active databases within 30 days.
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                5. Data Security
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                We are committed to protecting your data and work hard to keep it secure. We protect your personal information against unauthorized access, alteration, disclosure, or destruction by implementing appropriate technical and organizational measures. Your passwords are encrypted and are never visible to any organizational members.
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                6. Your Rights & Consent
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                By using our app, you consent to the collection and use of your information as described in this policy. You have full control over your data and can:
                {'\n\n'}• Access and update your personal information
                {'\n'}• Manage your privacy settings and permissions
                {'\n'}• Withdraw your consent by deleting your account
                {'\n'}• Opt-out of communications
                {'\n\n'}
                We only request access to device permissions (like location) when relevant to the app's core functionality, and you can revoke these permissions at any time in your device settings.
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                7. Contact Us
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                If you have any questions about this Privacy Policy, please contact us at admin@usepicky.app
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
                fontWeight: Typography.fontWeight.bold,
              }}>
                8. Changes to This Policy
              </Text>

              <Text style={{
                color: c.text,
                fontSize: Typography.scale.body.fontSize,
                fontFamily: Typography.fontFamily.body,
                lineHeight: Typography.scale.body.lineHeight,
                marginBottom: Spacing.md,
              }}>
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
