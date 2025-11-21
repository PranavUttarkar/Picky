import { supabase } from './supabase';
import type { UserSettings } from '@/types/models';

// Privacy settings functions
export async function getUserSettings(): Promise<UserSettings | null> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  // First try to update existing settings
  const { data: updated, error: updateError } = await supabase
    .from('user_settings')
    .update(settings)
    .eq('user_id', user.id)
    .select()
    .maybeSingle();

  if (updateError && updateError.code !== 'PGRST116') { // PGRST116 = no rows found
    throw updateError;
  }

  // If no existing settings, create new ones
  if (!updated) {
    const defaultSettings = {
      user_id: user.id,
      show_activity_to_friends: true,
      show_activity_to_followers: true,
      allow_friend_requests: true,
      ...settings
    };

    const { data: created, error: createError } = await supabase
      .from('user_settings')
      .insert(defaultSettings)
      .select()
      .single();

    if (createError) throw createError;
    return created;
  }

  return updated;
}

export async function getOrCreateUserSettings(): Promise<UserSettings> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');

  let settings = await getUserSettings();
  
  if (!settings) {
    // Create default settings
    settings = await updateUserSettings({
      show_activity_to_friends: true,
      show_activity_to_followers: true,
      allow_friend_requests: true
    });
  }

  return settings;
}

// Privacy check functions
export async function canShowActivityToUser(targetUserId: string): Promise<boolean> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return false;
  if (user.id === targetUserId) return true; // Can always see own activity

  // Get current user's privacy settings
  const settings = await getUserSettings();
  if (!settings) return true; // Default to showing activity if no settings

  // Check if users are blocked
  const { data: blocked } = await supabase
    .from('blocked_users')
    .select('id')
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${user.id})`)
    .maybeSingle();

  if (blocked) return false; // Never show activity to/from blocked users

  // Check relationship type
  const { data: friendship } = await supabase
    .from('friendships')
    .select('status')
    .or(`and(requester_id.eq.${user.id},addressee_id.eq.${targetUserId}),and(requester_id.eq.${targetUserId},addressee_id.eq.${user.id})`)
    .eq('status', 'accepted')
    .maybeSingle();

  if (friendship) {
    return settings.show_activity_to_friends;
  }

  // Check if target user follows current user (for organization accounts)
  const { data: follow } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', targetUserId)
    .eq('followed_id', user.id)
    .maybeSingle();

  if (follow) {
    return settings.show_activity_to_followers;
  }

  return false; // Don't show activity to non-friends/non-followers by default
}

export async function canReceiveFriendRequest(targetUserId: string): Promise<boolean> {
  // Get target user's privacy settings
  const { data: targetSettings } = await supabase
    .from('user_settings')
    .select('allow_friend_requests')
    .eq('user_id', targetUserId)
    .maybeSingle();

  // Default to allowing friend requests if no settings found
  return targetSettings?.allow_friend_requests ?? true;
}

// Bulk privacy check for activity visibility
export async function filterVisibleActivity<T extends { user_id?: string }>(
  activities: T[]
): Promise<T[]> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user || activities.length === 0) return activities;

  const visibleActivities: T[] = [];

  for (const activity of activities) {
    if (!activity.user_id) {
      visibleActivities.push(activity);
      continue;
    }

    const canShow = await canShowActivityToUser(activity.user_id);
    if (canShow) {
      visibleActivities.push(activity);
    }
  }

  return visibleActivities;
}

// Get privacy-aware friend activity counts
export async function getPrivacyAwareFriendCounts(
  itemId: string | number,
  itemType: 'event' | 'restaurant'
): Promise<{ count: number; names: string[] }> {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) return { count: 0, names: [] };

  // Get all friends
  const { data: friends } = await supabase.rpc('get_user_friends');
  if (!friends || friends.length === 0) return { count: 0, names: [] };

  const friendIds = friends.map((f: any) => f.id);
  
  // Get saves from friends for this item
  const tableName = itemType === 'event' ? 'saved_events' : 'saved_restaurants';
  const idColumn = itemType === 'event' ? 'event_id' : 'restaurant_id';

  const { data: saves } = await supabase
    .from(tableName)
    .select('user_id')
    .eq(idColumn, itemId)
    .in('user_id', friendIds);

  if (!saves || saves.length === 0) return { count: 0, names: [] };

  // Filter based on privacy settings
  const visibleSaves: string[] = [];
  
  for (const save of saves) {
    const canShow = await canShowActivityToUser(save.user_id);
    if (canShow) {
      visibleSaves.push(save.user_id);
    }
  }

  // Get names for visible saves
  const { data: userData } = await supabase
    .from('users')
    .select('id, display_name, username')
    .in('id', visibleSaves);

  const names = (userData ?? []).map(u => u.display_name || u.username || 'Friend');

  return {
    count: visibleSaves.length,
    names: names
  };
}
