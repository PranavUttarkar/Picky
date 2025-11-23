import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Image, ImageSourcePropType } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing, Shadows, Typography } from '@/theme/designTokens';
import { useTheme } from '@/theme/ThemeProvider';

type Props = {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  footerTag?: string;
  illustration?: ImageSourcePropType | React.ReactNode;
};

export default function BlurbBubble({ title, children, style, footerTag, illustration }: Props) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const shadows = scheme === 'dark' ? Shadows.dark : Shadows.light;
  // Use a more lively accent derived from theme primary instead of orange
  const accentColor = c.primary;
  return (
    <View style={[styles.wrapper, style]}>
      {/* Thought cloud dots (tail) */}
      <View
        style={[styles.dotLg, { borderColor: accentColor, backgroundColor: c.card }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[styles.dotMd, { borderColor: accentColor, backgroundColor: c.card }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <View
        style={[styles.dotSm, { borderColor: accentColor, backgroundColor: c.card }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />

      <View
        style={[
          styles.container,
          {
            backgroundColor: c.card,
            borderColor: accentColor,
            shadowColor: c.text,
            ...shadows.lg,
          },
        ]}
        accessibilityRole="summary"
      >
        {/* Header with optional illustration and title */}
        {illustration || title ? (
          <View style={styles.headerRow}>
            {illustration ? (
              <View style={styles.stickerWrap}>
                {React.isValidElement(illustration) ? (
                  illustration
                ) : (
                  <Image
                    source={illustration as ImageSourcePropType}
                    style={styles.illustration}
                    resizeMode="contain"
                    accessibilityIgnoresInvertColors
                  />
                )}
              </View>
            ) : null}
            {title ? (
              <Text
                style={[
                  {
                    color: c.text,
                    fontSize: Typography.scale.heading3.fontSize,
                    lineHeight: Typography.scale.heading3.lineHeight,
                    fontFamily: Typography.fontFamily.body,
                    fontWeight: Typography.fontWeight.bold,
                    marginBottom: Spacing.xs + 2, // 6px
                  },
                ]}
              >
                {title}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={{ gap: Spacing.sm }}>{children}</View>

        {footerTag ? (
          <View style={[styles.tag, { backgroundColor: 'transparent' }]}>
            <Text
              style={[
                {
                  color: accentColor,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.body,
                  fontWeight: Typography.fontWeight.bold,
                  letterSpacing: 0.3,
                },
              ]}
            >
              {footerTag}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  container: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 3,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md - 4, // 12px
    marginBottom: Spacing.xs + 2, // 6px
  },
  stickerWrap: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  illustration: {
    width: 64,
    height: 64,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm + 2, // 10px
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm + 1, // 9px
    marginTop: Spacing.md - 4, // 12px
  },
  dotLg: {
    position: 'absolute',
    left: 26,
    bottom: -18,
    width: 22,
    height: 22,
    borderRadius: 22,
    borderWidth: 3,
    ...Shadows.light.sm,
  },
  dotMd: {
    position: 'absolute',
    left: 16,
    bottom: -34,
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 2,
    ...Shadows.light.sm,
  },
  dotSm: {
    position: 'absolute',
    left: 10,
    bottom: -46,
    width: 10,
    height: 10,
    borderRadius: 10,
    borderWidth: 2,
  },
});
