import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { PanGestureHandler, PanGestureHandlerStateChangeEvent } from 'react-native-gesture-handler';

type OverlayLabels = {
  like?: { text?: string; color?: string };
  nope?: { text?: string; color?: string };
  super?: { text?: string; color?: string };
};

type SwipeDeckProps<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderCard: (item: T, index: number) => React.ReactNode;
  onSwipeRight?: (item: T, index: number) => void | Promise<void>;
  onSwipeLeft?: (item: T, index: number) => void | Promise<void>;
  onSwipeUp?: (item: T, index: number) => void | Promise<void>;
  overlayLabels?: OverlayLabels;
  stackDepth?: number; // number of cards to render in stack
  enableHaptics?: boolean;
};

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD_X = width * 0.25;
const SWIPE_THRESHOLD_Y = height * 0.18;

export default function SwipeDeck<T = any>({
  data,
  keyExtractor,
  renderCard,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  overlayLabels,
  stackDepth = 3,
}: SwipeDeckProps<T>) {
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;
  const dragging = useRef(false);
  // While we are advancing to the next card (animation + awaiting callback), suppress reconciliation
  const advancingRef = useRef(false);
  // Track which items have been swiped (by stable key) so we don't re-show them if data updates
  const swipedKeysRef = useRef<Set<string>>(new Set());
  const prevKeysRef = useRef<string[] | null>(null);

  // Reconcile current index with incoming data while preserving progress
  useEffect(() => {
    if (advancingRef.current) return; // don't reconcile mid-advance
    const keys = data.map((item, i) => keyExtractor(item, i));
    const prev = prevKeysRef.current;
    prevKeysRef.current = keys;
    // First load
    if (!prev) {
      // Ensure index starts at first unswiped (typically 0)
      const first = keys.findIndex((k) => !swipedKeysRef.current.has(k));
      setIndex(first < 0 ? keys.length : first);
      position.setValue({ x: 0, y: 0 });
      return;
    }
    // Determine if this is a totally new dataset (e.g., navigating to a different poll)
    const prevSet = new Set(prev);
    let overlap = 0;
    for (const k of keys) if (prevSet.has(k)) overlap += 1;
    const isNewDataset = overlap === 0;
    if (isNewDataset) {
      swipedKeysRef.current.clear();
      setIndex(0);
      position.setValue({ x: 0, y: 0 });
      return;
    }
    // Otherwise, keep progress: find first key not yet swiped
    const first = keys.findIndex((k) => !swipedKeysRef.current.has(k));
    setIndex(first < 0 ? keys.length : first);
    position.setValue({ x: 0, y: 0 });
  }, [data, keyExtractor, position]);

  const currentItem = data[index];
  const nextItems = useMemo(
    () => data.slice(index + 1, index + 1 + stackDepth),
    [data, index, stackDepth],
  );

  const rotate = position.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });
  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD_X],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD_X, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const superOpacity = position.y.interpolate({
    inputRange: [-SWIPE_THRESHOLD_Y, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const resetCard = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
      tension: 80,
    }).start();
  };

  const swipeOut = (
    dir: 'left' | 'right' | 'up',
    cb?: (item: T, idx: number) => void | Promise<void>,
  ) => {
    if (!currentItem) return;
    // Record swiped key immediately to preserve progress if parent updates data during callback
    try {
      const k = keyExtractor(currentItem, index);
      swipedKeysRef.current.add(k);
    } catch {}
    let toValue = { x: 0, y: 0 } as { x: number; y: number };
    if (dir === 'left') toValue = { x: -width * 1.3, y: 0 };
    if (dir === 'right') toValue = { x: width * 1.3, y: 0 };
    if (dir === 'up') toValue = { x: 0, y: -height * 1.2 };
    Animated.timing(position, { toValue, duration: 220, useNativeDriver: true }).start(async () => {
      // Snapshot before advancing
      const itemSnapshot = currentItem;
      const indexSnapshot = index;
      advancingRef.current = true;
      // Immediately advance UI to next card
      position.setValue({ x: 0, y: 0 });
      setIndex((i) => i + 1);
      try {
        cb && (await cb(itemSnapshot, indexSnapshot));
      } finally {
        advancingRef.current = false;
        // Trigger a microtask reconciliation if parent updated data during advance
        requestAnimationFrame(() => {
          const keys = data.map((item, i) => keyExtractor(item, i));
          const first = keys.findIndex((k) => !swipedKeysRef.current.has(k));
          setIndex(first < 0 ? keys.length : Math.max(first, indexSnapshot + 1));
        });
      }
    });
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: position.x, translationY: position.y } }],
    { useNativeDriver: true },
  );

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    const { state, translationX, translationY } = e.nativeEvent as any;
    if (state === 4 /* ACTIVE */) {
      dragging.current = true;
      return;
    }
    if (state === 5 /* END */ || state === 3 /* CANCELLED */ || state === 2 /* FAILED */) {
      dragging.current = false;
      const absX = Math.abs(translationX || 0);
      const absY = Math.abs(translationY || 0);
      if (absX > SWIPE_THRESHOLD_X && absX >= absY) {
        swipeOut(
          translationX > 0 ? 'right' : 'left',
          translationX > 0 ? onSwipeRight : onSwipeLeft,
        );
        return;
      }
      if (-translationY > SWIPE_THRESHOLD_Y && -translationY >= absX) {
        swipeOut('up', onSwipeUp);
        return;
      }
      resetCard();
    }
  };

  // Render stacked cards: top is interactive, others are static with slight scale/offset
  return (
    <View style={styles.container}>
      {nextItems
        .map((item, i) => ({ item, i }))
        .reverse()
        .map(({ item, i }) => {
          const scale = 1 - (i + 1) * 0.05;
          const translateY = (i + 1) * 10;
          return (
            <Animated.View
              key={`stack-${keyExtractor(item, index + 1 + i)}`}
              style={{
                position: 'absolute',
                width: '100%',
                transform: [{ scale }, { translateY }],
              }}
            >
              {renderCard(item, index + 1 + i)}
            </Animated.View>
          );
        })}
      {currentItem ? (
        <PanGestureHandler
          onGestureEvent={onGestureEvent}
          onHandlerStateChange={onHandlerStateChange}
        >
          <Animated.View
            style={{
              transform: [{ translateX: position.x }, { translateY: position.y }, { rotate }],
            }}
          >
            <View>
              {renderCard(currentItem, index)}
              {/* Overlays */}
              <Animated.View
                style={[
                  styles.badge,
                  {
                    left: 16,
                    top: 16,
                    borderColor: overlayLabels?.like?.color || '#22c55e',
                    opacity: likeOpacity,
                  },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: overlayLabels?.like?.color || '#22c55e' }]}
                >
                  {overlayLabels?.like?.text || 'LIKE'}
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.badge,
                  {
                    right: 16,
                    top: 16,
                    borderColor: overlayLabels?.nope?.color || '#ef4444',
                    opacity: nopeOpacity,
                  },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: overlayLabels?.nope?.color || '#ef4444' }]}
                >
                  {overlayLabels?.nope?.text || 'NOPE'}
                </Text>
              </Animated.View>
              <Animated.View
                style={[
                  styles.badge,
                  {
                    alignSelf: 'center',
                    top: 16,
                    borderColor: overlayLabels?.super?.color || '#f59e0b',
                    opacity: superOpacity,
                  },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: overlayLabels?.super?.color || '#f59e0b' }]}
                >
                  {overlayLabels?.super?.text || 'SUPERLIKE'}
                </Text>
              </Animated.View>
            </View>
          </Animated.View>
        </PanGestureHandler>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#00000020',
  },
  badgeText: { fontWeight: '900', fontSize: 16 },
});
