import { supabase } from './supabase';
import type { Event } from './supabase';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';

export async function uploadEventImage(userId: string, imageUri: string): Promise<string> {
  try {
    // Generate filename with extension
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${userId}/${fileName}`;

    if (Platform.OS === 'ios') {
      // For iOS, manipulate the URI directly to avoid blob conversion
      // Create a FileReader-like workaround using fetch with blob response
      const fetchResponse = await fetch(imageUri);
      const fetchBlob = await fetchResponse.blob();
      
      // Convert to ArrayBuffer which is safe on iOS
      const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = reject;
        reader.readAsArrayBuffer(fetchBlob);
      });
      
      // Upload the ArrayBuffer directly
      const { error: uploadError } = await supabase.storage
        .from('event_images')
        .upload(filePath, new Uint8Array(arrayBuffer), {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: false
        });
        
      if (uploadError) throw uploadError;
    } else {
      // For web and Android, use fetch and blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      const { error: uploadError } = await supabase.storage
        .from('event_images')
        .upload(filePath, blob, {
          contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
          upsert: false
        });

      if (uploadError) throw uploadError;
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('event_images')
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (err) {
    console.error('Error uploading image:', err);
    throw new Error('Failed to upload image');
  }
}

export async function getEvents(options: {
  search?: string;
  latitude?: number;
  longitude?: number;
  distance?: number; // in kilometers
  topicId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  let query = supabase
    .from('events')
    .select(`
      *,
      topics (
        id,
        name,
        icon
      )
    `)
    .gte('start_time', options.startDate?.toISOString() || new Date().toISOString())
    .order('start_time');

  if (options.search) {
    query = query.ilike('title', `%${options.search}%`);
  }

  if (options.topicId) {
    query = query.eq('topic_id', options.topicId);
  }

  if (options.latitude && options.longitude && options.distance) {
    // Rough distance calculation using bounding box
    const lat = options.latitude;
    const lon = options.longitude;
    const dist = options.distance;
    
    const latRange = dist / 111.0; // 1 degree lat = ~111km
    const lonRange = dist / (111.0 * Math.cos(lat * Math.PI / 180));
    
    query = query
      .gte('latitude', lat - latRange)
      .lte('latitude', lat + latRange)
      .gte('longitude', lon - lonRange)
      .lte('longitude', lon + lonRange);
  }

  const { data: events, error } = await query;
  
  if (error) throw error;
  return events;
}

export function getGoogleMapsUrl(event: Event): string {
  const query = encodeURIComponent(event.location);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export async function openLocationMap(event: Event) {
  const url = getGoogleMapsUrl(event);
  
  try {
    if (Platform.OS === 'web') {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  } catch (error) {
    console.error('Failed to open map:', error);
  }
}
export async function createEvent(event: Omit<Event, 'id' | 'created_at' | 'updated_at'>) {
  // Make sure latitude and longitude are properly formatted numbers or null
  // Prevents potential issues with the location_geom trigger
  const formattedEvent: Omit<Event, 'id' | 'created_at' | 'updated_at'> = {
    ...event,
    latitude: event.latitude ? parseFloat(String(event.latitude)) : null,
    longitude: event.longitude ? parseFloat(String(event.longitude)) : null,
    // Ensure image_url is a properly formatted string or null
    image_url: event.image_url && typeof event.image_url === 'string' ? event.image_url : null
  };

  // Ensure the location field is a string
  if (typeof formattedEvent.location !== 'string' || !formattedEvent.location.trim()) {
    throw new Error('Location must be a valid string');
  }

  try {
    const { data, error } = await supabase
      .from('events')
      .insert(formattedEvent)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating event:', err);
    throw err;
  }
}

// Get events with RSVP status for the current user
export const getEventsWithRSVP = async (options: {
  search?: string;
  latitude?: number;
  longitude?: number;
  distance?: number; // km
  includeMyRSVPs?: boolean;
}) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;

  let query = supabase
    .from('events')
    .select(`
      *,
      topics (*),
      created_by_profile: profiles!events_created_by_fkey (*),
      my_rsvp: event_rsvps!inner(id, status)
    `)
    .order('start_time', { ascending: true });

  // Filter by user RSVPs if requested
  if (options.includeMyRSVPs && userId) {
    query = query.eq('my_rsvp.user_id', userId);
  } else if (userId) {
    // Just join to get RSVP status if available
    query = supabase
      .from('events')
      .select(`
        *,
        topics (*),
        created_by_profile: profiles!events_created_by_fkey (*),
        my_rsvp: event_rsvps(id, status)
      `)
      .eq('my_rsvp.user_id', userId)
      .order('start_time', { ascending: true });
  }

  // Add search filter if provided
  if (options.search) {
    query = query.or(`title.ilike.%${options.search}%,description.ilike.%${options.search}%`);
  }

  // Add location filter if provided
  if (options.latitude && options.longitude && options.distance) {
    // Rough distance calculation using bounding box
    const lat = options.latitude;
    const lon = options.longitude;
    const dist = options.distance;
    
    const latRange = dist / 111.0; // 1 degree lat = ~111km
    const lonRange = dist / (111.0 * Math.cos(lat * Math.PI / 180));
    
    query = query
      .gte('latitude', lat - latRange)
      .lte('latitude', lat + latRange)
      .gte('longitude', lon - lonRange)
      .lte('longitude', lon + lonRange);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching events:', error);
    throw error;
  }

  return data || [];
};

// RSVP to an event
export const rsvpToEvent = async (eventId: string, status: 'attending' | 'maybe' | 'declined') => {
  // Call the RPC function we created in the migration
  const { data, error } = await supabase.rpc('rsvp_to_event', {
    p_event_id: eventId,
    p_status: status,
  });

  if (error) {
    console.error('Error RSVPing to event:', error);
    throw error;
  }

  return data;
};

// Get attendees for an event
export const getEventAttendees = async (eventId: string) => {
  const { data, error } = await supabase
    .from('event_rsvps')
    .select(`
      id,
      status,
      created_at,
      profiles(*)
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching event attendees:', error);
    throw error;
  }

  return data || [];
};

// Check if user is the event organizer
export const isEventOrganizer = async (eventId: string) => {
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;

  if (!userId) return false;

  const { data, error } = await supabase
    .from('events')
    .select('id')
    .eq('id', eventId)
    .eq('created_by', userId)
    .maybeSingle();

  if (error) {
    console.error('Error checking if user is event organizer:', error);
    return false;
  }

  return !!data;
};