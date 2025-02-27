import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { getEventAttendees, isEventOrganizer, rsvpToEvent, openLocationMap } from '../../lib/events';
import { getProfileById } from '../../lib/profiles';
import { supabase } from '../../lib/supabase';
import type { Event, Profile } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [event, setEvent] = useState<Event | null>(null);
  const [attendees, setAttendees] = useState<{ id: string; status: string; profile: Profile }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [currentUserRsvp, setCurrentUserRsvp] = useState<string | null>(null);
  const [organizer, setOrganizer] = useState<Profile | null>(null);

  useEffect(() => {
    if (!id) return;
    
    loadEventDetails();
    loadEventAttendees();
    checkIfOrganizer();
  }, [id]);

  const loadEventDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          topics (*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setEvent(data);

      if (data.created_by) {
        const organizerProfile = await getProfileById(data.created_by);
        setOrganizer(organizerProfile);
      }
    } catch (err) {
      console.error('Error loading event details:', err);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const loadEventAttendees = async () => {
    try {
      const attendeeData = await getEventAttendees(id as string);
      setAttendees(attendeeData.map(item => ({ 
        id: item.id, 
        status: item.status, 
        profile: item.profiles 
      })));

      // Check if current user has RSVP'd
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (userId) {
        const userRsvp = attendeeData.find(item => item.profiles.id === userId);
        if (userRsvp) {
          setCurrentUserRsvp(userRsvp.status);
        }
      }
    } catch (err) {
      console.error('Error loading attendees:', err);
    }
  };

  const checkIfOrganizer = async () => {
    try {
      const result = await isEventOrganizer(id as string);
      setIsOrganizer(result);
    } catch (err) {
      console.error('Error checking organizer status:', err);
    }
  };

  const handleRSVP = async (status: 'attending' | 'maybe' | 'declined') => {
    try {
      await rsvpToEvent(id as string, status);
      setCurrentUserRsvp(status);
      loadEventAttendees(); // Refresh attendee list
      Alert.alert('Success', `You are now ${status} this event.`);
    } catch (err) {
      console.error('Failed to RSVP:', err);
      Alert.alert('Error', 'Failed to RSVP to the event. Please try again.');
    }
  };

  const showRSVPOptions = () => {
    Alert.alert(
      'RSVP to Event',
      `Update your RSVP status for "${event?.title}"?`,
      [
        {
          text: 'Attending',
          onPress: () => handleRSVP('attending'),
        },
        {
          text: 'Maybe',
          onPress: () => handleRSVP('maybe'),
        },
        {
          text: 'Decline',
          onPress: () => handleRSVP('declined'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const viewUserProfile = (userId: string) => {
    router.push(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading event details...
        </Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          Event not found or has been removed.
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

  const getRsvpStatusColor = (status: string) => {
    switch (status) {
      case 'attending':
        return { bg: '#dcfce7', text: '#16a34a' };
      case 'maybe':
        return { bg: '#fef9c3', text: '#ca8a04' };
      case 'declined':
        return { bg: '#fee2e2', text: '#dc2626' };
      default:
        return { bg: colors.background, text: colors.textSecondary };
    }
  };

  return (
    <ScrollView 
      style={[styles.container, { 
        backgroundColor: colors.background,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right
      }]}
    >
      <Stack.Screen 
        options={{
          title: 'Event Details',
          headerBackTitle: 'Back',
        }}
      />

      {event.image_url && (
        <Image 
          source={{ uri: event.image_url }} 
          style={styles.eventImage}
          resizeMode="cover"
        />
      )}

      <View style={[styles.eventContent, { backgroundColor: colors.card }]}>
        <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
        
        {event.topics && (
          <View style={[styles.categoryTag, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.categoryText, { color: colors.primary }]}>
              {event.topics.name}
            </Text>
          </View>
        )}

        <View style={styles.metaSection}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {new Date(event.start_time).toLocaleDateString()} at {' '}
              {new Date(event.start_time).toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.metaItem}
            onPress={() => openLocationMap(event)}>
            <Ionicons name="location-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {event.location}
            </Text>
            <Ionicons name="open-outline" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
          </TouchableOpacity>

          {organizer && (
            <TouchableOpacity 
              style={styles.metaItem}
              onPress={() => viewUserProfile(organizer.id)}>
              <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                Organized by {organizer.full_name || organizer.username || 'Anonymous'}
              </Text>
              <Ionicons name="chevron-forward-outline" size={16} color={colors.primary} style={{ marginLeft: 4 }} />
            </TouchableOpacity>
          )}
        </View>

        {event.description && (
          <View style={styles.descriptionSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {event.description}
            </Text>
          </View>
        )}

        <View style={styles.rsvpSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your RSVP</Text>
          
          {currentUserRsvp ? (
            <View style={styles.currentRsvpRow}>
              <View style={[
                styles.rsvpStatusBadge, 
                { backgroundColor: getRsvpStatusColor(currentUserRsvp).bg }
              ]}>
                <Text style={[
                  styles.rsvpStatusText,
                  { color: getRsvpStatusColor(currentUserRsvp).text }
                ]}>
                  {currentUserRsvp.charAt(0).toUpperCase() + currentUserRsvp.slice(1)}
                </Text>
              </View>
              
              <TouchableOpacity
                style={[styles.updateRsvpButton, { borderColor: colors.primary }]}
                onPress={showRSVPOptions}>
                <Text style={[styles.updateRsvpText, { color: colors.primary }]}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.rsvpButtonsRow}>
              <TouchableOpacity
                style={[styles.rsvpButton, { backgroundColor: '#dcfce7' }]}
                onPress={() => handleRSVP('attending')}>
                <Text style={[styles.rsvpButtonText, { color: '#16a34a' }]}>Attending</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.rsvpButton, { backgroundColor: '#fef9c3' }]}
                onPress={() => handleRSVP('maybe')}>
                <Text style={[styles.rsvpButtonText, { color: '#ca8a04' }]}>Maybe</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.rsvpButton, { backgroundColor: '#fee2e2' }]}
                onPress={() => handleRSVP('declined')}>
                <Text style={[styles.rsvpButtonText, { color: '#dc2626' }]}>Decline</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.attendeesSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Attendees ({attendees.filter(a => a.status === 'attending').length})
          </Text>
          
          {attendees.length === 0 ? (
            <Text style={[styles.noAttendeesText, { color: colors.textSecondary }]}>
              No one has RSVP'd to this event yet. Be the first!
            </Text>
          ) : (
            <View style={styles.attendeesList}>
              {attendees
                .filter(attendee => attendee.status === 'attending')
                .map(attendee => (
                  <TouchableOpacity 
                    key={attendee.id}
                    style={[styles.attendeeItem, { backgroundColor: colors.background }]}
                    onPress={() => viewUserProfile(attendee.profile.id)}
                  >
                    <View style={styles.attendeeAvatar}>
                      {attendee.profile.avatar_url ? (
                        <Image 
                          source={{ uri: attendee.profile.avatar_url }} 
                          style={styles.avatarImage} 
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '40' }]}>
                          <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                            {(attendee.profile.full_name || attendee.profile.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.attendeeInfo}>
                      <Text style={[styles.attendeeName, { color: colors.text }]}>
                        {attendee.profile.full_name || attendee.profile.username || 'Anonymous'}
                      </Text>
                    </View>
                    
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              }
              
              {attendees.filter(a => a.status === 'maybe').length > 0 && (
                <Text style={[styles.maybeTitle, { color: colors.text }]}>
                  Maybe ({attendees.filter(a => a.status === 'maybe').length})
                </Text>
              )}
              
              {attendees
                .filter(attendee => attendee.status === 'maybe')
                .map(attendee => (
                  <TouchableOpacity 
                    key={attendee.id}
                    style={[styles.attendeeItem, { backgroundColor: colors.background }]}
                    onPress={() => viewUserProfile(attendee.profile.id)}
                  >
                    <View style={styles.attendeeAvatar}>
                      {attendee.profile.avatar_url ? (
                        <Image 
                          source={{ uri: attendee.profile.avatar_url }} 
                          style={styles.avatarImage} 
                        />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '40' }]}>
                          <Text style={[styles.avatarInitial, { color: colors.primary }]}>
                            {(attendee.profile.full_name || attendee.profile.username || '?').charAt(0).toUpperCase()}
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.attendeeInfo}>
                      <Text style={[styles.attendeeName, { color: colors.text }]}>
                        {attendee.profile.full_name || attendee.profile.username || 'Anonymous'}
                      </Text>
                    </View>
                    
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </TouchableOpacity>
                ))
              }
            </View>
          )}
        </View>
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
  eventImage: {
    width: '100%',
    height: 200,
  },
  eventContent: {
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: -20,
  },
  eventTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '500',
  },
  metaSection: {
    marginBottom: 24,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  metaText: {
    marginLeft: 8,
    fontSize: 16,
    flex: 1,
  },
  descriptionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
  },
  rsvpSection: {
    marginBottom: 24,
  },
  currentRsvpRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  rsvpStatusText: {
    fontWeight: '600',
    fontSize: 14,
  },
  updateRsvpButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  updateRsvpText: {
    fontWeight: '600',
    fontSize: 14,
  },
  rsvpButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rsvpButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  rsvpButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  attendeesSection: {
    marginBottom: 40,
  },
  attendeesList: {
    marginTop: 8,
  },
  attendeeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  attendeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginRight: 12,
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
    fontSize: 18,
    fontWeight: '600',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  noAttendeesText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
  },
  maybeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
}); 