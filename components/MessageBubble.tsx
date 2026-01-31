import { memo, useState, useRef, useEffect } from 'react';
import { View, Text, Pressable, Platform, Modal, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';
import Avatar from '@/components/Avatar';
import * as Haptics from 'expo-haptics';
import type { GroupMessage, MessageReaction } from '@/services/messages';

// Quick emoji reactions for messages
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🔥'];

interface MessageBubbleProps {
  message: GroupMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  onLongPress?: () => void;
  onReactionPress?: (emoji: string) => void;
  onReplyPress?: () => void;
  onDelete?: () => void;
  onAvatarPress?: (userId: string) => void;
}

/**
 * iMessage-style message bubble component
 * Features:
 * - Different styles for own vs other messages
 * - Avatar display for other users
 * - Reply threading
 * - Emoji reactions
 * - Long press for actions
 * - Timestamp display
 * - Edited indicator
 */
const MessageBubble = memo(function MessageBubble({
  message,
  isOwnMessage,
  showAvatar = true,
  isFirstInGroup = true,
  isLastInGroup = true,
  onLongPress,
  onReactionPress,
  onReplyPress,
  onDelete,
  onAvatarPress,
}: MessageBubbleProps) {
  const c = useThemeColors();
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showReactionMenu, setShowReactionMenu] = useState(false);

  // When on web, prefer showing the reaction menu whenever the message
  // is hovered (or actions have been toggled). This makes the reactions
  // appear when hovering anywhere over the message, not just when
  // hovering the small icon.
  const isWeb = Platform.OS === 'web';
  const isTouchDevice = typeof globalThis !== 'undefined' && (
    ('ontouchstart' in (globalThis as any)) || (typeof (globalThis as any).navigator !== 'undefined' && ((globalThis as any).navigator.maxTouchPoints ?? 0) > 0)
  );

  useEffect(() => {
    if (isWeb) {
      setShowReactionMenu(hovered || showActions);
    }
  }, [hovered, showActions, isWeb]);
  // Entrance animation for optimistic messages (negative id)
  const anim = useRef(new Animated.Value(message.id < 0 ? 0 : 1)).current;
  useEffect(() => {
    if (message.id < 0) {
      anim.setValue(0);
      Animated.parallel([
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [message.id, anim]);

  const handleLongPress = () => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onLongPress?.();
    setShowEmojiPicker(true);
  };

  const handleEmojiSelect = (emoji: string) => {
    onReactionPress?.(emoji);
    setShowEmojiPicker(false);
  };

  // Group reactions by emoji
  const reactionGroups = message.reactions?.reduce((acc, reaction) => {
    if (!acc[reaction.emoji]) {
      acc[reaction.emoji] = [];
    }
    acc[reaction.emoji].push(reaction);
    return acc;
  }, {} as Record<string, MessageReaction[]>);

  const reactionEntries = Object.entries(reactionGroups || {});

  // Format timestamp
  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const displayName = message.user?.display_name || message.user?.username || 'Member';

  return (
    <Animated.View
      // @ts-ignore - onHoverIn/onHoverOut exist on web
      onHoverIn={() => {
        if (isWeb) setHovered(true);
      }}
      onHoverOut={() => {
        if (isWeb) {
          setHovered(false);
          setShowActions(false);
        }
      }}
      style={{
        flexDirection: isOwnMessage ? 'row-reverse' : 'row',
        marginBottom: isLastInGroup ? 12 : 2,
        paddingHorizontal: 12,
        alignItems: 'flex-end',
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}
    >
      {/* Avatar for other users */}
      {!isOwnMessage && showAvatar && (
        <Pressable onPress={() => onAvatarPress?.(message.user_id)} style={{ marginRight: 8, marginBottom: 20 }}>
          <Avatar uri={message.user?.avatar_url} size={32} />
        </Pressable>
      )}
      
      {/* Spacer when avatar is hidden but not own message */}
      {!isOwnMessage && !showAvatar && <View style={{ width: 40 }} />}

      {/* Message content container */}
      <View
        style={{
          maxWidth: '75%',
          alignItems: isOwnMessage ? 'flex-end' : 'flex-start',
          position: 'relative',
        }}
      >
        {/* Sender name (only for other users and first message in group) */}
        {!isOwnMessage && isFirstInGroup && (
          <Text style={{
            color: c.muted,
            fontSize: 11,
            fontWeight: '600',
            marginBottom: 2,
            marginLeft: 12,
          }}>
            {displayName}
          </Text>
        )}

        {/* Reply preview */}
        {message.reply_to && (
          <View style={{
            backgroundColor: isOwnMessage 
              ? 'rgba(0, 122, 255, 0.1)' 
              : c.muted + '20',
            borderLeftWidth: 3,
            borderLeftColor: isOwnMessage ? '#007AFF' : c.muted,
            borderRadius: 12,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
            padding: 8,
            marginBottom: 4,
            maxWidth: '100%',
          }}>
            <Text style={{
              color: c.muted,
              fontSize: 11,
              fontWeight: '600',
              marginBottom: 2,
            }}>
              {message.reply_to.user?.display_name || message.reply_to.user?.username || 'Member'}
            </Text>
            <Text
              style={{
                color: c.text,
                fontSize: 13,
                opacity: 0.7,
              }}
              numberOfLines={2}
            >
              {message.reply_to.message}
            </Text>
          </View>
        )}

        {/* Message bubble */}
        <Pressable
          onLongPress={handleLongPress}
          onPress={() => {
            // On mobile web (touch devices) toggle the action buttons when tapping
            if (isWeb && isTouchDevice) {
              setShowActions((s) => !s);
            }
          }}
          style={{
            backgroundColor: isOwnMessage 
              ? '#007AFF'  // iMessage blue
              : c.card,
            borderRadius: 18,
            borderTopLeftRadius: isOwnMessage ? 18 : (showAvatar && !isOwnMessage ? 4 : 18),
            borderTopRightRadius: isOwnMessage ? 4 : 18,
            paddingHorizontal: 14,
            paddingVertical: 10,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 1,
            ...Platform.select({
              web: {
                cursor: 'pointer',
                outlineWidth: 0,
                outlineColor: 'transparent',
              },
            }),
          }}
        >
          <Text style={{
            color: isOwnMessage ? '#FFFFFF' : c.text,
            fontSize: 15,
            lineHeight: 20,
          }}>
            {message.message}
          </Text>
        </Pressable>

        {/* Action buttons (web hover or mobile web tap): reactions, reply, delete */}
        {isWeb && (hovered || showActions) && (
          <View style={{
            position: 'absolute',
            top: 8,
            right: !isOwnMessage ? -110 : undefined,
            left: isOwnMessage ? -110 : undefined,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <View style={{ marginRight: 6, position: 'relative' }}>
              <Pressable onPress={() => { if (isTouchDevice) setShowReactionMenu(s => !s); }} style={[{ padding: 6, borderRadius: 20 }, Platform.select({ web: { outlineWidth: 0, outlineColor: 'transparent' } })]}>
                <Ionicons name="happy-outline" size={18} color={c.muted} />
              </Pressable>

              {showReactionMenu && (
                <View style={{
                  position: 'absolute',
                  top: -48,
                  left: -8,
                  flexDirection: 'row',
                  backgroundColor: c.card,
                  padding: 6,
                  borderRadius: 20,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.12,
                  shadowRadius: 6,
                  elevation: 6,
                }}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <Pressable
                      key={emoji}
                      onPress={() => { onReactionPress?.(emoji); setShowReactionMenu(false); }}
                      style={{ padding: 6, marginHorizontal: 2 }}
                    >
                      <Text style={{ fontSize: 18 }}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            <Pressable onPress={() => onReplyPress?.()} style={[{ padding: 6, borderRadius: 20, marginRight: 6 }, Platform.select({ web: { outlineWidth: 0, outlineColor: 'transparent' } })]}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={c.muted} />
            </Pressable>
          </View>
        )}

        {/* Reactions */}
        {reactionEntries.length > 0 && (
          <View style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            marginTop: 4,
            gap: 4,
          }}>
            {reactionEntries.map(([emoji, reactions]) => (
              <Pressable
                key={emoji}
                onPress={() => onReactionPress?.(emoji)}
                style={{
                  backgroundColor: c.card,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.muted + '30',
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.05,
                  shadowRadius: 2,
                  elevation: 1,
                }}
              >
                <Text style={{ fontSize: 14 }}>{emoji}</Text>
                {reactions.length > 1 && (
                  <Text style={{
                    color: c.text,
                    fontSize: 12,
                    fontWeight: '600',
                  }}>
                    {reactions.length}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        )}

        {/* Timestamp and status (only show for last message in a grouped sequence) */}
        {isLastInGroup && (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 2,
            gap: 4,
            opacity: 0.6,
          }}>
            <Text style={{
              color: c.muted,
              fontSize: 11,
            }}>
              {formatTime(message.created_at)}
            </Text>
            {message.is_edited && (
              <Text style={{
                color: c.muted,
                fontSize: 11,
              }}>
                • Edited
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Spacer for own messages */}
      {isOwnMessage && <View style={{ width: 40 }} />}

      {/* Quick Emoji Picker Modal */}
      {showEmojiPicker && (
        <Modal
          visible={showEmojiPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowEmojiPicker(false)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: 'rgba(0,0,0,0.4)',
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setShowEmojiPicker(false)}
          >
            <Pressable
              style={{
                backgroundColor: c.card,
                borderRadius: 24,
                padding: 16,
                maxWidth: 280,
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
                  fontSize: 15,
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
                    onPress={() => handleEmojiSelect(emoji)}
                    style={({ pressed }) => ({
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 22,
                      backgroundColor: pressed ? c.muted + '20' : 'transparent',
                    })}
                  >
                    <Text style={{ fontSize: 26 }}>{emoji}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Animated.View>
  );
});

export default MessageBubble;

/**
 * Date separator component for grouping messages by date
 */
export const DateSeparator = memo(function DateSeparator({ date }: { date: string }) {
  const c = useThemeColors();
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === now.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'long', 
        day: 'numeric', 
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined 
      });
    }
  };

  return (
    <View style={{
      alignItems: 'center',
      marginVertical: 16,
    }}>
      <View style={{
        backgroundColor: c.muted + '20',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
      }}>
        <Text style={{
          color: c.muted,
          fontSize: 12,
          fontWeight: '600',
        }}>
          {formatDate(date)}
        </Text>
      </View>
    </View>
  );
});

/**
 * Typing indicator component
 */
export const TypingIndicator = memo(function TypingIndicator({ 
  users 
}: { 
  users: Array<{ id: string; display_name?: string | null; username?: string | null }> 
}) {
  const c = useThemeColors();
  
  if (users.length === 0) return null;

  const displayNames = users.map(u => u.display_name || u.username || 'Someone');
  const text = displayNames.length === 1 
    ? `${displayNames[0]} is typing...`
    : displayNames.length === 2
    ? `${displayNames[0]} and ${displayNames[1]} are typing...`
    : `${displayNames[0]} and ${displayNames.length - 1} others are typing...`;

  return (
    <View style={{
      flexDirection: 'row',
      paddingHorizontal: 12,
      paddingVertical: 8,
      alignItems: 'center',
    }}>
      <View style={{
        backgroundColor: c.card,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}>
        <View style={{
          flexDirection: 'row',
          gap: 4,
        }}>
          {[0, 1, 2].map(i => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: c.muted,
                opacity: 0.6,
              }}
            />
          ))}
        </View>
        <Text style={{
          color: c.muted,
          fontSize: 13,
          fontStyle: 'italic',
        }}>
          {text}
        </Text>
      </View>
    </View>
  );
});
