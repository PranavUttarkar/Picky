import { memo } from 'react';
import { View, Pressable, Text, ScrollView, Modal, Platform } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import * as Haptics from 'expo-haptics';

interface EmojiPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  position?: { x: number; y: number };
}

// Common emoji reactions for messages
const QUICK_REACTIONS = [
  '👍', '❤️', '😂', '😮', '😢', '😡',
  '🎉', '🔥', '👏', '🙌', '💯', '✨',
  '🤔', '😊', '😎', '🤝', '💪', '🙏',
];

/**
 * Quick emoji picker for message reactions
 * Similar to iMessage's reaction tray
 */
const EmojiPicker = memo(function EmojiPicker({
  visible,
  onClose,
  onSelect,
  position,
}: EmojiPickerProps) {
  const c = useThemeColors();

  const handleSelect = (emoji: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onSelect(emoji);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={onClose}
      >
        <Pressable
          style={{
            backgroundColor: c.card,
            borderRadius: 24,
            padding: 16,
            maxWidth: 300,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 12,
            elevation: 8,
          }}
          onPress={(e) => e.stopPropagation()}
        >
          <Text
            style={{
              color: c.text,
              fontSize: 16,
              fontWeight: '700',
              marginBottom: 12,
              textAlign: 'center',
            }}
          >
            React with emoji
          </Text>
          
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 8,
              justifyContent: 'center',
            }}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => handleSelect(emoji)}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 24,
                  backgroundColor: pressed ? c.muted + '20' : 'transparent',
                })}
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
});

export default EmojiPicker;
