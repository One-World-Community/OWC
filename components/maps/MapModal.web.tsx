import React, { useEffect, useRef } from 'react';
import { Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../lib/theme';
import { MapModalProps } from './MapModal';

// Define types for Leaflet since we're using require instead of import
type LeafletMap = any;
type LeafletMarker = any;

// Leaflet's CSS is now included in index.html

export default function MapModal({
  isVisible,
  onClose,
  onConfirm,
  mapRegion,
  locationSearchText,
  setLocationSearchText,
  colors,
  initialCoordinates,
}: MapModalProps) {
  const webMapRef = useRef<HTMLDivElement | null>(null);
  const webMarkerRef = useRef<LeafletMarker>(null);
  const mapInstanceRef = useRef<LeafletMap>(null);
  const leafletRef = useRef<any>(null);

  // Set up the Leaflet map when the modal becomes visible
  useEffect(() => {
    if (isVisible && Platform.OS === 'web' && webMapRef.current) {
      setTimeout(() => {
        if (!leafletRef.current) {
          leafletRef.current = require('leaflet');
          // require('leaflet/dist/leaflet.css');
        }
        
        const L = leafletRef.current;
        
        if (!mapInstanceRef.current) {
          const map = L.map(webMapRef.current).setView([51.505, -0.09], 13);
          
          mapInstanceRef.current = map;

          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
          }).addTo(map);

          // Add a marker at the initial position
          const marker = L.marker([51.505, -0.09], {
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

          // Set up search control event handling
          const setupSearchControl = () => {
            const searchControl = document.getElementById('web-map-search');
            if (searchControl) {
              searchControl.addEventListener('keypress', handleSearchKeyPress);
            } else {
              // Try again if the search control isn't available yet
              setTimeout(setupSearchControl, 100);
            }
          };

          setupSearchControl();

          return () => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.remove();
              mapInstanceRef.current = null;
            }
          };
        }
      }, 100);
    }
  }, [isVisible, initialCoordinates, mapRegion.latitude, mapRegion.longitude]);

  const handleSearchKeyPress = async (e: KeyboardEvent) => {
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
        
        if (results.length > 0 && webMarkerRef.current && mapInstanceRef.current) {
          const { lat, lon, display_name } = results[0];
          webMarkerRef.current.setLatLng([lat, lon]);
          mapInstanceRef.current.setView([lat, lon], 16);
          setLocationSearchText(display_name);
        }
      } catch (err) {
        console.error('Error searching location:', err);
      }
    }
  };

  const handleSearch = async () => {
    if (!locationSearchText.trim()) return;
    
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationSearchText)}&limit=1`
      );
      const results = await response.json();
      
      if (results.length > 0 && webMarkerRef.current && mapInstanceRef.current) {
        const { lat, lon, display_name } = results[0];
        webMarkerRef.current.setLatLng([lat, lon]);
        mapInstanceRef.current.setView([lat, lon], 16);
        setLocationSearchText(display_name);
      }
    } catch (err) {
      console.error('Error searching location:', err);
    }
  };

  const handleConfirm = () => {
    if (!webMarkerRef.current) return;
    
    const position = webMarkerRef.current.getLatLng();
    onConfirm(
      locationSearchText,
      position.lat,
      position.lng
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={false}
      visible={isVisible}
      onRequestClose={onClose}>
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
              onClick={onClose}
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
              onClick={handleConfirm}
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
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
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
              onClick={handleSearch}
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
  );
} 