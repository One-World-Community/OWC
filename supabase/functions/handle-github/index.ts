// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Octokit } from "https://esm.sh/octokit"
import { corsHeaders } from "../_shared/cors.ts"
// No need for Buffer import - using native Deno base64 encoding/decoding

// Define error interface for better type checking
interface ErrorWithMessage {
  message: string;
  response?: {
    status: number;
    statusText: string;
    data: unknown;
  };
  stack?: string;
}

// Define interface for vault secret response
interface VaultSecret {
  id: string;
  name: string;
  description: string;
  secret: string;
  updated_at: string;
  created_at: string;
}

// Helper function to ensure errors have a message property
function errorWithMessage(error: unknown): ErrorWithMessage {
  if (error && typeof error === 'object' && 'message' in error) {
    return error as ErrorWithMessage;
  }
  return { message: String(error) };
}

// Helper function to clean GitHub token
function cleanGitHubToken(token: string): string {
  // Remove any whitespace, newlines, or carriage returns
  return token.replace(/[\s\r\n]+/g, '');
}

// GitHub OAuth endpoints
const GITHUB_OAUTH_URL = "https://github.com/login/oauth/authorize"
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"

// Your template repo details (replace with your actual values)
const TEMPLATE_OWNER = "One-World-Community"
const TEMPLATE_REPO = "owc-blog-template"

console.log("Hello from Functions!")

// Base64 encoding/decoding functions
function base64Encode(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data));
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
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
        const octokit = new Octokit({ auth: `Bearer ${tokenData.access_token}` })
        const { data: githubUser } = await octokit.rest.users.getAuthenticated()

        // Store access token in Vault
        const timestamp = new Date().getTime();
        const uniqueName = `github_token_${user.id}_${timestamp}`;
        
        const { data: accessTokenData, error: accessTokenError } = await supabaseAdmin.rpc(
          'vault_insert', 
          { 
            secret: tokenData.access_token,
            secret_name: uniqueName,
            description: `GitHub access token for user ${user.id} created at ${new Date().toISOString()}`
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
          const refreshTimestamp = new Date().getTime();
          const uniqueRefreshName = `github_refresh_${user.id}_${refreshTimestamp}`;
          
          const { data: refreshTokenData, error: refreshTokenError } = await supabaseAdmin.rpc(
            'vault_insert', 
            { 
              secret: tokenData.refresh_token,
              secret_name: uniqueRefreshName,
              description: `GitHub refresh token for user ${user.id} created at ${new Date().toISOString()}`
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
          .from("github_connections")
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
        console.log("Creating blog with params:", JSON.stringify(params));
        
        try {
          if (!user) {
            throw new Error("User not found");
          }

          // Get user's GitHub token ID
          console.log("Fetching GitHub connection for user ID:", user.id);
          const { data: connection, error: connectionError } = await supabaseAdmin
            .from("github_connections")
            .select("access_token_id, github_username")
            .eq("user_id", user.id)
            .single();

          if (connectionError) {
            console.error("Error fetching GitHub connection:", connectionError);
            return new Response(
              JSON.stringify({ error: "GitHub connection not found", details: connectionError }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (!connection) {
            console.error("No GitHub connection found for user ID:", user.id);
            return new Response(
              JSON.stringify({ error: "GitHub connection not found" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          console.log("Found GitHub connection for username:", connection.github_username);

          // Get access token from vault
          console.log("Fetching GitHub token from vault with id:", connection.access_token_id)
          try {
            const { data: vaultResponse, error: tokenError } = await supabaseAdmin
              .rpc('vault_get_secret', { secret_id: connection.access_token_id })
              .single<VaultSecret>();
            
            console.log("Token fetch result:", tokenError ? "Error" : "Success")
            console.log("Vault response structure:", {
              hasData: !!vaultResponse,
              keys: vaultResponse ? Object.keys(vaultResponse) : [],
              secretLength: vaultResponse?.secret?.length,
            });
            
            if (tokenError) {
              console.error("Error fetching token:", JSON.stringify({
                code: tokenError.code,
                message: tokenError.message,
                details: tokenError.details,
                hint: tokenError.hint
              }))
              return new Response(
                JSON.stringify({ 
                  error: "Error fetching GitHub token",
                  details: tokenError.message,
                  hint: "Make sure the vault_get_secret function is accessible"
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              )
            }
    
            if (!vaultResponse || !vaultResponse.secret) {
              console.error("No GitHub token or secret found in vault for token ID:", connection.access_token_id)
              return new Response(
                JSON.stringify({ error: "GitHub token not found or failed to decrypt" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              )
            }

            // Clean and format the token
            const cleanToken = cleanGitHubToken(vaultResponse.secret);
            console.log("Raw token details:", {
              length: vaultResponse.secret.length,
              prefix: vaultResponse.secret.substring(0, 4),
              isBase64: /^[A-Za-z0-9+/=]+$/.test(vaultResponse.secret),
              containsGho: vaultResponse.secret.includes('gho_'),
              containsBearer: vaultResponse.secret.toLowerCase().includes('bearer')
            });
            console.log("Cleaned token details:", {
              length: cleanToken.length,
              prefix: cleanToken.substring(0, 4),
              isBase64: /^[A-Za-z0-9+/=]+$/.test(cleanToken),
              containsGho: cleanToken.includes('gho_'),
              containsBearer: cleanToken.toLowerCase().includes('bearer')
            });

            // Try to decode if it looks like base64
            if (/^[A-Za-z0-9+/=]+$/.test(cleanToken)) {
              try {
                const decoded = new TextDecoder().decode(base64Decode(cleanToken));
                console.log("Attempted base64 decode details:", {
                  length: decoded.length,
                  prefix: decoded.substring(0, 4),
                  containsGho: decoded.includes('gho_'),
                  containsBearer: decoded.toLowerCase().includes('bearer')
                });
              } catch (e) {
                console.log("Failed to decode as base64");
              }
            }
            
            // Initialize GitHub client with user token
            console.log("Initializing Octokit with GitHub token");
            const octokit = new Octokit({
              auth: cleanToken,  // Let Octokit handle the auth header
              previews: ["baptiste"]  // Enable template repository preview
            });
            
            // Verify token works by getting authenticated user
            try {
              const { data: authUser } = await octokit.rest.users.getAuthenticated();
              console.log("Successfully authenticated as GitHub user:", authUser.login);
            } catch (authError) {
              console.error("Failed to authenticate with GitHub:", authError);
              return new Response(
                JSON.stringify({ 
                  error: "Invalid GitHub token", 
                  details: "Token authentication failed. Please reconnect your GitHub account."
                }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
            
            // Create repository from template
            const { name, description } = params;
            console.log(`Creating repo from template: ${TEMPLATE_OWNER}/${TEMPLATE_REPO} -> ${connection.github_username}/${name}`);
            
            try {
              // Create repo from template
              console.log("Calling Octokit to create repo from template");
              const { data: repo } = await octokit.rest.repos.createUsingTemplate({
                template_owner: TEMPLATE_OWNER,
                template_repo: TEMPLATE_REPO,
                owner: connection.github_username,
                name,
                description,
                private: false,
                include_all_branches: false
              });
              
              console.log("Successfully created repo from template:", repo.html_url);

              try {
                // Wait a moment to ensure repo is fully created before configuring
                console.log("Waiting for repository to be fully created...");
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Configure GitHub Pages
                console.log("Setting up GitHub Pages");
                try {
                  await octokit.rest.repos.createPagesSite({
                    owner: connection.github_username,
                    repo: name,
                    source: {
                      branch: "main",
                      path: "/"
                    }
                  });
                  console.log("Successfully set up GitHub Pages");
                } catch (pagesError) {
                  console.error("Error setting up GitHub Pages (continuing anyway):", pagesError);
                  // We'll continue even if this fails as it might be auto-configured by workflow
                }
                
                // Update _config.yml with user settings
                console.log("Fetching _config.yml");
                let configContent;
                try {
                  configContent = await octokit.rest.repos.getContent({
                    owner: connection.github_username,
                    repo: name,
                    path: '_config.yml'
                  });
                  console.log("Successfully retrieved _config.yml");
                } catch (unknownError) {
                  const configFetchError = errorWithMessage(unknownError);
                  console.error("Error fetching _config.yml:", configFetchError);
                  throw new Error(`Failed to fetch _config.yml: ${configFetchError.message}`);
                }

                // Parse, update and push new config
                if ('content' in configContent.data) {
                  console.log("Updating _config.yml");
                  const content = new TextDecoder().decode(
                    base64Decode(configContent.data.content)
                  );
                  const updatedContent = content
                    .replace(/title: .*/, `title: "${params.blogTitle || name}"`)
                    .replace(/description: .*/, `description: "${description || ''}"`)
                    .replace(/author: .*/, `author: "${connection.github_username}"`);

                  try {
                    await octokit.rest.repos.createOrUpdateFileContents({
                      owner: connection.github_username,
                      repo: name,
                      path: '_config.yml',
                      message: 'Update configuration with user details',
                      content: base64Encode(new TextEncoder().encode(updatedContent)),
                      sha: configContent.data.sha
                    });
                    console.log("Successfully updated _config.yml");
                  } catch (unknownError) {
                    const updateError = errorWithMessage(unknownError);
                    console.error("Error updating _config.yml:", updateError);
                    throw new Error(`Failed to update _config.yml: ${updateError.message}`);
                  }
                } else {
                  console.warn("Unexpected format for _config.yml, not updating");
                }

                // Store blog info in database
                console.log("Storing blog info in database");
                try {
                  await supabaseAdmin
                    .from("user_blogs")
                    .insert({
                      user_id: user.id,
                      repo_name: name,
                      repo_full_name: `${connection.github_username}/${name}`,
                      repo_url: repo.html_url,
                      is_setup_complete: true
                    });
                  console.log("Successfully stored blog info in database");
                } catch (dbError) {
                  console.error("Error storing blog info in database:", dbError);
                  // Continue even if database storage fails
                }

                const githubPagesUrl = `https://${connection.github_username}.github.io/${name}/`;
                console.log("Blog creation completed successfully. GitHub Pages URL:", githubPagesUrl);
                
                return new Response(
                  JSON.stringify({ 
                    success: true, 
                    blog: {
                      name,
                      url: repo.html_url,
                      github_pages_url: githubPagesUrl
                    }
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              } catch (unknownError) {
                const setupError = errorWithMessage(unknownError);
                console.error("Error in blog setup process:", setupError);
                
                // Even if there's an error in the setup, the repo was created, so return partial success
                return new Response(
                  JSON.stringify({ 
                    success: true, 
                    warning: "Repository created but there was an error in the setup process: " + setupError.message,
                    blog: {
                      name,
                      url: repo.html_url,
                      github_pages_url: `https://${connection.github_username}.github.io/${name}/`
                    }
                  }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            } catch (unknownError) {
              const error = errorWithMessage(unknownError);
              console.error("GitHub API error creating repository:", error);
              const errorMessage = error.message || "Failed to create blog";
              
              // Check if error response has more details
              if (error.response) {
                console.error("GitHub API error response:", {
                  status: error.response.status,
                  statusText: error.response.statusText,
                  data: error.response.data
                });
              }
              
              return new Response(
                JSON.stringify({ error: errorMessage, details: error.response?.data || {} }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } catch (unknownError) {
            const error = errorWithMessage(unknownError);
            console.error("Error:", error);
            return new Response(
              JSON.stringify({ error: error.message || "Internal server error" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (unknownError) {
          const error = errorWithMessage(unknownError);
          console.error("Unexpected error in create-blog:", error);
          return new Response(
            JSON.stringify({ 
              error: "Unexpected error in blog creation process", 
              message: error.message || "Unknown error",
              stack: error.stack
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
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
        try {
          if (!user) {
            throw new Error("User not found");
          }

          // Get user's GitHub token and blog info
          const { data: connection, error: connectionError } = await supabaseAdmin
            .from("github_connections")
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
          console.log("Fetching GitHub token from vault with id:", connection.access_token_id)
          try {
            const { data: vaultResponse, error: tokenError } = await supabaseAdmin
              .rpc('vault_get_secret', { secret_id: connection.access_token_id })
              .single<VaultSecret>();
            
            console.log("Token fetch result:", tokenError ? "Error" : "Success")
            console.log("Vault response structure:", {
              hasData: !!vaultResponse,
              keys: vaultResponse ? Object.keys(vaultResponse) : [],
              secretLength: vaultResponse?.secret?.length,
            });
            
            if (tokenError) {
              console.error("Error fetching token:", JSON.stringify({
                code: tokenError.code,
                message: tokenError.message,
                details: tokenError.details,
                hint: tokenError.hint
              }))
              return new Response(
                JSON.stringify({ 
                  error: "Error fetching GitHub token",
                  details: tokenError.message,
                  hint: "Make sure the vault_get_secret function is accessible"
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              )
            }
    
            if (!vaultResponse || !vaultResponse.secret) {
              console.error("No GitHub token or secret found in vault for token ID:", connection.access_token_id)
              return new Response(
                JSON.stringify({ error: "GitHub token not found or failed to decrypt" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              )
            }

            // Clean and format the token
            const cleanToken = cleanGitHubToken(vaultResponse.secret);
            console.log("Raw token details:", {
              length: vaultResponse.secret.length,
              prefix: vaultResponse.secret.substring(0, 4),
              isBase64: /^[A-Za-z0-9+/=]+$/.test(vaultResponse.secret),
              containsGho: vaultResponse.secret.includes('gho_'),
              containsBearer: vaultResponse.secret.toLowerCase().includes('bearer')
            });
            console.log("Cleaned token details:", {
              length: cleanToken.length,
              prefix: cleanToken.substring(0, 4),
              isBase64: /^[A-Za-z0-9+/=]+$/.test(cleanToken),
              containsGho: cleanToken.includes('gho_'),
              containsBearer: cleanToken.toLowerCase().includes('bearer')
            });

            // Try to decode if it looks like base64
            if (/^[A-Za-z0-9+/=]+$/.test(cleanToken)) {
              try {
                const decoded = new TextDecoder().decode(base64Decode(cleanToken));
                console.log("Attempted base64 decode details:", {
                  length: decoded.length,
                  prefix: decoded.substring(0, 4),
                  containsGho: decoded.includes('gho_'),
                  containsBearer: decoded.toLowerCase().includes('bearer')
                });
              } catch (e) {
                console.log("Failed to decode as base64");
              }
            }
            
            // Initialize GitHub client with user token
            console.log("Initializing Octokit with GitHub token");
            const octokit = new Octokit({
              auth: cleanToken  // Let Octokit handle the auth header
            });
            
            // Verify token works by getting authenticated user
            try {
              const { data: authUser } = await octokit.rest.users.getAuthenticated();
              console.log("Successfully authenticated as GitHub user:", authUser.login);
            } catch (authError) {
              console.error("Failed to authenticate with GitHub:", authError);
              return new Response(
                JSON.stringify({ 
                  error: "Invalid GitHub token", 
                  details: "Token authentication failed. Please reconnect your GitHub account."
                }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
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
                content: base64Encode(new TextEncoder().encode(frontMatter))
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
            } catch (unknownError) {
              const error = errorWithMessage(unknownError);
              console.error("GitHub API error:", error);
              return new Response(
                JSON.stringify({ error: error.message || "Failed to create post" }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          } catch (unknownError) {
            const error = errorWithMessage(unknownError);
            console.error("Error:", error);
            return new Response(
              JSON.stringify({ error: error.message || "Internal server error" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } catch (unknownError) {
          const error = errorWithMessage(unknownError);
          console.error("Error:", error);
          return new Response(
            JSON.stringify({ error: error.message || "Internal server error" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (unknownError) {
    const error = errorWithMessage(unknownError);
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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
