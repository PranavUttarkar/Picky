import { supabase } from '@/services/supabase';
import type { UserProfile, UserRSVP, RSVPCounts } from '@/types/models';
import { createRateLimiter, RateLimitPresets } from '@/utils/rateLimiter';

// Rate limiters for organizer actions
const inviteLimiter = createRateLimiter({ maxRequests: 20, windowMs: 60000, key: 'organizer:invite' });
const rsvpLimiter = createRateLimiter({ maxRequests: 10, windowMs: 60000, key: 'organizer:rsvp' });
const manageLimiter = createRateLimiter({ maxRequests: 30, windowMs: 60000, key: 'organizer:manage' });

// Types for organizer features
export type AttendeeStatus = 'pending' | 'accepted' | 'declined' | 'waitlisted';
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface EventAttendee {
  id: number;
  event_id: number;
  user_id: string;
  status: AttendeeStatus;
  created_at: string;
  responded_at: string | null;
  waitlist_position: number | null;
  user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface EventInvite {
  id: number;
  event_id: number;
  invited_by: string;
  invited_user_id: string;
  status: InviteStatus;
  created_at: string;
  responded_at: string | null;
  invited_user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface RSVPResult {
  status: AttendeeStatus;
  waitlist_position: number | null;
}

export interface EventStats {
  total_attendees: number;
  accepted_count: number;
  pending_count: number;
  waitlisted_count: number;
  declined_count: number;
  capacity: number | null;
  spots_remaining: number | null;
}

// Invite users to an event (organizer only)
export async function inviteUsersToEvent(eventId: number, userIds: string[]): Promise<EventInvite[]> {
  return inviteLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify user is the event organizer
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', eventId)
      .single();

    if (eventError) throw eventError;
    if (event.created_by !== auth.user.id) {
      throw new Error('Only the event organizer can invite users');
    }

    // Create invites for each user
    const invites = userIds.map(userId => ({
      event_id: eventId,
      invited_by: auth.user.id,
      invited_user_id: userId,
      status: 'pending' as const,
    }));

    const { data, error } = await supabase
      .from('event_invites')
      .upsert(invites, { onConflict: 'event_id,invited_user_id' })
      .select(`
        id, event_id, invited_by, invited_user_id, status, created_at, responded_at,
        invited_user:users!event_invites_invited_user_id_fkey(id, username, display_name, avatar_url)
      `);

    if (error) throw error;
    return (data ?? []) as EventInvite[];
  });
}

// Respond to an event invite (invited user)
export async function respondToInvite(
  inviteId: number, 
  response: 'accepted' | 'declined'
): Promise<EventInvite> {
  return rsvpLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Update invite status
    const { data, error } = await supabase
      .from('event_invites')
      .update({ status: response, responded_at: new Date().toISOString() })
      .eq('id', inviteId)
      .eq('invited_user_id', auth.user.id)
      .select()
      .single();

    if (error) throw error;

    // If accepted, also RSVP to the event
    if (response === 'accepted' && data) {
      await rsvpToEvent(data.event_id, 'accepted');
    }

    return data as EventInvite;
  });
}

// RSVP to an event (for public events or after invite acceptance)
export async function rsvpToEvent(eventId: number, status: 'accepted' | 'declined' = 'accepted'): Promise<RSVPResult> {
  return rsvpLimiter.execute(async () => {
    const { data, error } = await supabase.rpc('rsvp_to_event', {
      p_event_id: eventId,
      p_status: status,
    });

    if (error) throw error;
    return data as RSVPResult;
  });
}

// Request to join a private event
export async function requestToJoinEvent(eventId: number): Promise<RSVPResult> {
  return rsvpLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Create a pending attendance record
    const { data, error } = await supabase
      .from('event_attendees')
      .upsert({
        event_id: eventId,
        user_id: auth.user.id,
        status: 'pending',
      }, { onConflict: 'event_id,user_id' })
      .select()
      .single();

    if (error) throw error;
    return {
      status: data.status as AttendeeStatus,
      waitlist_position: data.waitlist_position,
    };
  });
}

// Approve a join request (organizer only)
export async function approveJoinRequest(attendeeId: number): Promise<boolean> {
  return manageLimiter.execute(async () => {
    const { data, error } = await supabase.rpc('approve_join_request', {
      p_attendee_id: attendeeId,
    });

    if (error) throw error;
    return data as boolean; // true if accepted, false if waitlisted
  });
}

// Reject a join request (organizer only)
export async function rejectJoinRequest(attendeeId: number): Promise<void> {
  return manageLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify ownership via the attendee's event
    const { data: attendee, error: attendeeError } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('id', attendeeId)
      .single();

    if (attendeeError) throw attendeeError;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', attendee.event_id)
      .single();

    if (eventError) throw eventError;
    if (event.created_by !== auth.user.id) {
      throw new Error('Only the event organizer can reject requests');
    }

    const { error } = await supabase
      .from('event_attendees')
      .update({ status: 'declined', responded_at: new Date().toISOString() })
      .eq('id', attendeeId);

    if (error) throw error;
  });
}

// Get all attendees for an event
export async function getEventAttendees(
  eventId: number, 
  statusFilter?: AttendeeStatus
): Promise<EventAttendee[]> {
  let query = supabase
    .from('event_attendees')
    .select(`
      id, event_id, user_id, status, created_at, responded_at, waitlist_position,
      user:users!event_attendees_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EventAttendee[];
}

// Get all invites for an event (organizer view)
export async function getEventInvites(eventId: number): Promise<EventInvite[]> {
  const { data, error } = await supabase
    .from('event_invites')
    .select(`
      id, event_id, invited_by, invited_user_id, status, created_at, responded_at,
      invited_user:users!event_invites_invited_user_id_fkey(id, username, display_name, avatar_url)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as EventInvite[];
}

// Get invites received by current user
export async function getMyEventInvites(): Promise<EventInvite[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('event_invites')
    .select(`
      id, event_id, invited_by, invited_user_id, status, created_at, responded_at,
      event:events(id, title, date_time, location, image_url, visibility)
    `)
    .eq('invited_user_id', auth.user.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as any;
}

// Get user's RSVP status for an event
export async function getUserEventStatus(eventId: number): Promise<{
  attendee: EventAttendee | null;
  invite: EventInvite | null;
}> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { attendee: null, invite: null };

  const [attendeeResult, inviteResult] = await Promise.all([
    supabase
      .from('event_attendees')
      .select('*')
      .eq('event_id', eventId)
      .eq('user_id', auth.user.id)
      .maybeSingle(),
    supabase
      .from('event_invites')
      .select('*')
      .eq('event_id', eventId)
      .eq('invited_user_id', auth.user.id)
      .maybeSingle(),
  ]);

  return {
    attendee: attendeeResult.data as EventAttendee | null,
    invite: inviteResult.data as EventInvite | null,
  };
}

// Update attendee status (organizer only)
export async function updateAttendeeStatus(
  attendeeId: number, 
  status: AttendeeStatus
): Promise<EventAttendee> {
  return manageLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    // Verify ownership
    const { data: attendee, error: attendeeError } = await supabase
      .from('event_attendees')
      .select('event_id')
      .eq('id', attendeeId)
      .single();

    if (attendeeError) throw attendeeError;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('created_by')
      .eq('id', attendee.event_id)
      .single();

    if (eventError) throw eventError;
    if (event.created_by !== auth.user.id) {
      throw new Error('Only the event organizer can update attendee status');
    }

    const { data, error } = await supabase
      .from('event_attendees')
      .update({ status, responded_at: new Date().toISOString() })
      .eq('id', attendeeId)
      .select()
      .single();

    if (error) throw error;
    return data as EventAttendee;
  });
}

// Remove an attendee (organizer or self)
export async function removeAttendee(attendeeId: number): Promise<void> {
  return manageLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('id', attendeeId);

    if (error) throw error;
  });
}

// Cancel RSVP (self)
export async function cancelRSVP(eventId: number): Promise<void> {
  return rsvpLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('event_attendees')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', auth.user.id);

    if (error) throw error;

    // Promote next person from waitlist
    await supabase.rpc('promote_from_waitlist', { p_event_id: eventId });
  });
}

// Get event stats for organizer dashboard
export async function getEventStats(eventId: number): Promise<EventStats> {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('capacity')
    .eq('id', eventId)
    .single();

  if (eventError) throw eventError;

  const { data: attendees, error: attendeesError } = await supabase
    .from('event_attendees')
    .select('status')
    .eq('event_id', eventId);

  if (attendeesError) throw attendeesError;

  const stats = {
    total_attendees: attendees?.length ?? 0,
    accepted_count: 0,
    pending_count: 0,
    waitlisted_count: 0,
    declined_count: 0,
    capacity: event.capacity,
    spots_remaining: null as number | null,
  };

  for (const a of attendees ?? []) {
    switch (a.status) {
      case 'accepted': stats.accepted_count++; break;
      case 'pending': stats.pending_count++; break;
      case 'waitlisted': stats.waitlisted_count++; break;
      case 'declined': stats.declined_count++; break;
    }
  }

  if (event.capacity !== null) {
    stats.spots_remaining = Math.max(0, event.capacity - stats.accepted_count);
  }

  return stats;
}

// Get waitlist position for current user
export async function getWaitlistPosition(eventId: number): Promise<number | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data, error } = await supabase.rpc('get_waitlist_position', {
    p_event_id: eventId,
    p_user_id: auth.user.id,
  });

  if (error) return null;
  return data as number | null;
}

// Revoke an invite (organizer only)
export async function revokeInvite(inviteId: number): Promise<void> {
  return manageLimiter.execute(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw new Error('Not authenticated');

    const { error } = await supabase
      .from('event_invites')
      .delete()
      .eq('id', inviteId);

    if (error) throw error;
  });
}

// Search users to invite (excludes already invited)
export async function searchUsersToInvite(
  eventId: number, 
  query: string, 
  limit: number = 10
): Promise<UserProfile[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  // Get already invited users
  const { data: existingInvites } = await supabase
    .from('event_invites')
    .select('invited_user_id')
    .eq('event_id', eventId);

  const invitedIds = (existingInvites ?? []).map(i => i.invited_user_id);

  // Search users
  let searchQuery = supabase
    .from('users')
    .select('id, username, display_name, avatar_url, account_type')
    .not('username', 'is', null)
    .neq('id', auth.user.id)
    .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
    .limit(limit);

  if (invitedIds.length > 0) {
    searchQuery = searchQuery.not('id', 'in', `(${invitedIds.join(',')})`);
  }

  const { data, error } = await searchQuery;
  if (error) throw error;
  return (data ?? []) as UserProfile[];
}

// ============================================
// User RSVP Functions
// ============================================

// Get all RSVPs for current user
export async function getMyRSVPs(statusFilter?: AttendeeStatus): Promise<UserRSVP[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('get_my_rsvps', {
    p_status: statusFilter ?? null,
  });

  if (error) throw error;
  return (data ?? []) as UserRSVP[];
}

// Get upcoming RSVPs (accepted/waitlisted events in the future)
export async function getMyUpcomingRSVPs(): Promise<UserRSVP[]> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('get_my_upcoming_rsvps');

  if (error) throw error;
  return (data ?? []) as UserRSVP[];
}

// Get RSVP counts for current user
export async function getMyRSVPCounts(): Promise<RSVPCounts> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not authenticated');

  const { data, error } = await supabase.rpc('get_my_rsvp_counts');

  if (error) throw error;
  const result = Array.isArray(data) ? data[0] : data;
  return (result ?? {
    total_rsvps: 0,
    accepted_count: 0,
    waitlisted_count: 0,
    pending_count: 0,
    upcoming_count: 0,
  }) as RSVPCounts;
}

