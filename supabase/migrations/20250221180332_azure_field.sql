\n\n-- Add more RSS feeds (only if they don't exist)\nDO $$\nBEGIN\n  -- Update TechCrunch feed URL\n  UPDATE public.rss_feeds \n  SET url = 'https://feeds.feedburner.com/TechCrunch/'\n  WHERE name = 'TechCrunch';
\n\n  -- Update MIT Technology Review feed URL\n  UPDATE public.rss_feeds \n  SET url = 'https://feeds.feedburner.com/technologyreview/all'\n  WHERE name = 'MIT Technology Review';
\n\n  -- Update Science Daily feed URL\n  UPDATE public.rss_feeds \n  SET url = 'https://feeds.feedburner.com/sciencedaily/all'\n  WHERE name = 'Science Daily';
\n\n  -- Add Wired feed\n  IF NOT EXISTS (\n    SELECT 1 FROM public.rss_feeds WHERE url = 'https://feeds.wired.com/wired/index'\n  ) THEN\n    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)\n    SELECT \n      'Wired',\n      'https://feeds.wired.com/wired/index',\n      topics.id,\n      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100'\n    FROM public.topics \n    WHERE name = 'Technology';
\n  END IF;
\n\n  -- Add Nature feed\n  IF NOT EXISTS (\n    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.nature.com/nature.rss'\n  ) THEN\n    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)\n    SELECT \n      'Nature',\n      'https://www.nature.com/nature.rss',\n      topics.id,\n      'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=100'\n    FROM public.topics \n    WHERE name = 'Science';
\n  END IF;
\nEND $$;
;
