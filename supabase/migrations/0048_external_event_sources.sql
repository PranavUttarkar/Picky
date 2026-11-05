-- Track events imported from official TAMU event sources so scheduled syncs can
-- update them in place without creating duplicates.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS external_source text,
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS source_url text;

CREATE UNIQUE INDEX IF NOT EXISTS events_external_source_id_key
  ON public.events (external_source, external_id);

CREATE INDEX IF NOT EXISTS events_source_url_idx
  ON public.events (source_url)
  WHERE source_url IS NOT NULL;
