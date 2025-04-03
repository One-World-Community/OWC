\n\nDO $$\nBEGIN\n  -- Update TechCrunch feed URL\n  UPDATE public.rss_feeds \n  SET url = 'https://techcrunch.com/feed/'\n  WHERE name = 'TechCrunch';
\n\n  -- Update MIT Technology Review feed URL\n  UPDATE public.rss_feeds \n  SET url = 'https://www.technologyreview.com/topnews.rss'\n  WHERE name = 'MIT Technology Review';
\n\n  -- Update Science Daily feed URL\n  UPDATE public.rss_feeds \n  SET url = 'https://www.sciencedaily.com/rss/top.xml'\n  WHERE name = 'Science Daily';
\n\n  -- Add The Verge feed\n  IF NOT EXISTS (\n    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.theverge.com/rss/index.xml'\n  ) THEN\n    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)\n    SELECT \n      'The Verge',\n      'https://www.theverge.com/rss/index.xml',\n      topics.id,\n      'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100'\n    FROM public.topics \n    WHERE name = 'Technology';
\n  END IF;
\nEND $$;
;
