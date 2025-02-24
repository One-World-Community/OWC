\n\n-- Create storage bucket for avatars if it doesn't exist\nINSERT INTO storage.buckets (id, name, public)\nVALUES ('avatars', 'avatars', true)\nON CONFLICT (id) DO NOTHING;
\n\n-- Create storage policy to allow authenticated users to upload their own avatar\nCREATE POLICY "Users can upload their own avatar"\n  ON storage.objects\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (\n    bucket_id = 'avatars' AND\n    auth.uid()::text = (storage.foldername(name))[1]\n  );
\n\n-- Create storage policy to allow users to update their own avatar\nCREATE POLICY "Users can update their own avatar"\n  ON storage.objects\n  FOR UPDATE\n  TO authenticated\n  USING (\n    bucket_id = 'avatars' AND\n    auth.uid()::text = (storage.foldername(name))[1]\n  );
\n\n-- Create storage policy to allow public access to avatars\nCREATE POLICY "Avatar images are publicly accessible"\n  ON storage.objects\n  FOR SELECT\n  TO public\n  USING (bucket_id = 'avatars');
;
