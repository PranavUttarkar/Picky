import { supabase } from '@/services/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

// Rate limiters for message operations
const sendMessageLimiter = createRateLimiter({ 
  maxRequests: 30, 
  windowMs: 60000, // 30 messages per minute
  key: 'messages:send' 
});

const reactionLimiter = createRateLimiter({ 
  maxRequests: 60, 
  windowMs: 60000, // 60 reactions per minute
  key: 'messages:reaction' 
});

export interface GroupMessage {
  id: number;
  group_id: number;
  user_id: string;
  message: string;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  is_edited: boolean;
  reply_to_id: number | null;
  user?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
  reactions?: MessageReaction[];
  reply_to?: {
    id: number;
    message: string;
    user_id: string;
    user?: {
      id: string;
      username?: string | null;
      display_name?: string | null;
      avatar_url?: string | null;
    };
  };
}

export interface MessageReaction {
  id: number;
  message_id: number;
  user_id: string;
  emoji: string;
  created_at: string;
  user?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

/**
 * Fetch messages for a group with user profiles and reactions
 */
export async function getGroupMessages(groupId: number, limit: number = 100): Promise<GroupMessage[]> {
  // Fetch messages
  const { data: messages, error } = await supabase
    .from('group_messages')
    .select('*')
    .eq('group_id', groupId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  if (!messages || messages.length === 0) return [];

  // Fetch user profiles for message authors
  const userIds = [...new Set(messages.map(m => m.user_id))];
  const { data: profiles } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

  // Fetch reactions for all messages
  const messageIds = messages.map(m => m.id);
  const { data: reactions } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds);

  // Fetch reactor profiles
  const reactorIds = [...new Set((reactions || []).map(r => r.user_id))];
  const { data: reactorProfiles } = reactorIds.length > 0
    ? await supabase.from('users').select('id, username, display_name, avatar_url').in('id', reactorIds)
    : { data: [] };

  const reactorMap = new Map(reactorProfiles?.map(p => [p.id, p]) || []);

  // Group reactions by message_id
  const reactionsByMessage = new Map<number, MessageReaction[]>();
  reactions?.forEach(r => {
    if (!reactionsByMessage.has(r.message_id)) {
      reactionsByMessage.set(r.message_id, []);
    }
    reactionsByMessage.get(r.message_id)!.push({
      ...r,
      user: reactorMap.get(r.user_id),
    });
  });

  // Fetch reply_to messages if any
  const replyToIds = [...new Set(messages.map(m => m.reply_to_id).filter(Boolean))] as number[];
  const replyToMap = new Map<number, any>();
  
  if (replyToIds.length > 0) {
    const { data: replyMessages } = await supabase
      .from('group_messages')
      .select('id, message, user_id')
      .in('id', replyToIds);

    if (replyMessages) {
      const replyUserIds = [...new Set(replyMessages.map(m => m.user_id))];
      const { data: replyProfiles } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', replyUserIds);
      
      const replyProfileMap = new Map(replyProfiles?.map(p => [p.id, p]) || []);
      
      replyMessages.forEach(rm => {
        replyToMap.set(rm.id, {
          ...rm,
          user: replyProfileMap.get(rm.user_id),
        });
      });
    }
  }

  // Combine everything
  return messages.map(m => ({
    ...m,
    user: profileMap.get(m.user_id),
    reactions: reactionsByMessage.get(m.id) || [],
    reply_to: m.reply_to_id ? replyToMap.get(m.reply_to_id) : undefined,
  }));
}

/**
 * Send a new message to a group
 */
export async function sendMessage(
  groupId: number, 
  message: string,
  replyToId?: number
): Promise<GroupMessage> {
  return sendMessageLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    // Validate message
    if (!message || message.trim().length === 0) {
      throw new Error('Message cannot be empty');
    }

    if (message.length > 5000) {
      throw new Error('Message is too long (max 5000 characters)');
    }

    // Insert message
    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId,
        user_id: user.id,
        message: message.trim(),
        reply_to_id: replyToId || null,
      })
      .select()
      .single();

    if (error) throw error;

    // Fetch user profile
    const { data: profile } = await supabase
      .from('users')
      .select('id, username, display_name, avatar_url')
      .eq('id', user.id)
      .single();

    return {
      ...data,
      user: profile || undefined,
      reactions: [],
    };
  });
}

/**
 * Edit an existing message
 */
export async function editMessage(messageId: number, newMessage: string): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  if (!newMessage || newMessage.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }

  if (newMessage.length > 5000) {
    throw new Error('Message is too long (max 5000 characters)');
  }

  const { error } = await supabase
    .from('group_messages')
    .update({
      message: newMessage.trim(),
      updated_at: new Date().toISOString(),
      is_edited: true,
    })
    .eq('id', messageId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(messageId: number): Promise<void> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('group_messages')
    .update({
      deleted_at: new Date().toISOString(),
    })
    .eq('id', messageId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Toggle a reaction on a message
 */
export async function toggleMessageReaction(messageId: number, emoji: string): Promise<void> {
  return reactionLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    // Check if reaction already exists
    const { data: existing } = await supabase
      .from('message_reactions')
      .select('id')
      .eq('message_id', messageId)
      .eq('user_id', user.id)
      .eq('emoji', emoji)
      .single();

    if (existing) {
      // Remove reaction
      const { error } = await supabase
        .from('message_reactions')
        .delete()
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      // Add reaction
      const { error } = await supabase
        .from('message_reactions')
        .insert({
          message_id: messageId,
          user_id: user.id,
          emoji,
        });

      if (error) throw error;
    }
  });
}

/**
 * Subscribe to new messages in a group
 */
export function subscribeToGroupMessages(
  groupId: number,
  onMessage: (message: GroupMessage) => void,
  onReaction: (reaction: MessageReaction & { message_id: number }) => void,
  onDelete: (messageId: number) => void
): RealtimeChannel {
  const channel = supabase.channel(`group-messages-${groupId}`);

  // Subscribe to new messages
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'group_messages',
      filter: `group_id=eq.${groupId}`,
    },
    async (payload) => {
      const message = payload.new as any;
      
      // Fetch user profile
      const { data: profile } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .eq('id', message.user_id)
        .single();

      // Fetch reply_to if exists
      let replyTo;
      if (message.reply_to_id) {
        const { data: replyMsg } = await supabase
          .from('group_messages')
          .select('id, message, user_id')
          .eq('id', message.reply_to_id)
          .single();

        if (replyMsg) {
          const { data: replyProfile } = await supabase
            .from('users')
            .select('id, username, display_name, avatar_url')
            .eq('id', replyMsg.user_id)
            .single();

          replyTo = {
            ...replyMsg,
            user: replyProfile || undefined,
          };
        }
      }

      onMessage({
        ...message,
        user: profile || undefined,
        reactions: [],
        reply_to: replyTo,
      });
    }
  );

  // Subscribe to message updates (edits, deletes)
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'group_messages',
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      const updated = payload.new as any;
      if (updated.deleted_at) {
        onDelete(updated.id);
      }
    }
  );

  // Subscribe to reaction inserts
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'message_reactions',
    },
    async (payload) => {
      const reaction = payload.new as any;
      // Verify this reaction is for a message in this group
      const { data: message } = await supabase
        .from('group_messages')
        .select('group_id')
        .eq('id', reaction.message_id)
        .single();

      if (message?.group_id === groupId) {
        // Fetch reactor profile
        const { data: profile } = await supabase
          .from('users')
          .select('id, username, display_name, avatar_url')
          .eq('id', reaction.user_id)
          .single();

        onReaction({
          ...reaction,
          user: profile || undefined,
        });
      }
    }
  );

  // Subscribe to reaction deletes
  channel.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'message_reactions',
    },
    async (payload) => {
      // On DELETE, data is in payload.old
      const deletedReaction = payload.old as any;
      if (!deletedReaction || !deletedReaction.message_id) return;
      
      // Verify this reaction is for a message in this group
      const { data: message } = await supabase
        .from('group_messages')
        .select('group_id')
        .eq('id', deletedReaction.message_id)
        .single();

      if (message?.group_id === groupId) {
        // Send reaction with a flag indicating it was deleted (id will be present but negative or undefined check can be used)
        // We'll set id to 0 to indicate deletion
        onReaction({
          ...deletedReaction,
          id: 0, // Signal that this is a deletion
          user: undefined,
        });
      }
    }
  );

  channel.subscribe();
  return channel;
}
