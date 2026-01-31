import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useThemeColors } from '@/theme/ThemeProvider';

/**
 * Default route: checks auth state and onboarding status
 * - If not authenticated -> onboarding/welcome
 * - If authenticated but no username (new user) -> onboarding/profile-setup
 * - If authenticated with username -> home
 */
export default function Index() {
  const c = useThemeColors();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuthAndOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          // Not authenticated - go to welcome
          router.replace('/onboarding/welcome');
          return;
        }

        // User is authenticated - check if they completed onboarding (have a username)
        const { data: userProfile } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle();

        if (userProfile?.username) {
          // Existing user with completed profile - go to home
          router.replace('/(tabs)/home');
        } else {
          // User never completed onboarding - send to profile setup
          router.replace('/onboarding/profile-setup');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // On error, default to welcome screen
        router.replace('/onboarding/welcome');
      } finally {
        setChecking(false);
      }
    };

    checkAuthAndOnboarding();
  }, []);

  // Show loading while checking auth state
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}
