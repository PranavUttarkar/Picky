/**
 * Global Text Styles Helper
 * Ensures all text uses the correct sans-serif fonts with proper fallbacks
 */

import { TextStyle } from 'react-native';
import { Typography } from './designTokens';

/**
 * Get the font family string for a given weight
 * Ensures sans-serif fallback to prevent serif fonts
 */
export const getFontFamily = (weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular'): string => {
  switch (weight) {
    case 'medium':
      return Typography.fontFamily.bodyMedium;
    case 'semibold':
      return Typography.fontFamily.bodySemibold;
    case 'bold':
      return Typography.fontFamily.bodyBold;
    default:
      return Typography.fontFamily.body;
  }
};

/**
 * Base text style - ensures all text is sans-serif
 */
export const baseTextStyle: TextStyle = {
  fontFamily: Typography.fontFamily.body,
  // @ts-ignore - React Native accepts this for web
  fontFamilyFallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
};

/**
 * Helper to create text styles with proper font family
 */
export const createTextStyle = (
  fontSize: number,
  lineHeight: number,
  weight: 'regular' | 'medium' | 'semibold' | 'bold' = 'regular',
  additionalStyles?: TextStyle
): TextStyle => ({
  ...baseTextStyle,
  fontSize,
  lineHeight,
  fontFamily: getFontFamily(weight),
  fontWeight: Typography.fontWeight[weight],
  ...additionalStyles,
});

