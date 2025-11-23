import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Gradients, BorderRadius, Spacing, Typography } from '@/theme/designTokens';

type Props = {
  label: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function Chip({ label, style, textStyle }: Props) {
  const c = useThemeColors();
  return (
    <LinearGradient
      colors={Gradients.success}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ padding: 1.5, borderRadius: BorderRadius.full }, style]}
    >
      <View
        style={{
          backgroundColor: c.background,
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          borderRadius: BorderRadius.full,
        }}
      >
        <Text
          style={[
            {
              color: c.text,
              fontSize: Typography.scale.bodySmall.fontSize,
              lineHeight: Typography.scale.bodySmall.lineHeight,
              fontFamily: Typography.fontFamily.body,
              fontWeight: Typography.fontWeight.regular,
            },
            textStyle,
          ]}
        >
          {label}
        </Text>
      </View>
    </LinearGradient>
  );
}
