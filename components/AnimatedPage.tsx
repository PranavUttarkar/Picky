import React, { useCallback, useRef } from 'react';
import { Animated, Easing, ViewStyle, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';

type Variant = 'fade-up' | 'slide-right' | 'pop';

type AnimatedPageProps = {
  children: React.ReactNode;
  variant?: Variant;
  style?: ViewStyle;
  delay?: number;
  duration?: number;
};

// A lightweight, reusable wrapper that plays a short entrance animation
// whenever the screen gains focus. Variants are kept transform/opacity-only
// to fully support useNativeDriver across platforms.
export default function AnimatedPage({
  children,
  variant = 'fade-up',
  style,
  delay = 0,
  duration = 420,
}: AnimatedPageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const reset = () => {
    opacity.setValue(0);
    tx.setValue(variant === 'slide-right' ? 24 : 0);
    ty.setValue(variant === 'fade-up' ? 12 : 0);
    scale.setValue(variant === 'pop' ? 0.96 : 1);
  };

  const play = () => {
    const canNative = Platform.OS !== 'web';
    const common = { delay, useNativeDriver: canNative } as const;
    if (variant === 'pop') {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          ...common,
        }),
        Animated.spring(scale, {
          toValue: 1,
          bounciness: 10,
          speed: 12,
          useNativeDriver: canNative,
        }),
      ]).start();
      return;
    }
    if (variant === 'slide-right') {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          ...common,
        }),
        Animated.timing(tx, { toValue: 0, duration, easing: Easing.out(Easing.cubic), ...common }),
      ]).start();
      return;
    }
    // fade-up default
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        easing: Easing.out(Easing.cubic),
        ...common,
      }),
      Animated.timing(ty, { toValue: 0, duration, easing: Easing.out(Easing.cubic), ...common }),
    ]).start();
  };

  useFocusEffect(
    useCallback(() => {
      reset();
      // short micro-delay avoids conflicting with navigation transition
      const id = setTimeout(play, 10);
      return () => clearTimeout(id);
    }, [variant, delay, duration]),
  );

  return (
    <Animated.View
      style={[{ opacity, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }, style]}
    >
      {children}
    </Animated.View>
  );
}
