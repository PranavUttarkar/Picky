import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Platform,
  Text,
} from 'react-native';
import LazyImage from '@/components/LazyImage';

export type ImageGalleryProps = {
  images: string[];
  width?: number; // if not provided, will measure container width
  height?: number; // optional fixed height, otherwise use aspect ratio 16:9
  borderRadius?: number;
  showDots?: boolean;
  showArrows?: boolean;
  arrowColor?: string;
  autoPlayActive?: boolean; // when true, auto-advance continuously
  autoPlayOnHover?: boolean; // on web, start autoplay on hover
  autoPlayIntervalMs?: number;
  /**
   * Optional handler when an image is tapped (e.g., to open fullscreen later)
   */
  onPressImage?: (index: number) => void;
};

export default function ImageGallery({
  images,
  width,
  height,
  borderRadius = 12,
  showDots = true,
  showArrows = false,
  arrowColor = '#fff',
  autoPlayActive = false,
  autoPlayOnHover = false,
  autoPlayIntervalMs = 1400,
  onPressImage,
}: ImageGalleryProps) {
  const clean = useMemo(() => (images || []).filter(Boolean), [images]);
  // Maintain a local list that can drop images that fail to load
  const [items, setItems] = useState<string[]>(clean);
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(width ?? null);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(false);

  const w = measuredWidth ?? width ?? 0;
  const h = height ?? (w ? Math.round(w / (16 / 9)) : undefined);

  // Keep items in sync if prop changes
  useEffect(() => {
    setItems(clean);
    setIndex(0);
  }, [clean.join('|')]);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      if (!w) return;
      const i = Math.round(x / w);
      if (i !== index) setIndex(i);
    },
    [w, index],
  );

  const scrollToIndex = useCallback(
    (i: number) => {
      if (!w || !scrollRef.current || items.length <= 0) return;
      const bounded = ((i % items.length) + items.length) % items.length;
      scrollRef.current.scrollTo({ x: bounded * w, animated: true });
      setIndex(bounded);
    },
    [w, items.length],
  );

  // Autoplay when active (e.g., on web hover)
  useEffect(() => {
    const shouldAuto = autoPlayActive || (autoPlayOnHover && Platform.OS === 'web' && hovered);
    if (!shouldAuto || !w || items.length <= 1) return;
    const id = setInterval(() => {
      scrollToIndex(index + 1);
    }, Math.max(600, autoPlayIntervalMs));
    return () => clearInterval(id);
  }, [
    autoPlayActive,
    autoPlayOnHover,
    hovered,
    w,
    items.length,
    index,
    autoPlayIntervalMs,
    scrollToIndex,
  ]);

  // If all images failed, render nothing
  if (!items.length) return null;

  return (
    <Pressable
      onLayout={(ev) => {
        if (width == null) {
          const cw = Math.round(ev.nativeEvent.layout.width);
          if (cw && cw !== measuredWidth) setMeasuredWidth(cw);
        }
      }}
      // Hover listeners are no-ops on native; on web they trigger autoplay when enabled
      onHoverIn={() => {
        setHovered(true);
        if (autoPlayOnHover && Platform.OS === 'web' && clean.length > 1 && index === 0) {
          // Nudge to next image immediately on hover when cycling is enabled
          scrollToIndex(index + 1);
        }
      }}
      onHoverOut={() => setHovered(false)}
      style={{ width: width ?? '100%' }}
    >
      {w && h ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={{
            width: w,
            height: h,
            borderRadius,
            overflow: 'hidden',
            backgroundColor: '#00000010',
          }}
          contentContainerStyle={{}}
        >
          {items.map((uri, i) => {
            const shouldRender = Math.abs(i - index) <= 1; // render only current slide and neighbors
            const key = `${uri}-${i}`;
            const child = shouldRender ? (
              <LazyImage
                uri={uri}
                width={w}
                height={h}
                borderRadius={0}
                onError={() => {
                  // Drop this URI from local list and advance if needed
                  setItems((prev) => {
                    const next = prev.filter((x, idx) => !(idx === i && x === uri));
                    // Adjust index if we removed the current item or index is out of bounds
                    if (next.length === 0) {
                      setIndex(0);
                    } else if (index >= next.length) {
                      setIndex(next.length - 1);
                      // snap scroll to new index
                      setTimeout(() => scrollToIndex(next.length - 1), 0);
                    } else if (i === index) {
                      // move to the same index, which now points to the next item
                      setTimeout(() => scrollToIndex(index), 0);
                    }
                    return next;
                  });
                }}
              />
            ) : (
              <View style={{ width: w, height: h, backgroundColor: '#00000010' }} />
            );
            return onPressImage ? (
              <Pressable key={key} onPress={() => onPressImage(i)} style={{ width: w, height: h }}>
                {child}
              </Pressable>
            ) : (
              <View key={key} style={{ width: w, height: h }}>
                {child}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        // Fallback blank box while measuring width
        <View
          style={{ width: '100%', aspectRatio: 16 / 9, borderRadius, backgroundColor: '#00000010' }}
        />
      )}

      {/* Arrows */}
      {showArrows && w && items.length > 1 ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Pressable
            onPress={() => scrollToIndex(index - 1)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              marginLeft: 6,
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderRadius: 999,
            }}
            accessibilityLabel="Previous image"
          >
            <Text style={{ color: arrowColor, fontSize: 18 }}>{'‹'}</Text>
          </Pressable>
          <Pressable
            onPress={() => scrollToIndex(index + 1)}
            style={{
              paddingVertical: 8,
              paddingHorizontal: 10,
              marginRight: 6,
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderRadius: 999,
            }}
            accessibilityLabel="Next image"
          >
            <Text style={{ color: arrowColor, fontSize: 18 }}>{'›'}</Text>
          </Pressable>
        </View>
      ) : null}

      {showDots && items.length > 1 ? (
        <View
          style={{
            position: 'absolute',
            bottom: 8,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
          accessibilityLabel={`Image ${index + 1} of ${items.length}`}
        >
          {items.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: i === index ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.5)',
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.2)',
              }}
            />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
