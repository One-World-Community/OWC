

-- Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;


-- Add geometry column to events
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS location_geom geometry(Point, 4326);


-- Create spatial index
CREATE INDEX IF NOT EXISTS events_location_idx 
ON events USING GIST (location_geom);


-- Function to update geometry when lat/lng change
CREATE OR REPLACE FUNCTION update_event_location()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL) THEN
    NEW.location_geom := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326);

  END IF;

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;


-- Trigger to automatically update geometry
DROP TRIGGER IF EXISTS update_event_location_trigger ON events;

CREATE TRIGGER update_event_location_trigger
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_event_location();


-- Function to get formatted location text
CREATE OR REPLACE FUNCTION get_event_location_text(event_row events)
RETURNS text AS $$
BEGIN
  RETURN event_row.location;

END;

$$ LANGUAGE plpgsql;


-- Update existing events with geometry data
UPDATE events
SET location_geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
;
