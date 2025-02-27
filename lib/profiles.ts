import { supabase } from './supabase';
import type { Profile } from './supabase';

// Get a user profile by ID
export const getProfileById = async (userId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return null;
  }

  return data;
};

// Get current user profile
export const getCurrentProfile = async (): Promise<Profile | null> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;

  if (!userId) return null;

  return getProfileById(userId);
};

// Update profile
export const updateProfile = async (profile: Partial<Profile>): Promise<Profile | null> => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;

  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update(profile)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error);
    return null;
  }

  return data;
};

// Get events created by a user
export const getEventsCreatedByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('events')
    .select(`
      *,
      topics (*),
      _count: event_rsvps(count)
    `)
    .eq('created_by', userId)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching user events:', error);
    throw error;
  }

  return data || [];
};

// Get events a user is attending
export const getEventsAttendingByUser = async (userId: string) => {
  const { data, error } = await supabase
    .from('event_rsvps')
    .select(`
      id,
      status,
      events (
        *,
        topics (*),
        created_by_profile: profiles!events_created_by_fkey (*)
      )
    `)
    .eq('user_id', userId)
    .eq('status', 'attending')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching attending events:', error);
    throw error;
  }

  return data || [];
}; 