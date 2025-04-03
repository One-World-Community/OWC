-- Enable PostGIS extension if not already enabled
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add location fields to RSS feeds
ALTER TABLE public.rss_feeds
ADD COLUMN IF NOT EXISTS location_point geometry(Point, 4326),
ADD COLUMN IF NOT EXISTS location_name TEXT,
ADD COLUMN IF NOT EXISTS coverage_radius INTEGER, -- in km
ADD COLUMN IF NOT EXISTS is_location_aware BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS location_category TEXT; -- 'local_news', 'politics', 'community', etc.

-- Create spatial index for efficient proximity queries
CREATE INDEX IF NOT EXISTS rss_feeds_location_idx 
ON public.rss_feeds USING GIST (location_point);

-- Create categories for location-aware content rather than a single "Local News" topic
DO $$
BEGIN
  -- Create "Local News" topic if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.topics WHERE name = 'Local News') THEN
    INSERT INTO public.topics (name, icon, description)
    VALUES ('Local News', '📍', 'News from your local area');
  END IF;
  
  -- Create "Local Politics" topic if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.topics WHERE name = 'Local Politics') THEN
    INSERT INTO public.topics (name, icon, description)
    VALUES ('Local Politics', '🏛️', 'Political updates from your area');
  END IF;
  
  -- Create "Community" topic if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM public.topics WHERE name = 'Community') THEN
    INSERT INTO public.topics (name, icon, description)
    VALUES ('Community', '👥', 'Updates from your local community');
  END IF;
END $$;

-- Create a function to get feeds near a location
CREATE OR REPLACE FUNCTION get_feeds_near_location(
  lat FLOAT,
  lng FLOAT,
  radius_km INTEGER DEFAULT 50,
  category TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  url TEXT,
  icon_url TEXT,
  topic_id UUID,
  status TEXT,
  location_name TEXT,
  location_category TEXT,
  distance_km FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id, 
    f.name, 
    f.url, 
    f.icon_url,
    f.topic_id,
    f.status::TEXT,
    f.location_name,
    f.location_category,
    ST_Distance(
      f.location_point::geography, 
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    )/1000 AS distance_km
  FROM 
    rss_feeds f
  WHERE 
    f.is_location_aware = true
    AND f.location_point IS NOT NULL
    AND ST_DWithin(
      f.location_point::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
    AND (category IS NULL OR f.location_category = category)
  ORDER BY 
    distance_km ASC;
END;
$$ LANGUAGE plpgsql;

-- Add sample location data to existing feeds and create new feeds if needed
DO $$
DECLARE 
  local_news_topic_id UUID;
  local_politics_topic_id UUID;
  community_topic_id UUID;
BEGIN
  -- Get topic IDs for use below
  SELECT id INTO local_news_topic_id FROM public.topics WHERE name = 'Local News' LIMIT 1;
  SELECT id INTO local_politics_topic_id FROM public.topics WHERE name = 'Local Politics' LIMIT 1;
  SELECT id INTO community_topic_id FROM public.topics WHERE name = 'Community' LIMIT 1;

  -- Update existing feeds with location data
  -- New York Times
  UPDATE public.rss_feeds
  SET location_point = ST_SetSRID(ST_MakePoint(-73.9866, 40.7306), 4326),
      location_name = 'New York',
      coverage_radius = 100,
      is_location_aware = true,
      location_category = 'local_news'
  WHERE name ILIKE '%New York Times%'
    AND location_point IS NULL;

  -- SF Chronicle or similar Bay Area news
  UPDATE public.rss_feeds
  SET location_point = ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
      location_name = 'San Francisco',
      coverage_radius = 75,
      is_location_aware = true,
      location_category = 'local_news'
  WHERE (name ILIKE '%SF%' OR name ILIKE '%San Francisco%')
    AND location_point IS NULL;

  -- Washington Post
  UPDATE public.rss_feeds
  SET location_point = ST_SetSRID(ST_MakePoint(-77.0369, 38.9072), 4326),
      location_name = 'Washington DC',
      coverage_radius = 100,
      is_location_aware = true,
      location_category = 'local_news'
  WHERE name ILIKE '%Washington Post%'
    AND location_point IS NULL;

  -- LA Times
  UPDATE public.rss_feeds
  SET location_point = ST_SetSRID(ST_MakePoint(-118.2437, 34.0522), 4326),
      location_name = 'Los Angeles',
      coverage_radius = 100,
      is_location_aware = true, 
      location_category = 'local_news'
  WHERE name ILIKE '%LA Times%' OR name ILIKE '%Los Angeles Times%'
    AND location_point IS NULL;

  -- Chicago Tribune
  UPDATE public.rss_feeds
  SET location_point = ST_SetSRID(ST_MakePoint(-87.6298, 41.8781), 4326),
      location_name = 'Chicago',
      coverage_radius = 100,
      is_location_aware = true,
      location_category = 'local_news'
  WHERE name ILIKE '%Chicago Tribune%'
    AND location_point IS NULL;

  -- Boston Globe
  UPDATE public.rss_feeds
  SET location_point = ST_SetSRID(ST_MakePoint(-71.0589, 42.3601), 4326),
      location_name = 'Boston',
      coverage_radius = 100,
      is_location_aware = true,
      location_category = 'local_news'
  WHERE name ILIKE '%Boston Globe%'
    AND location_point IS NULL;

  -- Create new location-aware feeds if they don't exist
  
  -- New York
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.amny.com/feed/') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'AM New York',
      'https://www.amny.com/feed/',
      local_news_topic_id,
      'https://images.amny.com/favicon.ico',
      ST_SetSRID(ST_MakePoint(-73.9866, 40.7306), 4326),
      'New York',
      100,
      true,
      'local_news',
      'active'
    );
  END IF;
  
  -- San Francisco
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://sfist.com/feed/') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'SFist',
      'https://sfist.com/feed/',
      local_news_topic_id,
      'https://sfist.com/favicon.ico',
      ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326),
      'San Francisco',
      75,
      true,
      'local_news',
      'active'
    );
  END IF;
  
  -- Los Angeles
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://laist.com/feeds/latest.xml') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'LAist',
      'https://laist.com/feeds/latest.xml',
      local_news_topic_id,
      'https://laist.com/favicon.ico',
      ST_SetSRID(ST_MakePoint(-118.2437, 34.0522), 4326),
      'Los Angeles',
      100,
      true,
      'local_news',
      'active'
    );
  END IF;
  
  -- Chicago
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://blockclubchicago.org/feed/') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'Block Club Chicago',
      'https://blockclubchicago.org/feed/',
      local_news_topic_id,
      'https://blockclubchicago.org/favicon.ico',
      ST_SetSRID(ST_MakePoint(-87.6298, 41.8781), 4326),
      'Chicago',
      100,
      true,
      'local_news',
      'active'
    );
  END IF;
  
  -- Example local politics feeds
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://dcist.com/feed/') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'DCist',
      'https://dcist.com/feed/',
      local_politics_topic_id,
      'https://dcist.com/favicon.ico',
      ST_SetSRID(ST_MakePoint(-77.0369, 38.9072), 4326),
      'Washington DC',
      100,
      true,
      'local_politics',
      'active'
    );
  END IF;
  
  -- Example community feeds
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://patch.com/feeds/new-york-city') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'Patch NYC',
      'https://patch.com/feeds/new-york-city',
      community_topic_id,
      'https://patch.com/favicon.ico',
      ST_SetSRID(ST_MakePoint(-73.9866, 40.7306), 4326),
      'New York',
      100,
      true,
      'community',
      'active'
    );
  END IF;
END $$;

-- Create a view for easier querying of location-aware feeds
CREATE OR REPLACE VIEW public.location_aware_feeds AS
SELECT 
  id,
  name,
  url,
  icon_url,
  topic_id,
  status,
  location_name,
  location_category,
  coverage_radius,
  location_point,
  ST_X(location_point) AS longitude,
  ST_Y(location_point) AS latitude
FROM 
  public.rss_feeds
WHERE 
  is_location_aware = true
  AND location_point IS NOT NULL;

-- Grant permissions on the view
GRANT SELECT ON public.location_aware_feeds TO authenticated, anon;
