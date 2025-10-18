-- Backfill image_urls from legacy image_url and keep them in sync going forward
-- Idempotent update
UPDATE public.events
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL
  AND (image_urls IS NULL OR cardinality(image_urls) = 0);

-- Create helper function to sync image_url <-> image_urls
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'events_sync_image_urls' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.events_sync_image_urls()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      -- If array missing but single present, derive array
      IF NEW.image_urls IS NULL OR cardinality(NEW.image_urls) = 0 THEN
        IF NEW.image_url IS NOT NULL THEN
          NEW.image_urls := ARRAY[NEW.image_url];
        END IF;
      END IF;

      -- If array present, ensure single is first element for backward compat
      IF NEW.image_urls IS NOT NULL AND cardinality(NEW.image_urls) > 0 THEN
        NEW.image_url := NEW.image_urls[1];
      END IF;

      RETURN NEW;
    END;
    $fn$;
  END IF;
END
$do$;

-- Create triggers if not exists
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'tr_events_sync_image_urls_biur'
  ) THEN
    CREATE TRIGGER tr_events_sync_image_urls_biur
    BEFORE INSERT OR UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.events_sync_image_urls();
  END IF;
END
$do$;
