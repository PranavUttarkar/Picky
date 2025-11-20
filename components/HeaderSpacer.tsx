import React from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/theme/ThemeProvider';

/**
 * HeaderSpacer
 *
 * Renders a spacer equal to the top safe-area inset on native (iOS/Android)
 * so content doesn't overlap the status bar/notch. No-op on web.
 */
export default function HeaderSpacer() {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();

  if (Platform.OS === 'web') return null; // Do not add spacer on web

  return <View style={{ height: insets.top, backgroundColor: c.background }} />;
}
