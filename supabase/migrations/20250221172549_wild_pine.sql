

-- Drop articles table and its policies
DROP TABLE IF EXISTS public.articles CASCADE;


-- Add last_successful_fetch to rss_feeds
ALTER TABLE public.rss_feeds 
ADD COLUMN IF NOT EXISTS last_successful_fetch timestamptz;
;
