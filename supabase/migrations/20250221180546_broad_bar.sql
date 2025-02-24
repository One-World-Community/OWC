/*
  # Update feed URLs to more reliable sources

  1. Changes
    - Update feed URLs to use reliable FeedBurner and official RSS endpoints
    - Add new feeds from reliable sources
*/

DO $$
BEGIN
  -- Update TechCrunch feed URL
  UPDATE public.rss_feeds 
  SET url = 'https://techcrunch.com/feed/'
  WHERE name = 'TechCrunch';

  -- Update MIT Technology Review feed URL
  UPDATE public.rss_feeds 
  SET url = 'https://www.technologyreview.com/topnews.rss'
  WHERE name = 'MIT Technology Review';

  -- Update Science Daily feed URL
  UPDATE public.rss_feeds 
  SET url = 'https://www.sciencedaily.com/rss/top.xml'
  WHERE name = 'Science Daily';

  -- Add The Verge feed
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.theverge.com/rss/index.xml'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'The Verge',
      'https://www.theverge.com/rss/index.xml',
      topics.id,
      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100'
    FROM public.topics 
    WHERE name = 'Technology';
  END IF;
END $$;