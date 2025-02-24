/*
  # Update feed sources with reliable RSS feeds

  1. Changes
    - Add reliable feeds for each topic category
    - Update existing feed URLs to more reliable sources
*/

DO $$
BEGIN
  -- Technology feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.engadget.com/rss.xml'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Engadget',
      'https://www.engadget.com/rss.xml',
      topics.id,
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=100'
    FROM public.topics 
    WHERE name = 'Technology';
  END IF;

  -- Science feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.livescience.com/feeds/all'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Live Science',
      'https://www.livescience.com/feeds/all',
      topics.id,
      'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=100'
    FROM public.topics 
    WHERE name = 'Science';
  END IF;

  -- Health feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.medicalnewstoday.com/newsfeeds/rss/medical_all'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Medical News Today',
      'https://www.medicalnewstoday.com/newsfeeds/rss/medical_all',
      topics.id,
      'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=100'
    FROM public.topics 
    WHERE name = 'Health';
  END IF;

  -- Environment feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://news.mongabay.com/feed/'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Mongabay',
      'https://news.mongabay.com/feed/',
      topics.id,
      'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=100'
    FROM public.topics 
    WHERE name = 'Environment';
  END IF;

  -- Education feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.edutopia.org/rss.xml'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Edutopia',
      'https://www.edutopia.org/rss.xml',
      topics.id,
      'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=100'
    FROM public.topics 
    WHERE name = 'Education';
  END IF;

  -- Arts feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.theartnewspaper.com/feed'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'The Art Newspaper',
      'https://www.theartnewspaper.com/feed',
      topics.id,
      'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=100'
    FROM public.topics 
    WHERE name = 'Arts';
  END IF;

  -- Social Impact feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://ssir.org/site/rss_2.0'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Stanford Social Innovation Review',
      'https://ssir.org/site/rss_2.0',
      topics.id,
      'https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=100'
    FROM public.topics 
    WHERE name = 'Social Impact';
  END IF;

  -- Innovation feeds
  IF NOT EXISTS (
    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.fastcompany.com/feed'
  ) THEN
    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
    SELECT 
      'Fast Company',
      'https://www.fastcompany.com/feed',
      topics.id,
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=100'
    FROM public.topics 
    WHERE name = 'Innovation';
  END IF;
END $$;