/**
 * ThemedText Component
 * Ensures all text uses the correct sans-serif fonts
 * Use this instead of Text for consistent typography
 */

import React from 'react';
import { Text, TextProps, TextStyle } from 'react-native';
import { Typography } from '@/theme/designTokens';

type ThemedTextProps = TextProps & {
  variant?: 'displayLarge' | 'display' | 'heading1' | 'heading2' | 'heading3' | 'bodyLarge' | 'body' | 'bodySmall' | 'caption';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  style?: TextStyle;
};

export default function ThemedText({ 
  variant = 'body', 
  weight = 'regular',
  style,
  children,
  ...props 
}: ThemedTextProps) {
  const typographyStyle = Typography.scale[variant];
  
  // Get the correct font family based on weight
  const getFontFamily = () => {
    if (variant === 'displayLarge' || variant === 'display') {
      return weight === 'bold' ? Typography.fontFamily.displayBold : Typography.fontFamily.display;
    }
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

  return (
    <Text
      style={[
        {
          fontFamily: getFontFamily(),
          fontSize: typographyStyle.fontSize,
          lineHeight: typographyStyle.lineHeight,
          fontWeight: Typography.fontWeight[weight],
        },
        style,
      ]}
      {...props}
    >
      {children}
    </Text>
  );
}

