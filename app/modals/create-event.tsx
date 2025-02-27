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

// Conditionally require react-native-maps only on native platforms
// This will prevent it from being bundled in the web build
let MapView: any = null;
let Marker: any = null;
if (Platform.OS === 'ios' || Platform.OS === 'android') {
  try {
    // Wrap in try/catch to prevent errors during build
    const ReactNativeMaps = require('react-native-maps');
    MapView = ReactNativeMaps.default;
    Marker = ReactNativeMaps.Marker;
  } catch (e) {
    console.warn('Could not load react-native-maps:', e);
  }
}

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
  const mapRef = useRef(null);
  // For web leaflet map
  const webMapRef = useRef<any>(null);
  const webMarkerRef = useRef<any>(null);
  
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
  
  // For mobile map modal
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

  // Only runs on web to set up the Leaflet map when the modal is visible
  useEffect(() => {
    if (Platform.OS !== 'web' || !mapVisible) return;

    const initializeLeafletMap = async () => {
      try {
        // Dynamically import Leaflet only on web - handled in a way that works with TypeScript
        const L = await require('leaflet');
        await require('leaflet/dist/leaflet.css');

        if (!webMapRef.current) {
          // If map container doesn't exist yet, wait for it
          setTimeout(initializeLeafletMap, 100);
          return;
        }

        // Create new map or use existing one
        const map = L.map('web-map-container').setView(
          event.latitude && event.longitude 
            ? [event.latitude, event.longitude] 
            : [mapRegion.latitude, mapRegion.longitude], 
          13
        );

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        // Add a marker at the initial position
        const initialLatLng = event.latitude && event.longitude 
          ? [event.latitude, event.longitude] 
          : [mapRegion.latitude, mapRegion.longitude];
          
        const marker = L.marker(initialLatLng as [number, number], {
          draggable: true
        }).addTo(map);
        
        webMarkerRef.current = marker;

        // Get address on marker drag end
        marker.on('dragend', async function() {
          const position = marker.getLatLng();
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.lat}&lon=${position.lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            if (data && data.display_name) {
              setLocationSearchText(data.display_name);
            }
          } catch (err) {
            console.error('Error getting address:', err);
          }
        });

        // Handle map clicks to move marker
        map.on('click', async function(e: { latlng: { lat: number; lng: number } }) {
          const { lat, lng } = e.latlng;
          marker.setLatLng([lat, lng]);
          
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
            );
            const data = await response.json();
            if (data && data.display_name) {
              setLocationSearchText(data.display_name);
            }
          } catch (err) {
            console.error('Error getting address:', err);
          }
        });

        // Add search control
        const searchControl = document.getElementById('web-map-search');
        if (searchControl) {
          searchControl.addEventListener('keypress', async function(e: KeyboardEvent) {
            if (e.key === 'Enter') {
              e.preventDefault();
              const searchInput = document.getElementById('web-map-search') as HTMLInputElement;
              const searchTerm = searchInput.value.trim();
              
              if (!searchTerm) return;
              
              try {
                const response = await fetch(
                  `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1`
                );
                const results = await response.json();
                
                if (results.length > 0) {
                  const { lat, lon, display_name } = results[0];
                  marker.setLatLng([lat, lon]);
                  map.setView([lat, lon], 16);
                  setLocationSearchText(display_name);
                }
              } catch (err) {
                console.error('Error searching location:', err);
              }
            }
          });
        }

        return () => {
          map.remove();
        };
      } catch (error) {
        console.error('Error initializing Leaflet map:', error);
      }
    };

    initializeLeafletMap();
  }, [mapVisible, Platform.OS, event.latitude, event.longitude]);

  const handleLocationSearch = async () => {
    try {
      if (!locationSearchText.trim()) {
        return;
      }

      if (Platform.OS === 'web' && webMarkerRef.current) {
        // On web, search using Nominatim API directly
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearchText)}&limit=1`
        );
        const results = await response.json();
        
        if (results.length > 0) {
          const { lat, lon, display_name } = results[0];
          webMarkerRef.current.setLatLng([lat, lon]);
          
          if (webMapRef.current) {
            webMapRef.current.setView([lat, lon], 16);
          }
          
          setLocationSearchText(display_name);
        } else {
          setError('Location not found. Please try a different search term.');
        }
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

  const handleMapPress = async (e: any) => {
    // Only run on native platforms
    if (Platform.OS === 'web') return;
    
    const { coordinate } = e.nativeEvent;
    
    try {
      // Update the marker position
      setMapRegion({
        ...mapRegion,
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
      });
      
      // Reverse geocode to get address
      const addressResult = await Location.reverseGeocodeAsync({
        latitude: coordinate.latitude,
        longitude: coordinate.longitude,
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
        
        setLocationSearchText(formattedAddress);
        
        // Don't update event yet, this happens when map selection is confirmed
      }
    } catch (err) {
      console.error('Error getting address:', err);
    }
  };

  const confirmLocationSelection = () => {
    if (Platform.OS === 'web' && webMarkerRef.current) {
      // For web, get coordinates from the Leaflet marker
      const position = webMarkerRef.current.getLatLng();
      
      setEvent(prev => ({
        ...prev,
        location: locationSearchText,
        latitude: position.lat,
        longitude: position.lng,
      }));
    } else {
      // For mobile
      setEvent(prev => ({
        ...prev,
        location: locationSearchText,
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
      }));
    }
    
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

  // Render native map modal
  const renderNativeMapModal = () => {
    if (Platform.OS === 'web' || !MapView) return null;
    
    return (
      <Modal
        animationType="slide"
        transparent={false}
        visible={mapVisible}
        onRequestClose={() => setMapVisible(false)}>
        <View style={styles.modalContainer}>
          <MapView
            ref={mapRef}
            style={styles.fullscreenMap}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={handleMapPress}>
            <Marker
              coordinate={{
                latitude: mapRegion.latitude,
                longitude: mapRegion.longitude,
              }}
              draggable
              onDragEnd={handleMapPress}
            />
          </MapView>
          
          {/* Search Bar with Safe Area */}
          <View style={[styles.searchBarWrapper, { marginTop: insets.top }]}>
            <View style={styles.floatingSearchContainer}>
              <TextInput
                style={[styles.floatingSearchInput, { color: colors.text }]}
                placeholder="Search for a location"
                placeholderTextColor={colors.textSecondary}
                value={locationSearchText}
                onChangeText={setLocationSearchText}
                onSubmitEditing={handleLocationSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.floatingSearchButton}
                onPress={handleLocationSearch}>
                <Ionicons name="search" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Floating Buttons */}
          <View style={styles.floatingButtonsContainer}>
            <TouchableOpacity
              style={[styles.floatingButton, { backgroundColor: colors.error }]}
              onPress={() => setMapVisible(false)}>
              <Text style={styles.floatingButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.floatingButton, { backgroundColor: colors.primary }]}
              onPress={confirmLocationSelection}>
              <Text style={styles.floatingButtonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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

      {/* Render native map modal conditionally */}
      {renderNativeMapModal()}

      {/* Web Map Modal */}
      {Platform.OS === 'web' && (
        <Modal
          animationType="slide"
          transparent={false}
          visible={mapVisible}
          onRequestClose={() => setMapVisible(false)}>
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: colors.background,
          }}>
            <div style={{
              padding: 16,
              backgroundColor: colors.card,
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
              borderBottomStyle: 'solid',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <button 
                  onClick={() => setMapVisible(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 16,
                    padding: 8,
                    color: colors.text
                  }}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </button>
                
                <span style={{ 
                  fontSize: 18, 
                  fontWeight: 600,
                  color: colors.text
                }}>
                  Select Location
                </span>
                
                <button 
                  onClick={confirmLocationSelection}
                  style={{
                    backgroundColor: colors.primary,
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    color: colors.card,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Done
                </button>
              </div>
              
              <div style={{
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.background,
                borderRadius: 8,
                padding: 8,
              }}>
                <input 
                  id="web-map-search"
                  type="text"
                  placeholder="Search for a location"
                  value={locationSearchText}
                  onChange={(e) => setLocationSearchText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLocationSearch()}
                  style={{
                    flex: 1,
                    height: 40,
                    fontSize: 16,
                    paddingLeft: 8,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: colors.text,
                    outline: 'none',
                  }}
                />
                <button 
                  onClick={handleLocationSearch}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 8,
                    cursor: 'pointer',
                    color: colors.primary,
                  }}
                >
                  <Ionicons name="search" size={20} color={colors.primary} />
                </button>
              </div>
            </div>
            
            <div 
              id="web-map-container" 
              ref={webMapRef}
              style={{
                flex: 1,
                width: '100%',
                height: '100%',
              }}
            />
          </div>
        </Modal>
      )}
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