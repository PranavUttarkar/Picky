import React from 'react';
import {
  View,
  Image,
  Pressable,
  Text,
  Platform,
  StyleSheet,
  ImageSourcePropType,
  ViewStyle,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';

export type MediaCardProps = {
  image: ImageSourcePropType;
  label?: string;
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
};

export default function MediaCard({
  image,
  label,
  onPress,
  selected,
  style,
  accessibilityLabel,
}: MediaCardProps) {
  const c = useThemeColors();
  const card = (
    <View
      style={[
        styles.card,
        {
          borderColor: selected ? c.primary : '#00000020',
          borderWidth: selected ? 2 : 1,
        },
        style,
      ]}
    >
      <View style={styles.media}>
        <Image
          source={image}
          style={styles.mediaImage}
          resizeMode={Platform.OS === 'web' ? 'cover' : 'contain'}
        />
      </View>
      {label ? (
        <View style={styles.footer}>
          <Text style={{ color: c.text, fontWeight: '800' }}>{label}</Text>
        </View>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {({ pressed }) => <View style={{ opacity: pressed ? 0.9 : 1 }}>{card}</View>}
      </Pressable>
    );
  }
  return card;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00000020',
    width: '100%',
  },
  media: {
    width: '100%',
    aspectRatio: 2 / 1,
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  footer: {
    padding: 12,
    backgroundColor: '#00000010',
  },
});
