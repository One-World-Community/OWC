import React, { useEffect, useState } from 'react';
import { View, Button, Platform, Linking, Text } from 'react-native';
import { supabase } from '../../lib/supabase';
import * as WebBrowser from 'expo-web-browser';

interface GitHubAuthProps {
  onSuccess: (username: string) => void;
  onError: (error: string) => void;
}

export default function GitHubAuth({ onSuccess, onError }: GitHubAuthProps) {
  const [loading, setLoading] = useState(false);
  
  // Listen for deep links (for mobile)
  useEffect(() => {
    // Handle deep linking
    const handleDeepLink = async (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        
        // Only process our GitHub auth deep links
        if (url.protocol !== 'owc:' || url.hostname !== 'github-auth') return;
        
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        
        if (code && state) {
          await exchangeCodeForToken(code, state);
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };
    
    // Set up linking listeners properly for newer React Native versions
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    // Check if app was opened via URL
    Linking.getInitialURL().then(url => {
      if (url) {
        handleDeepLink({ url });
      }
    }).catch(err => {
      console.error('Error getting initial URL:', err);
    });
    
    return () => {
      // Clean up
      subscription.remove();
    };
  }, []);
  
  // Listen for web messages (for web platform)
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.log("Setting up web message listener for GitHub OAuth");
      
      const handleWebMessage = async (event: MessageEvent) => {
        // Log all messages for debugging
        console.log("Message received from origin:", event.origin);
        console.log("Message data:", JSON.stringify(event.data));
        console.log("Sender:", event.source);
        
        // For success messages
        if (event.data?.type === 'github-oauth-success') {
          console.log("Received GitHub OAuth success:", event.data);
          if (event.data?.github_username) {
            // The entire OAuth flow was completed in the edge function
            console.log(`GitHub connected successfully as ${event.data.github_username}`);
            onSuccess(event.data.github_username);
          } else {
            console.error("Missing GitHub username in success response");
            onError('GitHub connection completed but username was not returned');
          }
        }
        
        // For error messages
        if (event.data?.type === 'github-oauth-error') {
          console.error("Received GitHub OAuth error:", event.data);
          onError(event.data?.error || 'Failed to connect to GitHub');
        }
        
        // For backward compatibility (old flow)
        if (event.data?.type === 'github-oauth') {
          console.log("Received GitHub OAuth callback data (legacy flow)", event.data);
          const { code, state } = event.data;
          if (code && state) {
            try {
              // Use a more specific state check if needed
              console.log(`Processing GitHub OAuth code (first 4 chars): ${code.substring(0, 4)}...`);
              console.log(`Processing state: ${state}`);
              
              await exchangeCodeForToken(code, state);
              console.log("Successfully processed GitHub OAuth data");
            } catch (error) {
              console.error("Error processing GitHub OAuth data:", error);
              onError(error instanceof Error ? error.message : 'Failed to process GitHub authentication');
            }
          } else {
            console.error("Invalid GitHub OAuth data received:", event.data);
            onError('Invalid authentication data received');
          }
        }
      };
      
      // Add event listener for messages - use window.addEventListener
      window.addEventListener('message', handleWebMessage);
      
      // Log to confirm listener is installed
      console.log("Web message listener for GitHub OAuth installed at", new Date().toISOString());
      
      return () => {
        console.log("Removing web message listener");
        window.removeEventListener('message', handleWebMessage);
      };
    }
  }, []);
  
  // Exchange code for token
  const exchangeCodeForToken = async (code: string, state: string) => {
    try {
      setLoading(true);
      console.log("Exchanging code for token...");
      
      // Parse state to extract the UUID part if it has platform prefix
      // Format from handle-github is: {platform}|{random-uuid}
      console.log("Original state from callback:", state);
      let stateUuid = state;
      
      // If state includes platform prefix (format: "web|uuid" or "ios|uuid" etc.)
      if (state.includes('|')) {
        const [platform, uuid] = state.split('|');
        stateUuid = uuid;
        console.log(`Extracted platform: ${platform}, stateUuid: ${stateUuid}`);
      } else {
        console.log("State doesn't have platform prefix, using as-is");
      }
      
      // Get session first to access the token
      console.log("Getting Supabase session...");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available - user may not be authenticated");
        onError("Authentication required. Please log in again.");
        return;
      }
      
      console.log("Session obtained successfully");
      console.log("Calling handle-github with auth token (truncated):", accessToken.substring(0, 10) + "...");
      
      // Call edge function to exchange code for token
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'exchange-code',
          params: { 
            code,
            state: stateUuid // Send only the UUID part without platform prefix
          }
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (error) {
        console.error("Error from handle-github function:", error);
        // Add detailed error inspection
        console.error("Error details:", {
          message: error.message,
          name: error.name,
          status: error.status,
          stack: error.stack
        });
        throw new Error(error.message);
      }
      
      console.log("Response from handle-github function:", data);
      
      if (data?.success && data?.github_username) {
        console.log("GitHub connection successful for user:", data.github_username);
        onSuccess(data.github_username);
      } else {
        console.error("GitHub connection failed with data:", data);
        // More detailed error logging
        if (data?.error) {
          console.error("API error details:", data.error);
        }
        onError(data?.message || data?.error || 'GitHub connection failed');
      }
    } catch (error) {
      console.error("Exception in exchangeCodeForToken:", error);
      // Log more details about the caught error
      if (error instanceof Error) {
        console.error("Error details:", {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      onError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Start the GitHub OAuth flow
  const connectGitHub = async () => {
    try {
      setLoading(true);
      
      // Get session first to access the token
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      
      if (!accessToken) {
        console.error("No access token available - user may not be authenticated");
        onError("Authentication required. Please log in again.");
        return;
      }
      
      // Always use the Supabase edge function URL for the redirect
      // This is the URL that needs to be registered in the GitHub OAuth app settings
      const redirectUri = 'https://uyplzmzrgbfivwbrmque.supabase.co/functions/v1/github-callback';
      
      // Get auth URL from our function
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'get-auth-url',
          params: {
            redirectUri,
            platform: Platform.OS
          }
        },
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      
      if (error) throw new Error(error.message);
      
      const authUrl = data?.authUrl;
      if (!authUrl) throw new Error('No auth URL returned');
      
      console.log("Got GitHub auth URL:", authUrl);
      
      // Open auth URL based on platform
      if (Platform.OS === 'web') {
        // For web, open in a popup
        const popup = window.open(authUrl, 'github-oauth', 'width=600,height=700');
        
        // Check if popup was blocked
        if (!popup || popup.closed || typeof popup.closed === 'undefined') {
          console.error("Popup was blocked by the browser");
          onError('Login popup was blocked. Please allow popups for this site.');
          return;
        }
        
        // Additional check to ensure window message handler is set up
        console.log("GitHub auth popup opened successfully");
      } else {
        // For mobile, use WebBrowser from Expo
        const result = await WebBrowser.openAuthSessionAsync(authUrl, 'owc://github-auth');
        
        // WebBrowser will handle the redirect back to our app
        if (result.type !== 'success' && result.type !== 'cancel') {
          onError('Authentication failed');
        } else if (result.type === 'cancel') {
          onError('Authentication was cancelled');
        }
      }
    } catch (error) {
      console.error("Error connecting to GitHub:", error);
      onError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <View style={{ padding: 20 }}>
      <Button
        title={loading ? "Connecting..." : "Connect GitHub"}
        onPress={connectGitHub}
        disabled={loading}
      />
      {loading && <Text>Please wait...</Text>}
    </View>
  );
} 