import { StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Spacing, BorderRadius, Typography } from '@/theme/designTokens';

// Helper to consolidate top bar styling between tabs (events, food, etc.)
export const topBarStyles = (c: { card: string; text: string; muted: string; background: string; primary: string }) => {
  return {
    searchContainer: {
      backgroundColor: c.card,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.sm + 2, // 10px (slightly more than sm for input comfort)
      paddingVertical: Spacing.sm,
      marginTop: Spacing.md - 4, // 12px
      // Horizontal spacing now handled by outer tab container (padding:16)
    } as ViewStyle,
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    } as ViewStyle,
    searchIconPressable: {
      padding: Spacing.xs,
    } as ViewStyle,
    searchInput: {
      color: c.text,
      flex: 1,
      fontSize: Typography.scale.body.fontSize,
      lineHeight: Typography.scale.body.lineHeight,
      fontFamily: Typography.fontFamily.body,
    } as TextStyle,
    rowWrap: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md - 4, // 12px
      flexWrap: 'wrap',
      alignItems: 'center',
    } as ViewStyle,
    modeButton: (active: boolean): ViewStyle => ({
      backgroundColor: active ? c.primary : c.background,
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm + 2, // 10px
      borderRadius: BorderRadius.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    }),
    modeButtonText: (active: boolean): TextStyle => ({
      color: active ? c.background : c.text,
      fontSize: Typography.scale.body.fontSize,
      fontFamily: Typography.fontFamily.body,
      fontWeight: active ? Typography.fontWeight.medium : Typography.fontWeight.regular,
    }),
    toggleButton: {
      backgroundColor: c.background,
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    actionButton: {
      backgroundColor: c.primary,
      paddingVertical: 6,
      paddingHorizontal: Spacing.sm + 2, // 10px
      borderRadius: BorderRadius.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    } as ViewStyle,
    actionButtonText: {
      color: '#FFFFFF', // White text on primary background for better contrast
      fontSize: Typography.scale.body.fontSize,
      fontFamily: Typography.fontFamily.body,
      fontWeight: Typography.fontWeight.medium,
    } as TextStyle,
  };
};

export type TopBarDerivedStyles = ReturnType<typeof topBarStyles>;
