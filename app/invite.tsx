import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, Alert, Animated } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { supabase } from '@/services/supabase';
import { joinGroupByCode } from '@/services/groups';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Typography, Spacing, BorderRadius, Gradients } from '@/theme/designTokens';
import GradientBackground from '@/components/GradientBackground';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function InviteRoute() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { code, quickPick } = useLocalSearchParams<{ code?: string; quickPick?: string }>();
  const [status, setStatus] = useState<'checking' | 'needs-auth' | 'joining' | 'done' | 'error'>(
    'checking',
  );
  const [error, setError] = useState<string | null>(null);
  const [inviterName, setInviterName] = useState<string | null>(null);
  
  // For the enhanced invite experience
  const isQuickPick = quickPick === 'true';

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
          if (isQuickPick) {
            await AsyncStorage.setItem('pending_quick_pick', 'true');
          }
        } catch {}
        setStatus('needs-auth');
        return;
      }
      try {
        setStatus('joining');
        const groupId = await joinGroupByCode(invite);
        setStatus('done');
        
        // If it's a quick pick session, go to voting
        if (isQuickPick) {
          router.replace(`/quick-pick/vote?groupId=${groupId}`);
        } else {
          router.replace(`/groups/${groupId}`);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Invalid or expired invite');
        setStatus('error');
      }
    })();
  }, [code, isQuickPick]);
  
  const handleSignUp = () => {
    router.replace('/onboarding/welcome?mode=signUp');
  };

  // Enhanced needs-auth screen for Quick Pick invites
  if (status === 'needs-auth') {
    return (
      <GradientBackground variant="dim">
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flex: 1, padding: Spacing.lg, alignItems: 'center', justifyContent: 'center' }}>
            {/* Hero */}
            <View style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: scheme === 'dark' ? 'rgba(255,196,148,0.15)' : 'rgba(255,111,97,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.xl,
            }}>
              <Text style={{ fontSize: 48 }}>🤝</Text>
            </View>
            
            <Text style={{
              color: c.text,
              fontSize: Typography.scale.heading2.fontSize,
              fontWeight: '700',
              fontFamily: Typography.fontFamily.displayBold,
              textAlign: 'center',
              marginBottom: Spacing.sm,
            }}>
              You're Invited!
            </Text>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.body.fontSize,
              textAlign: 'center',
              maxWidth: 280,
              lineHeight: 22,
              marginBottom: Spacing.xl,
            }}>
              {isQuickPick 
                ? "Join in 15 seconds to help pick the perfect plan together!"
                : "Create an account to join this group and start deciding together."}
            </Text>
            
            {/* Benefits */}
            <View style={{
              width: '100%',
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : '#fff',
              borderRadius: BorderRadius.lg,
              padding: Spacing.lg,
              marginBottom: Spacing.xl,
            }}>
              {[
                { icon: 'flash', text: 'Sign up in 15 seconds' },
                { icon: 'people', text: 'Vote with your friends' },
                { icon: 'sparkles', text: 'Find the perfect plan' },
              ].map((item, i) => (
                <View 
                  key={item.text}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center',
                    paddingVertical: Spacing.sm,
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderTopColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                  }}
                >
                  <View style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: c.primary + '20',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: Spacing.md,
                  }}>
                    <Ionicons name={item.icon as any} size={18} color={c.primary} />
                  </View>
                  <Text style={{
                    color: c.text,
                    fontSize: Typography.scale.body.fontSize,
                  }}>
                    {item.text}
                  </Text>
                </View>
              ))}
            </View>
            
            {/* CTA */}
            <Pressable
              onPress={handleSignUp}
              style={({ pressed }) => ({
                width: '100%',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <LinearGradient
                colors={Gradients.primary as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  paddingVertical: Spacing.md,
                  borderRadius: BorderRadius.lg,
                  alignItems: 'center',
                }}
              >
                <Text style={{
                  color: '#fff',
                  fontSize: Typography.scale.bodyLarge.fontSize,
                  fontWeight: '700',
                }}>
                  Join Now
                </Text>
              </LinearGradient>
            </Pressable>
            
            <Text style={{
              color: c.muted,
              fontSize: Typography.scale.bodySmall.fontSize,
              textAlign: 'center',
              marginTop: Spacing.md,
            }}>
              Already have an account?{' '}
              <Text 
                style={{ color: c.primary }} 
                onPress={() => router.replace('/onboarding/welcome?mode=signIn')}
              >
                Sign in
              </Text>
            </Text>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="dim">
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          padding: Spacing.lg,
        }}
      >
        {status === 'checking' || status === 'joining' ? (
          <>
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: c.primary + '20',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: Spacing.lg,
            }}>
              <ActivityIndicator size="large" color={c.primary} />
            </View>
            <Text style={{ 
              color: c.text, 
              fontSize: Typography.scale.bodyLarge.fontSize,
              fontWeight: '600',
            }}>
              {status === 'checking' ? 'Checking invite…' : 'Joining group…'}
            </Text>
          </>
        ) : status === 'error' ? (
          <>
            <Text style={{ fontSize: 48, marginBottom: Spacing.lg }}>😕</Text>
            <Text style={{ 
              color: c.text, 
              fontSize: Typography.scale.heading3.fontSize,
              fontWeight: '700',
              marginBottom: Spacing.sm,
              textAlign: 'center',
            }}>
              Oops!
            </Text>
            <Text style={{ 
              color: c.muted, 
              marginBottom: Spacing.xl,
              textAlign: 'center',
            }}>
              {error ?? 'Something went wrong'}
            </Text>
            <Pressable 
              onPress={() => router.replace('/(tabs)/home')}
              style={{
                paddingHorizontal: Spacing.xl,
                paddingVertical: Spacing.md,
                backgroundColor: c.primary,
                borderRadius: BorderRadius.lg,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Go Home</Text>
            </Pressable>
          </>
        ) : (
          <>
            <ActivityIndicator color={c.primary} />
            <Text style={{ color: c.muted, marginTop: Spacing.md }}>Redirecting…</Text>
          </>
        )}
      </View>
    </GradientBackground>
  );
}
