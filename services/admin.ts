import { supabase } from '@/services/supabase';

/**
 * Suspend a user (can login but cannot post events)
 * @param userId User ID to suspend
 * @param reason Optional reason for suspension
 * @param until Optional timestamp for temporary suspension (if null, permanent until manually unsuspended)
 */
export async function suspendUser(
  userId: string,
  reason?: string | null,
  until?: string | null // ISO string
): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      is_suspended: true,
      suspension_reason: reason || null,
      suspended_until: until || null,
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Ban a user permanently (cannot login at all)
 * @param userId User ID to ban
 * @param reason Optional reason for ban
 */
export async function banUser(userId: string, reason?: string | null): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      is_banned: true,
      is_suspended: true, // Banned users are also suspended
      suspension_reason: reason || null,
    })
    .eq('id', userId);

  if (error) throw error;

  // Note: To fully prevent login, you may need to use Supabase Auth hooks
  // or handle this in your authentication flow
}

/**
 * Remove suspension from a user
 */
export async function unsuspendUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      is_suspended: false,
      suspended_until: null,
      suspension_reason: null,
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Remove ban from a user
 */
export async function unbanUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({
      is_banned: false,
      is_suspended: false,
      suspended_until: null,
      suspension_reason: null,
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Check if a user is currently suspended or banned
 */
export async function checkUserStatus(userId: string): Promise<{
  is_suspended: boolean;
  is_banned: boolean;
  suspended_until: string | null;
  suspension_reason: string | null;
}> {
  const { data, error } = await supabase
    .from('users')
    .select('is_suspended, is_banned, suspended_until, suspension_reason')
    .eq('id', userId)
    .single();

  if (error) throw error;

  return {
    is_suspended: data?.is_suspended || false,
    is_banned: data?.is_banned || false,
    suspended_until: data?.suspended_until || null,
    suspension_reason: data?.suspension_reason || null,
  };
}

