import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/theme/ThemeProvider';

type Props = {
  label: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function Chip({ label, style, textStyle }: Props) {
  const c = useThemeColors();
  return (
    <LinearGradient
      colors={['#34d399', '#22d3ee'] as const}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ padding: 1.5, borderRadius: 999 }, style]}
    >
      <View
        style={{
          backgroundColor: c.background,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
        }}
      >
        <Text style={[{ color: c.text, fontSize: 12 }, textStyle]}>{label}</Text>
      </View>
    </LinearGradient>
  );
}
