\n\n-- Add more RSS feeds\nINSERT INTO public.rss_feeds (name, url, topic_id, icon_url) \nSELECT \n  'Science Daily',\n  'https://www.sciencedaily.com/rss/all.xml',\n  topics.id,\n  'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=100'\nFROM public.topics \nWHERE name = 'Science';
\n\nINSERT INTO public.rss_feeds (name, url, topic_id, icon_url)\nSELECT \n  'MIT Technology Review',\n  'https://www.technologyreview.com/feed',\n  topics.id,\n  'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100'\nFROM public.topics \nWHERE name = 'Technology';
\n\n-- Add sample events\nINSERT INTO public.events (\n  title,\n  description,\n  location,\n  latitude,\n  longitude,\n  start_time,\n  end_time,\n  topic_id,\n  image_url\n)\nSELECT\n  'Tech for Good Hackathon',\n  'Join us for a weekend of coding and innovation to create solutions for social impact.',\n  'Innovation Hub, San Francisco',\n  37.7749,\n  -122.4194,\n  NOW() + interval '10 days',\n  NOW() + interval '11 days',\n  topics.id,\n  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800'\nFROM public.topics\nWHERE name = 'Technology';
\n\nINSERT INTO public.events (\n  title,\n  description,\n  location,\n  latitude,\n  longitude,\n  start_time,\n  end_time,\n  topic_id,\n  image_url\n)\nSELECT\n  'Environmental Sustainability Workshop',\n  'Learn practical ways to reduce your carbon footprint and live more sustainably.',\n  'Green Space Center, Seattle',\n  47.6062,\n  -122.3321,\n  NOW() + interval '7 days',\n  NOW() + interval '7 days' + interval '3 hours',\n  topics.id,\n  'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=800'\nFROM public.topics\nWHERE name = 'Environment';
;
