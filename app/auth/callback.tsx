import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';
import { ensureProfile } from '@/services/profile';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Typography } from '@/theme/designTokens';

/**
 * OAuth callback handler for web.
 * Handles the redirect from Google/Apple sign-in and extracts tokens from URL.
 */
export default function AuthCallback() {
  const c = useThemeColors();
  const params = useLocalSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // For web, Supabase automatically handles the hash fragment
        // We just need to wait for the session to be established
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Auth callback error:', error);
          router.replace('/onboarding/welcome');
          return;
        }

        if (session) {
          await ensureProfile();
          
          const { data: { user } } = await supabase.auth.getUser();
          
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
        } else {
          // No session found, redirect back to welcome
          router.replace('/onboarding/welcome');
        }
      } catch (e) {
        console.error('Auth callback exception:', e);
        router.replace('/onboarding/welcome');
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={{
      flex: 1,
      backgroundColor: c.background,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
    }}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={{
        color: c.text,
        fontSize: Typography.scale.body.fontSize,
        fontFamily: Typography.fontFamily.body,
      }}>
        Completing sign in...
      </Text>
    </View>
  );
}

