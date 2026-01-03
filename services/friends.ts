import { supabase } from './supabase';
import type { FriendSearchResult, UserProfile, FriendActivityResult } from '@/types/models';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

// Shared limiters for this service
const friendRequestLimiter = createRateLimiter({ ...RateLimitPresets.friendRequest, key: 'friends:send_request' });
const respondLimiter = createRateLimiter({ ...RateLimitPresets.socialAction, key: 'friends:respond' });
const searchLimiter = createRateLimiter({ ...RateLimitPresets.search, key: 'friends:search' });
const updateProfileLimiter = createRateLimiter({ maxRequests: 5, windowMs: 60000, key: 'friends:update_profile' });
const updateUsernameLimiter = createRateLimiter({ maxRequests: 2, windowMs: 60000, key: 'friends:update_username' });

export interface PendingFriendRequest {
// ... existing interface ...
  id: number;
  requester: UserProfile;
  created_at: string;
}

export interface SentFriendRequest {
// ... existing interface ...
  id: number;
  addressee: UserProfile;
  created_at: string;
}

// Friend management functions
export async function sendFriendRequest(username: string): Promise<number> {
  return friendRequestLimiter.execute(async () => {
    const { data, error } = await supabase.rpc('send_friend_request', { 
      p_addressee_username: username 
    });
    if (error) throw error;
    return data as number;
  });
}

export async function respondToFriendRequest(
  friendshipId: number, 
  response: 'accepted' | 'declined'
): Promise<boolean> {
  return respondLimiter.execute(async () => {
    const { data, error } = await supabase.rpc('respond_to_friend_request', {
      p_friendship_id: friendshipId,
      p_response: response
    });
    if (error) throw error;
    return data as boolean;
  });
}

export async function searchUsersByUsername(
  query: string, 
  limit: number = 10
): Promise<FriendSearchResult[]> {
  return searchLimiter.execute(async () => {
    const { data, error } = await supabase.rpc('search_users_by_username', {
      p_query: query,
      p_limit: limit
    });
    if (error) throw error;
    return (data ?? []) as FriendSearchResult[];
  });
}

export async function getUserFriends(): Promise<UserProfile[]> {
// ... no limit for read ...
  const { data, error } = await supabase.rpc('get_user_friends');
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

export async function removeFriend(friendId: string): Promise<void> {
  return respondLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('friendships')
      .delete()
      .or(`and(requester_id.eq.${user.id},addressee_id.eq.${friendId}),and(requester_id.eq.${friendId},addressee_id.eq.${user.id})`);
    
    if (error) throw error;
  });
}
// ... existing functions ...

export async function getPendingFriendRequests(): Promise<PendingFriendRequest[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      requester:users!friendships_requester_id_fkey(id, username, display_name, account_type, avatar_url)
    `)
    .eq('addressee_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => ({
    id: item.id,
    requester: item.requester,
    created_at: item.created_at
  }));
}

export async function getSentFriendRequests(): Promise<SentFriendRequest[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('friendships')
    .select(`
      id,
      created_at,
      addressee:users!friendships_addressee_id_fkey(id, username, display_name, account_type, avatar_url)
    `)
    .eq('requester_id', user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => ({
    id: item.id,
    addressee: item.addressee,
    created_at: item.created_at
  }));
}

// Activity functions
export async function getEventFriendActivity(eventId: number): Promise<FriendActivityResult> {
  const { data, error } = await supabase.rpc('get_event_friend_activity', {
    p_event_id: eventId
  });
  if (error) throw error;
  
  const result = data?.[0];
  return {
    friend_count: result?.friend_count ?? 0,
    friend_names: result?.friend_names ?? []
  };
}

export async function getRestaurantFriendActivity(restaurantId: string): Promise<FriendActivityResult> {
  const { data, error } = await supabase.rpc('get_restaurant_friend_activity', {
    p_restaurant_id: restaurantId
  });
  if (error) throw error;
  
  const result = data?.[0];
  return {
    friend_count: result?.friend_count ?? 0,
    friend_names: result?.friend_names ?? []
  };
}

// User profile functions
export async function updateUserProfile(updates: {
  username?: string;
  display_name?: string;
  account_type?: 'personal' | 'organization';
  avatar_url?: string; // allow updating avatar
}): Promise<void> {
  return updateProfileLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', user.id);

    if (error) throw error;
  });
}

// Server-enforced username update with 7-day cooldown
export async function updateUsername(newUsername: string): Promise<void> {
  return updateUsernameLimiter.execute(async () => {
    const { error } = await supabase.rpc('update_username', { p_new_username: newUsername });
    if (error) {
      // Map server exceptions to user-friendly messages
      const msg = error.message || '';
      if (/USERNAME_CHANGE_TOO_SOON/.test(msg)) throw new Error('You can only change your username once every 7 days.');
      if (/USERNAME_TAKEN/.test(msg)) throw new Error('That username is already taken.');
      if (/USERNAME_TOO_SHORT/.test(msg)) throw new Error('Username must be at least 3 characters.');
      if (/USERNAME_INVALID_FORMAT/.test(msg)) throw new Error('Only letters, numbers, and underscores allowed.');
      throw error;
    }
  });
}

export async function checkUsernameAvailability(username: string): Promise<boolean> {
  return searchLimiter.execute(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .maybeSingle();

    if (error) throw error;
    return data === null; // Available if no user found
  });
}

export async function generateFriendInviteLink(): Promise<string> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // Get user's username
  const { data: userData, error } = await supabase
    .from('users')
    .select('username')
    .eq('id', user.id)
    .single();

  if (error || !userData?.username) {
    throw new Error('Username required to generate invite link');
  }

  // Generate a simple invite link with username
  const baseUrl = process.env.EXPO_PUBLIC_APP_URL || 'https://usepicky.app';
  return `${baseUrl}/invite/friend/${userData.username}`;
}
