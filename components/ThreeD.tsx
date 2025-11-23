import React from 'react';
import { View, ViewStyle, Text, TextStyle, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing, Shadows, Typography, Colors, Gradients } from '@/theme/designTokens';

// Shared 3D styles
export const useThreeDStyles = () => {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const shadows = scheme === 'dark' ? Shadows.dark : Shadows.light;
  const cardBg = c.card;
  const shadowColor = '#000';
  const highlight = scheme === 'light' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.08)';
  const shadow = scheme === 'light' ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.6)';

  const card: ViewStyle = {
    backgroundColor: cardBg,
    borderRadius: BorderRadius.lg,
    ...shadows.md,
    borderWidth: 1,
    borderColor: scheme === 'light' ? Colors.light.neutral[300] + '40' : Colors.dark.neutral[600] + '60',
  };

  const inset: ViewStyle = {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: scheme === 'light' ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.06)',
    backgroundColor: scheme === 'light' ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.03)',
  };

  const button: ViewStyle = {
    borderRadius: BorderRadius.md,
    backgroundColor: c.primary,
    paddingHorizontal: Spacing.md - 2, // 14px
    paddingVertical: Spacing.sm + 2, // 10px
    ...shadows.md,
  };

  const buttonText: TextStyle = {
    color: '#FFFFFF', // White text on primary for better contrast
    fontSize: Typography.scale.body.fontSize,
    fontFamily: Typography.fontFamily.body,
    fontWeight: Typography.fontWeight.bold,
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
  const { scheme } = useTheme();
  if (gradient) {
    const colors = gradientColors ?? (scheme === 'dark' ? Gradients.background.dark : Gradients.background.light);
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
  const { scheme } = useTheme();
  if (gradient) {
    const colors = gradientColors ?? Gradients.success;
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        style={[{ borderRadius: BorderRadius.md }, disabled ? { opacity: 0.6 } : null]}
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
            <Text
              style={[
                {
                  color: '#FFFFFF',
                  fontSize: Typography.scale.body.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.bold,
                },
                textStyle,
              ]}
            >
              {title}
            </Text>
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
