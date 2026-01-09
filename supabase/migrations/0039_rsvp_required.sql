-- RSVP Required Enhancement
-- Adds rsvp_required field and functions for tracking user RSVPs

-- Add rsvp_required column to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS rsvp_required boolean NOT NULL DEFAULT false;

-- Create index for RSVP queries
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_status ON event_attendees(user_id, status);

-- Function to get all RSVPs for the current user
CREATE OR REPLACE FUNCTION get_my_rsvps(p_status text DEFAULT NULL)
RETURNS TABLE (
  attendee_id bigint,
  event_id bigint,
  status text,
  waitlist_position integer,
  rsvp_created_at timestamptz,
  responded_at timestamptz,
  event_title text,
  event_description text,
  event_date_time timestamptz,
  event_end_time timestamptz,
  event_location text,
  event_image_url text,
  event_image_urls text[],
  event_visibility text,
  event_capacity integer,
  event_rsvp_required boolean,
  organizer_id uuid,
  organizer_username text,
  organizer_display_name text,
  current_attendee_count integer,
  waitlist_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    ea.id as attendee_id,
    ea.event_id,
    ea.status,
    ea.waitlist_position,
    ea.created_at as rsvp_created_at,
    ea.responded_at,
    e.title as event_title,
    e.description as event_description,
    e.date_time as event_date_time,
    e.end_time as event_end_time,
    e.location as event_location,
    e.image_url as event_image_url,
    e.image_urls as event_image_urls,
    e.visibility as event_visibility,
    e.capacity as event_capacity,
    e.rsvp_required as event_rsvp_required,
    e.created_by as organizer_id,
    u.username as organizer_username,
    u.display_name as organizer_display_name,
    get_event_attendee_count(e.id) as current_attendee_count,
    get_event_waitlist_count(e.id) as waitlist_count
  FROM event_attendees ea
  JOIN events e ON e.id = ea.event_id
  LEFT JOIN users u ON u.id = e.created_by
  WHERE ea.user_id = auth.uid()
    AND (p_status IS NULL OR ea.status = p_status)
  ORDER BY 
    CASE ea.status 
      WHEN 'accepted' THEN 1 
      WHEN 'waitlisted' THEN 2 
      WHEN 'pending' THEN 3 
      ELSE 4 
    END,
    e.date_time ASC;
$$;

-- Function to get upcoming RSVPs (accepted events in the future)
CREATE OR REPLACE FUNCTION get_my_upcoming_rsvps()
RETURNS TABLE (
  attendee_id bigint,
  event_id bigint,
  status text,
  waitlist_position integer,
  event_title text,
  event_date_time timestamptz,
  event_location text,
  event_image_url text,
  event_capacity integer,
  current_attendee_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    ea.id as attendee_id,
    ea.event_id,
    ea.status,
    ea.waitlist_position,
    e.title as event_title,
    e.date_time as event_date_time,
    e.location as event_location,
    e.image_url as event_image_url,
    e.capacity as event_capacity,
    get_event_attendee_count(e.id) as current_attendee_count
  FROM event_attendees ea
  JOIN events e ON e.id = ea.event_id
  WHERE ea.user_id = auth.uid()
    AND ea.status IN ('accepted', 'waitlisted')
    AND e.date_time >= now()
  ORDER BY e.date_time ASC;
$$;

-- Function to get RSVP counts by status for current user
CREATE OR REPLACE FUNCTION get_my_rsvp_counts()
RETURNS TABLE (
  total_rsvps bigint,
  accepted_count bigint,
  waitlisted_count bigint,
  pending_count bigint,
  upcoming_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT 
    COUNT(*) as total_rsvps,
    COUNT(*) FILTER (WHERE ea.status = 'accepted') as accepted_count,
    COUNT(*) FILTER (WHERE ea.status = 'waitlisted') as waitlisted_count,
    COUNT(*) FILTER (WHERE ea.status = 'pending') as pending_count,
    COUNT(*) FILTER (WHERE ea.status IN ('accepted', 'waitlisted') AND e.date_time >= now()) as upcoming_count
  FROM event_attendees ea
  JOIN events e ON e.id = ea.event_id
  WHERE ea.user_id = auth.uid();
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_my_rsvps(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_upcoming_rsvps() TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_rsvp_counts() TO authenticated;


