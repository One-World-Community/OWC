-- Update vault_get_secret function to avoid column ambiguity
CREATE OR REPLACE FUNCTION vault_get_secret(secret_id uuid)
RETURNS TABLE (id uuid, name text, description text, secret text, updated_at timestamptz, created_at timestamptz)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT ds.id, ds.name, ds.description, ds.secret, ds.updated_at, ds.created_at 
  FROM vault.decrypted_secrets ds
  WHERE ds.id = secret_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION vault_get_secret TO anon, authenticated; 