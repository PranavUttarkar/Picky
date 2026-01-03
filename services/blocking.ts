import { supabase } from './supabase';
import type { UserProfile } from '@/types/models';
import { createRateLimiter } from '@/utils/rateLimiter';

// Rate limiter for blocking actions
const blockActionLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, key: 'blocking:action' });

// Blocking functions
export async function blockUser(username: string): Promise<boolean> {
  return blockActionLimiter.execute(async () => {
    const { data, error } = await supabase.rpc('toggle_user_block', {
      p_username: username
    });
    if (error) throw error;
    return data as boolean; // true if now blocked, false if unblocked
  });
}

export async function unblockUser(username: string): Promise<boolean> {
  // Same function as blockUser - it toggles the block status
  return await blockUser(username);
}

export async function isUserBlocked(userId: string): Promise<boolean> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return false;

  const { data, error } = await supabase
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', user.id)
    .eq('blocked_id', userId)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

export async function getBlockedUsers(): Promise<UserProfile[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('blocked_users')
    .select(`
      blocked:users!blocked_users_blocked_id_fkey(
        id,
        username,
        display_name,
        account_type,
        email
      )
    `)
    .eq('blocker_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => item.blocked);
}

export async function getBlockedByUsers(): Promise<UserProfile[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('blocked_users')
    .select(`
      blocker:users!blocked_users_blocker_id_fkey(
        id,
        username,
        display_name,
        account_type,
        email
      )
    `)
    .eq('blocked_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => item.blocker);
}

// Helper function to filter out blocked users from any user list
export async function filterBlockedUsers(users: UserProfile[]): Promise<UserProfile[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user || users.length === 0) return users;

  // Get all blocked user IDs (both directions)
  const { data: blockedData, error } = await supabase
    .from('blocked_users')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);

  if (error) return users;

  const blockedIds = new Set<string>();
  (blockedData ?? []).forEach(block => {
    if (block.blocker_id === user.id) {
      blockedIds.add(block.blocked_id);
    } else {
      blockedIds.add(block.blocker_id);
    }
  });

  return users.filter(u => !blockedIds.has(u.id));
}

// Check if current user is blocked by another user
export async function isBlockedBy(userId: string): Promise<boolean> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return false;

  const { data, error } = await supabase
    .from('blocked_users')
    .select('id')
    .eq('blocker_id', userId)
    .eq('blocked_id', user.id)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

// Get mutual block status between current user and another user
export async function getBlockStatus(userId: string): Promise<{
  isBlocked: boolean;
  isBlockedBy: boolean;
}> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return { isBlocked: false, isBlockedBy: false };

  const { data, error } = await supabase
    .from('blocked_users')
    .select('blocker_id, blocked_id')
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`);

  if (error) return { isBlocked: false, isBlockedBy: false };

  let isBlocked = false;
  let isBlockedBy = false;

  (data ?? []).forEach(block => {
    if (block.blocker_id === user.id && block.blocked_id === userId) {
      isBlocked = true;
    }
    if (block.blocker_id === userId && block.blocked_id === user.id) {
      isBlockedBy = true;
    }
  });

  return { isBlocked, isBlockedBy };
}
