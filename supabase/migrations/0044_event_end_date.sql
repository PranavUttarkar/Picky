-- Add optional end_date to events for multi-day events
-- The existing end_time is used for end time on the same day
-- end_date is for when an event spans multiple days (e.g., conferences, festivals)

ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS end_date timestamptz NULL;

-- Index for queries that may filter/order by end_date (optional)
CREATE INDEX IF NOT EXISTS events_end_date_idx ON public.events (end_date);

-- Note: For scoring, sorting, and date-based filtering, continue using date_time (start date)
-- The end_date is purely for display purposes to show event duration
