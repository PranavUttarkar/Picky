import React from 'react';
import { View, Text, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/theme/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
};

export default function GradientHeader({
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
}: Props) {
  const c = useThemeColors();
  return (
    <View style={[{ marginBottom: 12 }, style]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] as const}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: 12, borderRadius: 12 }}
      >
        <Text style={[{ color: c.text, fontWeight: '800', fontSize: 20 }, titleStyle]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[{ color: c.muted, marginTop: 4 }, subtitleStyle]}>{subtitle}</Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}
