import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useTheme } from '../../lib/theme';
import { getNearbyFeeds } from '../../lib/feeds';

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
  defaultRadius = 50
}: LocationAwareFeedsProps) {
  const { colors } = useTheme();
  const [feeds, setFeeds] = useState<LocationFeed[]>([]);
  const [location, setLocation] = useState<LocationCoordinates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchRadius, setSearchRadius] = useState(defaultRadius); // km

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (location) {
      loadNearbyFeeds();
    }
  }, [location, searchRadius, category, topicId]);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const userLocation = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: userLocation.coords.latitude,
          longitude: userLocation.coords.longitude,
        });
      } else {
        setError('Location permission denied');
      }
    } catch (err) {
      console.warn('Error getting location:', err);
      setError('Could not determine your location');
    }
  };

  const loadNearbyFeeds = async () => {
    if (!location) return;
    
    try {
      setLoading(true);
      const nearbyFeeds = await getNearbyFeeds({
        latitude: location.latitude,
        longitude: location.longitude,
        radius: searchRadius,
        category: category,
        topicId: topicId
      });
      setFeeds(nearbyFeeds);
    } catch (err) {
      console.error('Error loading nearby feeds:', err);
      setError('Failed to load location-based feeds');
    } finally {
      setLoading(false);
    }
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
        <View style={styles.radiusSelector}>
          <Text style={[styles.radiusLabel, { color: colors.textSecondary }]}>
            Within:
          </Text>
          {[25, 50, 100, 250].map((radius) => (
            <TouchableOpacity
              key={radius}
              style={[
                styles.radiusButton,
                radius === searchRadius && { backgroundColor: colors.primary }
              ]}
              onPress={() => setSearchRadius(radius)}
            >
              <Text style={[
                styles.radiusButtonText,
                radius === searchRadius ? { color: colors.card } : { color: colors.primary }
              ]}>
                {radius} km
              </Text>
            </TouchableOpacity>
          ))}
        </View>
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