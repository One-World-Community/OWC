\n\n-- Add policy for inserting feeds\nCREATE POLICY "Authenticated users can create feeds"\n  ON public.rss_feeds\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (true);
\n\n-- Add policy for updating feeds\nCREATE POLICY "Users can update their own feeds"\n  ON public.rss_feeds\n  FOR UPDATE\n  USING (\n    EXISTS (\n      SELECT 1 FROM public.user_feeds\n      WHERE user_feeds.feed_id = rss_feeds.id\n      AND user_feeds.user_id = auth.uid()\n    )\n  );
;
