// GitHub OAuth callback handler
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Octokit } from "https://esm.sh/octokit"

// GitHub OAuth token URL
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"

// Serve HTTP requests
Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get URL parameters
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    if (!code || !state) {
      return new Response("Missing code or state parameter", { 
        status: 400,
        headers: corsHeaders
      });
    }
    
    // Determine if this is mobile or web based on state parameter
    // We'll encode platform and redirect info in the state
    const [platform, ...rest] = state.split('|');
    const stateValue = rest.join('|');
    
    // Setup Supabase admin client to access auth schema and vault
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )
    
    console.log(`Verifying state: ${stateValue}`);
    
    // Verify state - we only stored the UUID part without the platform prefix
    const { data: stateData, error: stateError } = await supabaseAdmin
      .from("auth_states")
      .select("*")
      .eq("state", stateValue)
      .single();
    
    if (stateError || !stateData) {
      return new Response(
        JSON.stringify({ error: "Invalid state parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const userId = stateData.user_id;
    
    // Clean up used state
    await supabaseAdmin
      .from("auth_states")
      .delete()
      .eq("state", stateValue);
    
    // Exchange code for token
    const clientId = Deno.env.get("GITHUB_CLIENT_ID");
    const clientSecret = Deno.env.get("GITHUB_CLIENT_SECRET");
    
    if (!clientId || !clientSecret) {
      throw new Error("GitHub OAuth credentials not configured");
    }
    
    console.log("Exchanging code for token...");
    
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
    });
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      console.error("Token exchange error:", tokenData.error);
      if (platform === 'web') {
        return new Response(renderErrorPage(tokenData.error_description || tokenData.error), { 
          headers: { ...corsHeaders, "Content-Type": "text/html" }
        });
      } else {
        return new Response(
          JSON.stringify({ error: tokenData.error_description || tokenData.error }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Get user info from GitHub
    console.log("Getting GitHub user info...");
    const octokit = new Octokit({ auth: tokenData.access_token });
    const { data: githubUser } = await octokit.rest.users.getAuthenticated();
    
    console.log(`GitHub user: ${githubUser.login}`);
    
    // Store access token in Vault
    console.log("Attempting to store access token in vault...");
    let accessTokenData = null;
    try {
      // Create a unique name with timestamp
      const timestamp = new Date().getTime();
      const uniqueName = `github_token_${userId}_${timestamp}`;
      
      const vaultParams = { 
        secret: tokenData.access_token,
        secret_name: uniqueName,
        description: `GitHub access token for user ${userId} created at ${new Date().toISOString()}`
      };
      console.log("Vault parameters:", JSON.stringify({
        ...vaultParams,
        secret: "REDACTED" // Don't log actual secret
      }));
      
      const vaultResult = await supabaseAdmin.rpc(
        'vault_insert', 
        vaultParams
      );
      
      const { data, error: accessTokenError } = vaultResult;
      console.log("Vault response data:", JSON.stringify(data || {}));
      console.log("Vault response error:", JSON.stringify(accessTokenError || {}));
      
      if (!data || !data.id) {
        console.error("Warning: Vault operation succeeded but returned no valid ID");
        console.log("Full vault response:", JSON.stringify(vaultResult));
      }
      
      if (accessTokenError) {
        console.error('Failed to store access token in vault:', accessTokenError);
        console.error('Error details:', JSON.stringify(accessTokenError));
        
        if (platform === 'web') {
          return new Response(renderErrorPage(`Failed to securely store access token: ${accessTokenError.message || JSON.stringify(accessTokenError)}`), { 
            headers: { ...corsHeaders, "Content-Type": "text/html" }
          });
        } else {
          return new Response(
            JSON.stringify({ error: `Failed to securely store access token: ${accessTokenError.message || JSON.stringify(accessTokenError)}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
      
      accessTokenData = data || { id: null };
    } catch (vaultError) {
      console.error("Unexpected error during vault operation:", vaultError);
      if (platform === 'web') {
        return new Response(renderErrorPage(`Vault operation failed: ${vaultError instanceof Error ? vaultError.message : String(vaultError)}`), { 
          headers: { ...corsHeaders, "Content-Type": "text/html" }
        });
      } else {
        return new Response(
          JSON.stringify({ error: `Vault operation failed: ${vaultError instanceof Error ? vaultError.message : String(vaultError)}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Store refresh token in Vault if present
    let refreshTokenId = null;
    if (tokenData.refresh_token) {
      console.log("Attempting to store refresh token in vault...");
      try {
        // Create a unique name with timestamp
        const timestamp = new Date().getTime();
        const uniqueRefreshName = `github_refresh_${userId}_${timestamp}`;
        
        const refreshVaultParams = { 
          secret: tokenData.refresh_token,
          secret_name: uniqueRefreshName,
          description: `GitHub refresh token for user ${userId} created at ${new Date().toISOString()}`
        };
        
        const refreshResult = await supabaseAdmin.rpc(
          'vault_insert', 
          refreshVaultParams
        );
        
        const { data: refreshTokenData, error: refreshTokenError } = refreshResult;
        
        console.log("Refresh token vault response:", refreshTokenData ? "success" : "null", 
                    "Error:", refreshTokenError || "null");
        
        if (refreshTokenError) {
          console.error('Failed to store refresh token in vault:', refreshTokenError);
          console.error('Refresh token error details:', JSON.stringify(refreshTokenError));
          // Continue without refresh token
        } else {
          refreshTokenId = refreshTokenData.id;
        }
      } catch (refreshError) {
        console.error("Unexpected error during refresh token vault operation:", refreshError);
        // Continue without refresh token
      }
    }
    
    // Store token IDs in github_connections table
    const connectionData = {
      user_id: userId,
      access_token_id: accessTokenData?.id || null,
      refresh_token_id: refreshTokenId || null,
      token_type: tokenData.token_type,
      scope: tokenData.scope,
      github_username: githubUser.login,
      updated_at: new Date().toISOString()
    };
    
    console.log("Connection data (complete, with token IDs):", JSON.stringify({
      ...connectionData,
      // Don't redact IDs here, we need to see if they're null or actual UUIDs
    }));
    
    // Try different schema paths and methods
    console.log("Trying to access table in public schema: github_connections");
    let result;
    try {
      // Use public schema table
      result = await supabaseAdmin
        .from("github_connections") // This will access public.github_connections
        .upsert(connectionData, { onConflict: 'user_id' });
        
      if (result.error) {
        console.log("Insertion failed with error:", JSON.stringify(result.error));
        
        // Log detailed error info
        if (result.error.code) {
          console.log("Error code:", result.error.code);
        }
        if (result.error.details) {
          console.log("Error details:", result.error.details);
        }
        if (result.error.hint) {
          console.log("Error hint:", result.error.hint);
        }
      }
    } catch (err: any) {
      console.error("Error with GitHub connection storage (detailed):", err);
      console.log("Error name:", err.name);
      console.log("Error message:", err.message);
      console.log("Error stack:", err.stack);
      result = { error: err };
    }
    
    const { error: connectionError } = result;
    
    if (connectionError) {
      console.error('Failed to store GitHub connection:', connectionError);
      if (platform === 'web') {
        return new Response(renderErrorPage('Failed to store GitHub connection'), { 
          headers: { ...corsHeaders, "Content-Type": "text/html" }
        });
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to store GitHub connection' }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Handle response based on platform
    if (platform === 'web') {
      // For web: render a success page that communicates with the parent window
      return new Response(
        renderSuccessPage(githubUser.login),
        { headers: { ...corsHeaders, "Content-Type": "text/html" } }
      );
    } else {
      // For mobile: redirect to app
      return new Response(null, { 
        status: 302,
        headers: {
          ...corsHeaders,
          "Location": `owc://github-auth?success=true&username=${encodeURIComponent(githubUser.login)}`
        }
      });
    }
  } catch (error) {
    console.error("Error handling GitHub callback:", error);
    
    if (error instanceof Error) {
      // Determine if this is web or mobile from state parameter
      const state = new URL(req.url).searchParams.get('state') || '';
      const platform = state.split('|')[0];
      
      if (platform === 'web') {
        return new Response(renderErrorPage(error.message), { 
          headers: { ...corsHeaders, "Content-Type": "text/html" }
        });
      } else {
        return new Response(null, { 
          status: 302,
          headers: {
            ...corsHeaders,
            "Location": `owc://github-auth?error=${encodeURIComponent(error.message)}`
          }
        });
      }
    }
    
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to render success page for web
function renderSuccessPage(username: string) {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <title>GitHub Connected!</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; text-align: center; }
        .success { color: #4caf50; margin: 20px 0; }
        button { background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #3367d6; }
      </style>
    </head>
    <body>
      <h2 class="success">Successfully Connected to GitHub!</h2>
      <p>Connected as: <strong>${username}</strong></p>
      <div id="status">Sending data to app...</div>
      
      <script>
        // Pass data back to the parent window and close
        window.onload = function() {
          const status = document.getElementById('status');
          
          try {
            // Try to send message to parent
            window.opener.postMessage({
              type: 'github-oauth-success',
              github_username: '${username}'
            }, '*');
            
            status.innerText = 'Connection complete!';
            
            // Try to close window automatically
            setTimeout(() => {
              try {
                window.close();
              } catch (err) {
                console.error('Could not close window automatically:', err);
                status.innerText = 'You can now close this window and return to the app.';
              }
            }, 1500);
          } catch (err) {
            console.error('Error sending message to parent window:', err);
            status.innerText = 'Connection complete! You can close this window and return to the app.';
          }
        };
      </script>
    </body>
  </html>`;
}

// Helper function to render error page for web
function renderErrorPage(errorMessage: string) {
  return `
  <!DOCTYPE html>
  <html>
    <head>
      <title>GitHub Connection Error</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; text-align: center; }
        .error { color: #f44336; margin: 20px 0; }
        button { background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 4px; font-size: 16px; cursor: pointer; }
        button:hover { background: #3367d6; }
      </style>
    </head>
    <body>
      <h2 class="error">Error Connecting to GitHub</h2>
      <p>${errorMessage}</p>
      <div id="status">Sending error to app...</div>
      
      <script>
        // Pass error back to the parent window and close
        window.onload = function() {
          const status = document.getElementById('status');
          
          try {
            // Try to send message to parent
            window.opener.postMessage({
              type: 'github-oauth-error',
              error: '${errorMessage.replace(/'/g, "\\'")}'
            }, '*');
            
            status.innerText = 'You can now close this window and return to the app.';
            
            // Try to close window automatically
            setTimeout(() => {
              try {
                window.close();
              } catch (err) {
                console.error('Could not close window automatically:', err);
              }
            }, 1500);
          } catch (err) {
            console.error('Error sending message to parent window:', err);
            status.innerText = 'Error reported! You can close this window and return to the app.';
          }
        };
      </script>
    </body>
  </html>`;
}
