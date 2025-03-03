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
    const { data: accessTokenData, error: accessTokenError } = await supabaseAdmin.rpc(
      'vault_insert', 
      { 
        secret: tokenData.access_token,
        secret_name: `github_token_${userId}`,
        description: `GitHub access token for user ${userId}`
      }
    );
    
    if (accessTokenError) {
      console.error('Failed to store access token in vault:', accessTokenError);
      if (platform === 'web') {
        return new Response(renderErrorPage('Failed to securely store access token: ' + accessTokenError.message), { 
          headers: { ...corsHeaders, "Content-Type": "text/html" }
        });
      } else {
        return new Response(
          JSON.stringify({ error: 'Failed to securely store access token: ' + accessTokenError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Store refresh token in Vault if present
    let refreshTokenId = null;
    if (tokenData.refresh_token) {
      const { data: refreshTokenData, error: refreshTokenError } = await supabaseAdmin.rpc(
        'vault_insert', 
        { 
          secret: tokenData.refresh_token,
          secret_name: `github_refresh_${userId}`,
          description: `GitHub refresh token for user ${userId}`
        }
      );
      
      if (refreshTokenError) {
        console.error('Failed to store refresh token in vault:', refreshTokenError);
        // Continue without refresh token
      } else {
        refreshTokenId = refreshTokenData.id;
      }
    }
    
    // Store token IDs in github_connections table
    const { error: connectionError } = await supabaseAdmin
      .from("auth.github_connections")
      .upsert({
        user_id: userId,
        access_token_id: accessTokenData.id,
        refresh_token_id: refreshTokenId,
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        github_username: githubUser.login,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      
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
