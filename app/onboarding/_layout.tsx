import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="welcome" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="org-setup" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="group" />
    </Stack>
  );
}
