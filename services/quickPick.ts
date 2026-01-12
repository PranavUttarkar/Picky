/**
 * Quick Pick Service
 * Handles ephemeral group decision sessions for fast, fun decision-making.
 * Sessions are lightweight and auto-expire, enabling rapid coordination.
 */

import { supabase } from '@/services/supabase';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';
import { getTopGroupMatches, getUpcomingEvents } from '@/services/events';
import { getTopGroupRestaurantMatches, listRestaurants } from '@/services/food';
import { createGroup, joinGroupByCode, getGroupMembers } from '@/services/groups';
import { createPollWithOptions, createTextPoll } from '@/services/polls';
import type { Event, Restaurant, ScoredRestaurant, Group, UserProfile } from '@/types/models';
import type { ScoredEvent } from '@/services/events';

// Rate limiters
const sessionLimiter = createRateLimiter({ ...RateLimitPresets.create, key: 'quickPick:session' });
const joinLimiter = createRateLimiter({ ...RateLimitPresets.groupAction, key: 'quickPick:join' });

// ============================================================================
// TYPES
// ============================================================================

export type TimeWindow = 
  | 'tonight'      // Today 5pm-11pm
  | 'tomorrow'     // Tomorrow all day
  | 'this-weekend' // Sat-Sun
  | 'this-week'    // Next 7 days
  | 'custom';      // User picks specific date/time

export type DecisionCategory = 'events' | 'food' | 'both';

export interface QuickSession {
  id: string;           // The group ID as string
  groupId: number;      // Underlying group ID
  inviteCode: string;   // Share code
  name: string;         // Session name
  createdBy: string;    // Creator user ID
  timeWindow: TimeWindow;
  windowStart: string;  // ISO date
  windowEnd: string;    // ISO date
  category: DecisionCategory;
  pollId?: number;      // Created poll ID (once voting starts)
  status: 'gathering' | 'voting' | 'decided';
}

export interface SessionParticipant {
  id: string;
  name?: string | null;
  avatar_url?: string | null;
  hasVoted?: boolean;
}

// ============================================================================
// TIME WINDOW HELPERS
// ============================================================================

/**
 * Calculate actual date range from a TimeWindow
 */
export function getTimeWindowRange(window: TimeWindow, customStart?: Date, customEnd?: Date): { start: Date; end: Date } {
  const now = new Date();
  
  switch (window) {
    case 'tonight': {
      const start = new Date(now);
      start.setHours(17, 0, 0, 0); // 5pm
      if (now.getHours() >= 17) {
        // If it's past 5pm, start from now
        start.setTime(now.getTime());
      }
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'tomorrow': {
      const start = new Date(now);
      start.setDate(start.getDate() + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'this-weekend': {
      const dayOfWeek = now.getDay();
      const daysUntilSat = dayOfWeek === 0 ? 6 : (6 - dayOfWeek);
      const start = new Date(now);
      start.setDate(start.getDate() + daysUntilSat);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1); // Sunday
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'this-week': {
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    case 'custom': {
      if (customStart && customEnd) {
        return { start: customStart, end: customEnd };
      }
      // Fallback to this week
      const start = new Date(now);
      const end = new Date(now);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    
    default:
      return { start: now, end: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
  }
}

/**
 * Get human-readable label for time window
 */
export function getTimeWindowLabel(window: TimeWindow): string {
  switch (window) {
    case 'tonight': return 'Tonight';
    case 'tomorrow': return 'Tomorrow';
    case 'this-weekend': return 'This Weekend';
    case 'this-week': return 'This Week';
    case 'custom': return 'Custom Time';
    default: return 'Anytime';
  }
}

/**
 * Format date range for display
 */
export function formatTimeRange(start: Date, end: Date): string {
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  };
  
  const startStr = start.toLocaleDateString('en-US', options);
  const endStr = end.toLocaleDateString('en-US', options);
  
  if (startStr === endStr) {
    return startStr;
  }
  return `${startStr} - ${endStr}`;
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Create a new Quick Pick session (creates underlying group)
 */
export async function createQuickSession(
  name: string,
  timeWindow: TimeWindow,
  category: DecisionCategory,
  customStart?: Date,
  customEnd?: Date
): Promise<QuickSession> {
  return sessionLimiter.execute(async () => {
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) throw new Error('Not authenticated');
    
    // Create group with a fun name
    const sessionName = name || `Quick Pick ${new Date().toLocaleDateString()}`;
    const { group_id, invite_code } = await createGroup(sessionName);
    
    const { start, end } = getTimeWindowRange(timeWindow, customStart, customEnd);
    
    // Store session metadata (we use group name + invite code for now)
    // In production, you'd want a separate quick_sessions table
    return {
      id: String(group_id),
      groupId: group_id,
      inviteCode: invite_code,
      name: sessionName,
      createdBy: user.id,
      timeWindow,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
      category,
      status: 'gathering',
    };
  });
}

/**
 * Join an existing Quick Pick session by invite code
 */
export async function joinQuickSession(inviteCode: string): Promise<{ groupId: number; success: boolean }> {
  return joinLimiter.execute(async () => {
    const groupId = await joinGroupByCode(inviteCode);
    return { groupId, success: true };
  });
}

/**
 * Get session participants
 */
export async function getSessionParticipants(groupId: number): Promise<SessionParticipant[]> {
  const members = await getGroupMembers(groupId);
  return members.map(m => ({
    id: m.id,
    name: m.name,
    avatar_url: m.avatar_url,
    hasVoted: false, // Will be enriched later from poll data
  }));
}

// ============================================================================
// RECOMMENDATIONS ENGINE
// ============================================================================

/**
 * Check if an event falls within the time window
 */
function eventInTimeWindow(event: Event, windowStart: Date, windowEnd: Date): boolean {
  const eventDate = new Date(event.date_time);
  return eventDate >= windowStart && eventDate <= windowEnd;
}

/**
 * Check if a restaurant is likely open during the time window
 * Uses opening hours data if available
 */
function restaurantOpenDuring(restaurant: Restaurant, windowStart: Date): boolean {
  const dayOfWeek = windowStart.getDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayName = dayNames[dayOfWeek];
  
  const openTimeKey = `open_time_${dayName}` as keyof Restaurant;
  const openTime = restaurant[openTimeKey] as string | null;
  
  // If no opening hours data, assume open
  if (!openTime) return true;
  
  // Check if marked as closed
  if (openTime.toLowerCase().includes('closed')) return false;
  
  return true;
}

/**
 * Get filtered events for the time window
 */
export async function getEventsForSession(
  groupId: number,
  windowStart: Date,
  windowEnd: Date,
  limit = 6
): Promise<ScoredEvent[]> {
  try {
    // Get group-scored events first
    const scored = await getTopGroupMatches(groupId, limit * 3);
    const filtered = scored.filter(e => eventInTimeWindow(e, windowStart, windowEnd));
    
    if (filtered.length >= limit) {
      return filtered.slice(0, limit);
    }
    
    // If not enough, fall back to upcoming events
    const upcoming = await getUpcomingEvents(limit * 2);
    const upcomingFiltered = upcoming
      .filter(e => eventInTimeWindow(e, windowStart, windowEnd))
      .filter(e => !filtered.some(f => f.id === e.id));
    
    const combined = [...filtered, ...upcomingFiltered.map(e => ({ ...e, match_percent: 50 }))];
    return combined.slice(0, limit);
  } catch (error) {
    console.error('Error fetching events for session:', error);
    // Return empty on error
    return [];
  }
}

/**
 * Get filtered restaurants for the time window
 */
export async function getRestaurantsForSession(
  groupId: number,
  windowStart: Date,
  limit = 6
): Promise<ScoredRestaurant[]> {
  try {
    // Get group-scored restaurants
    const scored = await getTopGroupRestaurantMatches(groupId, limit * 2);
    const filtered = scored.filter(r => restaurantOpenDuring(r, windowStart));
    
    if (filtered.length >= limit) {
      return filtered.slice(0, limit);
    }
    
    // Fall back to popular restaurants
    const popular = await listRestaurants(0, limit * 2);
    const popularFiltered = popular
      .filter(r => restaurantOpenDuring(r, windowStart))
      .filter(r => !filtered.some(f => f.id === r.id));
    
    const combined = [...filtered, ...popularFiltered.map(r => ({ ...r, match_percent: 50 }))];
    return combined.slice(0, limit);
  } catch (error) {
    console.error('Error fetching restaurants for session:', error);
    return [];
  }
}

/**
 * Get combined recommendations based on category
 */
export async function getSessionRecommendations(
  groupId: number,
  category: DecisionCategory,
  windowStart: Date,
  windowEnd: Date
): Promise<{ events: ScoredEvent[]; restaurants: ScoredRestaurant[] }> {
  let events: ScoredEvent[] = [];
  let restaurants: ScoredRestaurant[] = [];
  
  if (category === 'events' || category === 'both') {
    events = await getEventsForSession(groupId, windowStart, windowEnd, category === 'both' ? 3 : 6);
  }
  
  if (category === 'food' || category === 'both') {
    restaurants = await getRestaurantsForSession(groupId, windowStart, category === 'both' ? 3 : 6);
  }
  
  return { events, restaurants };
}

// ============================================================================
// POLL CREATION FOR SESSION
// ============================================================================

/**
 * Encode restaurant as poll option text (matches existing pattern)
 */
function encodeRestaurantOption(restaurant: Restaurant): string {
  return `[FOOD:${restaurant.id}]${restaurant.restaurant_name}`;
}

/**
 * Create poll for the session based on recommendations
 */
export async function createSessionPoll(
  groupId: number,
  category: DecisionCategory,
  events: ScoredEvent[],
  restaurants: ScoredRestaurant[],
  title?: string
): Promise<number> {
  const pollTitle = title || `Quick Pick - ${new Date().toLocaleDateString()}`;
  
  if (category === 'events' && events.length > 0) {
    // Create event poll
    return await createPollWithOptions(
      groupId,
      events.map(e => e.id),
      { title: pollTitle, mode: 'rating' }
    );
  }
  
  if (category === 'food' && restaurants.length > 0) {
    // Create text poll with encoded restaurant options
    const texts = restaurants.map(r => encodeRestaurantOption(r));
    return await createTextPoll(groupId, texts, { title: pollTitle });
  }
  
  if (category === 'both') {
    // Create mixed poll - encode all as text for flexibility
    const texts: string[] = [
      ...events.map(e => `[EVENT:${e.id}]${e.title}`),
      ...restaurants.map(r => encodeRestaurantOption(r)),
    ];
    return await createTextPoll(groupId, texts, { title: pollTitle });
  }
  
  throw new Error('No options available for poll');
}

// ============================================================================
// SESSION STATUS HELPERS
// ============================================================================

/**
 * Calculate session progress
 */
export function calculateSessionProgress(
  totalMembers: number,
  votedMembers: number
): { percent: number; label: string } {
  if (totalMembers === 0) return { percent: 0, label: 'Waiting for friends' };
  const percent = Math.round((votedMembers / totalMembers) * 100);
  if (percent === 100) return { percent, label: 'Everyone voted!' };
  return { percent, label: `${votedMembers}/${totalMembers} voted` };
}

/**
 * Check if session can proceed to voting
 */
export function canStartVoting(participantCount: number): boolean {
  return participantCount >= 1; // Allow solo quick picks too
}

/**
 * Generate share message for session
 */
export function generateShareMessage(session: { name: string; inviteCode: string }, inviterName?: string): string {
  const who = inviterName ? `${inviterName} invited you` : "You're invited";
  return `🤝 ${who} to make a quick decision!\n\nJoin "${session.name}" on Picky - find the perfect plan in 60 seconds!\n\nTap to join:`;
}
