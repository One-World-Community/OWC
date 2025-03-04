# GitHub Integration for Blog Setup

This edge function handles GitHub integration for automatic blog setup. It manages the OAuth flow,
repository creation, and content management for Jekyll blogs.

## Setup Instructions

### 1. Create a GitHub OAuth Application

1. Go to GitHub Settings > Developer settings > OAuth Apps > New OAuth App
2. Fill in the details:
   - Application name: Your app name
   - Homepage URL: Your app's URL (e.g., https://your-app.com)
   - Authorization callback URL: Your app's callback URL (e.g., https://your-app.com/github/callback)
3. Note your Client ID and Client Secret

### 2. Enable Supabase Vault

1. Ensure Vault is enabled in your Supabase project (Project Settings > API > Vault)
   - This is critical as the app uses Vault to securely store OAuth tokens
   - If Vault is not enabled, you'll get the error: `relation "public.vault.decrypted_secrets" does not exist`

2. Create an RPC function to simplify inserting secrets into Vault:

```sql
-- Run this in the SQL Editor
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
```

3. Verify Vault access by running a test query:
```sql
-- This should return some rows if Vault is properly set up
SELECT * FROM vault.secrets LIMIT 5;

-- This view should be accessible for reading secrets
SELECT * FROM vault.decrypted_secrets LIMIT 5;
```

### Troubleshooting Vault Issues

If you encounter errors related to Vault:

1. **"relation public.vault.decrypted_secrets does not exist"**:
   - Ensure Vault is enabled in your project
   - Check that the service role has access to the vault schema
   - Verify your database migrations have been applied correctly

2. **"The schema must be one of the following: public, graphql_public"**:
   - This occurs when trying to access the vault schema directly
   - Create an RPC function to access the vault (see below)

3. **No data returned from vault queries**:
   - Confirm that secrets were actually stored in the vault
   - Check the access_token_id in the github_connections table is correct
   - Ensure the service role key used has sufficient permissions

### 4. Create an RPC Function to Get Secrets from Vault

To securely access vault secrets from the client or edge functions, create this helper function:

```sql
-- Run this in the SQL Editor
CREATE OR REPLACE FUNCTION vault_get_secret(secret_id uuid)
RETURNS TABLE (id uuid, name text, description text, secret text, updated_at timestamptz, created_at timestamptz)
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM vault.decrypted_secrets
  WHERE id = secret_id;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION vault_get_secret TO anon, authenticated;
```

### 5. Set Supabase Secrets

Set the following secrets in the Supabase dashboard (Project Settings > API > Functions):

```bash
supabase secrets set GITHUB_CLIENT_ID="your-github-client-id"
supabase secrets set GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 6. Set Up Your Jekyll Blog Template

1. Create a Jekyll blog repository in your GitHub account
2. Configure it as a template repository (Settings > Template repository)
3. Update the constants in the edge function:
   ```typescript
   // Update these values
   const TEMPLATE_OWNER = "your-username-or-org"
   const TEMPLATE_REPO = "jekyll-blog-template"
   ```

### 7. Deploy the Edge Function

```bash
supabase functions deploy handle-github
```

## Client-Side Integration

### 1. Start GitHub Authorization

```typescript
const { data, error } = await supabase.functions.invoke('handle-github', {
  body: {
    action: 'get-auth-url',
    params: {
      redirectUri: 'https://your-app.com/github/callback'
    }
  }
})

// Redirect user to GitHub
window.location.href = data.authUrl
```

### 2. Handle the Callback

```typescript
// On your callback page
const code = new URLSearchParams(window.location.search).get('code')
const state = new URLSearchParams(window.location.search).get('state')

const { data, error } = await supabase.functions.invoke('handle-github', {
  body: {
    action: 'exchange-code',
    params: { code, state }
  }
})

// User is now connected to GitHub
```

### 3. Create a Blog

```typescript
const { data, error } = await supabase.functions.invoke('handle-github', {
  body: {
    action: 'create-blog',
    params: {
      name: 'my-awesome-blog',
      description: 'My personal blog',
      blogTitle: 'My Awesome Blog'
    }
  }
})

// Blog created
```

### 4. Create a Post

```typescript
const { data, error } = await supabase.functions.invoke('handle-github', {
  body: {
    action: 'create-post',
    params: {
      blogName: 'my-awesome-blog',
      title: 'My First Post',
      slug: 'my-first-post',
      content: 'This is the content of my first post.',
      categories: 'general'
    }
  }
})

// Post created
``` 