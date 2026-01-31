# Group Chat Setup Guide

## Quick Start

Follow these steps to enable group chat messaging in your Picky installation.

## Prerequisites

- Supabase CLI installed and configured
- Existing Picky project with groups functionality
- Node.js and npm/yarn installed

## Installation Steps

### 1. Database Migration

Run the migration to create the necessary tables:

```bash
# Navigate to project root
cd /path/to/Picky

# Apply the migration using Supabase CLI
supabase db push

# Or manually execute the migration SQL
# supabase/migrations/0046_group_messages.sql
```

This creates:
- `group_messages` table
- `message_reactions` table
- Necessary indexes
- Row Level Security (RLS) policies

### 2. Verify Database Setup

Connect to your Supabase project and verify:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('group_messages', 'message_reactions');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('group_messages', 'message_reactions');

-- Should return rowsecurity = true for both tables
```

### 3. Enable Realtime (Supabase Dashboard)

1. Go to Supabase Dashboard → Database → Replication
2. Enable replication for:
   - `group_messages`
   - `message_reactions`
3. Click "Save"

### 4. Test the Feature

1. Start your development server:
```bash
npm run web
# or
npm run ios
```

2. Navigate to any group page
3. Try sending a message
4. Test reactions by long-pressing a message
5. Test reply functionality

## Configuration

### Rate Limits

Default rate limits are set in `services/messages.ts`:

```typescript
// Adjust these values as needed
const sendMessageLimiter = createRateLimiter({ 
  maxRequests: 30,    // messages
  windowMs: 60000,    // per minute
  key: 'messages:send' 
});

const reactionLimiter = createRateLimiter({ 
  maxRequests: 60,    // reactions
  windowMs: 60000,    // per minute
  key: 'messages:reaction' 
});
```

### Message Length

To change the maximum message length, update both:

1. **Service validation** (`services/messages.ts`):
```typescript
if (message.length > 5000) {  // Change this value
  throw new Error('Message is too long (max 5000 characters)');
}
```

2. **Input component** (`components/MessageInput.tsx`):
```typescript
<TextInput
  maxLength={5000}  // Change this value
  // ...
/>
```

### Emoji Reactions

To customize quick reaction emojis, edit:

**MessageBubble.tsx**:
```typescript
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '🔥'];
// Add or remove emojis as desired
```

**EmojiPicker.tsx**:
```typescript
const QUICK_REACTIONS = [
  '👍', '❤️', '😂', '😮', '😢', '😡',
  '🎉', '🔥', '👏', '🙌', '💯', '✨',
  '🤔', '😊', '😎', '🤝', '💪', '🙏',
];
// Customize the full picker selection
```

## Troubleshooting

### Migration Fails

**Error**: "relation already exists"
- Some tables may already be created
- Check which tables exist and manually create missing ones
- Or modify migration to use `CREATE TABLE IF NOT EXISTS`

**Error**: "permission denied"
- Ensure you're authenticated with Supabase CLI
- Run `supabase login` and try again
- Check your database permissions

### Messages Don't Appear

1. **Check Realtime is enabled**:
   - Supabase Dashboard → Database → Replication
   - Ensure `group_messages` has replication enabled

2. **Check RLS Policies**:
```sql
-- View policies
SELECT * FROM pg_policies 
WHERE tablename IN ('group_messages', 'message_reactions');

-- Should see 4 policies for group_messages
-- Should see 3 policies for message_reactions
```

3. **Check group membership**:
```sql
-- Verify user is in group
SELECT * FROM group_members 
WHERE group_id = YOUR_GROUP_ID 
AND user_id = YOUR_USER_ID;
```

### Reactions Don't Work

1. **Check table exists**:
```sql
SELECT * FROM message_reactions LIMIT 1;
```

2. **Check RLS policy**:
```sql
-- Test insert permission
INSERT INTO message_reactions (message_id, user_id, emoji) 
VALUES (TEST_MESSAGE_ID, auth.uid(), '👍');
```

3. **Check browser console** for errors

### Performance Issues

If you have many messages (100+):

1. **Implement pagination** in `getGroupMessages`:
```typescript
export async function getGroupMessages(
  groupId: number, 
  limit: number = 100,
  offset: number = 0  // Add pagination
): Promise<GroupMessage[]> {
  const { data: messages, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1)  // Add range
    .limit(limit);
  // ...
}
```

2. **Add virtual scrolling** using `@react-native-community/virtualized-lists`

3. **Optimize queries** with database indexes (already included in migration)

## Development Tips

### Testing Locally

1. **Use multiple browser windows/tabs** to simulate multiple users
2. **Open browser console** to see real-time subscription logs
3. **Check Supabase Dashboard** → Table Editor to view data directly
4. **Monitor rate limits** in Network tab

### Debugging

Enable verbose logging in `services/messages.ts`:

```typescript
export async function sendMessage(/* ... */) {
  console.log('[Messages] Sending message:', { groupId, message, replyToId });
  
  // ... existing code ...
  
  console.log('[Messages] Message sent successfully:', data);
  return /* ... */;
}
```

### Adding Features

To add new features like typing indicators:

1. **Add database tracking**:
```sql
CREATE TABLE group_typing_status (
  group_id BIGINT REFERENCES groups(id),
  user_id UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (group_id, user_id)
);
```

2. **Add service functions**:
```typescript
export async function updateTypingStatus(groupId: number, isTyping: boolean) {
  if (isTyping) {
    await supabase.from('group_typing_status').upsert({ group_id: groupId });
  } else {
    await supabase.from('group_typing_status').delete().eq('group_id', groupId);
  }
}
```

3. **Subscribe to updates**:
```typescript
channel.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'group_typing_status',
  filter: `group_id=eq.${groupId}`
}, (payload) => {
  // Update UI with typing users
});
```

## Production Deployment

### Before Deploying

- [ ] Test with real users
- [ ] Verify rate limits are appropriate
- [ ] Check mobile responsiveness
- [ ] Test on slow network connections
- [ ] Review RLS policies for security
- [ ] Set up monitoring/logging

### Deployment Checklist

1. **Run migration on production database**:
```bash
supabase db push --db-url "postgresql://..."
```

2. **Enable Realtime on production**:
   - Go to production Supabase project
   - Enable replication for new tables

3. **Deploy code**:
```bash
# Build for production
npm run build

# Deploy to Vercel/Netlify
npm run deploy
```

4. **Monitor**:
   - Check Supabase Dashboard → Logs
   - Monitor error rates
   - Watch database performance

### Post-Deployment

- Monitor database size growth
- Check query performance
- Set up alerts for errors
- Gather user feedback

## Support

For issues or questions:
- Check existing GitHub issues
- Review Supabase documentation
- Check React Native/Expo docs for platform-specific issues

## Next Steps

Once basic messaging is working:
- [ ] Add image attachments
- [ ] Implement typing indicators
- [ ] Add push notifications
- [ ] Create message search
- [ ] Add message threading
- [ ] Implement read receipts

See `docs/group-chat-messaging.md` for full feature documentation.
