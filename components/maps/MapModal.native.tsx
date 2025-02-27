import React, { useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Region } from 'react-native-maps';
import { MapModalProps } from './MapModal';

export default function MapModal({
  visible,
  onClose,
  onConfirm,
  mapRegion,
  setMapRegion,
  locationSearchText,
  setLocationSearchText,
  handleLocationSearch,
  colors,
  insets
}: MapModalProps) {
  const mapRef = useRef<MapView>(null);

  const handleMapPress = async (e: any) => {
    const { coordinate } = e.nativeEvent;
    
    try {
      // Update the marker position
      if (setMapRegion) {
        setMapRegion({
          ...mapRegion,
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        });
      }
      
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
      }
    } catch (err) {
      console.error('Error getting address:', err);
    }
  };

  const confirmLocation = () => {
    onConfirm(
      locationSearchText, 
      mapRegion.latitude, 
      mapRegion.longitude
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={visible}
      onRequestClose={onClose}>
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
        {insets && (
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
        )}
        
        {/* Floating Buttons */}
        <View style={styles.floatingButtonsContainer}>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.error }]}
            onPress={onClose}>
            <Text style={styles.floatingButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingButton, { backgroundColor: colors.primary }]}
            onPress={confirmLocation}>
            <Text style={styles.floatingButtonText}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
}); 