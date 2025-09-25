import React from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  children?: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  variant?: 'app' | 'dim';
};

export default function GradientBackground({
  children,
  style,
  contentContainerStyle,
  variant = 'app',
}: Props) {
  const { scheme } = useTheme();

  const light =
    variant === 'app'
      ? (['#e9fdf5', '#f9fafb'] as const)
      : variant === 'dim'
      ? (['#f8fafc', '#eef2ff'] as const)
      : (['#f9fafb', '#eef2ff'] as const);
  const dark =
    variant === 'app'
      ? (['#0b1220', '#111827'] as const)
      : variant === 'dim'
      ? (['#0a0f1c', '#0e172a'] as const)
      : (['#0b1220', '#0e172a'] as const);

  const colors = (scheme === 'dark' ? dark : light) as readonly [string, string];

  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ flex: 1 }, style]}
    >
      {contentContainerStyle ? <View style={contentContainerStyle}>{children}</View> : children}
    </LinearGradient>
  );
}
