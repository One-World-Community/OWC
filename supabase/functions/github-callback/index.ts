// GitHub OAuth callback handler
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"

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
    
    if (platform === 'web') {
      // For web: render a simple page that communicates with the parent window
      const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Connecting to GitHub...</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; text-align: center; }
          </style>
        </head>
        <body>
          <h3>Connecting to GitHub...</h3>
          <p>Please wait while we complete the connection.</p>
          <script>
            // Pass data back to the parent window
            window.onload = function() {
              window.opener.postMessage({
                type: 'github-oauth',
                code: '${code}',
                state: '${stateValue}'
              }, '*');
              window.close();
            };
          </script>
        </body>
      </html>
      `;
      
      return new Response(html, {
        headers: { ...corsHeaders, "Content-Type": "text/html" }
      });
    } else {
      // For mobile: redirect to the app's URL scheme
      // We'll use the pattern: owc://github-auth?code=XXX&state=YYY
      const redirectUrl = `owc://github-auth?code=${encodeURIComponent(code)}&state=${encodeURIComponent(stateValue)}`;
      
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Redirecting...</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; text-align: center; }
            </style>
          </head>
          <body>
            <h3>Connecting to your app...</h3>
            <p>Please wait while we redirect you back to the app.</p>
            <script>
              window.location.href = "${redirectUrl}";
            </script>
          </body>
        </html>
      `, {
        headers: { ...corsHeaders, "Content-Type": "text/html" }
      });
    }
  } catch (error) {
    console.error("Error in GitHub callback:", error);
    return new Response("Error processing GitHub callback", { 
      status: 500,
      headers: corsHeaders
    });
  }
});
