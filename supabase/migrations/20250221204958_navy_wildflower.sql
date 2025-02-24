/*
  # Fix Profile RLS Policies

  1. Changes
    - Update RLS policies for profiles table
    - Allow users to update their own profile
    - Ensure public read access remains

  2. Security
    - Users can only update their own profile
    - Public read access for all profiles
*/

-- Drop existing RLS policies for profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile picture" ON public.profiles;

-- Recreate RLS policies with proper permissions
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);