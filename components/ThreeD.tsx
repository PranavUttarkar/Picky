import React from 'react';
import { View, ViewStyle, Text, TextStyle, Pressable } from 'react-native';
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

export const ThreeDCard: React.FC<{ style?: ViewStyle; children?: React.ReactNode }> = ({
  style,
  children,
}) => {
  const { card } = useThreeDStyles();
  return <View style={[card, style]}>{children}</View>;
};

export const ThreeDButton: React.FC<{
  title: string;
  onPress?: () => void | Promise<void>;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}> = ({ title, onPress, style, textStyle, disabled }) => {
  const { button, buttonText } = useThreeDStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[button, disabled ? { opacity: 0.6 } : null, style]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <Text style={[buttonText, textStyle]}>{title}</Text>
    </Pressable>
  );
};
