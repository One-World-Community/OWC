

-- Add more RSS feeds (only if they don't exist)
DO $$
BEGIN
  -- Update TechCrunch feed URL
  UPDATE public.rss_feeds 
  SET url = 'https://feeds.feedburner.com/TechCrunch/'
  WHERE name = 'TechCrunch';


  -- Update MIT Technology Review feed URL
  UPDATE public.rss_feeds 
  SET url = 'https://feeds.feedburner.com/technologyreview/all'
  WHERE name = 'MIT Technology Review';


  -- Update Science Daily feed URL
  UPDATE public.rss_feeds 
  SET url = 'https://feeds.feedburner.com/sciencedaily/all'
  WHERE name = 'Science Daily';


  -- Add Wired feed
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://feeds.wired.com/wired/index'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Wired',
      'https://feeds.wired.com/wired/index',
      topics.id,
      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100'
    FROM public.topics 
    WHERE name = 'Technology';

  END IF;


  -- Add Nature feed
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.nature.com/nature.rss'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Nature',
      'https://www.nature.com/nature.rss',
      topics.id,
      'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=100'
    FROM public.topics 
    WHERE name = 'Science';

  END IF;

END $$;
;
