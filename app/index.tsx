import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabase';
import { useThemeColors } from '@/theme/ThemeProvider';

/**
 * Default route: checks auth state and onboarding status
 * - If authenticated but no username (new user) -> onboarding/profile-setup
 * - If authenticated with username -> home
 */
export default function Index() {
  const c = useThemeColors();

  useEffect(() => {
    const checkAuthAndOnboarding = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // There is no remote work on the signed-out path.
          router.replace('/home');
          return;
        }

        // Do not keep the launch screen up while this network request is in flight.
        // On a cold launch this was the only thing preventing the app from rendering,
        // so a slow/unavailable Supabase connection looked like the app had frozen.
        // Home already renders a loading state for its own data, and we redirect new
        // accounts as soon as this check completes.
        router.replace('/(tabs)/home');

        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('username')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!profileError && !userProfile?.username) {
          // New users still continue straight to profile setup once the profile
          // result arrives; existing users never wait on this request to see UI.
          router.replace('/onboarding/profile-setup');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        // Auth state could not be restored. Keep the app usable instead of
        // trapping the user on the launch spinner.
        router.replace('/home');
      }
    };

    checkAuthAndOnboarding();
  }, []);

  // This is displayed only while the persisted session is read from local storage.
  return (
    <View style={{ flex: 1, backgroundColor: c.background, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}
