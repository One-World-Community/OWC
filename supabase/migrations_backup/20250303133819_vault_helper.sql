-- Helper function to simplify inserting secrets into Vault
CREATE OR REPLACE FUNCTION vault_insert(secret text, associated text)
RETURNS TABLE (id uuid, name text)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO vault.secrets (secret, associated)
  VALUES (secret, associated)
  RETURNING vault.secrets.id, vault.secrets.name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION vault_insert TO authenticated; 