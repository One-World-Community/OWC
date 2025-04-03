-- Drop existing vault_insert function
DROP FUNCTION IF EXISTS vault_insert;

-- Helper function to simplify inserting secrets into Vault
CREATE OR REPLACE FUNCTION vault_insert(secret text, secret_name text DEFAULT NULL, description text DEFAULT '')
RETURNS TABLE (id uuid, name text)
SECURITY DEFINER
AS $$
BEGIN 
  RETURN QUERY
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (secret, secret_name, description)
  RETURNING vault.secrets.id, vault.secrets.name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION vault_insert TO authenticated; 