import { memo } from 'react';
import { View, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';

type FloatingAddButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  bottom?: number;
  right?: number;
  size?: number;
};

/**
 * FloatingAddButton - A modern, reusable floating action button (FAB)
 * 
 * Features:
 * - Glassmorphism effect with BlurView
 * - Adaptive colors for light/dark mode
 * - Customizable position and size
 * - Accessible with proper labels
 * - Modern shadow and elevation
 * 
 * Usage:
 * ```tsx
 * <FloatingAddButton
 *   onPress={() => openAddModal()}
 *   accessibilityLabel="Add Event"
 * />
 * ```
 */
export const FloatingAddButton = memo(function FloatingAddButton({
  onPress,
  accessibilityLabel = 'Add',
  bottom = 24,
  right = 16,
  size = 56,
}: FloatingAddButtonProps) {
  const { scheme } = useTheme();
  const c = useThemeColors();

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        right,
        bottom,
      }}
    >
      <BlurView
        intensity={35}
        tint={scheme === 'dark' ? 'dark' : 'light'}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.5)',
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        }}
      >
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          style={({ pressed }) => ({
            width: '100%',
            height: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: pressed
              ? scheme === 'dark'
                ? 'rgba(255,255,255,0.2)'
                : 'rgba(255,255,255,0.3)'
              : scheme === 'dark'
              ? 'rgba(255,255,255,0.1)'
              : 'rgba(255,255,255,0.2)',
            transform: [{ scale: pressed ? 0.95 : 1 }],
          })}
        >
          <Ionicons name="add" size={26} color={c.text} />
        </Pressable>
      </BlurView>
    </View>
  );
});

export default FloatingAddButton;
