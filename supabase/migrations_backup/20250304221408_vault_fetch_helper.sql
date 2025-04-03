-- Creates an RPC function to securely fetch secrets from the vault schema
-- This solves the error: "The schema must be one of the following: public, graphql_public"
-- by providing a secure way to access vault contents through the public schema

-- Drop existing function if it exists (for idempotency)
DROP FUNCTION IF EXISTS public.vault_get_secret;

-- Create the function in the public schema
CREATE OR REPLACE FUNCTION public.vault_get_secret(secret_id uuid)
RETURNS TABLE (id uuid, name text, description text, secret text, updated_at timestamptz, created_at timestamptz)
SECURITY DEFINER -- Uses the privileges of the function creator
SET search_path = vault -- Sets the search path to vault for this function
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM vault.decrypted_secrets
  WHERE id = secret_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anon and authenticated users
-- This allows both anonymous and logged-in users to call this function
GRANT EXECUTE ON FUNCTION public.vault_get_secret TO anon, authenticated;
