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
      const handleWebMessage = async (event: MessageEvent) => {
        // Only process messages from our OAuth flow
        if (event.data?.type === 'github-oauth') {
          const { code, state } = event.data;
          if (code && state) {
            await exchangeCodeForToken(code, state);
          }
        }
      };
      
      window.addEventListener('message', handleWebMessage);
      
      return () => {
        window.removeEventListener('message', handleWebMessage);
      };
    }
  }, []);
  
  // Exchange code for token
  const exchangeCodeForToken = async (code: string, state: string) => {
    try {
      setLoading(true);
      
      // Call edge function to exchange code for token
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'exchange-code',
          params: { code, state }
        }
      });
      
      if (error) throw new Error(error.message);
      
      if (data?.success && data?.github_username) {
        onSuccess(data.github_username);
      } else {
        onError('GitHub connection failed');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Start the GitHub OAuth flow
  const connectGitHub = async () => {
    try {
      setLoading(true);
      
      // Get the redirect URI based on platform
      const redirectUri = Platform.OS === 'web'
        ? `${window.location.origin}/github-callback`
        : 'owc://github-auth'; // This is just stored for reference
      
      // Get auth URL from our function
      const { data, error } = await supabase.functions.invoke('handle-github', {
        body: {
          action: 'get-auth-url',
          params: {
            redirectUri,
            platform: Platform.OS
          }
        }
      });
      
      if (error) throw new Error(error.message);
      
      const authUrl = data?.authUrl;
      if (!authUrl) throw new Error('No auth URL returned');
      
      // Open auth URL based on platform
      if (Platform.OS === 'web') {
        // For web, open in a popup
        window.open(authUrl, 'github-oauth', 'width=600,height=700');
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