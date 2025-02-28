import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../lib/theme';
import { getNearbyFeeds } from '../../lib/feeds';
import { supabase } from '../../lib/supabase';

// Define the type for the feed data
type LocationFeed = {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  topic_id: string | null;
  status: string;
  location_name: string;
  location_category: string;
  distance_km: number;
};

// Define the location type
type LocationCoordinates = {
  latitude: number;
  longitude: number;
};

type LocationAwareFeedsProps = {
  title?: string;
  category?: string;
  topicId?: string;
  defaultRadius?: number;
};

const getIconForCategory = (category: string) => {
  switch (category) {
    case 'local_news':
      return 'newspaper-outline';
    case 'local_politics':
      return 'business-outline';
    case 'community':
      return 'people-outline';
    default:
      return 'earth-outline';
  }
};

export default function LocationAwareFeeds({ 
  title = 'Location-Based Feeds',
  category,
  topicId,
  defaultRadius = 100
}: LocationAwareFeedsProps) {
  const { colors } = useTheme();
  const [feeds, setFeeds] = useState<LocationFeed[]>([]);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(defaultRadius); // km
  const [isAllDistance, setIsAllDistance] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'determining' | 'found' | 'error'>('determining');

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (location) {
      loadNearbyFeeds();
    }
  }, [location, searchRadius, isAllDistance, category, topicId]);

  const requestLocation = async () => {
    setLocationStatus('determining');
    
    try {
      console.log('Requesting location permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        console.log('Permission granted, getting current position...');
        
        try {
          // First try to get the current position with a timeout
          const userLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced, // Less accuracy = faster response
            timeInterval: 5000 // Only need location every 5 seconds
          });
          
          console.log('Got current position:', userLocation.coords);
          setLocation({
            latitude: userLocation.coords.latitude,
            longitude: userLocation.coords.longitude,
          });
          setLocationStatus('found');
          return;
        } catch (positionError) {
          console.warn('Error getting current position:', positionError);
          
          // Fall back to last known position if current position fails
          console.log('Trying to get last known position...');
          const lastKnownPosition = await Location.getLastKnownPositionAsync();
          
          if (lastKnownPosition) {
            console.log('Using last known position:', lastKnownPosition.coords);
            setLocation({
              latitude: lastKnownPosition.coords.latitude,
              longitude: lastKnownPosition.coords.longitude,
            });
            setLocationStatus('found');
            return;
          }
          
          // If we can't get the last known position either, try using a rough city-level guess
          console.warn('Could not get last known position, using a fallback');
          setError('Could not precisely determine your location. Results may not be accurate.');
          
          // Fallback to a default central location if everything fails
          setLocation({
            latitude: 37.7749, // San Francisco as a reasonable default
            longitude: -122.4194
          });
          setLocationStatus('error');
        }
      } else {
        console.warn('Location permission denied');
        setError('Location permission denied. Please enable location services to see nearby feeds.');
        setLocationStatus('error');
      }
    } catch (err) {
      console.error('Error in location request:', err);
      setError('Could not determine your location. Please check your location settings.');
      setLocationStatus('error');
    }
  };

  const loadNearbyFeeds = async () => {
    if (!location) return;
    
    try {
      setLoading(true);
      console.log(`Loading feeds with: radius=${isAllDistance ? 'All' : searchRadius}, lat=${location.latitude}, lng=${location.longitude}`);
      
      if (isAllDistance) {
        // For "All" option, get all location-aware feeds without distance filtering
        let query = supabase
          .from('location_aware_feeds')
          .select('*');
        
        // Only add category filter if category is provided
        if (category) {
          query = query.eq('location_category', category);
        }
        
        // Add topic filter if provided
        if (topicId) {
          query = query.eq('topic_id', topicId);
        }
        
        const { data: allFeeds, error } = await query;
        
        if (error) throw error;
        console.log(`Got ${allFeeds?.length || 0} feeds, calculating distances...`);
        
        // Calculate distances manually for display purposes
        const feedsWithDistance = allFeeds?.map(feed => {
          const distance = calculateDistance(
            location.latitude, 
            location.longitude, 
            feed.latitude, 
            feed.longitude
          );
          return { ...feed, distance_km: distance };
        }).sort((a, b) => a.distance_km - b.distance_km); // Sort by closest first
        
        setFeeds(feedsWithDistance || []);
        console.log(`Set ${feedsWithDistance?.length || 0} feeds sorted by distance`);
      } else {
        // Use the standard RPC function for distance-based filtering
        const nearbyFeeds = await getNearbyFeeds({
          latitude: location.latitude,
          longitude: location.longitude,
          radius: searchRadius,
          category: category,
          topicId: topicId
        });
        
        // Make sure we also have distance-based sorting in the near feeds case
        // (The DB function already sorts by distance, but this ensures consistency)
        const sortedFeeds = [...nearbyFeeds].sort((a, b) => a.distance_km - b.distance_km);
        
        setFeeds(sortedFeeds);
        console.log(`Got ${sortedFeeds?.length || 0} feeds within ${searchRadius}km radius`);
      }
    } catch (err) {
      console.error('Error loading nearby feeds:', err);
      setError('Failed to load location-based feeds');
    } finally {
      setLoading(false);
    }
  };

  // Simple distance calculation function using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleOpenFeed = (feedId: string) => {
    router.push(`/feeds/${feedId}`);
  };

  const formatCategory = (category: string) => {
    return category
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleRadiusSelect = (radius: number | null) => {
    if (radius === null) {
      setIsAllDistance(true);
    } else {
      setSearchRadius(radius);
      setIsAllDistance(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        
        {locationStatus === 'determining' && (
          <View style={styles.locationStatusContainer}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.locationStatusText, { color: colors.textSecondary }]}>
              Determining your location...
            </Text>
          </View>
        )}
        
        {locationStatus === 'error' && location && (
          <View style={styles.locationStatusContainer}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.warning} />
            <Text style={[styles.locationStatusText, { color: colors.warning }]}>
              Using approximate location
            </Text>
          </View>
        )}
        
        {location && (
          <View style={styles.radiusSelector}>
            <Text style={[styles.radiusLabel, { color: colors.textSecondary }]}>
              Within:
            </Text>
            <TouchableOpacity
              style={[
                styles.radiusButton,
                (!isAllDistance && searchRadius === 100) && { backgroundColor: colors.primary }
              ]}
              onPress={() => handleRadiusSelect(100)}
            >
              <Text style={[
                styles.radiusButtonText,
                (!isAllDistance && searchRadius === 100) ? { color: colors.card } : { color: colors.primary }
              ]}>
                100 km
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.radiusButton,
                (!isAllDistance && searchRadius === 500) && { backgroundColor: colors.primary }
              ]}
              onPress={() => handleRadiusSelect(500)}
            >
              <Text style={[
                styles.radiusButtonText,
                (!isAllDistance && searchRadius === 500) ? { color: colors.card } : { color: colors.primary }
              ]}>
                500 km
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.radiusButton,
                isAllDistance && { backgroundColor: colors.primary }
              ]}
              onPress={() => handleRadiusSelect(null)}
            >
              <Text style={[
                styles.radiusButtonText,
                isAllDistance ? { color: colors.card } : { color: colors.primary }
              ]}>
                All
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.primary }]}
            onPress={requestLocation}
          >
            <Text style={[styles.retryButtonText, { color: colors.card }]}>
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={feeds}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.feedCard, { backgroundColor: colors.card }]}
              onPress={() => handleOpenFeed(item.id)}
            >
              <View style={styles.feedCardContent}>
                <Text style={[styles.feedName, { color: colors.text }]}>
                  {item.name}
                </Text>
                <View style={styles.locationInfo}>
                  <Ionicons name="location-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.locationText, { color: colors.textSecondary }]}>
                    {item.location_name} ({Math.round(item.distance_km)} km away)
                  </Text>
                </View>
                {item.location_category && (
                  <View style={styles.categoryTag}>
                    <Ionicons name={getIconForCategory(item.location_category)} size={12} color={colors.primary} />
                    <Text style={[styles.categoryText, { color: colors.primary }]}>
                      {formatCategory(item.location_category)}
                    </Text>
                  </View>
                )}
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.feedsList}
          refreshing={loading}
          onRefresh={loadNearbyFeeds}
          ListEmptyComponent={loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Finding feeds near you...
              </Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons 
                name={category ? getIconForCategory(category) : "location-outline"} 
                size={48} 
                color={colors.textSecondary} 
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No location-based feeds found nearby
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                Try increasing the search radius
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  radiusSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  locationStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  locationStatusText: {
    marginLeft: 8,
    fontSize: 14,
  },
  radiusLabel: {
    marginRight: 8,
    fontSize: 14,
  },
  radiusButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  radiusButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  feedsList: {
    padding: 16,
  },
  feedCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  feedCardContent: {
    flex: 1,
  },
  feedName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    marginLeft: 4,
  },
  categoryTag: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: '#f0f4ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
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
    marginTop: 8,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
}); 