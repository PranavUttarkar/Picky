import React from 'react';
import { View, Text } from 'react-native';
import LazyImage from '@/components/LazyImage';

export interface EventImagesProps {
  images: string[];
  /** Height of the image area (single image uses this, multi-image grids fit inside) */
  height?: number;
  /** Maximum number of images to render before showing a +N overlay */
  maxDisplay?: number;
  /** If true, show +N overlay when images exceed maxDisplay */
  showOverflowIndicator?: boolean;
  /** Corner radius */
  borderRadius?: number;
  /** Variant can slightly tweak default height (e.g., card vs detail) */
  variant?: 'card' | 'detail' | 'modal';
}

/**
 * Consistent multi-image layout for events:
 *  - 1 image: full bleed
 *  - 2 images: side-by-side
 *  - 3 images: magazine layout (left large, right two stacked)
 *  - >3 images: show first 3 in above layout, +N overlay on the smallest (bottom-right) tile
 */
export const EventImages: React.FC<EventImagesProps> = ({
  images,
  height,
  maxDisplay = 3,
  showOverflowIndicator = true,
  borderRadius = 16,
  variant = 'detail',
}) => {
  if (!images || !images.length) return null;
  const clean = images.filter(Boolean);
  if (!clean.length) return null;

  const h = height ?? (variant === 'card' ? 160 : 220);
  const count = clean.length;
  const display = clean.slice(0, maxDisplay);
  const overflow = count - display.length;

  // Single image straightforward
  if (display.length === 1) {
    return (
      <LazyImage
        uri={display[0]}
        width={'100%'}
        height={h}
        borderRadius={borderRadius}
        accessibilityLabel="Event image"
      />
    );
  }

  // Two images side-by-side
  if (display.length === 2) {
    return (
      <View style={{ flexDirection: 'row', width: '100%', height: h, gap: 6 }}>
        {display.map((u, i) => (
          <View key={i} style={{ flex: 1 }}>
            <LazyImage
              uri={u}
              width={'100%'}
              height={h}
              borderRadius={borderRadius}
              style={{}}
              accessibilityLabel={`Event image ${i + 1}`}
            />
          </View>
        ))}
      </View>
    );
  }

  // Three (or more -> first 3) images magazine layout
  // Left large (2/3 width), right column two stacked (1/3 width)
  return (
    <View style={{ flexDirection: 'row', width: '100%', height: h, gap: 6 }}>
      <View style={{ flex: 2, height: h }}>
        <LazyImage
          uri={display[0]}
          width={'100%'}
          height={h}
          borderRadius={borderRadius}
          accessibilityLabel={`Event image 1`}
        />
      </View>
      <View style={{ flex: 1, height: h, gap: 6, justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <LazyImage
            uri={display[1]}
            width={'100%'}
            height={'100%'}
            borderRadius={borderRadius}
            accessibilityLabel={`Event image 2`}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <LazyImage
              uri={display[2]}
              width={'100%'}
              height={'100%'}
              borderRadius={borderRadius}
              accessibilityLabel={`Event image 3`}
            />
            {overflow > 0 && showOverflowIndicator ? (
              <View
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0,0,0,0.45)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius,
                }}
                accessibilityLabel={`Plus ${overflow} more images`}
              >
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 18 }}>+{overflow}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
};

export default EventImages;
