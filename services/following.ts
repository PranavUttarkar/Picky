import { supabase } from './supabase';
import type { UserProfile, UserFollow } from '@/types/models';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

// Shared limiters for this service
const socialLimiter = createRateLimiter({ ...RateLimitPresets.socialAction, key: 'following:action' });
const searchLimiter = createRateLimiter({ ...RateLimitPresets.search, key: 'following:search' });

// Following functions for organization accounts
export async function followUser(userId: string): Promise<void> {
  return socialLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    // Check if target user is an organization
    const { data: targetUser, error: userError } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', userId)
      .single();

    if (userError) throw userError;
    if (targetUser.account_type !== 'organization') {
      throw new Error('Can only follow organization accounts');
    }

    // Check if already following
    const { data: existing } = await supabase
      .from('user_follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('followed_id', userId)
      .maybeSingle();

    if (existing) {
      throw new Error('Already following this organization');
    }

    // Check if blocked
    const { data: blocked } = await supabase
      .from('blocked_users')
      .select('id')
      .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`)
      .maybeSingle();

    if (blocked) {
      throw new Error('Cannot follow blocked user');
    }

    const { error } = await supabase
      .from('user_follows')
      .insert({
        follower_id: user.id,
        followed_id: userId
      });

    if (error) throw error;
  });
}

export async function unfollowUser(userId: string): Promise<void> {
  return socialLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('user_follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('followed_id', userId);

    if (error) throw error;
  });
}

export async function getFollowing(): Promise<UserProfile[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_follows')
    .select(`
      followed:users!user_follows_followed_id_fkey(
        id,
        username,
        display_name,
        account_type,
        email
      )
    `)
    .eq('follower_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => item.followed);
}

export async function getFollowers(): Promise<UserProfile[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_follows')
    .select(`
      follower:users!user_follows_follower_id_fkey(
        id,
        username,
        display_name,
        account_type,
        email
      )
    `)
    .eq('followed_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => item.follower);
}

export async function isFollowing(userId: string): Promise<boolean> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return false;

  const { data, error } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('followed_id', userId)
    .maybeSingle();

  if (error) return false;
  return data !== null;
}

export async function getFollowingCount(userId?: string): Promise<number> {
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) return 0;

  const { count, error } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', targetUserId);

  if (error) return 0;
  return count ?? 0;
}

export async function getFollowersCount(userId?: string): Promise<number> {
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) return 0;

  const { count, error } = await supabase
    .from('user_follows')
    .select('*', { count: 'exact', head: true })
    .eq('followed_id', targetUserId);

  if (error) return 0;
  return count ?? 0;
}

// Get organization accounts for discovery
export async function discoverOrganizations(limit: number = 20): Promise<UserProfile[]> {
  const user = (await supabase.auth.getUser()).data.user;
  
  let query = supabase
    .from('users')
    .select('id, username, display_name, account_type, email')
    .eq('account_type', 'organization')
    .not('username', 'is', null)
    .limit(limit);

  // If user is authenticated, exclude blocked users
  if (user) {
    const { data: blockedUsers } = await supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', user.id);

    const blockedIds = (blockedUsers ?? []).map(b => b.blocked_id);
    if (blockedIds.length > 0) {
      query = query.not('id', 'in', `(${blockedIds.join(',')})`);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// Search organizations by name/username
export async function searchOrganizations(
  query: string, 
  limit: number = 10
): Promise<UserProfile[]> {
  return searchLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    
    let searchQuery = supabase
      .from('users')
      .select('id, username, display_name, account_type, email')
      .eq('account_type', 'organization')
      .not('username', 'is', null)
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    // If user is authenticated, exclude blocked users
    if (user) {
      const { data: blockedUsers } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', user.id);

      const blockedIds = (blockedUsers ?? []).map(b => b.blocked_id);
      if (blockedIds.length > 0) {
        searchQuery = searchQuery.not('id', 'in', `(${blockedIds.join(',')})`);
      }
    }

    const { data, error } = await searchQuery;
    if (error) throw error;
    return data ?? [];
  });
}
