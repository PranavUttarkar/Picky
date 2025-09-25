-- Add array of up to 3 image URLs for events
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_urls text[];

-- Backfill existing single image_url into image_urls if present and image_urls is null
UPDATE events SET image_urls = ARRAY[image_url] WHERE image_url IS NOT NULL AND (image_urls IS NULL OR cardinality(image_urls)=0);

-- (Optional) Add a check constraint to limit to 3 entries
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_image_urls_length_check;
ALTER TABLE events ADD CONSTRAINT events_image_urls_length_check CHECK (image_urls IS NULL OR cardinality(image_urls) <= 3);

-- You may later deprecate image_url column after the app fully migrates. Keeping for backward compatibility now.
