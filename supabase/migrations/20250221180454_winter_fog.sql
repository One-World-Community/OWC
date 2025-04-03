

DO $$
BEGIN
  -- Remove the defunct ENN feed
  DELETE FROM public.rss_feeds
  WHERE name = 'Environmental News Network';


  -- Add The Guardian Environment feed
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.theguardian.com/environment/rss'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'The Guardian Environment',
      'https://www.theguardian.com/environment/rss',
      topics.id,
      'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=100'
    FROM public.topics 
    WHERE name = 'Environment';

  END IF;

END $$;
;
