\n\nDO $$\nBEGIN\n  -- Remove the defunct ENN feed\n  DELETE FROM public.rss_feeds\n  WHERE name = 'Environmental News Network';
\n\n  -- Add The Guardian Environment feed\n  IF NOT EXISTS (\n    SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.theguardian.com/environment/rss'\n  ) THEN\n    INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)\n    SELECT \n      'The Guardian Environment',\n      'https://www.theguardian.com/environment/rss',\n      topics.id,\n      'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=100'\n    FROM public.topics \n    WHERE name = 'Environment';
\n  END IF;
\nEND $$;
;
