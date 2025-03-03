import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './database.types';
import { useMemo } from 'react';
import Constants from 'expo-constants';

// Initialize Supabase client
const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Hook to use Supabase client in components
export function useSupabase() {
  return useMemo(() => supabase, []);
}

export type Tables = Database['public']['Tables'];
export type Topic = Tables['topics']['Row'];
export type Profile = Tables['profiles']['Row'];
export type Event = Tables['events']['Row'];
export type RssFeed = Tables['rss_feeds']['Row'];
export type EventRSVP = Tables['event_rsvps']['Row'];