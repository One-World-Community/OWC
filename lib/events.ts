import { supabase } from './supabase';
import type { Event } from './supabase';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as ImagePicker from 'expo-image-picker';

export async function uploadEventImage(userId: string, imageUri: string): Promise<string> {
  try {
    // For web, we need to fetch the file first
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Upload to Supabase Storage
    const fileExt = 'jpg';
    const filePath = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('event_images')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (uploadError) throw uploadError;

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
  const { data, error } = await supabase
    .from('events')
    .insert(event)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}