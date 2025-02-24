\n\n-- Drop existing RLS policies for profiles\nDROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
\nDROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
\nDROP POLICY IF EXISTS "Users can update their own profile picture" ON public.profiles;
\n\n-- Recreate RLS policies with proper permissions\nCREATE POLICY "Public profiles are viewable by everyone"\n  ON public.profiles\n  FOR SELECT\n  TO public\n  USING (true);
\n\nCREATE POLICY "Users can insert their own profile"\n  ON public.profiles\n  FOR INSERT\n  TO authenticated\n  WITH CHECK (auth.uid() = id);
\n\nCREATE POLICY "Users can update their own profile"\n  ON public.profiles\n  FOR UPDATE\n  TO authenticated\n  USING (auth.uid() = id)\n  WITH CHECK (auth.uid() = id);
;
