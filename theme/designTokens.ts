/**
 * Picky Design Tokens
 * Complete visual design system aligned with brand identity:
 * - Clarity, Fairness, Momentum, Togetherness, Intelligence
 * - Lightweight & Fun, Effortless & Fast, Social at the Core, Neutral & Trusted
 */

// ============================================================================
// COLOR SYSTEM
// ============================================================================

export const Colors = {
  light: {
    // Primary Colors (Momentum & Confidence)
    primary: {
      50: '#EEF2FF',
      300: '#818CF8',
      400: '#6366F1',
      500: '#4F46E5',
    },
    // Secondary Colors (Togetherness & Inclusion)
    secondary: {
      50: '#ECFDF5',
      400: '#34D399',
      500: '#10B981',
    },
    // Neutral Colors (Clarity & Fairness)
    neutral: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      300: '#D1D5DB',
      500: '#6B7280',
      700: '#374151',
      900: '#111827',
    },
    // Accent Colors (Relief & Momentum)
    accent: {
      warm: '#F59E0B',
      cool: '#06B6D4',
      warning: '#EF4444',
      info: '#3B82F6',
    },
    // Semantic Colors (for ThemeProvider compatibility)
    background: '#fffff8f4',
    card: '#ffffff',
    text: '#111827',
    muted: '#6B7280',
    primary: '#FF6F61',
    accent: '#EEF2FF',
  },
  dark: {
    // Primary Colors (Maintains trust while feeling modern)
    primary: {
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      900: '#1E1B4B',
    },
    // Secondary Colors
    secondary: {
      400: '#6EE7B7',
      500: '#34D399',
      900: '#064E3B',
    },
    // Neutral Colors
    neutral: {
      50: '#F9FAFB',
      200: '#E5E7EB',
      400: '#9CA3AF',
      600: '#4B5563',
      800: '#1F2937',
      900: '#111827',
    },
    // Accent Colors (Same as light mode but adjusted for contrast)
    accent: {
      warm: '#F59E0B',
      cool: '#06B6D4',
      warning: '#EF4444',
      info: '#3B82F6',
    },
    // Semantic Colors (for ThemeProvider compatibility)
    background: '#111827',
    card: '#1F2937',
    text: '#F9FAFB',
    muted: '#9CA3AF',
    primary: '#ffc494ff',
    accent: '#1E1B4B',
  },
} as const;

// ============================================================================
// TYPOGRAPHY SYSTEM
// ============================================================================

export const Typography = {
  // Font Families - with system fallbacks to ensure sans-serif
  fontFamily: {
    body: 'NunitoSans_400Regular, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bodyMedium: 'NunitoSans_500Medium, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bodySemibold: 'NunitoSans_600SemiBold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    bodyBold: 'NunitoSans_700Bold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    display: 'NunitoSans_600SemiBold, NunitoSans_700Bold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    displayBold: 'NunitoSans_700Bold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    brand: 'Pacifico_400Regular, Pacifico, cursive',
  },
  // Font Weights
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  // Typography Scale
  scale: {
    displayLarge: {
      fontSize: 32,
      lineHeight: 40,
      fontFamily: 'NunitoSans_700Bold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '700',
    },
    display: {
      fontSize: 28,
      lineHeight: 36,
      fontFamily: 'NunitoSans_600SemiBold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '600',
    },
    heading1: {
      fontSize: 24,
      lineHeight: 32,
      fontFamily: 'NunitoSans_600SemiBold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '600',
    },
    heading2: {
      fontSize: 20,
      lineHeight: 28,
      fontFamily: 'NunitoSans_600SemiBold, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '600',
    },
    heading3: {
      fontSize: 18,
      lineHeight: 24,
      fontFamily: 'NunitoSans_500Medium, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '500',
    },
    bodyLarge: {
      fontSize: 16,
      lineHeight: 24,
      fontFamily: 'NunitoSans_400Regular, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '400',
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: 'NunitoSans_400Regular, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '400',
    },
    bodySmall: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: 'NunitoSans_400Regular, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '400',
    },
    caption: {
      fontSize: 11,
      lineHeight: 14,
      fontFamily: 'NunitoSans_400Regular, "Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontWeight: '400',
    },
  },
} as const;

// ============================================================================
// SPACING SYSTEM (8px base unit)
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  '2xl': 48,
  '3xl': 64,
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const;

// ============================================================================
// SHADOWS & ELEVATION
// ============================================================================

export const Shadows = {
  light: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.07,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 5,
    },
  },
  dark: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 3,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 15,
      elevation: 5,
    },
  },
} as const;

// ============================================================================
// ANIMATION & MOTION
// ============================================================================

export const Animation = {
  duration: {
    fast: 150,
    standard: 250,
    slow: 350,
  },
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

// ============================================================================
// GRADIENTS
// ============================================================================

export const Gradients = {
  primary: ['#f78e3fff', '#f8b312ff'] as const,
  success: ['#10B981', '#34D399'] as const,
  background: {
    light: ['#F9FAFB', '#F3F4F6'] as const,
    dark: ['#111827', '#1F2937'] as const,
  },
} as const;

// ============================================================================
// ICON SIZES
// ============================================================================

export const IconSizes = {
  small: 20,
  medium: 24,
  large: 32,
} as const;

