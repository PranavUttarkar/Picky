/**
 * Picky Recommendations Service
 * Fetches top matching events or restaurants for a group
 * and persists them to the database for all group members to see
 */

import { supabase } from '@/services/supabase';
import { getTopGroupMatches, type ScoredEvent } from '@/services/events';
import { getTopGroupRestaurantMatches } from '@/services/food';
import type { PickyCommand, PickyCommandType } from '@/utils/pickyParser';
import type { ScoredRestaurant } from '@/types/models';
import type { RealtimeChannel } from '@supabase/supabase-js';

// Re-export types for convenience
export type { ScoredEvent };
export type { ScoredRestaurant };

export interface PickyEventRecommendation {
  id: number;
  title: string;
  description?: string | null;
  image_url?: string | null;
  date_time: string;
  location?: string | null;
  match_percent?: number;
  tags?: string[];
}

export interface PickyFoodRecommendation {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  category?: string | null;
  price_range?: string | null;
  rating?: string | null;
  address?: string | null;
  match_percent?: number;
}

export type PickyRecommendation = 
  | { type: 'event'; data: PickyEventRecommendation }
  | { type: 'food'; data: PickyFoodRecommendation };

export interface PickyRecommendationResult {
  type: PickyCommandType;
  recommendations: PickyRecommendation[];
  requestedCount: number;
  actualCount: number;
  timestamp: string;
}

// Database row type
export interface PickyRecommendationRow {
  id: number;
  group_id: number;
  triggered_by: string;
  trigger_message_id: number | null;
  recommendation_type: 'events' | 'food';
  recommendations: PickyRecommendation[];
  requested_count: number;
  actual_count: number;
  created_at: string;
  // Optional: joined user profile
  triggered_by_user?: {
    id: string;
    username?: string | null;
    display_name?: string | null;
    avatar_url?: string | null;
  };
}

/**
 * Fetch top recommendations based on a Picky command for a group
 */
export async function getPickyRecommendations(
  groupId: number,
  command: PickyCommand
): Promise<PickyRecommendationResult> {
  const { type, count } = command;
  const timestamp = new Date().toISOString();
  
  if (type === 'events') {
    const events = await getTopGroupMatches(groupId, count);
    const recommendations: PickyRecommendation[] = events.map(event => ({
      type: 'event',
      data: {
        id: event.id,
        title: event.title,
        description: event.description,
        image_url: event.image_url || (event.image_urls?.[0]),
        date_time: event.date_time,
        location: event.location,
        match_percent: event.match_percent,
        tags: event.tags,
      },
    }));
    
    return {
      type: 'events',
      recommendations,
      requestedCount: count,
      actualCount: recommendations.length,
      timestamp,
    };
  } else {
    const restaurants = await getTopGroupRestaurantMatches(groupId, count);
    const recommendations: PickyRecommendation[] = restaurants.map(restaurant => ({
      type: 'food',
      data: {
        id: restaurant.id,
        name: restaurant.restaurant_name,
        description: restaurant.description,
        image_url: restaurant.main_image,
        category: restaurant.category,
        price_range: restaurant.price_range,
        rating: restaurant.review_points,
        address: restaurant.address,
        match_percent: restaurant.match_percent,
      },
    }));
    
    return {
      type: 'food',
      recommendations,
      requestedCount: count,
      actualCount: recommendations.length,
      timestamp,
    };
  }
}

/**
 * Save a Picky recommendation to the database
 */
export async function savePickyRecommendation(
  groupId: number,
  result: PickyRecommendationResult,
  triggerMessageId?: number
): Promise<PickyRecommendationRow | null> {
  try {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) {
      console.warn('Cannot save Picky recommendation: not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('picky_recommendations')
      .insert({
        group_id: groupId,
        triggered_by: user.id,
        trigger_message_id: triggerMessageId || null,
        recommendation_type: result.type,
        recommendations: result.recommendations,
        requested_count: result.requestedCount,
        actual_count: result.actualCount,
      })
      .select()
      .single();

    if (error) {
      console.warn('Failed to save Picky recommendation:', error.message);
      return null;
    }
    
    return data as PickyRecommendationRow;
  } catch (e) {
    console.warn('Error saving Picky recommendation:', e);
    return null;
  }
}

/**
 * Fetch all Picky recommendations for a group
 */
export async function getGroupPickyRecommendations(
  groupId: number,
  limit: number = 50
): Promise<PickyRecommendationRow[]> {
  try {
    const { data, error } = await supabase
      .from('picky_recommendations')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(limit);

    // If table doesn't exist or other error, return empty array
    if (error) {
      console.warn('Failed to fetch Picky recommendations:', error.message);
      return [];
    }
    
    if (!data || data.length === 0) return [];
    
    // Fetch user profiles for triggered_by
    const userIds = [...new Set(data.map(r => r.triggered_by))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('users')
        .select('id, username, display_name, avatar_url')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      return data.map(row => ({
        ...row,
        triggered_by_user: profileMap.get(row.triggered_by),
      }));
    }
    
    return data;
  } catch (e) {
    console.warn('Error fetching Picky recommendations:', e);
    return [];
  }
}

/**
 * Subscribe to new Picky recommendations in a group
 * Note: User profile should be resolved by the caller from local state to avoid extra queries
 */
export function subscribeToPickyRecommendations(
  groupId: number,
  onNewRecommendation: (recommendation: PickyRecommendationRow) => void
): RealtimeChannel {
  const channel = supabase.channel(`picky-recommendations-${groupId}`);

  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'picky_recommendations',
      filter: `group_id=eq.${groupId}`,
    },
    (payload) => {
      // Don't fetch user profile here - let the caller resolve it from local state
      // This prevents extra database queries on every realtime event
      const row = payload.new as PickyRecommendationRow;
      onNewRecommendation(row);
    }
  );

  channel.subscribe();
  return channel;
}

/**
 * Convert database row to PickyRecommendationResult format
 */
export function rowToResult(row: PickyRecommendationRow): PickyRecommendationResult {
  return {
    type: row.recommendation_type,
    recommendations: row.recommendations,
    requestedCount: row.requested_count,
    actualCount: row.actual_count,
    timestamp: row.created_at,
  };
}

/**
 * Generate the Picky response message text
 */
export function generatePickyResponseText(result: PickyRecommendationResult): string {
  if (result.actualCount === 0) {
    return result.type === 'events'
      ? "I couldn't find any matching events for your group. Try checking out the Discover tab!"
      : "I couldn't find any matching restaurants for your group. Try exploring the Food tab!";
  }
  
  const emoji = result.type === 'events' ? '🎉' : '🍽️';
  const typeLabel = result.type === 'events' ? 'events' : 'places to eat';
  
  return `${emoji} Here are the top ${result.actualCount} ${typeLabel} matched for your group!`;
}
