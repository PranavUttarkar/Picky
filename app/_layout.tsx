import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { useFonts, Pacifico_400Regular } from '@expo-google-fonts/pacifico';
import { SavedNotificationProvider } from '@/utils/SavedNotificationContext';

export default function RootLayout() {
  const scheme = useColorScheme();
  // Load the brand font; we don't block UI on this
  const [fontsLoaded] = useFonts({ Pacifico_400Regular });
  return (
    <ThemeProvider>
      <SavedNotificationProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="events/[id]" />
          {/** decisions routed via (tabs) to keep header/tab visible */}
          {/** Poll routes are under (tabs)/polls now to keep header/tab visible */}
        </Stack>
      </SavedNotificationProvider>
    </ThemeProvider>
  );
}
