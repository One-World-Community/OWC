\n\n-- Drop articles table and its policies\nDROP TABLE IF EXISTS public.articles CASCADE;
\n\n-- Add last_successful_fetch to rss_feeds\nALTER TABLE public.rss_feeds \nADD COLUMN IF NOT EXISTS last_successful_fetch timestamptz;
;
