/*
  # Remove Articles Table and Update Schema

  1. Changes
    - Remove articles table as we'll fetch content directly from RSS feeds
    - Add last_successful_fetch field to rss_feeds to track feed health
    
  2. Security
    - No changes to existing policies
*/

-- Drop articles table and its policies
DROP TABLE IF EXISTS public.articles CASCADE;

-- Add last_successful_fetch to rss_feeds
ALTER TABLE public.rss_feeds 
ADD COLUMN IF NOT EXISTS last_successful_fetch timestamptz;