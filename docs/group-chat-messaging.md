# Group Chat Messaging Feature

## Overview

A fully-featured, real-time group chat messaging system with iMessage-style UI/UX, integrated seamlessly with the existing polls feature in group pages.

## Features

### ✨ Core Messaging
- **Send/Receive Messages**: Real-time text messaging with instant delivery
- **Reply Threading**: Quote and reply to specific messages
- **Message Editing**: Edit your own messages (marked with "Edited" indicator)
- **Message Deletion**: Soft-delete your own messages
- **Character Limit**: 5,000 characters per message with validation

### 🎨 iMessage-Style UI
- **Bubble Design**: 
  - Blue bubbles (#007AFF) for own messages
  - Card-colored bubbles for other users
  - Rounded corners with tail indicators
  - Shadow effects for depth
- **Avatar Display**: Profile pictures for other users
- **Sender Names**: Display names shown above bubbles
- **Timestamps**: Smart time formatting (Just now, 5m, 2h, 3d)
- **Date Separators**: Automatic date headers (Today, Yesterday, specific dates)
- **Message States**: Visual indicators for edited messages

### 😊 Emoji Reactions
- **Quick Reactions**: 6 common emojis (👍 ❤️ 😂 😮 🎉 🔥)
- **Reaction Counts**: Aggregate and display reaction counts
- **Toggle Reactions**: Tap to add/remove your reaction
- **Multiple Users**: See who reacted with what emoji

### 🔐 Security & Best Practices
- **Row Level Security (RLS)**: 
  - Users can only view messages in groups they're members of
  - Users can only edit/delete their own messages
  - Secure reaction management
- **Rate Limiting**: 
  - 30 messages per minute
  - 60 reactions per minute
- **Input Validation**: 
  - Empty message prevention
  - Length limits
  - Trim whitespace
- **SQL Injection Protection**: Parameterized queries via Supabase

### ⚡ Real-time Features
- **Live Updates**: Instant message delivery using Supabase Realtime
- **Reaction Sync**: Real-time reaction updates
- **Typing Indicators**: Component ready for typing status (future enhancement)
- **Auto-scroll**: Automatically scroll to newest messages

### 📱 Cross-Platform Support
- **iOS**: Native feel with proper keyboard handling
- **Web**: Fully responsive with mouse/keyboard support
- **Android**: Material-style interactions

## Technical Implementation

### Database Schema

```sql
-- Messages Table
CREATE TABLE group_messages (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  is_edited BOOLEAN DEFAULT FALSE,
  reply_to_id BIGINT REFERENCES group_messages(id)
);

-- Reactions Table
CREATE TABLE message_reactions (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT REFERENCES group_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji)
);
```

### API Layer

**Service**: `services/messages.ts`

Key functions:
- `getGroupMessages(groupId, limit)` - Fetch message history
- `sendMessage(groupId, message, replyToId?)` - Send new message
- `editMessage(messageId, newMessage)` - Update existing message
- `deleteMessage(messageId)` - Soft delete message
- `toggleMessageReaction(messageId, emoji)` - Add/remove reaction
- `subscribeToGroupMessages(groupId, callbacks)` - Real-time subscription

### Components

#### MessageBubble
Location: `components/MessageBubble.tsx`

Features:
- iMessage-style bubble rendering
- Avatar display logic
- Reply preview
- Reaction display
- Timestamp formatting
- Long-press actions
- Quick emoji picker modal

Props:
```typescript
{
  message: GroupMessage;
  isOwnMessage: boolean;
  showAvatar?: boolean;
  onLongPress?: () => void;
  onReactionPress?: (emoji: string) => void;
  onReplyPress?: () => void;
  onAvatarPress?: (userId: string) => void;
}
```

#### MessageInput
Location: `components/MessageInput.tsx`

Features:
- Auto-growing text input (max 120px height)
- Animated send button (appears when text entered)
- Reply preview with cancel
- Character count enforcement
- Keyboard handling

Props:
```typescript
{
  onSend: (message: string) => void | Promise<void>;
  replyTo?: GroupMessage | null;
  onCancelReply?: () => void;
  placeholder?: string;
  disabled?: boolean;
}
```

#### DateSeparator
Location: `components/MessageBubble.tsx` (exported)

Features:
- Smart date formatting (Today, Yesterday, full dates)
- Styled separator chip

#### EmojiPicker
Location: `components/EmojiPicker.tsx`

Features:
- Modal overlay with quick emoji selection
- 18 common reactions
- Touch/click handling
- Haptic feedback

### Integration

The messaging system is integrated into `app/(tabs)/groups/[id].tsx`:

1. **Combined Timeline**: Messages and polls are merged into a single chronological feed
2. **Smart Rendering**: Type-based rendering for messages, polls, and date separators
3. **Real-time Sync**: Automatic updates for new messages, reactions, and deletions
4. **Input Bar**: Fixed at bottom with message input
5. **Floating Actions**: Poll and Quick Pick buttons positioned above input

## Usage

### Sending Messages

```typescript
// Simple message
await sendMessage(groupId, "Hello everyone!");

// Reply to message
await sendMessage(groupId, "Thanks!", replyToMessageId);
```

### Adding Reactions

```typescript
// Toggle reaction (adds if not present, removes if already reacted)
await toggleMessageReaction(messageId, "👍");
```

### Long Press Actions

iOS:
- ActionSheet with options: Reply, Copy, Delete (if own message)

Android/Web:
- Alert dialog with same options

### Real-time Subscription

```typescript
const channel = subscribeToGroupMessages(
  groupId,
  (newMessage) => {
    // Handle new message
  },
  (reaction) => {
    // Handle reaction update
  },
  (deletedId) => {
    // Handle message deletion
  }
);

// Cleanup
supabase.removeChannel(channel);
```

## Rate Limits

- **Messages**: 30 per minute per user
- **Reactions**: 60 per minute per user
- **Message Length**: 5,000 characters maximum

## Security Considerations

1. **Authentication Required**: All operations require valid user session
2. **Group Membership**: Users must be group members to view/send messages
3. **Ownership Validation**: Only message authors can edit/delete
4. **Content Filtering**: Consider adding profanity filter (leo-profanity already in dependencies)
5. **Spam Prevention**: Rate limiting on send operations

## Future Enhancements

### Planned Features
- [ ] Typing indicators (component structure ready)
- [ ] Read receipts
- [ ] Message search
- [ ] Image/file attachments
- [ ] Link previews
- [ ] Mentions (@username)
- [ ] Message forwarding
- [ ] Push notifications for new messages

### Performance Optimizations
- [ ] Pagination (load older messages on scroll)
- [ ] Virtual scrolling for large message lists
- [ ] Message caching
- [ ] Optimistic updates

### UI/UX Improvements
- [ ] Swipe to reply gesture
- [ ] Message selection mode (multi-delete)
- [ ] Custom emoji picker with search
- [ ] GIF/sticker support
- [ ] Voice messages
- [ ] Dark mode optimizations

## Testing

### Manual Testing Checklist

- [ ] Send message in group
- [ ] Receive message from another user
- [ ] Reply to a message
- [ ] Edit own message
- [ ] Delete own message
- [ ] Add reaction to message
- [ ] Remove reaction from message
- [ ] Long press message for actions
- [ ] Scroll behavior with many messages
- [ ] iOS keyboard avoidance
- [ ] Web responsiveness
- [ ] Real-time sync between devices

### Test Scenarios

1. **Multi-user Chat**: Have 3+ users send messages simultaneously
2. **Rapid Messaging**: Test rate limiting with fast message sending
3. **Long Messages**: Test with various message lengths
4. **Network Issues**: Test offline/online behavior
5. **Memory**: Test with 100+ messages loaded

## Troubleshooting

### Messages Not Appearing
- Check user authentication status
- Verify group membership in `group_members` table
- Check browser console for subscription errors
- Ensure Supabase Realtime is enabled for the project

### Reactions Not Working
- Verify `message_reactions` table exists
- Check RLS policies are applied
- Ensure emoji string is not empty

### Keyboard Issues (iOS)
- Verify `KeyboardAvoidingView` is properly configured
- Check `behavior="padding"` is set for iOS
- Test with both hardware and software keyboards

### Performance Issues
- Consider implementing pagination if >100 messages
- Check for memory leaks in subscriptions
- Verify cleanup in useEffect return functions

## Migration

To add this feature to an existing Picky installation:

1. **Run Migration**: Execute `supabase/migrations/0046_group_messages.sql`
2. **Add Files**: Copy all new component and service files
3. **Update Dependencies**: Already included in package.json
4. **Test Locally**: Verify database tables and RLS policies
5. **Deploy**: Push migration and code to production

## API Reference

### Messages Service

```typescript
// Fetch messages
getGroupMessages(groupId: number, limit?: number): Promise<GroupMessage[]>

// Send message
sendMessage(groupId: number, message: string, replyToId?: number): Promise<GroupMessage>

// Edit message
editMessage(messageId: number, newMessage: string): Promise<void>

// Delete message
deleteMessage(messageId: number): Promise<void>

// Toggle reaction
toggleMessageReaction(messageId: number, emoji: string): Promise<void>

// Subscribe to updates
subscribeToGroupMessages(
  groupId: number,
  onMessage: (message: GroupMessage) => void,
  onReaction: (reaction: MessageReactionType) => void,
  onDelete: (messageId: number) => void
): RealtimeChannel
```

## Credits

- **Design Inspiration**: Apple iMessage
- **Icons**: Ionicons
- **Real-time**: Supabase Realtime
- **UI Framework**: React Native / Expo

## License

Part of the Picky application. See main project license.
