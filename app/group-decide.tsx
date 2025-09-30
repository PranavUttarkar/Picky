import { useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useRootNavigationState } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import AnimatedPage from '@/components/AnimatedPage';
import { useThemeColors } from '@/theme/ThemeProvider';

export default function GroupDecideRedirect() {
  const c = useThemeColors();
  const mountedRef = useRef(true);
  const rootState = useRootNavigationState();
  const navReady = !!rootState?.key;
  useEffect(() => {
    mountedRef.current = true;
    if (navReady && mountedRef.current) {
      // Redirect standalone route to the tabs version for unified UX
      router.replace('/(tabs)/group-decide');
    }
    return () => {
      mountedRef.current = false;
    };
  }, [navReady]);
  return (
    <GradientBackground variant="dim">
      <AnimatedPage variant="pop" style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View>
          <ActivityIndicator color={c.text} />
        </View>
      </AnimatedPage>
    </GradientBackground>
  );
}
