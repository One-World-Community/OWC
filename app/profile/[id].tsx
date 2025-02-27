import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { getProfileById } from '../../lib/profiles';
import { getEventsCreatedByUser, getEventsAttendingByUser } from '../../lib/profiles';
import { supabase } from '../../lib/supabase';
import type { Profile, Event } from '../../lib/supabase';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createdEvents, setCreatedEvents] = useState<Event[]>([]);
  const [attendingEvents, setAttendingEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    
    loadProfile();
  }, [id]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      // Get profile
      const userProfile = await getProfileById(id as string);
      setProfile(userProfile);
      
      // Check if viewing own profile
      const { data: session } = await supabase.auth.getSession();
      const currentUserId = session?.session?.user?.id;
      setIsCurrentUser(currentUserId === id);
      
      // Get events created by user
      const events = await getEventsCreatedByUser(id as string);
      setCreatedEvents(events);
      
      // Get events user is attending
      const attending = await getEventsAttendingByUser(id as string);
      setAttendingEvents(attending);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewEvent = (eventId: string) => {
    router.push(`/event/${eventId}`);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading profile...
        </Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          User not found or has been removed.
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}>
          <Text style={[styles.backButtonText, { color: colors.card }]}>
            Go Back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen 
        options={{
          title: isCurrentUser ? 'My Profile' : 'User Profile',
          headerBackTitle: 'Back',
        }}
      />

      <View style={[styles.profileHeader, { backgroundColor: colors.card }]}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarContainer}>
            {profile.avatar_url ? (
              <Image 
                source={{ uri: profile.avatar_url }} 
                style={styles.avatarImage} 
              />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                  {(profile.full_name || profile.username || '?').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          
          <Text style={[styles.userName, { color: colors.text }]}>
            {profile.full_name || profile.username || 'Anonymous'}
          </Text>
          
          {profile.username && profile.full_name && (
            <Text style={[styles.userUsername, { color: colors.textSecondary }]}>
              @{profile.username}
            </Text>
          )}
        </View>
      </View>

      {/* Created Events Section */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Events Created ({createdEvents.length})
        </Text>

        {createdEvents.length === 0 ? (
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            {isCurrentUser 
              ? "You haven't created any events yet." 
              : "This user hasn't created any events yet."}
          </Text>
        ) : (
          <View style={styles.eventsList}>
            {createdEvents.map(event => (
              <TouchableOpacity
                key={event.id}
                style={[styles.eventCard, { backgroundColor: colors.card }]}
                onPress={() => viewEvent(event.id)}
              >
                <View style={styles.eventDetails}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                  
                  <View style={styles.eventMeta}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.eventMetaText, { color: colors.textSecondary }]}>
                      {new Date(event.start_time).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.eventMeta}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.eventMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {event.location}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Attending Events Section */}
      <View style={styles.sectionContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Events Attending ({attendingEvents.length})
        </Text>

        {attendingEvents.length === 0 ? (
          <Text style={[styles.emptyStateText, { color: colors.textSecondary }]}>
            {isCurrentUser 
              ? "You're not attending any events yet." 
              : "This user isn't attending any events yet."}
          </Text>
        ) : (
          <View style={styles.eventsList}>
            {attendingEvents.map(rsvp => (
              <TouchableOpacity
                key={rsvp.id}
                style={[styles.eventCard, { backgroundColor: colors.card }]}
                onPress={() => viewEvent(rsvp.events.id)}
              >
                <View style={styles.eventDetails}>
                  <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
                    {rsvp.events.title}
                  </Text>
                  
                  <View style={styles.eventMeta}>
                    <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.eventMetaText, { color: colors.textSecondary }]}>
                      {new Date(rsvp.events.start_time).toLocaleDateString()}
                    </Text>
                  </View>
                  
                  <View style={styles.eventMeta}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.eventMetaText, { color: colors.textSecondary }]} numberOfLines={1}>
                      {rsvp.events.location}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  profileHeader: {
    padding: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 24,
  },
  profileInfo: {
    alignItems: 'center',
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 16,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 40,
    fontWeight: '600',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  userUsername: {
    fontSize: 16,
  },
  sectionContainer: {
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 24,
  },
  eventsList: {
    marginTop: 8,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  eventDetails: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventMetaText: {
    fontSize: 14,
    marginLeft: 6,
  },
}); 