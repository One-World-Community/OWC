import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../lib/auth';
import { ThemeProvider } from '../lib/theme';
import * as Linking from 'expo-linking';

// Add type declaration for frameworkReady
declare global {
  interface Window {
    frameworkReady?: () => void;
  }
}

export default function RootLayout() {
  useEffect(() => {
    window.frameworkReady?.();
    
    // Set up deep linking handler for article URLs
    const subscription = Linking.addEventListener('url', handleDeepLink);
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  const handleDeepLink = (event: Linking.EventType) => {
    // Process the URL
    const { path, queryParams } = Linking.parse(event.url);
    
    // If a URL is shared to the app, redirect to share screen
    if (queryParams && queryParams.url) {
      // Navigate to share screen with the article URL
      router.push({
        pathname: 'share',
        params: { url: queryParams.url }
      });
    }
  };

  return (
    <ThemeProvider>
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="modals" />
          <Stack.Screen name="share" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </ThemeProvider>
  );
}