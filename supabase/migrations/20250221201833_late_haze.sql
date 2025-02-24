/*
  # Fix RSS Feeds RLS Policies

  1. Security Changes
    - Add RLS policy for authenticated users to insert into rss_feeds table
    - Add RLS policy for authenticated users to update their own feeds
*/

-- Add policy for inserting feeds
CREATE POLICY "Authenticated users can create feeds"
  ON public.rss_feeds
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Add policy for updating feeds
CREATE POLICY "Users can update their own feeds"
  ON public.rss_feeds
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_feeds
      WHERE user_feeds.feed_id = rss_feeds.id
      AND user_feeds.user_id = auth.uid()
    )
  );