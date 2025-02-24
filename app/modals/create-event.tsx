import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../lib/auth';
import { useTheme } from '../../lib/theme';
import { createEvent, uploadEventImage } from '../../lib/events';
import * as Location from 'expo-location';

export default function CreateEventScreen() {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [mapVisible, setMapVisible] = useState(Platform.OS === 'web');
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

  const handleLocationSearch = async () => {
    try {
      if (!event.location.trim()) {
        return;
      }

      if (Platform.OS === 'web') {
        // Web uses Leaflet's search functionality
        return;
      }

      const result = await Location.geocodeAsync(event.location);
      if (result.length > 0) {
        setEvent(prev => ({
          ...prev,
          latitude: result[0].latitude,
          longitude: result[0].longitude,
        }));
      } else {
        setError('Location not found. Please try a different search term.');
      }
    } catch (err) {
      console.error('Error searching location:', err);
      setError('Failed to search location. Please try again.');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  const MapComponent = Platform.OS === 'web' ? () => {
    useEffect(() => {
      // Only import Leaflet on web
      const L = require('leaflet');
      require('leaflet/dist/leaflet.css');

      // Initialize map
      const map = L.map('map').setView([0, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
      }).addTo(map);

      // Add search control
      const searchControl = L.Control.extend({
        onAdd: function() {
          const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
          const input = L.DomUtil.create('input', 'location-search', container);
          input.type = 'text';
          input.placeholder = 'Type to search location...';
          input.style.padding = '6px';
          input.style.width = '200px';
          input.style.border = '2px solid rgba(0,0,0,0.2)';
          input.style.borderRadius = '4px';
          input.style.margin = '10px';

          // Prevent map from zooming when scrolling the input
          L.DomEvent.disableClickPropagation(container);
          
          // Handle search
          let marker;
          let searchTimeout: NodeJS.Timeout;

          input.oninput = async (e) => {
            // Clear previous timeout
            if (searchTimeout) {
              clearTimeout(searchTimeout);
            }

            // Debounce search
            searchTimeout = setTimeout(async () => {
              const searchTerm = e.target.value.trim();
              if (!searchTerm) return;

            try {
              const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=1`
              );
              const results = await response.json();
              if (results.length > 0) {
                const { lat, lon, display_name } = results[0];
                if (marker) marker.remove();
                marker = L.marker([lat, lon]).addTo(map);
                map.setView([lat, lon], 16);
                setEvent(prev => ({
                  ...prev,
                  location: display_name,
                  latitude: parseFloat(lat),
                  longitude: parseFloat(lon)
                }));
                setError(null);
              } else {
                setError('Location not found. Please try a different search term.');
              }
            } catch (err) {
              console.error('Error searching location:', err);
              setError('Failed to search location. Please try again.');
            }
            }, 500); // Debounce for 500ms
          };

          return container;
        }
      });

      map.addControl(new searchControl({ position: 'topleft' }));

      // Cleanup
      return () => map.remove();
    }, []);

    return (
      <div id="map" style={{ 
        height: 300, 
        width: '100%',
        marginBottom: 20,
        borderRadius: 8,
        overflow: 'hidden'
      }} />
    );
  } : () => null;

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
    icon: string;
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
            onChange={(event, selectedDate) => {
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
              name="location" 
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
              onBlur={Platform.OS === 'web' ? undefined : handleLocationSearch}
            />
            {Platform.OS !== 'web' && (
              <TouchableOpacity
                onPress={handleLocationSearch}
                style={styles.searchButton}>
                <Ionicons name="search" size={20} color={colors.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {Platform.OS === 'web' && <MapComponent />}

        <DateTimeInput
          value={event.start_time}
          onChange={date => setEvent(prev => ({ ...prev, start_time: date }))}
          mode="date"
          showPicker={showDatePicker}
          setShowPicker={setShowDatePicker}
          label="Date"
          icon="calendar-outline"
        />

        <DateTimeInput
          value={event.start_time}
          onChange={date => setEvent(prev => ({ ...prev, start_time: date }))}
          mode="time"
          showPicker={showTimePicker}
          setShowPicker={setShowTimePicker}
          label="Time"
          icon="time-outline"
        />

        <DateTimeInput
          value={event.end_time}
          onChange={date => setEvent(prev => ({ ...prev, end_time: date }))}
          mode="time"
          showPicker={showTimePicker}
          setShowPicker={setShowTimePicker}
          label="End Time"
          icon="time-outline"
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
    fontSize: 16,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
});