# Organizer Events System

This document describes the organizer features for managing events, including visibility controls, RSVP management, capacity limits, and waitlist handling.

## Overview

The organizer system allows any authenticated user to create and manage events with the following capabilities:

- **Event Visibility**: Public or private events
- **Capacity Management**: Optional attendee limits with automatic waitlist
- **RSVP Tracking**: Track who's attending, pending approval, or waitlisted
- **RSVP Required**: Organizers can mark events as requiring RSVP to attend
- **Invite System**: Invite specific users to private events
- **Join Requests**: Users can request to join private events (if enabled)
- **My RSVPs Page**: Users can view all events they've RSVP'd for

## Database Schema

### Events Table Extensions

```sql
ALTER TABLE events ADD COLUMN visibility text DEFAULT 'public';
ALTER TABLE events ADD COLUMN capacity integer;
ALTER TABLE events ADD COLUMN allow_join_requests boolean DEFAULT true;
ALTER TABLE events ADD COLUMN rsvp_required boolean DEFAULT false;
```

### Event Attendees Table

Tracks RSVPs with status:

```sql
CREATE TABLE event_attendees (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES events(id),
  user_id uuid REFERENCES users(id),
  status text CHECK (status IN ('pending', 'accepted', 'declined', 'waitlisted')),
  waitlist_position integer,
  created_at timestamptz,
  responded_at timestamptz
);
```

### Event Invites Table

For private event invitations:

```sql
CREATE TABLE event_invites (
  id bigserial PRIMARY KEY,
  event_id bigint REFERENCES events(id),
  invited_by uuid REFERENCES users(id),
  invited_user_id uuid REFERENCES users(id),
  status text CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz,
  responded_at timestamptz
);
```

## Event Visibility Rules

### Public Events

- Visible to all users in feed and search
- Anyone can RSVP (up to capacity)
- Excess RSVPs go to waitlist automatically

### Private Events

- Only visible to:
  - Event creator (organizer)
  - Invited users
  - Users who have requested access
- **Invite Flow**: Organizer invites → User accepts → Becomes attendee
- **Request Flow**: User requests → Organizer approves → Becomes attendee
- Join requests can be disabled per-event

## Service Layer API

### Organizer Service (`services/organizer.ts`)

#### Invite Users

```typescript
inviteUsersToEvent(eventId: number, userIds: string[]): Promise<EventInvite[]>
```

Invite multiple users to an event. Only the event organizer can send invites.

#### Respond to Invite

```typescript
respondToInvite(inviteId: number, response: 'accepted' | 'declined'): Promise<EventInvite>
```

Accept or decline an event invitation.

#### RSVP to Event

```typescript
rsvpToEvent(eventId: number, status?: 'accepted' | 'declined'): Promise<RSVPResult>
```

RSVP to a public event. Returns status and waitlist position if applicable.

#### Request to Join

```typescript
requestToJoinEvent(eventId: number): Promise<RSVPResult>
```

Request to join a private event. Creates a pending attendee record.

#### Approve/Reject Requests

```typescript
approveJoinRequest(attendeeId: number): Promise<boolean>
rejectJoinRequest(attendeeId: number): Promise<void>
```

Organizer actions to approve or reject join requests.

#### Get Event Attendees

```typescript
getEventAttendees(eventId: number, statusFilter?: AttendeeStatus): Promise<EventAttendee[]>
```

Get all attendees for an event, optionally filtered by status.

#### Get Event Stats

```typescript
getEventStats(eventId: number): Promise<EventStats>
```

Returns:
- Total attendees
- Counts by status (accepted, pending, waitlisted, declined)
- Capacity info and remaining spots

### Events Service Extensions

The `EventInput` type now includes:

```typescript
type EventInput = {
  // ...existing fields...
  visibility?: 'public' | 'private';
  capacity?: number | null;
  allow_join_requests?: boolean;
  rsvp_required?: boolean; // NEW: Whether RSVP is required to attend
};
```

### User RSVP Functions

New functions to let users track their RSVPs:

```typescript
// Get all RSVPs for current user
getMyRSVPs(statusFilter?: AttendeeStatus): Promise<UserRSVP[]>

// Get upcoming RSVPs (future events the user is attending or waitlisted)
getMyUpcomingRSVPs(): Promise<UserRSVP[]>

// Get summary counts of user's RSVPs
getMyRSVPCounts(): Promise<RSVPCounts>
```

#### UserRSVP Type

```typescript
interface UserRSVP {
  attendee_id: number;
  event_id: number;
  status: 'pending' | 'accepted' | 'declined' | 'waitlisted';
  waitlist_position: number | null;
  event_title: string;
  event_date_time: string;
  event_location: string | null;
  event_capacity: number | null;
  event_rsvp_required: boolean;
  current_attendee_count: number;
  waitlist_count: number;
  organizer_username: string | null;
  organizer_display_name: string | null;
}
```

#### RSVPCounts Type

```typescript
interface RSVPCounts {
  total_rsvps: number;
  accepted_count: number;
  waitlisted_count: number;
  pending_count: number;
  upcoming_count: number;
}
```

## UI Components

### AttendeeList

Displays attendees with status badges and organizer actions:

```typescript
<AttendeeList
  attendees={attendees}
  isOrganizer={true}
  filterStatus="pending"
  onApprove={handleApprove}
  onReject={handleReject}
  onRemove={handleRemove}
/>
```

### InviteUsersModal

Search and invite users to an event:

```typescript
<InviteUsersModal
  visible={showInviteModal}
  onClose={() => setShowInviteModal(false)}
  eventId={eventId}
  onInvitesSent={reloadData}
/>
```

### AttendeeStats

Summary statistics for organizer dashboard:

```typescript
<AttendeeStats
  accepted={10}
  pending={3}
  waitlisted={5}
  capacity={15}
/>
```

## Pages

### Event Management (`/events/[id]/manage`)

Organizer dashboard for:
- Viewing attendee statistics
- Managing capacity and settings
- Approving/rejecting join requests
- Sending invites
- Removing attendees

### Event Detail Page Updates

- Shows RSVP/Join Request button based on visibility
- Displays current user's status (attending, waitlisted, pending)
- Shows "RSVP Required" badge when applicable
- Enhanced waitlist display showing position and people behind
- Shows waitlist count indicator
- Shows "Manage Event" button for organizers

### My Events Page Updates

- Visibility toggle (public/private) when creating events
- Capacity input field
- Allow join requests toggle for private events
- **NEW: RSVP Required toggle** - Mark events as requiring RSVP to attend
- Quick access to manage page

### My RSVPs Page (`/(tabs)/my-rsvps`) - NEW

User dashboard to track all RSVP'd events:

- **Stats Summary**: Shows counts for upcoming, attending, waitlisted, and pending RSVPs
- **Filter Tabs**: Filter by upcoming, all, attending, or waitlisted
- **RSVP Cards**: Each card shows:
  - Event image and title
  - Status badge (Attending, Waitlisted with position, Pending)
  - Date, time, and location
  - Capacity info (X/Y spots)
  - Actions to view event or cancel RSVP
- **Empty States**: Helpful messages and browse events CTA when no RSVPs
- **Pull-to-Refresh**: Refresh data with swipe gesture

Access via Profile → My RSVPs

## RLS Policies

### Event Visibility

Events are visible if:
- Public visibility, OR
- User is the creator, OR
- User has been invited, OR
- User has an attendee record (even if pending)

### Attendee Management

- Users can create their own attendee records
- Organizers can update/delete any attendee
- Users can update/delete their own records

### Invite Management

- Only organizers can create/delete invites
- Invited users can update their own invite status

## Waitlist Logic

When an event reaches capacity:

1. New RSVPs are automatically waitlisted
2. Waitlist position is assigned sequentially
3. When a spot opens (cancellation), first waitlisted user is promoted
4. Waitlist positions are reordered after promotions

### SQL Function: `rsvp_to_event`

Handles automatic waitlist placement:

```sql
CREATE FUNCTION rsvp_to_event(p_event_id bigint, p_status text)
RETURNS jsonb
-- Returns { status: 'accepted' | 'waitlisted', waitlist_position: number | null }
```

### SQL Function: `promote_from_waitlist`

Promotes next user when spot opens:

```sql
CREATE FUNCTION promote_from_waitlist(p_event_id bigint)
RETURNS uuid
-- Returns the user_id who was promoted
```

## Migrations

### `0038_organizer_events.sql`

Core organizer features:

1. Event table column additions (visibility, capacity, allow_join_requests)
2. New tables (event_attendees, event_invites)
3. Indexes for performance
4. RLS policies
5. Helper functions for RSVP and waitlist
6. Updated event visibility policies

### `0039_rsvp_required.sql` - NEW

RSVP tracking enhancements:

1. Add `rsvp_required` column to events
2. `get_my_rsvps(p_status)` - Get all RSVPs for current user with event details
3. `get_my_upcoming_rsvps()` - Get future events user is attending/waitlisted
4. `get_my_rsvp_counts()` - Get summary counts for user's RSVPs
5. New index for RSVP queries

## Best Practices

1. **Check ownership**: Always verify user is the organizer before management actions
2. **Handle capacity**: Check capacity before confirming RSVPs
3. **Waitlist notifications**: Consider implementing notifications when promoted
4. **Rate limiting**: All organizer actions are rate-limited
5. **Optimistic updates**: Update local state while waiting for server response

