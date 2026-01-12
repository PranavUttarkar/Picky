import { Stack } from 'expo-router';

/**
 * Quick Pick Flow Layout
 * Handles navigation within the quick pick decision flow
 */
export default function QuickPickLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
      }}
    >
      <Stack.Screen name="setup" />
      <Stack.Screen name="when" />
      <Stack.Screen name="what" />
      <Stack.Screen 
        name="vote" 
        options={{
          gestureEnabled: false, // Prevent accidental back during voting
        }}
      />
      <Stack.Screen 
        name="result" 
        options={{
          gestureEnabled: false, // Prevent back from result
          animation: 'fade',
        }}
      />
    </Stack>
  );
}
