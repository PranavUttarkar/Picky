import React from 'react';
import { View, ViewStyle, Text, TextStyle, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';

// Shared 3D styles
export const useThreeDStyles = () => {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const elevation = 6;
  const cardBg = c.card;
  const shadowColor = '#000';
  const highlight = scheme === 'light' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.08)';
  const shadow = scheme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)';

  const card: ViewStyle = {
    backgroundColor: cardBg,
    borderRadius: 16,
    shadowColor,
    shadowOffset: { width: 0, height: elevation },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: scheme === 'light' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.06)',
  };

  const inset: ViewStyle = {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: scheme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.06)',
    backgroundColor: scheme === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.03)',
  };

  const button: ViewStyle = {
    borderRadius: 12,
    backgroundColor: c.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  };

  const buttonText: TextStyle = {
    color: '#000',
    fontWeight: '800',
  };

  return { card, inset, button, buttonText, highlight, shadow };
};

export const ThreeDCard: React.FC<{
  style?: ViewStyle;
  children?: React.ReactNode;
  gradient?: boolean;
  gradientColors?: readonly [string, string];
}> = ({ style, children, gradient = false, gradientColors }) => {
  const { card } = useThreeDStyles();
  if (gradient) {
    const colors = gradientColors ?? (['#ffffff', '#f3f4f6'] as const);
    return (
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[card, style]}
      >
        {children}
      </LinearGradient>
    );
  }
  return <View style={[card, style]}>{children}</View>;
};

export const ThreeDButton: React.FC<{
  title?: string;
  onPress?: () => void | Promise<void>;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  gradient?: boolean;
  gradientColors?: readonly [string, string];
  children?: React.ReactNode; // allow icon-only or custom content
}> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled,
  gradient = false,
  gradientColors,
  children,
}) => {
  const { button, buttonText } = useThreeDStyles();
  if (gradient) {
    const colors = gradientColors ?? (['#34d399', '#22d3ee'] as const);
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[{ borderRadius: 12 }, disabled ? { opacity: 0.6 } : null]}
        accessibilityRole="button"
        accessibilityLabel={title || 'Button'}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[button, { backgroundColor: 'transparent' }, style]}
        >
          {children ? (
            children
          ) : (
            <Text style={[{ color: '#001219', fontWeight: '800' }, textStyle]}>{title}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[button, disabled ? { opacity: 0.6 } : null, style]}
      accessibilityRole="button"
      accessibilityLabel={title || 'Button'}
    >
      {children ? <>{children}</> : <Text style={[buttonText, textStyle]}>{title}</Text>}
    </Pressable>
  );
};
