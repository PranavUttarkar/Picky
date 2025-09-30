import React from 'react';
import { View, Text, StyleSheet, ViewStyle, Image, ImageSourcePropType } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';

type Props = {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  footerTag?: string;
  illustration?: ImageSourcePropType | React.ReactNode;
};

export default function BlurbBubble({ title, children, style, footerTag, illustration }: Props) {
  const c = useThemeColors();
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
            {title ? <Text style={[styles.title, { color: c.text }]}>{title}</Text> : null}
          </View>
        ) : null}

        <View style={{ gap: 8 }}>{children}</View>

        {footerTag ? (
          <View
            style={[
              styles.tag,
              { backgroundColor: 'transparent', borderColor: accentColor, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.tagText, { color: accentColor }]}>{footerTag}</Text>
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
    borderRadius: 22,
    padding: 16,
    borderWidth: 3,
    // playful shadow
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 16 },
    elevation: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  stickerWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
  },
  illustration: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9,
    marginTop: 12,
  },
  tagText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  dotLg: {
    position: 'absolute',
    left: 26,
    bottom: -18,
    width: 22,
    height: 22,
    borderRadius: 22,
    borderWidth: 3,
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dotMd: {
    position: 'absolute',
    left: 16,
    bottom: -34,
    width: 16,
    height: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
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
