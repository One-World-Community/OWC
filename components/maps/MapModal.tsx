import React from 'react';
import { View, Text } from 'react-native';
import { EdgeInsets } from 'react-native-safe-area-context';

// Common interface for both native and web implementations
export interface MapModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: string, latitude: number, longitude: number) => void;
  mapRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  locationSearchText: string;
  setLocationSearchText: (text: string) => void;
  colors: {
    background: string;
    text: string;
    textSecondary: string;
    primary: string;
    error: string;
    card: string;
    border: string;
  };
  // Platform-specific props with optional flags
  handleLocationSearch?: () => void; // Only needed on native
  setMapRegion?: (region: any) => void; // Only needed on native
  insets?: EdgeInsets; // Only needed on native
  initialCoordinates?: { // Only used on web
    latitude: number;
    longitude: number;
  };
}

// Base component - this should never actually be used
// as the bundler will select the platform-specific version
export default function MapModal(props: MapModalProps) {
  return (
    <View>
      <Text>
        If you see this, something went wrong with platform-specific component loading.
      </Text>
    </View>
  );
} 