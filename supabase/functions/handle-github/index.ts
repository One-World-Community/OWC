// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Octokit } from "https://esm.sh/octokit"
import { corsHeaders } from "../_shared/cors.ts"

// GitHub OAuth endpoints
const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"

// Your template repo details (replace with your actual values)
const TEMPLATE_OWNER = "your-username-or-org"
const TEMPLATE_REPO = "jekyll-blog-template"

console.log("Hello from Functions!")

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Setup Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: req.headers.get("Authorization")! } },
        auth: { persistSession: false }
      }
    )

    // Get the current user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Setup admin client for accessing auth schema and vault
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Parse request body
    const { action, params } = await req.json()

    switch (action) {
      case "get-auth-url": {
        // Generate GitHub OAuth URL
        const clientId = Deno.env.get("GITHUB_CLIENT_ID")
        if (!clientId) {
          throw new Error("GitHub client ID not configured")
        }

        // Get platform and redirect URI
        const { redirectUri, platform = 'web' } = params
        
        // For mobile, we'll use our callback function as the redirect URI
        const callbackUrl = platform === 'web' 
          ? redirectUri 
          : `${Deno.env.get("SUPABASE_URL")}/functions/v1/github-callback`
        
        const scopes = ["repo", "user"]
        
        // Generate unique state and encode platform info
        // Format: {platform}|{random-uuid}
        const stateUuid = crypto.randomUUID()
        const state = `${platform}|${stateUuid}`

        // Store state temporarily to verify later
        await supabaseAdmin
          .from("auth_states")
          .insert({
            state: stateUuid, // Only store the UUID part
            user_id: user.id,
            created_at: new Date().toISOString(),
            redirect_uri: redirectUri // Store the original app redirect URI
          })

        const authUrl = `${GITHUB_OAUTH_URL}?client_id=${clientId}&redirect_uri=${encodeURIComponent(callbackUrl)}&scope=${encodeURIComponent(scopes.join(" "))}&state=${encodeURIComponent(state)}`
        return new Response(
          JSON.stringify({ authUrl }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "exchange-code": {
        // Exchange code for access token
        const { code, state } = params
        
        // Verify state - we only stored the UUID part without the platform prefix
        const stateValue = state.includes('|') ? state.split('|')[1] : state
        
        const { data: stateData, error: stateError } = await supabaseAdmin
          .from("auth_states")
          .select("*")
          .eq("state", stateValue)
          .eq("user_id", user.id)
          .single()

        if (stateError || !stateData) {
          return new Response(
            JSON.stringify({ error: "Invalid state parameter" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Clean up used state
        await supabaseAdmin
          .from("auth_states")
          .delete()
          .eq("state", stateValue)

        // Exchange code for token
        const clientId = Deno.env.get("GITHUB_CLIENT_ID")
        const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET")

        if (!clientId || !clientSecret) {
          throw new Error("GitHub OAuth credentials not configured")
        }

        const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: stateData.redirect_uri
          })
        })

        const tokenData = await tokenResponse.json()
        
        if (tokenData.error) {
          return new Response(
            JSON.stringify({ error: tokenData.error_description || tokenData.error }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get user info from GitHub
        const octokit = new Octokit({ auth: tokenData.access_token })
        const { data: githubUser } = await octokit.rest.users.getAuthenticated()

        // Store access token in Vault
        const { data: accessTokenData, error: accessTokenError } = await supabaseAdmin.rpc(
          'vault_insert', 
          { 
            secret: tokenData.access_token,
            secret_name: `github_token_${user.id}`,
            description: `GitHub access token for user ${user.id}`
          }
        )

        if (accessTokenError) {
          console.error('Failed to store access token in vault:', accessTokenError)
          return new Response(
            JSON.stringify({ error: 'Failed to securely store access token: ' + accessTokenError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Store refresh token in Vault if present
        let refreshTokenId = null
        if (tokenData.refresh_token) {
          const { data: refreshTokenData, error: refreshTokenError } = await supabaseAdmin.rpc(
            'vault_insert', 
            { 
              secret: tokenData.refresh_token,
              secret_name: `github_refresh_${user.id}`,
              description: `GitHub refresh token for user ${user.id}`
            }
          )

          if (refreshTokenError) {
            console.error('Failed to store refresh token in vault:', refreshTokenError)
            // Continue without refresh token
          } else {
            refreshTokenId = refreshTokenData.id
          }
        }

        // Store token IDs in github_connections table
        await supabaseAdmin
          .from("auth.github_connections")
          .upsert({
            user_id: user.id,
            access_token_id: accessTokenData.id,
            refresh_token_id: refreshTokenId,
            token_type: tokenData.token_type,
            scope: tokenData.scope,
            github_username: githubUser.login,
            updated_at: new Date().toISOString()
          })

        return new Response(
          JSON.stringify({ 
            success: true, 
            github_username: githubUser.login 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "create-blog": {
        // Get user's GitHub token ID
        const { data: connection, error: connectionError } = await supabaseAdmin
          .from("auth.github_connections")
          .select("access_token_id, github_username")
          .eq("user_id", user.id)
          .single()

        if (connectionError || !connection) {
          return new Response(
            JSON.stringify({ error: "GitHub connection not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get access token from vault
        const { data: tokenData, error: tokenError } = await supabaseAdmin
          .from('vault.decrypted_secrets')
          .select('secret')
          .eq('id', connection.access_token_id)
          .single()

        if (tokenError || !tokenData) {
          return new Response(
            JSON.stringify({ error: "GitHub token not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Initialize GitHub client with user token
        const octokit = new Octokit({ auth: tokenData.secret })
        
        // Create repository from template
        const { name, description } = params
        
        try {
          // Create repo from template
          const { data: repo } = await octokit.rest.repos.createUsingTemplate({
            template_owner: TEMPLATE_OWNER,
            template_repo: TEMPLATE_REPO,
            owner: connection.github_username,
            name,
            description,
            private: false,
            include_all_branches: true
          })

          // Configure GitHub Pages if needed
          await octokit.rest.repos.updateBranchProtection({
            owner: connection.github_username,
            repo: name,
            branch: 'main',
            required_status_checks: null,
            enforce_admins: false,
            restrictions: null,
            required_pull_request_reviews: null
          })

          // Update _config.yml with user settings
          const configContent = await octokit.rest.repos.getContent({
            owner: connection.github_username,
            repo: name,
            path: '_config.yml'
          })

          // Parse, update and push new config
          if ('content' in configContent.data) {
            const content = Buffer.from(configContent.data.content, 'base64').toString()
            const updatedContent = content
              .replace(/title: .*/, `title: "${params.blogTitle || name}"`)
              .replace(/description: .*/, `description: "${description || ''}"`)
              .replace(/author: .*/, `author: "${connection.github_username}"`)

            await octokit.rest.repos.createOrUpdateFileContents({
              owner: connection.github_username,
              repo: name,
              path: '_config.yml',
              message: 'Update configuration with user details',
              content: Buffer.from(updatedContent).toString('base64'),
              sha: configContent.data.sha
            })
          }

          // Store blog info in database
          await supabaseAdmin
            .from("public.user_blogs")
            .insert({
              user_id: user.id,
              repo_name: name,
              repo_full_name: `${connection.github_username}/${name}`,
              repo_url: repo.html_url,
              is_setup_complete: true
            })

          return new Response(
            JSON.stringify({ 
              success: true, 
              blog: {
                name,
                url: repo.html_url,
                github_pages_url: `https://${connection.github_username}.github.io/${name}/`
              }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        } catch (error: any) {
          console.error("GitHub API error:", error)
          return new Response(
            JSON.stringify({ error: error.message || "Failed to create blog" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
      }

      case "get-blogs": {
        // Get user's blogs
        const { data: blogs, error: blogsError } = await supabaseAdmin
          .from("public.user_blogs")
          .select("*")
          .eq("user_id", user.id)

        if (blogsError) {
          return new Response(
            JSON.stringify({ error: blogsError.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        return new Response(
          JSON.stringify({ blogs }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
      }

      case "create-post": {
        // Get user's GitHub token and blog info
        const { data: connection, error: connectionError } = await supabaseAdmin
          .from("auth.github_connections")
          .select("access_token_id")
          .eq("user_id", user.id)
          .single()

        if (connectionError || !connection) {
          return new Response(
            JSON.stringify({ error: "GitHub connection not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Get access token from vault
        const { data: tokenData, error: tokenError } = await supabaseAdmin
          .from('vault.decrypted_secrets')
          .select('secret')
          .eq('id', connection.access_token_id)
          .single()

        if (tokenError || !tokenData) {
          return new Response(
            JSON.stringify({ error: "GitHub token not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        const { data: blog, error: blogError } = await supabaseAdmin
          .from("public.user_blogs")
          .select("*")
          .eq("user_id", user.id)
          .eq("repo_name", params.blogName)
          .single()

        if (blogError || !blog) {
          return new Response(
            JSON.stringify({ error: "Blog not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }

        // Initialize GitHub client with user token
        const octokit = new Octokit({ auth: tokenData.secret })
        
        // Format post date and filename
        const date = new Date()
        const dateStr = date.toISOString().split('T')[0]
        const filename = `_posts/${dateStr}-${params.slug}.md`
        
        // Create Jekyll front matter
        const frontMatter = [
          '---',
          `layout: post`,
          `title: "${params.title}"`,
          `date: ${date.toISOString()}`,
          `categories: ${params.categories || ''}`,
          '---',
          '',
          params.content
        ].join('\n')

        try {
          // Commit post to repository
          const [owner, repo] = blog.repo_full_name.split('/')
          
          await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filename,
            message: `Add new post: ${params.title}`,
            content: Buffer.from(frontMatter).toString('base64')
          })

          return new Response(
            JSON.stringify({ 
              success: true, 
              post: {
                title: params.title,
                date: dateStr,
                url: `${blog.repo_url}/blob/main/${filename}`
              }
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        } catch (error: any) {
          console.error("GitHub API error:", error)
          return new Response(
            JSON.stringify({ error: error.message || "Failed to create post" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
  } catch (error: any) {
    console.error("Error:", error)
  return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
  }
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/handle-github' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
