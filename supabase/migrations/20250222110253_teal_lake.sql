\n\n-- Add end_time to events table\nALTER TABLE events\nADD COLUMN IF NOT EXISTS end_time timestamptz;
\n\n-- Create storage bucket for event images\nINSERT INTO storage.buckets (id, name, public)\nVALUES ('event_images', 'event_images', true)\nON CONFLICT (id) DO NOTHING;
\n\n-- Create storage policy to allow authenticated users to upload event images\nCREATE POLICY "Users can upload event images"\n  ON storage.objects\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (\n    bucket_id = 'event_images' AND\n    auth.uid()::text = (storage.foldername(name))[1]\n  );
\n\n-- Create storage policy to allow users to update their own event images\nCREATE POLICY "Users can update their own event images"\n  ON storage.objects\n  FOR UPDATE\n  TO authenticated\n  USING (\n    bucket_id = 'event_images' AND\n    auth.uid()::text = (storage.foldername(name))[1]\n  );
\n\n-- Create storage policy to allow public access to event images\nCREATE POLICY "Event images are publicly accessible"\n  ON storage.objects\n  FOR SELECT\n  TO public\n  USING (bucket_id = 'event_images');
;
