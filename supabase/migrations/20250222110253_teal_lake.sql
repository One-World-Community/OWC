

-- Add end_time to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS end_time timestamptz;


-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public)
VALUES ('event_images', 'event_images', true)
ON CONFLICT (id) DO NOTHING;


-- Create storage policy to allow authenticated users to upload event images
CREATE POLICY "Users can upload event images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event_images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- Create storage policy to allow users to update their own event images
CREATE POLICY "Users can update their own event images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event_images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );


-- Create storage policy to allow public access to event images
CREATE POLICY "Event images are publicly accessible"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'event_images');
;
