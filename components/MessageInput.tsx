import { useState, useRef, memo } from 'react';
import { 
  View, 
  Text,
  TextInput, 
  Pressable, 
  Platform, 
  KeyboardAvoidingView,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';
import * as Haptics from 'expo-haptics';
import type { GroupMessage } from '@/services/messages';

interface MessageInputProps {
  onSend: (message: string) => void | Promise<void>;
  replyTo?: GroupMessage | null;
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * iMessage-style message input component
 * Features:
 * - Auto-growing text input
 * - Send button that appears when text is entered
 * - Reply preview with cancel
 * - Emoji picker button
 * - Smooth animations
 */
const MessageInput = memo(function MessageInput({
  onSend,
  replyTo,
  onCancelReply,
  placeholder = 'Message',
  disabled = false,
  compact = false,
}: MessageInputProps) {
  const c = useThemeColors();
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [height, setHeight] = useState(40);
  const sendButtonScale = useRef(new Animated.Value(text.trim() ? 1 : 0)).current;

  const handleSend = async () => {
    if (!text.trim() || isSending || disabled) return;

    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    setIsSending(true);
    try {
      await onSend(text.trim());
      setText('');
      setHeight(40);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleTextChange = (newText: string) => {
    setText(newText);
    
    // Animate send button
    Animated.spring(sendButtonScale, {
      toValue: newText.trim() ? 1 : 0,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const maxInputHeight = 150;

  return (
    <View style={{ position: 'relative' }}>
      {/* Input container */}
      <View style={{
        flexDirection: 'row',
        alignItems: compact ? 'center' : 'flex-end',
        gap: 8,
      }}>
        {/* Text input */}
        <View style={{
          flex: 1,
          backgroundColor: c.background,
          borderRadius: 20,
          paddingHorizontal: 14,
          paddingVertical: compact ? 6 : 8,
          minHeight: compact ? 36 : 40,
          maxHeight: maxInputHeight,
          justifyContent: compact ? 'center' : 'center',
          ...(Platform.select({
            web: {
              outlineStyle: 'none',
            },
          }) as any),
        }}>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder={placeholder}
            placeholderTextColor={c.muted}
            multiline={!compact}
            numberOfLines={compact ? 1 : undefined}
            maxLength={5000}
            editable={!disabled && !isSending}
            onContentSizeChange={(e) => {
              if (!compact) {
                const newHeight = Math.min(
                  Math.max(40, e.nativeEvent.contentSize.height),
                  maxInputHeight
                );
                setHeight(newHeight);
              }
            }}
            style={{
              color: c.text,
              fontSize: 15,
              lineHeight: 20,
              maxHeight: maxInputHeight - 16,
              ...(Platform.select({
                web: {
                  outlineStyle: 'none',
                  resize: 'none',
                },
                ios: compact ? { paddingVertical: 0 } : { paddingTop: 10, paddingBottom: 10 },
                android: compact ? { paddingVertical: 0 } : { paddingTop: 8, paddingBottom: 8 },
              }) as any),
            }}
            returnKeyType="default"
            blurOnSubmit={false}
            onSubmitEditing={(e) => {
              if (!e.nativeEvent.text.includes('\n') && Platform.OS !== 'web') {
                handleSend();
              }
            }}
          />
        </View>

        {/* Send button */}
        <Animated.View
          style={{
            transform: [{ scale: sendButtonScale }],
            opacity: sendButtonScale,
          }}
        >
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || isSending || disabled}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#007AFF',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Ionicons 
              name={isSending ? 'hourglass-outline' : 'arrow-up'} 
              size={20} 
              color="#FFFFFF" 
            />
          </Pressable>
        </Animated.View>
      </View>

      {/* Reply preview (overlay) - positioned above the input so it doesn't push layout */}
      {replyTo && (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 0,
            right: 12,
            bottom: height + 12,
            zIndex: 1000,
            alignItems: 'stretch',
          }}
        >
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: c.card,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: c.muted + '20',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
            elevation: 6,
          }}>
            <View style={{
              width: 3,
              height: 32,
              backgroundColor: '#007AFF',
              borderRadius: 2,
              marginRight: 8,
            }} />
            <View style={{ flex: 1 }}>
              <Text style={{
                color: c.muted,
                fontSize: 11,
                fontWeight: '600',
              }}>
                Replying to {replyTo.user?.display_name || replyTo.user?.username || 'Member'}
              </Text>
              <Text
                style={{
                  color: c.text,
                  fontSize: 12,
                  marginTop: 2,
                }}
                numberOfLines={1}
              >
                {replyTo.message}
              </Text>
            </View>
            <Pressable
              onPress={onCancelReply}
              style={{
                width: 28,
                height: 28,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close-circle" size={18} color={c.muted} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
});

export default MessageInput;

/**
 * Emoji picker button component (placeholder for future emoji picker integration)
 */
export const EmojiPickerButton = memo(function EmojiPickerButton({
  onPress,
}: {
  onPress: () => void;
}) {
  const c = useThemeColors();
  
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name="happy-outline" size={24} color={c.muted} />
    </Pressable>
  );
});
