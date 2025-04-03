

-- Create a trigger to create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email);

  RETURN new;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- Function to subscribe users to default topics and feeds
CREATE OR REPLACE FUNCTION public.subscribe_user_to_defaults()
RETURNS TRIGGER AS $$
BEGIN
  -- Subscribe to default topics
  INSERT INTO public.user_topics (user_id, topic_id)
  SELECT NEW.id, id
  FROM public.topics
  WHERE name IN ('Technology', 'Science', 'Environment')
  ON CONFLICT DO NOTHING;


  -- Subscribe to default feeds
  INSERT INTO public.user_feeds (user_id, feed_id)
  SELECT NEW.id, id
  FROM public.rss_feeds
  WHERE name IN ('TechCrunch', 'Environmental News Network', 'Science Daily', 'MIT Technology Review')
  ON CONFLICT DO NOTHING;

  
  RETURN NEW;

END;

$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Create a trigger to subscribe new users to defaults
CREATE OR REPLACE TRIGGER on_profile_created
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.subscribe_user_to_defaults();
;
