import { Stack } from "expo-router";
import { useColorScheme } from "react-native";
import { ThemeProvider } from "@/theme/ThemeProvider";

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="events/[id]" />
        <Stack.Screen name="polls/[id]" />
      </Stack>
    </ThemeProvider>
  );
}
