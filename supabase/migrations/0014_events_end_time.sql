-- Add optional end_time to events
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS end_time timestamptz NULL;

-- Index for queries that may filter/order by end_time (optional)
CREATE INDEX IF NOT EXISTS events_end_time_idx ON public.events (end_time);
