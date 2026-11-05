import React from 'react';
import { Image, View, StyleProp, ViewStyle } from 'react-native';

type EventImagePlaceholderProps = {
  style?: StyleProp<ViewStyle>;
  borderRadius?: number;
};

/** Full-frame campus photo used when an event has no usable image. */
export default function EventImagePlaceholder({ style, borderRadius = 0 }: EventImagePlaceholderProps) {
  return (
    <View
      accessible
      accessibilityLabel="Texas A&M campus"
      style={[
        {
          width: '100%',
          height: '100%',
          backgroundColor: '#500000',
          overflow: 'hidden',
          borderRadius,
        },
        style,
      ]}
    >
      <Image
        source={require('@/assets/tamu-campus-placeholder.jpg')}
        accessibilityLabel="Texas A&M campus viewed from Rudder Tower"
        resizeMode="contain"
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
}
