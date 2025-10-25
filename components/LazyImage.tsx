import React, { useMemo, useState } from 'react';
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
import { proxiedImageUrl } from '@/utils/imageProxy';

interface LazyImageProps {
  uri: string;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
  skeletonColor?: string;
  resizeMode?: ImageResizeMode;
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  onError?: () => void;
  onLoad?: () => void;
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
  onError,
  onLoad,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const proxied = useMemo(() => {
    // Try to pass numeric width/height when available to help proxy resize & cache
    const wNum = typeof width === 'number' ? width : undefined;
    const hNum = typeof height === 'number' ? height : undefined;
    return proxiedImageUrl(uri, wNum, hNum);
  }, [uri, width, height]);
  return (
    <View style={{ width, height, position: 'relative', borderRadius, overflow: 'hidden' }}>
      {!loaded && !failed ? (
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
      {!failed ? (
        <Image
          source={{ uri: proxied }}
          onError={() => {
            setFailed(true);
            onError?.();
          }}
          onLoad={() => {
            onLoad?.();
          }}
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
      ) : null}
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
