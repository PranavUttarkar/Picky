import React from 'react';
import { View, Text, ViewStyle, TextStyle, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/theme/ThemeProvider';

type Props = {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  onBack?: () => void;
  backLabel?: string;
};

export default function GradientHeader({
  title,
  subtitle,
  style,
  titleStyle,
  subtitleStyle,
  onBack,
  backLabel = 'Back',
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              style={{
                paddingVertical: 4,
                paddingHorizontal: 8,
                backgroundColor: '#00000030',
                borderRadius: 8,
                marginRight: 8,
              }}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Text style={{ color: c.text, fontWeight: '700' }}>{'‹'}</Text>
            </Pressable>
          ) : null}
          <Text style={[{ color: c.text, fontWeight: '800', fontSize: 20 }, titleStyle]}>
            {title}
          </Text>
        </View>
        {subtitle ? (
          <Text style={[{ color: c.muted, marginTop: 4 }, subtitleStyle]}>{subtitle}</Text>
        ) : null}
      </LinearGradient>
    </View>
  );
}
