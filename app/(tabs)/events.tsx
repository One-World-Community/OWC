import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { getEventsWithRSVP, rsvpToEvent, openLocationMap } from '../../lib/events';
import type { Event, Topic } from '../../lib/supabase';
import * as Location from 'expo-location';

// Define an extended Event type that includes the topics property
type EventWithTopics = Event & { 
  my_rsvp?: { status: string };
  topics?: Topic | null;
};

export default function EventsScreen() {
  const { colors } = useTheme();
  const [events, setEvents] = useState<EventWithTopics[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMyEventsOnly, setShowMyEventsOnly] = useState(false);
  const [useDistanceFilter, setUseDistanceFilter] = useState(true);

  useEffect(() => {
    loadEvents();
    requestLocation();
  }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    } catch (err) {
      console.warn('Error getting location:', err);
    }
  };

  const loadEvents = async () => {
    try {
      setLoading(true);
      const fetchedEvents = await getEventsWithRSVP({
        search: searchQuery || undefined,
        latitude: useDistanceFilter ? location?.latitude : undefined,
        longitude: useDistanceFilter ? location?.longitude : undefined,
        distance: useDistanceFilter ? 50 : undefined, // 50km radius when filter is enabled
        includeMyRSVPs: showMyEventsOnly,
      });
      setEvents(fetchedEvents);
    } catch (err) {
      setError('Failed to load events');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvents();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, location, showMyEventsOnly, useDistanceFilter]);

  const handleRSVP = async (eventId: string, status: 'attending' | 'maybe' | 'declined') => {
    try {
      await rsvpToEvent(eventId, status);
      // Update the local state to reflect the change
      setEvents(events.map(event => 
        event.id === eventId 
          ? { ...event, my_rsvp: { status } } 
          : event
      ));
      Alert.alert('Success', `You are now ${status} this event.`);
    } catch (err) {
      console.error('Failed to RSVP:', err);
      Alert.alert('Error', 'Failed to RSVP to the event. Please try again.');
    }
  };

  const showRSVPOptions = (event: EventWithTopics) => {
    Alert.alert(
      'RSVP to Event',
      `Would you like to attend "${event.title}"?`,
      [
        {
          text: 'Attending',
          onPress: () => handleRSVP(event.id, 'attending'),
        },
        {
          text: 'Maybe',
          onPress: () => handleRSVP(event.id, 'maybe'),
        },
        {
          text: 'Decline',
          onPress: () => handleRSVP(event.id, 'declined'),
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const viewEventDetails = (event: EventWithTopics) => {
    router.push(`/event/${event.id}`);
  };

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        <TouchableOpacity 
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={loadEvents}>
          <Text style={[styles.retryButtonText, { color: colors.card }]}>Retry</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#ffffff' }]}>
      <View style={[styles.searchContainer, { 
        backgroundColor: colors.card,
        borderBottomColor: colors.border
      }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search events..."
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        
        <View style={styles.filterButtonsRow}>
          <TouchableOpacity 
            style={[
              styles.filterButton, 
              { 
                backgroundColor: showMyEventsOnly ? colors.primary : colors.background,
                borderColor: colors.primary
              }
            ]}
            onPress={() => setShowMyEventsOnly(!showMyEventsOnly)}
          >
            <Text style={[
              styles.filterButtonText, 
              { color: showMyEventsOnly ? colors.card : colors.primary }
            ]}>
              {showMyEventsOnly ? 'My Events' : 'All Events'}
            </Text>
          </TouchableOpacity>

          {location && (
            <TouchableOpacity 
              style={[
                styles.filterButton, 
                { 
                  backgroundColor: useDistanceFilter ? colors.primary : colors.background,
                  borderColor: colors.primary,
                  marginLeft: 8
                }
              ]}
              onPress={() => setUseDistanceFilter(!useDistanceFilter)}
            >
              <Text style={[
                styles.filterButtonText, 
                { color: useDistanceFilter ? colors.card : colors.primary }
              ]}>
                {useDistanceFilter ? 'Nearby' : 'Everywhere'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={events}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={[styles.eventCard, { backgroundColor: colors.card }]}
            onPress={() => viewEventDetails(item)}
          >
            <View style={styles.eventHeader}>
              <Text style={[styles.eventTitle, { color: colors.text }]}>{item.title}</Text>
              {item.topics && (
                <View style={[styles.categoryTag, { backgroundColor: colors.primary + '20' }]}>
                  <Text style={[styles.categoryText, { color: colors.primary }]}>
                    {item.topics.name}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.eventDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {new Date(item.start_time).toLocaleDateString()}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                  {new Date(item.start_time).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </Text>
              </View>
              
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                <TouchableOpacity 
                  onPress={() => openLocationMap(item)}
                  style={styles.locationButton}>
                  <Text style={[styles.detailText, { color: colors.textSecondary }]}>
                    {item.location}
                  </Text>
                  <Ionicons 
                    name="map-outline" 
                    size={16} 
                    color={colors.primary}
                    style={styles.mapIcon} 
                  />
                </TouchableOpacity>
              </View>

              {item.description && (
                <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
                  {item.description}
                </Text>
              )}
            </View>

            <View style={styles.actionButtonsRow}>
              {item.my_rsvp?.status ? (
                <View style={[
                  styles.rsvpStatus, 
                  { 
                    backgroundColor: 
                      item.my_rsvp.status === 'attending' ? colors.success + '20' :
                      item.my_rsvp.status === 'maybe' ? colors.warning + '20' :
                      colors.error + '20'
                  }
                ]}>
                  <Text style={[
                    styles.rsvpStatusText, 
                    { 
                      color: 
                        item.my_rsvp.status === 'attending' ? colors.success :
                        item.my_rsvp.status === 'maybe' ? colors.warning :
                        colors.error
                    }
                  ]}>
                    {item.my_rsvp.status.charAt(0).toUpperCase() + item.my_rsvp.status.slice(1)}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity 
                  style={[styles.rsvpButton, { backgroundColor: colors.primary }]}
                  onPress={() => showRSVPOptions(item)}
                >
                  <Text style={[styles.rsvpButtonText, { color: colors.card }]}>RSVP</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        )}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.eventsList, { paddingBottom: 40 }]}
        refreshing={loading}
        onRefresh={loadEvents}
      />
      
      <TouchableOpacity 
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => router.push('/modals/create-event')}>
        <Ionicons name="add" size={24} color={colors.card} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  searchContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1e293b',
  },
  eventsList: {
    padding: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 12,
  },
  categoryTag: {
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 12,
    color: '#6366f1',
    fontWeight: '500',
  },
  eventDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  registerButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  locationButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  mapIcon: {
    marginLeft: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  filterButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rsvpButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  rsvpButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  rsvpStatus: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rsvpStatusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
});