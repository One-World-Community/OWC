-- Event RSVPs table
CREATE TABLE public.event_rsvps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('attending', 'maybe', 'declined')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Everyone can view RSVPs
CREATE POLICY "Event RSVPs are viewable by everyone"
  ON public.event_rsvps
  FOR SELECT
  USING (true);

-- Users can manage their own RSVPs
CREATE POLICY "Users can manage their own RSVPs"
  ON public.event_rsvps
  FOR ALL
  USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_event_rsvps_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Add functions to make RSVP operations easier
CREATE OR REPLACE FUNCTION rsvp_to_event(
  p_event_id uuid,
  p_status text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_rsvp_id uuid;
BEGIN
  -- Get the user ID from the session
  v_user_id := auth.uid();
  
  -- Ensure the user exists
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Insert or update the RSVP
  INSERT INTO public.event_rsvps (event_id, user_id, status)
  VALUES (p_event_id, v_user_id, p_status)
  ON CONFLICT (event_id, user_id) 
  DO UPDATE SET status = p_status, updated_at = now()
  RETURNING id INTO v_rsvp_id;
  
  RETURN v_rsvp_id;
END;
$$; 