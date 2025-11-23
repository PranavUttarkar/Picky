import { Stack, router } from 'expo-router';
import { useColorScheme, Text, TextInput } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Typography } from '@/theme/designTokens';
import { SavedNotificationProvider } from '@/utils/SavedNotificationContext';
import { GroupDecisionNotificationProvider } from '@/utils/GroupDecisionNotificationContext';
import { FriendNotificationProvider } from '@/utils/FriendNotificationContext';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/services/supabase';
import { joinGroupByCode } from '@/services/groups';
import HeaderSpacer from '@/components/HeaderSpacer';

export default function RootLayout() {
  const scheme = useColorScheme();
  // Load all fonts; we don't block UI on this
  const [fontsLoaded] = useFonts({
    Pacifico_400Regular,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  // Note: React Native doesn't support defaultProps.style the same way
  // We'll ensure fonts are applied via design tokens in components
  // On auth available, process any pending invite captured before sign-up
  useEffect(() => {
    let mounted = true;
    const processPending = async () => {
      try {
        const code = await AsyncStorage.getItem('pending_invite_code');
        if (!code) return;
        const user = (await supabase.auth.getUser()).data.user;
        if (!user) return; // will be handled on auth change
        const groupId = await joinGroupByCode(code);
        await AsyncStorage.removeItem('pending_invite_code');
        if (!mounted) return;
        router.replace(`/groups/${groupId}`);
      } catch (e) {
        // If invalid, just clear and continue
        try {
          await AsyncStorage.removeItem('pending_invite_code');
        } catch {}
      }
    };
    // initial check
    processPending();
    // listen for auth changes
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (session) processPending();
    });
    return () => {
      mounted = false;
      try {
        sub.subscription.unsubscribe();
      } catch {}
    };
  }, []);
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <SavedNotificationProvider>
          <FriendNotificationProvider>
            <GroupDecisionNotificationProvider>
              {/* Spacer to avoid status bar overlap on iOS/Android; no-op on web */}
              <HeaderSpacer />
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="invite" />
                <Stack.Screen name="onboarding" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="events/[id]" />
                {/** decisions routed via (tabs) to keep header/tab visible */}
                {/** Poll routes are under (tabs)/polls now to keep header/tab visible */}
              </Stack>
            </GroupDecisionNotificationProvider>
          </FriendNotificationProvider>
        </SavedNotificationProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
