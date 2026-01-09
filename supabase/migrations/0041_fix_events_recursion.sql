-- Fix infinite recursion in events RLS policies
-- The issue: events policy checks event_attendees, which checks events, causing a loop

-- Step 1: Create helper functions that bypass RLS (SECURITY DEFINER)
-- These allow checking attendance/invites without triggering RLS on events

CREATE OR REPLACE FUNCTION user_has_event_attendance(p_event_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_attendees 
    WHERE event_id = p_event_id AND user_id = p_user_id
  );
$$;

CREATE OR REPLACE FUNCTION user_has_event_invite(p_event_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_invites 
    WHERE event_id = p_event_id AND invited_user_id = p_user_id
  );
$$;

-- Helper to check if user can see event (for use in attendees/invites policies)
CREATE OR REPLACE FUNCTION can_user_view_event(p_event_id bigint, p_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = p_event_id
    AND (
      e.visibility = 'public'
      OR e.created_by = p_user_id
      OR EXISTS (SELECT 1 FROM event_invites WHERE event_id = e.id AND invited_user_id = p_user_id)
      OR EXISTS (SELECT 1 FROM event_attendees WHERE event_id = e.id AND user_id = p_user_id)
    )
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION user_has_event_attendance(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_event_invite(bigint, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_view_event(bigint, uuid) TO authenticated;

-- Step 2: Update events SELECT policy to use helper functions instead of subqueries
DROP POLICY IF EXISTS "read_events_visibility" ON events;
CREATE POLICY "read_events_visibility" ON events
FOR SELECT
USING (
  visibility = 'public'
  OR created_by = auth.uid()
  OR user_has_event_invite(id, auth.uid())
  OR user_has_event_attendance(id, auth.uid())
);

-- Step 3: Simplify event_attendees policies - users can see attendees for:
-- 1. Events they created
-- 2. Events they're attending (including this record)
-- 3. Public events
DROP POLICY IF EXISTS "event_attendees_select" ON event_attendees;
CREATE POLICY "event_attendees_select" ON event_attendees
FOR SELECT TO authenticated
USING (
  -- User can see their own attendance records
  user_id = auth.uid()
  -- Or user is the event creator (using subquery that won't cause recursion)
  OR EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_attendees.event_id 
    AND e.created_by = auth.uid()
  )
  -- Or the event is public (direct check, no RLS recursion)
  OR EXISTS (
    SELECT 1 FROM events e 
    WHERE e.id = event_attendees.event_id 
    AND e.visibility = 'public'
  )
);

-- Simplify event_attendees insert policy
DROP POLICY IF EXISTS "event_attendees_insert" ON event_attendees;
CREATE POLICY "event_attendees_insert" ON event_attendees
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- Public events allow anyone to RSVP
    EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_attendees.event_id 
      AND e.visibility = 'public'
    )
    -- Or user created the event
    OR EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_attendees.event_id 
      AND e.created_by = auth.uid()
    )
    -- Or event allows join requests
    OR EXISTS (
      SELECT 1 FROM events e 
      WHERE e.id = event_attendees.event_id 
      AND e.allow_join_requests = true
    )
    -- Or user has an invite
    OR user_has_event_invite(event_attendees.event_id, auth.uid())
  )
);

-- Keep update/delete policies as they were (they don't cause recursion)
DROP POLICY IF EXISTS "event_attendees_update" ON event_attendees;
CREATE POLICY "event_attendees_update" ON event_attendees
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_attendees.event_id AND e.created_by = auth.uid())
);

DROP POLICY IF EXISTS "event_attendees_delete" ON event_attendees;
CREATE POLICY "event_attendees_delete" ON event_attendees
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_attendees.event_id AND e.created_by = auth.uid())
);

-- Step 4: Simplify event_invites policies similarly
DROP POLICY IF EXISTS "event_invites_select" ON event_invites;
CREATE POLICY "event_invites_select" ON event_invites
FOR SELECT TO authenticated
USING (
  -- Users can see invites they sent
  invited_by = auth.uid() 
  -- Or invites they received
  OR invited_user_id = auth.uid()
  -- Or if they're the event creator
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Insert policy stays the same (organizers only)
DROP POLICY IF EXISTS "event_invites_insert" ON event_invites;
CREATE POLICY "event_invites_insert" ON event_invites
FOR INSERT TO authenticated
WITH CHECK (
  invited_by = auth.uid()
  AND EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Update policy
DROP POLICY IF EXISTS "event_invites_update" ON event_invites;
CREATE POLICY "event_invites_update" ON event_invites
FOR UPDATE TO authenticated
USING (
  invited_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);

-- Delete policy
DROP POLICY IF EXISTS "event_invites_delete" ON event_invites;
CREATE POLICY "event_invites_delete" ON event_invites
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM events e WHERE e.id = event_invites.event_id AND e.created_by = auth.uid())
);


