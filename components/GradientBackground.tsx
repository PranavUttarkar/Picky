import React from 'react';
import { View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/theme/ThemeProvider';
import { Gradients } from '@/theme/designTokens';

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

  // Use new gradient system from design tokens
  const colors = (scheme === 'dark' ? Gradients.background.dark : Gradients.background.light) as readonly [
    string,
    string,
  ];

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
