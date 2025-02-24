/*
  # Remove broken feeds and add working alternatives

  This migration removes feeds that are consistently failing and replaces them with more reliable alternatives.

  1. Changes
    - Remove broken medical news feeds
    - Add new reliable health and medical feeds
*/

-- Remove broken feeds
DELETE FROM public.rss_feeds
WHERE url IN (
  'https://www.medpagetoday.com/rss/headlines.xml',
  'https://innovations.bmj.com/pages/rss-feeds/',
  'https://www.healthcareitnews.com/rss',
  'https://www.medpagetoday.com/rss/infectiousdisease.xml',
  'https://www.medpagetoday.com/rss/publichealthpolicy.xml',
  'https://www.medpagetoday.com/rss/covid19.xml'
);

-- Add new reliable health feeds
INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
SELECT 
  'WHO News',
  'https://www.who.int/rss-feeds/news-english.xml',
  topics.id,
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=100'
FROM public.topics 
WHERE name = 'Health'
AND NOT EXISTS (
  SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.who.int/rss-feeds/news-english.xml'
);

INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
SELECT 
  'NIH News',
  'https://www.nih.gov/news-events/news-releases/feed.xml',
  topics.id,
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=100'
FROM public.topics 
WHERE name = 'Health'
AND NOT EXISTS (
  SELECT 1 FROM public.rss_feeds WHERE url = 'https://www.nih.gov/news-events/news-releases/feed.xml'
);