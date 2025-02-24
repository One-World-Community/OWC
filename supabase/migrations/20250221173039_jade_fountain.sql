/*
  # Add sample RSS feeds and events

  1. Changes
    - Add new RSS feeds if they don't exist
    - Add sample events
  
  2. Details
    - Adds Science Daily and MIT Technology Review RSS feeds
    - Adds two sample events: Tech Hackathon and Environmental Workshop
*/

-- Add more RSS feeds (only if they don't exist)
DO $$
BEGIN
  -- Add Science Daily feed
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.sciencedaily.com/rss/all.xml'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url) 
    SELECT 
      'Science Daily',
      'https://www.sciencedaily.com/rss/all.xml',
      topics.id,
      'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=100'
    FROM public.topics 
    WHERE name = 'Science';
  END IF;

  -- Add MIT Technology Review feed
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.technologyreview.com/feed'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'MIT Technology Review',
      'https://www.technologyreview.com/feed',
      topics.id,
      'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100'
    FROM public.topics 
    WHERE name = 'Technology';
  END IF;
END $$;

-- Add sample events
INSERT INTO public.events (
  title,
  description,
  location,
  latitude,
  longitude,
  start_time,
  end_time,
  topic_id,
  image_url
)
SELECT
  'Tech for Good Hackathon',
  'Join us for a weekend of coding and innovation to create solutions for social impact.',
  'Innovation Hub, San Francisco',
  37.7749,
  -122.4194,
  NOW() + interval '10 days',
  NOW() + interval '11 days',
  topics.id,
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800'
FROM public.topics
WHERE name = 'Technology'
AND NOT EXISTS (
  SELECT 1 FROM public.events WHERE title = 'Tech for Good Hackathon'
);

INSERT INTO public.events (
  title,
  description,
  location,
  latitude,
  longitude,
  start_time,
  end_time,
  topic_id,
  image_url
)
SELECT
  'Environmental Sustainability Workshop',
  'Learn practical ways to reduce your carbon footprint and live more sustainably.',
  'Green Space Center, Seattle',
  47.6062,
  -122.3321,
  NOW() + interval '7 days',
  NOW() + interval '7 days' + interval '3 hours',
  topics.id,
  'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800'
FROM public.topics
WHERE name = 'Environment'
AND NOT EXISTS (
  SELECT 1 FROM public.events WHERE title = 'Environmental Sustainability Workshop'
);