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
2. Create an RPC function to simplify inserting secrets into Vault:

```sql
-- Run this in the SQL Editor
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
```

### 3. Set Supabase Secrets

Set the following secrets in the Supabase dashboard (Project Settings > API > Functions):

```bash
supabase secrets set GITHUB_CLIENT_ID="your-github-client-id"
supabase secrets set GITHUB_CLIENT_SECRET="your-github-client-secret"
```

### 4. Set Up Your Jekyll Blog Template

1. Create a Jekyll blog repository in your GitHub account
2. Configure it as a template repository (Settings > Template repository)
3. Update the constants in the edge function:
   ```typescript
   // Update these values
   const TEMPLATE_OWNER = "your-username-or-org"
   const TEMPLATE_REPO = "jekyll-blog-template"
   ```

### 5. Deploy the Edge Function

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