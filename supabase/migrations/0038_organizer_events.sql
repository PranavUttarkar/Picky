-- Organizer Events Migration
-- Adds visibility, capacity, RSVP management, and invitation system for events

-- Add new columns to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public' 
  CHECK (visibility IN ('public', 'private')),
ADD COLUMN IF NOT EXISTS capacity integer,
ADD COLUMN IF NOT EXISTS allow_join_requests boolean NOT NULL DEFAULT true;

-- Create event_attendees table for RSVP tracking with waitlist support
CREATE TABLE IF NOT EXISTS event_attendees (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'declined', 'waitlisted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  waitlist_position integer,
  CONSTRAINT event_attendees_unique UNIQUE (event_id, user_id)
);

-- Create event_invites table for private event invitations
CREATE TABLE IF NOT EXISTS event_invites (
  id bigserial PRIMARY KEY,
  event_id bigint NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  invited_by uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CONSTRAINT event_invites_unique UNIQUE (event_id, invited_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_status ON event_attendees(status);
CREATE INDEX IF NOT EXISTS idx_event_invites_event_id ON event_invites(event_id);
CREATE INDEX IF NOT EXISTS idx_event_invites_invited_user_id ON event_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(visibility);
CREATE INDEX IF NOT EXISTS idx_events_created_by_visibility ON events(created_by, visibility);

-- Enable RLS on new tables
ALTER TABLE event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_invites ENABLE ROW LEVEL SECURITY;

-- RLS Policies for event_attendees

-- Users can view attendees for events they can see
DROP POLICY IF EXISTS "event_attendees_select" ON event_attendees;
CREATE POLICY "event_attendees_select" ON event_attendees
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      e.visibility = 'public' 
      OR e.created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM event_invites ei WHERE ei.event_id = e.id AND ei.invited_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = e.id AND ea.user_id = auth.uid())
    )
  )
);

-- Users can insert their own attendance record (for public events or events they're invited to)
DROP POLICY IF EXISTS "event_attendees_insert" ON event_attendees;
CREATE POLICY "event_attendees_insert" ON event_attendees
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_attendees.event_id 
    AND (
      e.visibility = 'public'
      OR e.created_by = auth.uid()
      OR (e.allow_join_requests = true)
      OR EXISTS (SELECT 1 FROM event_invites ei WHERE ei.event_id = e.id AND ei.invited_user_id = auth.uid())
    )
  )
);

-- Users can update their own attendance, organizers can update any
DROP POLICY IF EXISTS "event_attendees_update" ON event_attendees;
CREATE POLICY "event_attendees_update" ON event_attendees
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_attendees.event_id AND e.created_by = auth.uid())
);

-- Users can delete their own attendance, organizers can remove anyone
DROP POLICY IF EXISTS "event_attendees_delete" ON event_attendees;
CREATE POLICY "event_attendees_delete" ON event_attendees
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_attendees.event_id AND e.created_by = auth.uid())
);

-- RLS Policies for event_invites

-- Users can view invites they sent or received
DROP POLICY IF EXISTS "event_invites_select" ON event_invites;
CREATE POLICY "event_invites_select" ON event_invites
FOR SELECT TO authenticated
USING (
  invited_by = auth.uid() 
  OR invited_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Only event organizers can create invites
DROP POLICY IF EXISTS "event_invites_insert" ON event_invites;
CREATE POLICY "event_invites_insert" ON event_invites
FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Invited users can update their invite (to accept/decline), organizers can update any
DROP POLICY IF EXISTS "event_invites_update" ON event_invites;
CREATE POLICY "event_invites_update" ON event_invites
FOR UPDATE TO authenticated
USING (
  invited_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Organizers can delete invites
DROP POLICY IF EXISTS "event_invites_delete" ON event_invites;
CREATE POLICY "event_invites_delete" ON event_invites
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Update the events read policy to respect visibility
DROP POLICY IF EXISTS "read_events_all" ON events;
CREATE POLICY "read_events_visibility" ON events
FOR SELECT
USING (
  visibility = 'public'
  OR created_by = auth.uid()
  OR EXISTS (SELECT 1 FROM event_invites ei WHERE ei.event_id = events.id AND ei.invited_user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM event_attendees ea WHERE ea.event_id = events.id AND ea.user_id = auth.uid())
);

-- Helper function to get attendee count for an event
CREATE OR REPLACE FUNCTION get_event_attendee_count(p_event_id bigint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer 
  FROM event_attendees 
  WHERE event_id = p_event_id AND status = 'accepted';
$$;

-- Helper function to get waitlist count for an event
CREATE OR REPLACE FUNCTION get_event_waitlist_count(p_event_id bigint)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT COUNT(*)::integer 
  FROM event_attendees 
  WHERE event_id = p_event_id AND status = 'waitlisted';
$$;

-- Helper function to check if event has capacity
CREATE OR REPLACE FUNCTION event_has_capacity(p_event_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    CASE 
      WHEN e.capacity IS NULL THEN true
      ELSE get_event_attendee_count(p_event_id) < e.capacity
    END
  FROM events e WHERE e.id = p_event_id;
$$;

-- Helper function to get user's waitlist position
CREATE OR REPLACE FUNCTION get_waitlist_position(p_event_id bigint, p_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT waitlist_position 
  FROM event_attendees 
  WHERE event_id = p_event_id AND user_id = p_user_id AND status = 'waitlisted';
$$;

-- Function to RSVP to an event with automatic waitlist handling
CREATE OR REPLACE FUNCTION rsvp_to_event(p_event_id bigint, p_status text DEFAULT 'accepted')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event record;
  v_current_count integer;
  v_final_status text;
  v_waitlist_pos integer;
  v_result jsonb;
BEGIN
  -- Get event details
  SELECT * INTO v_event FROM events WHERE id = p_event_id;
  
  IF v_event IS NULL THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  
  -- Check visibility for private events
  IF v_event.visibility = 'private' THEN
    -- Must be creator, invited, or requesting to join
    IF v_event.created_by != v_user_id 
       AND NOT EXISTS (SELECT 1 FROM event_invites WHERE event_id = p_event_id AND invited_user_id = v_user_id)
       AND NOT v_event.allow_join_requests THEN
      RAISE EXCEPTION 'Cannot RSVP to this private event';
    END IF;
  END IF;
  
  -- Determine final status based on capacity
  IF p_status = 'accepted' THEN
    v_current_count := get_event_attendee_count(p_event_id);
    
    IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
      -- Event is full, add to waitlist
      v_final_status := 'waitlisted';
      SELECT COALESCE(MAX(waitlist_position), 0) + 1 INTO v_waitlist_pos
      FROM event_attendees WHERE event_id = p_event_id AND status = 'waitlisted';
    ELSE
      v_final_status := 'accepted';
      v_waitlist_pos := NULL;
    END IF;
  ELSE
    v_final_status := p_status;
    v_waitlist_pos := NULL;
  END IF;
  
  -- Insert or update attendee record
  INSERT INTO event_attendees (event_id, user_id, status, waitlist_position, responded_at)
  VALUES (p_event_id, v_user_id, v_final_status, v_waitlist_pos, 
          CASE WHEN v_final_status != 'pending' THEN now() ELSE NULL END)
  ON CONFLICT (event_id, user_id) 
  DO UPDATE SET 
    status = v_final_status,
    waitlist_position = v_waitlist_pos,
    responded_at = CASE WHEN v_final_status != 'pending' THEN now() ELSE event_attendees.responded_at END;
  
  v_result := jsonb_build_object(
    'status', v_final_status,
    'waitlist_position', v_waitlist_pos
  );
  
  RETURN v_result;
END;
$$;

-- Function for organizer to approve a join request
CREATE OR REPLACE FUNCTION approve_join_request(p_attendee_id bigint)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attendee record;
  v_event record;
  v_current_count integer;
BEGIN
  -- Get attendee record
  SELECT * INTO v_attendee FROM event_attendees WHERE id = p_attendee_id;
  
  IF v_attendee IS NULL THEN
    RAISE EXCEPTION 'Attendee record not found';
  END IF;
  
  -- Get event and verify ownership
  SELECT * INTO v_event FROM events WHERE id = v_attendee.event_id;
  
  IF v_event.created_by != v_user_id THEN
    RAISE EXCEPTION 'Only the event organizer can approve requests';
  END IF;
  
  -- Check capacity
  v_current_count := get_event_attendee_count(v_attendee.event_id);
  
  IF v_event.capacity IS NOT NULL AND v_current_count >= v_event.capacity THEN
    -- Add to waitlist instead
    UPDATE event_attendees 
    SET status = 'waitlisted',
        waitlist_position = (SELECT COALESCE(MAX(waitlist_position), 0) + 1 FROM event_attendees WHERE event_id = v_attendee.event_id AND status = 'waitlisted'),
        responded_at = now()
    WHERE id = p_attendee_id;
    RETURN false; -- Indicates waitlisted, not fully approved
  ELSE
    UPDATE event_attendees 
    SET status = 'accepted', responded_at = now(), waitlist_position = NULL
    WHERE id = p_attendee_id;
    RETURN true;
  END IF;
END;
$$;

-- Function to promote from waitlist when spot opens
CREATE OR REPLACE FUNCTION promote_from_waitlist(p_event_id bigint)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_next_user uuid;
BEGIN
  -- Get next person in waitlist
  SELECT user_id INTO v_next_user
  FROM event_attendees
  WHERE event_id = p_event_id AND status = 'waitlisted'
  ORDER BY waitlist_position ASC
  LIMIT 1;
  
  IF v_next_user IS NOT NULL THEN
    UPDATE event_attendees
    SET status = 'accepted', waitlist_position = NULL, responded_at = now()
    WHERE event_id = p_event_id AND user_id = v_next_user;
    
    -- Reorder remaining waitlist
    WITH ranked AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY waitlist_position) as new_pos
      FROM event_attendees
      WHERE event_id = p_event_id AND status = 'waitlisted'
    )
    UPDATE event_attendees ea
    SET waitlist_position = r.new_pos
    FROM ranked r
    WHERE ea.id = r.id;
  END IF;
  
  RETURN v_next_user;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_event_attendee_count(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_event_waitlist_count(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION event_has_capacity(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION get_waitlist_position(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION rsvp_to_event(bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_join_request(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION promote_from_waitlist(bigint) TO authenticated;


