

-- Create custom types
CREATE TYPE public.feed_status AS ENUM ('active', 'error', 'inactive');


-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);


CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);


-- Topics table
CREATE TABLE public.topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text,
  description text,
  created_at timestamptz DEFAULT now()
);


ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Topics are viewable by everyone"
  ON public.topics
  FOR SELECT
  USING (true);


-- User topics table
CREATE TABLE public.user_topics (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  topic_id uuid REFERENCES public.topics(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, topic_id)
);


ALTER TABLE public.user_topics ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can view their own topic subscriptions"
  ON public.user_topics
  FOR SELECT
  USING (auth.uid() = user_id);


CREATE POLICY "Users can manage their own topic subscriptions"
  ON public.user_topics
  FOR ALL
  USING (auth.uid() = user_id);


-- RSS feeds table
CREATE TABLE public.rss_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text NOT NULL UNIQUE,
  topic_id uuid REFERENCES public.topics(id),
  icon_url text,
  status feed_status DEFAULT 'active',
  last_fetched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


ALTER TABLE public.rss_feeds ENABLE ROW LEVEL SECURITY;


CREATE POLICY "RSS feeds are viewable by everyone"
  ON public.rss_feeds
  FOR SELECT
  USING (true);


-- User feeds table
CREATE TABLE public.user_feeds (
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  feed_id uuid REFERENCES public.rss_feeds(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, feed_id)
);


ALTER TABLE public.user_feeds ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can view their feed subscriptions"
  ON public.user_feeds
  FOR SELECT
  USING (auth.uid() = user_id);


CREATE POLICY "Users can manage their feed subscriptions"
  ON public.user_feeds
  FOR ALL
  USING (auth.uid() = user_id);


-- Articles table
CREATE TABLE public.articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_id uuid REFERENCES public.rss_feeds(id) ON DELETE CASCADE,
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  description text,
  image_url text,
  published_at timestamptz,
  created_at timestamptz DEFAULT now()
);


ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Articles are viewable by everyone"
  ON public.articles
  FOR SELECT
  USING (true);


-- Events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  location text NOT NULL,
  latitude numeric(10, 8),
  longitude numeric(11, 8),
  start_time timestamptz NOT NULL,
  end_time timestamptz,
  topic_id uuid REFERENCES public.topics(id),
  image_url text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);


ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Events are viewable by everyone"
  ON public.events
  FOR SELECT
  USING (true);


CREATE POLICY "Authenticated users can create events"
  ON public.events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);


CREATE POLICY "Users can update their own events"
  ON public.events
  FOR UPDATE
  USING (auth.uid() = created_by);


-- Insert initial topics
INSERT INTO public.topics (name, icon, description) VALUES
  ('Technology', '💻', 'Latest in tech and innovation'),
  ('Science', '🔬', 'Scientific discoveries and research'),
  ('Health', '🏥', 'Health and wellness information'),
  ('Environment', '🌱', 'Environmental news and sustainability'),
  ('Education', '📚', 'Learning and educational content'),
  ('Arts', '🎨', 'Art, culture, and creativity'),
  ('Social Impact', '🤝', 'Social causes and community impact'),
  ('Innovation', '💡', 'New ideas and breakthrough solutions');


-- Insert sample RSS feeds
INSERT INTO public.rss_feeds (name, url, topic_id, icon_url) 
SELECT 
  'TechCrunch',
  'https://techcrunch.com/feed',
  topics.id,
  'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?w=100'
FROM public.topics 
WHERE name = 'Technology';


INSERT INTO public.rss_feeds (name, url, topic_id, icon_url)
SELECT 
  'Environmental News Network',
  'https://www.enn.com/feed',
  topics.id,
  'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?w=100'
FROM public.topics 
WHERE name = 'Environment';


-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();

  RETURN NEW;

END;

$$ LANGUAGE plpgsql;


-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER update_rss_feeds_updated_at
  BEFORE UPDATE ON public.rss_feeds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();
;
