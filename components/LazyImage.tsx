import React, { useState } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  Platform,
  DimensionValue,
  ImageResizeMode,
  StyleProp,
  ImageStyle,
} from 'react-native';

interface LazyImageProps {
  uri: string;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  skeletonColor?: string;
  resizeMode?: ImageResizeMode;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
}

/**
 * Lightweight lazy image with tiny skeleton & fade-in.
 * NOTE: React Native already defers offscreen work; this just improves perceived loading.
 */
const LazyImageBase: React.FC<LazyImageProps> = ({
  uri,
  width,
  height,
  borderRadius = 0,
  skeletonColor = '#00000015',
  style,
  resizeMode = 'cover',
  accessibilityLabel,
}) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width, height, position: 'relative', borderRadius, overflow: 'hidden' }}>
      {!loaded ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: skeletonColor,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ActivityIndicator size="small" color={Platform.OS === 'ios' ? '#888' : '#ccc'} />
        </View>
      ) : null}
      <Image
        source={{ uri }}
        onLoadEnd={() => setLoaded(true)}
        resizeMode={resizeMode}
        accessibilityLabel={accessibilityLabel}
        style={[
          {
            width: '100%',
            height: '100%',
            opacity: loaded ? 1 : 0,
            borderRadius,
          },
          style as any,
        ]}
      />
    </View>
  );
};
// Avoid unnecessary re-renders when parent updates unrelated state
const propsAreEqual = (prev: LazyImageProps, next: LazyImageProps) =>
  prev.uri === next.uri &&
  prev.width === next.width &&
  prev.height === next.height &&
  prev.borderRadius === next.borderRadius &&
  prev.resizeMode === next.resizeMode &&
  prev.accessibilityLabel === next.accessibilityLabel &&
  prev.skeletonColor === next.skeletonColor;
export default React.memo(LazyImageBase, propsAreEqual);
