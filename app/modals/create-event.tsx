import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Image, Modal, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { createEvent, uploadEventImage } from '../../lib/events';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapModal from '../../components/maps/MapModal';

export default function CreateEventScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [locationSearchText, setLocationSearchText] = useState('');
  
  const [event, setEvent] = useState({
    title: '',
    description: '',
    location: '',
    latitude: null as number | null,
    longitude: null as number | null,
    start_time: new Date(),
    end_time: new Date(new Date().getTime() + 2 * 60 * 60 * 1000), // Default to 2 hours later
    topic_id: null as string | null,
    image_url: null as string | null,
  });
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  // For map region state
  const [mapRegion, setMapRegion] = useState({
    latitude: 18.5204, // Default to Pune, India
    longitude: 73.8567,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Get user's current location for initial map position
  useEffect(() => {
    if (Platform.OS === 'web') return; // Skip on web platform
    
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          setMapRegion({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          });
        }
      } catch (err) {
        console.warn('Error getting initial location:', err);
      }
    })();
  }, []);

  const handleLocationSearch = async () => {
    try {
      if (!locationSearchText.trim()) {
        return;
      }

      if (Platform.OS === 'web') {
        // Web location search is handled inside the WebMapModal component
        return;
      }

      // For mobile
      const result = await Location.geocodeAsync(locationSearchText);
      if (result.length > 0) {
        // Update map position
        setMapRegion({
          latitude: result[0].latitude,
          longitude: result[0].longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
        
        // Get address details for the found coordinates
        const addressResult = await Location.reverseGeocodeAsync({
          latitude: result[0].latitude,
          longitude: result[0].longitude,
        });
        
        if (addressResult.length > 0) {
          const address = addressResult[0];
          const formattedAddress = [
            address.name,
            address.street,
            address.city,
            address.region,
            address.country
          ].filter(Boolean).join(', ');
          
          setEvent(prev => ({
            ...prev,
            location: formattedAddress,
            latitude: result[0].latitude,
            longitude: result[0].longitude,
          }));
        }
      } else {
        setError('Location not found. Please try a different search term.');
      }
    } catch (err) {
      console.error('Error searching location:', err);
      setError('Failed to search location. Please try again.');
    }
  };

  const confirmLocationSelection = (location: string, latitude: number, longitude: number) => {
    setEvent(prev => ({
      ...prev,
      location,
      latitude,
      longitude,
    }));
    
    // Close the map modal
    setMapVisible(false);
  };

  const openLocationPicker = async () => {
    // Set search text to current location
    setLocationSearchText(event.location);
    
    // Show the map modal
    setMapVisible(true);
    
    if (Platform.OS !== 'web') {
      // For mobile, if we already have coordinates for the event, center the map on them
      if (event.latitude && event.longitude) {
        setMapRegion({
          latitude: event.latitude,
          longitude: event.longitude,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        });
      }
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        // @ts-ignore - MediaTypeOptions.images is correct
        mediaTypes: ImagePicker.MediaTypeOptions.images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error('Error picking image:', err);
      setError('Failed to pick image');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!session?.user) return;
      
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!event.title.trim()) {
        throw new Error('Please enter an event title');
      }
      if (!event.location.trim()) {
        throw new Error('Please enter an event location');
      }
      if (event.end_time <= event.start_time) {
        throw new Error('End time must be after start time');
      }

      let image_url = null;
      if (imageUri) {
        image_url = await uploadEventImage(session.user.id, imageUri);
      }

      // Create the event
      await createEvent({
        ...event,
        image_url,
        created_by: session.user.id,
      });

      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  const DateTimeInput = ({ 
    value,
    onChange,
    mode,
    showPicker,
    setShowPicker,
    label,
    icon
  }: {
    value: Date;
    onChange: (date: Date) => void;
    mode: 'date' | 'time';
    showPicker: boolean;
    setShowPicker: (show: boolean) => void;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
  }) => {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={icon} size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <input
              type={mode}
              value={mode === 'date' 
                ? value.toISOString().split('T')[0]
                : value.toTimeString().split(' ')[0].slice(0, 5)
              }
              onChange={(e) => {
                const newDate = new Date(value);
                if (mode === 'date') {
                  const [year, month, day] = e.target.value.split('-');
                  newDate.setFullYear(parseInt(year), parseInt(month) - 1, parseInt(day));
                } else {
                  const [hours, minutes] = e.target.value.split(':');
                  newDate.setHours(parseInt(hours), parseInt(minutes));
                }
                onChange(newDate);
              }}
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                border: 'none',
                color: colors.text,
                fontSize: 16,
                outline: 'none',
              }}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.inputGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
        <TouchableOpacity
          style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowPicker(true)}>
          <Ionicons name={icon} size={20} color={colors.textSecondary} style={styles.inputIcon} />
          <Text style={[styles.input, { color: colors.text }]}>
            {mode === 'date'
              ? value.toLocaleDateString()
              : value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </TouchableOpacity>
        {showPicker && (
          <DateTimePicker
            value={value}
            mode={mode}
            is24Hour={true}
            onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
              setShowPicker(false);
              if (selectedDate) {
                onChange(selectedDate);
              }
            }}
          />
        )}
      </View>
    );
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}>
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Event Title</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="calendar" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter event title"
              placeholderTextColor={colors.textSecondary}
              value={event.title}
              onChangeText={title => setEvent(prev => ({ ...prev, title }))}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons 
              name="location-outline" 
              size={20} 
              color={colors.textSecondary} 
              style={styles.inputIcon} 
            />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter event location"
              placeholderTextColor={colors.textSecondary}
              value={event.location}
              onChangeText={location => setEvent(prev => ({ ...prev, location }))}
              editable={true}
            />
            <TouchableOpacity
              onPress={openLocationPicker}
              style={styles.searchButton}>
              <Ionicons name="map-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {event.latitude && event.longitude && (
            <Text style={[styles.locationCoordinates, { color: colors.textSecondary }]}>
              {`Lat: ${event.latitude.toFixed(6)}, Long: ${event.longitude.toFixed(6)}`}
            </Text>
          )}
        </View>

        <DateTimeInput
          value={event.start_time}
          onChange={date => setEvent(prev => ({ ...prev, start_time: date }))}
          mode="date"
          showPicker={showDatePicker}
          setShowPicker={setShowDatePicker}
          label="Date"
          icon={"calendar-outline" as keyof typeof Ionicons.glyphMap}
        />

        <DateTimeInput
          value={event.start_time}
          onChange={date => setEvent(prev => ({ ...prev, start_time: date }))}
          mode="time"
          showPicker={showTimePicker}
          setShowPicker={setShowTimePicker}
          label="Time"
          icon={"time-outline" as keyof typeof Ionicons.glyphMap}
        />

        <DateTimeInput
          value={event.end_time}
          onChange={date => setEvent(prev => ({ ...prev, end_time: date }))}
          mode="time"
          showPicker={showTimePicker}
          setShowPicker={setShowTimePicker}
          label="End Time"
          icon={"time-outline" as keyof typeof Ionicons.glyphMap}
        />

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Event Image</Text>
          <TouchableOpacity
            style={[styles.imagePickerButton, { 
              backgroundColor: colors.card,
              borderColor: colors.border
            }]}
            onPress={pickImage}>
            {imageUri ? (
              <Image 
                source={{ uri: imageUri }}
                style={styles.previewImage}
              />
            ) : (
              <View style={styles.imagePickerContent}>
                <Ionicons name="image-outline" size={24} color={colors.textSecondary} />
                <Text style={[styles.imagePickerText, { color: colors.textSecondary }]}>
                  Choose an image
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Description</Text>
          <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="create" size={20} color={colors.textSecondary} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Enter event description"
              placeholderTextColor={colors.textSecondary}
              value={event.description}
              onChangeText={description => setEvent(prev => ({ ...prev, description }))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>
        </View>

        {error && (
          <View style={[styles.errorContainer, { backgroundColor: colors.error + '10' }]}>
            <Ionicons name="alert-circle" size={20} color={colors.error} />
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          </View>
        )}

        <TouchableOpacity 
          style={[
            styles.submitButton,
            { backgroundColor: colors.primary },
            loading && { opacity: 0.7 }
          ]}
          onPress={handleSubmit}
          disabled={loading}>
          <Text style={[styles.submitButtonText, { color: colors.card }]}>
            {loading ? 'Creating Event...' : 'Create Event'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Use the platform-specific MapModal component */}
      <MapModal
        visible={mapVisible}
        onClose={() => setMapVisible(false)}
        onConfirm={confirmLocationSelection}
        mapRegion={mapRegion}
        locationSearchText={locationSearchText}
        setLocationSearchText={setLocationSearchText}
        colors={colors}
        // Platform-specific props
        insets={insets}
        setMapRegion={setMapRegion}
        handleLocationSearch={handleLocationSearch}
        initialCoordinates={event.latitude && event.longitude ? {
          latitude: event.latitude,
          longitude: event.longitude
        } : undefined}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  inputIcon: {
    padding: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: Platform.OS === 'web' ? 12 : 40,
    fontSize: 16,
  },
  searchButton: {
    padding: 10,
    position: 'absolute',
    right: 0,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    marginLeft: 8,
    flex: 1,
  },
  submitButton: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  imagePickerButton: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
    height: 200,
  },
  imagePickerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  imagePickerText: {
    fontSize: 14,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  locationCoordinates: {
    fontSize: 12,
    marginTop: 4,
  },
  // Map modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  fullscreenMap: {
    ...StyleSheet.absoluteFillObject,
  },
  searchBarWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  floatingSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
  },
  floatingSearchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    paddingHorizontal: 8,
  },
  floatingSearchButton: {
    padding: 8,
  },
  floatingButtonsContainer: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1000,
  },
  floatingButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  floatingButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  mapHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  mapTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
  },
  confirmButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    fontWeight: '600',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 8,
  },
  mapSearchInput: {
    flex: 1,
    height: 40,
    fontSize: 16,
    paddingHorizontal: 8,
  },
  searchIconButton: {
    padding: 8,
  },
  map: {
    flex: 1,
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.7,
  },
});