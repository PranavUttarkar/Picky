import { supabase } from './supabase';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';
import type { UserProfile, Event } from '@/types/models';

// Rate limiters for organization actions
const profileLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, key: 'org:profile' });
const queryLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60000, key: 'org:query' });

// Organization category options
export const ORGANIZATION_CATEGORIES = [
  'Student Club',
  'Business',
  'Sports Team',
  'Academic',
  'Arts & Cultural',
  'Religious',
  'Professional',
  'Nonprofit',
  'Greek Life',
  'Other',
] as const;

export type OrganizationCategory = typeof ORGANIZATION_CATEGORIES[number];

// Organization size options
export const ORGANIZATION_SIZES = ['1-10', '10-50', '50-100', '100+'] as const;
export type OrganizationSize = typeof ORGANIZATION_SIZES[number];

// Organization profile type
export interface OrganizationProfile {
  user_id: string;
  category: OrganizationCategory;
  description?: string | null;
  website?: string | null;
  contact_email?: string | null;
  founded_year?: number | null;
  member_count?: OrganizationSize | null;
  verified: boolean;
  created_at: string;
  updated_at: string;
}

// Extended organization type with user info and follower count
export interface OrganizationWithProfile {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  account_type: 'organization';
  category: OrganizationCategory;
  description?: string | null;
  website?: string | null;
  contact_email?: string | null;
  founded_year?: number | null;
  member_count?: OrganizationSize | null;
  verified: boolean;
  follower_count: number;
}

// Input type for creating/updating organization profile
export interface OrganizationProfileInput {
  category: OrganizationCategory;
  description?: string | null;
  website?: string | null;
  contact_email?: string | null;
  founded_year?: number | null;
  member_count?: OrganizationSize | null;
}

// Organization tags type
export interface OrganizationTags {
  user_id: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Get organization tags
export async function getOrganizationTags(userId?: string): Promise<string[]> {
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) return [];

  const { data, error } = await supabase
    .from('organization_tags')
    .select('tags')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) return [];
  return data?.tags || [];
}

// Update organization tags
export async function updateOrganizationTags(tags: string[]): Promise<void> {
  return profileLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('organization_tags')
      .upsert({
        user_id: auth.user.id,
        tags: tags.slice(0, 5), // Limit to 5 tags
      }, { onConflict: 'user_id' });

    if (error) throw error;
  });
}

// Create organization profile
export async function createOrganizationProfile(input: OrganizationProfileInput): Promise<OrganizationProfile> {
  return profileLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user is an organization
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('account_type')
      .eq('id', auth.user.id)
      .single();

    if (userError) throw userError;
    if (userData.account_type !== 'organization') {
      throw new Error('Only organization accounts can create organization profiles');
    }

    const { data, error } = await supabase
      .from('organization_profiles')
      .insert({
        user_id: auth.user.id,
        ...input,
      })
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationProfile;
  });
}

// Get organization profile for current user
export async function getMyOrganizationProfile(): Promise<OrganizationProfile | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error) throw error;
  return data as OrganizationProfile | null;
}

// Get organization profile by user ID (public)
export async function getOrganizationProfile(userId: string): Promise<OrganizationProfile | null> {
  const { data, error } = await supabase
    .from('organization_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data as OrganizationProfile | null;
}

// Get organization with full profile and follower count
export async function getOrganizationWithProfile(userId: string): Promise<OrganizationWithProfile | null> {
  const { data, error } = await supabase.rpc('get_organization_with_profile', {
    p_user_id: userId,
  });

  if (error) throw error;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  
  const row = Array.isArray(data) ? data[0] : data;
  return row as OrganizationWithProfile;
}

// Update organization profile
export async function updateOrganizationProfile(input: Partial<OrganizationProfileInput>): Promise<OrganizationProfile> {
  return profileLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('organization_profiles')
      .update(input)
      .eq('user_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationProfile;
  });
}

// Upsert organization profile (create or update)
export async function upsertOrganizationProfile(input: OrganizationProfileInput): Promise<OrganizationProfile> {
  return profileLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('organization_profiles')
      .upsert({
        user_id: auth.user.id,
        ...input,
      }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) throw error;
    return data as OrganizationProfile;
  });
}

// Get events created by an organization
export async function getOrganizationEvents(userId: string, limit: number = 20): Promise<Event[]> {
  return queryLimiter.execute(async () => {
    const nowIso = new Date().toISOString();

    const { data, error } = await supabase
      .from('events')
      .select(`
        id, title, description, image_url, image_urls, date_time, end_time,
        location, tags, visibility, capacity, allow_join_requests, rsvp_required, created_by
      `)
      .eq('created_by', userId)
      .gte('date_time', nowIso)
      .order('date_time', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Event[];
  });
}

// Get all events by organization (including past)
export async function getAllOrganizationEvents(userId: string, limit: number = 50): Promise<Event[]> {
  return queryLimiter.execute(async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        id, title, description, image_url, image_urls, date_time, end_time,
        location, tags, visibility, capacity, allow_join_requests, rsvp_required, created_by
      `)
      .eq('created_by', userId)
      .order('date_time', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Event[];
  });
}

// Get followers of an organization
export async function getOrganizationFollowers(userId?: string): Promise<UserProfile[]> {
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('user_follows')
    .select(`
      follower:users!user_follows_follower_id_fkey(
        id,
        username,
        display_name,
        avatar_url,
        account_type
      )
    `)
    .eq('followed_id', targetUserId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map((item: any) => item.follower) as UserProfile[];
}

// Discover organizations with profile data
export async function discoverOrganizationsWithProfiles(limit: number = 20): Promise<OrganizationWithProfile[]> {
  const { data, error } = await supabase.rpc('discover_organizations_with_profiles', {
    p_limit: limit,
  });

  if (error) throw error;
  return (data ?? []) as OrganizationWithProfile[];
}

// Search organizations by name/username with profile data
export async function searchOrganizations(
  query: string,
  limit: number = 10
): Promise<OrganizationWithProfile[]> {
  return queryLimiter.execute(async () => {
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, username, display_name, avatar_url, account_type,
        organization_profiles(category, description, verified)
      `)
      .eq('account_type', 'organization')
      .not('username', 'is', null)
      .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
      .limit(limit);

    if (error) throw error;

    // Transform and add follower counts
    const results: OrganizationWithProfile[] = [];
    for (const user of data ?? []) {
      const profile = Array.isArray(user.organization_profiles)
        ? user.organization_profiles[0]
        : user.organization_profiles;

      // Get follower count
      const { count } = await supabase
        .from('user_follows')
        .select('*', { count: 'exact', head: true })
        .eq('followed_id', user.id);

      results.push({
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_url: user.avatar_url,
        account_type: 'organization',
        category: profile?.category ?? 'Other',
        description: profile?.description ?? null,
        verified: profile?.verified ?? false,
        follower_count: count ?? 0,
      } as OrganizationWithProfile);
    }

    return results;
  });
}

// Check if current user is an organization
export async function isOrganizationAccount(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;

  const { data, error } = await supabase
    .from('users')
    .select('account_type')
    .eq('id', auth.user.id)
    .single();

  if (error) return false;
  return data?.account_type === 'organization';
}

// Check if organization has Stripe connected
export async function hasStripeConnected(userId?: string): Promise<boolean> {
  const targetUserId = userId || (await supabase.auth.getUser()).data.user?.id;
  if (!targetUserId) return false;

  const { data, error } = await supabase
    .from('organization_profiles')
    .select('stripe_connected')
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (error) return false;
  return data?.stripe_connected === true;
}
