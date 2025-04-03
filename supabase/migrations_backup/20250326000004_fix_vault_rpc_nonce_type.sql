-- Drop existing functions
DROP FUNCTION IF EXISTS vault_get_secret;
DROP FUNCTION IF EXISTS public.vault_get_secret;

-- Recreate the function in vault schema
CREATE OR REPLACE FUNCTION vault_get_secret(secret_id uuid)
RETURNS TABLE (id uuid, name text, description text, secret text, key_id uuid, nonce bytea, updated_at timestamptz, created_at timestamptz)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id, 
    ds.name, 
    ds.description, 
    COALESCE(convert_from(ds.decrypted_secret::bytea, 'UTF8'), ds.secret)::text as secret,
    ds.key_id, 
    ds.nonce::bytea, 
    ds.updated_at, 
    ds.created_at 
  FROM vault.decrypted_secrets ds
  WHERE ds.id = secret_id;
END;
$$ LANGUAGE plpgsql;

-- Recreate the function in public schema
CREATE OR REPLACE FUNCTION public.vault_get_secret(secret_id uuid)
RETURNS TABLE (id uuid, name text, description text, secret text, key_id uuid, nonce bytea, updated_at timestamptz, created_at timestamptz)
SECURITY DEFINER
SET search_path = vault
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id, 
    ds.name, 
    ds.description, 
    COALESCE(convert_from(ds.decrypted_secret::bytea, 'UTF8'), ds.secret)::text as secret,
    ds.key_id, 
    ds.nonce::bytea, 
    ds.updated_at, 
    ds.created_at 
  FROM vault.decrypted_secrets ds
  WHERE ds.id = secret_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION vault_get_secret TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vault_get_secret TO anon, authenticated; 