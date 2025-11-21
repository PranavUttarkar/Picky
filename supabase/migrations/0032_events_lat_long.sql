-- Add latitude and longitude columns to events table for location coordinates

alter table events add column if not exists latitude double precision;
alter table events add column if not exists longitude double precision;

-- Add index for location-based queries (optional but recommended for performance)
create index if not exists idx_events_location on events (latitude, longitude) where latitude is not null and longitude is not null;
