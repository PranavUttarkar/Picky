import { StyleProp, ViewStyle, TextStyle } from 'react-native';

// Helper to consolidate top bar styling between tabs (events, food, etc.)
export const topBarStyles = (c: { card: string; text: string; muted: string; background: string; primary: string }) => {
  return {
    searchContainer: {
      backgroundColor: c.card,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
      marginTop: 12,
      marginHorizontal: 16, // unified horizontal margin
    } as ViewStyle,
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    } as ViewStyle,
    searchIconPressable: {
      padding: 4,
    } as ViewStyle,
    searchInput: {
      color: c.text,
      flex: 1,
    } as TextStyle,
    rowWrap: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
      flexWrap: 'wrap',
      alignItems: 'center',
    } as ViewStyle,
    modeButton: (active: boolean): ViewStyle => ({
      backgroundColor: active ? c.primary : c.background,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    }),
    modeButtonText: (active: boolean): TextStyle => ({
      color: active ? c.background : c.text,
    }),
    toggleButton: {
      backgroundColor: c.background,
      padding: 8,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    } as ViewStyle,
    actionButton: {
      backgroundColor: c.primary,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    } as ViewStyle,
    actionButtonText: {
      color: '#000',
    } as TextStyle,
  };
};

export type TopBarDerivedStyles = ReturnType<typeof topBarStyles>;
