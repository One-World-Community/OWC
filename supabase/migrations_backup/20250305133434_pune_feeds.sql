-- Add location-aware RSS feeds for Pune, Maharashtra
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

  -- Add Times of India Pune RSS feed
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://timesofindia.indiatimes.com/rssfeeds/3942663.cms') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'Times of India - Pune',
      'https://timesofindia.indiatimes.com/rssfeeds/3942663.cms',
      local_news_topic_id,
      'https://static.toiimg.com/photo/msid-47529300/favicon.ico',
      ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326),
      'Pune, Maharashtra',
      75,
      true,
      'local_news',
      'active'
    );
  END IF;
  
  -- Add Indian Express Pune RSS feed
  IF NOT EXISTS (SELECT 1 FROM public.rss_feeds WHERE url = 'https://indianexpress.com/section/cities/pune/feed/') THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url, location_point, location_name, coverage_radius, is_location_aware, location_category, status)
    VALUES (
      'Indian Express - Pune',
      'https://indianexpress.com/section/cities/pune/feed/',
      local_news_topic_id,
      'https://indianexpress.com/wp-content/themes/indianexpress/images/icons/favicon.ico',
      ST_SetSRID(ST_MakePoint(73.8567, 18.5204), 4326),
      'Pune, Maharashtra',
      75,
      true,
      'local_news',
      'active'
    );
  END IF;
END $$;
