-- Enable pgcrypto extension for encryption features
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create GitHub connections table with references to Vault secrets
CREATE TABLE auth.github_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_id UUID, -- References vault.secrets.id for the access token
  refresh_token_id UUID, -- References vault.secrets.id for the refresh token
  token_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  github_username TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Create temporary state storage for OAuth flow
CREATE TABLE public.auth_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  state TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- States expire after 10 minutes
  CONSTRAINT auth_states_expire CHECK (created_at > NOW() - INTERVAL '10 minutes')
);

-- Create blogs table to track user blogs
CREATE TABLE public.user_blogs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  repo_name TEXT NOT NULL,
  repo_full_name TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  is_setup_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, repo_name)
);

-- Enable Row Level Security
ALTER TABLE auth.github_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blogs ENABLE ROW LEVEL SECURITY;

-- Create policies for secure access
-- Only allow users to see their own GitHub connections
CREATE POLICY "Users can only view their own GitHub connections"
  ON auth.github_connections
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow system to insert GitHub connections (via edge functions)
CREATE POLICY "Only system can insert GitHub connections"
  ON auth.github_connections
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only allow system to update GitHub connections (via edge functions)
CREATE POLICY "Only system can update GitHub connections"
  ON auth.github_connections
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy for auth_states
CREATE POLICY "Users can only view their own auth states"
  ON public.auth_states
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow system to insert auth states (via edge functions)
CREATE POLICY "Only system can insert auth states"
  ON public.auth_states
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only allow system to delete auth states (via edge functions)
CREATE POLICY "Only system can delete auth states"
  ON public.auth_states
  FOR DELETE
  USING (auth.uid() = user_id);

-- Policy for user_blogs table
CREATE POLICY "Users can view their own blogs"
  ON public.user_blogs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Only allow system to insert blogs (via edge functions)
CREATE POLICY "Only system can insert blogs"
  ON public.user_blogs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Only allow system to update blogs (via edge functions)
CREATE POLICY "Only system can update blogs"
  ON public.user_blogs
  FOR UPDATE
  USING (auth.uid() = user_id);
