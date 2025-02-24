/*
  # Profile Picture Support

  1. Changes
    - Add profile_picture column to profiles table
    - Add content_type column to profiles table
    - Add policies for profile picture management

  2. Security
    - Allow users to update their own profile pictures
    - Make profile pictures publicly accessible
*/

-- Add profile picture columns to profiles if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles'
    AND column_name = 'profile_picture'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN profile_picture bytea,
    ADD COLUMN content_type text;
  END IF;
END $$;

-- Update profiles RLS policies
CREATE POLICY "Users can update their own profile picture"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Function to handle profile picture updates
CREATE OR REPLACE FUNCTION handle_profile_picture_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger for profile picture updates
CREATE TRIGGER on_profile_picture_update
  BEFORE UPDATE OF profile_picture, content_type
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_profile_picture_update();