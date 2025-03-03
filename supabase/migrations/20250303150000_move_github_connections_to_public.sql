DO $$ BEGIN
  -- Only proceed if auth.github_connections exists
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'github_connections'
  ) THEN
    -- Move GitHub connections table from auth schema to public schema
    -- This allows edge functions to insert data into the table

    -- Create the table in public schema
    CREATE TABLE IF NOT EXISTS public.github_connections (
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

    -- Add Row Level Security (RLS) policies
    ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

    -- Policy to allow users to read only their own connections
    CREATE POLICY "Users can view their own GitHub connections" 
      ON public.github_connections
      FOR SELECT
      USING (auth.uid() = user_id);

    -- Policy to allow users to insert their own connections
    CREATE POLICY "Users can insert their own GitHub connections" 
      ON public.github_connections
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);

    -- Policy to allow users to update their own connections
    CREATE POLICY "Users can update their own GitHub connections" 
      ON public.github_connections
      FOR UPDATE
      USING (auth.uid() = user_id);

    -- Policy to allow the service role (used by edge functions) to access all connections
    CREATE POLICY "Service role can access all GitHub connections" 
      ON public.github_connections
      USING (auth.jwt() ? 'service_role');

    -- Drop the old table in auth schema
    DROP TABLE auth.github_connections;
  END IF;
END $$;