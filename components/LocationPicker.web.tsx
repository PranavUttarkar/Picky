import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

// Import Leaflet CSS
if (typeof document !== 'undefined') {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
  link.crossOrigin = '';
  if (!document.head.querySelector('link[href*="leaflet"]')) {
    document.head.appendChild(link);
  }
}

interface LocationResult {
  displayName: string;
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  value: string;
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (location: string, lat: number | null, lng: number | null) => void;
  placeholder?: string;
  textColor: string;
  backgroundColor: string;
  placeholderColor: string;
}

/**
 * Web-specific location picker with interactive Leaflet map
 * Allows users to click on map to drop a pin, pan, and zoom
 */
export default function LocationPicker({
  value,
  latitude,
  longitude,
  onLocationChange,
  placeholder = 'Location',
  textColor,
  backgroundColor,
  placeholderColor,
}: LocationPickerProps) {
  const [inputValue, setInputValue] = useState(value);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Initialize and cleanup Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Get initial location - try user's current location first, then fallback
    const getInitialLocation = async (): Promise<[number, number]> => {
      // If props already have coordinates, use those
      if (latitude != null && longitude != null) {
        return [latitude, longitude];
      }

      // Try to get user's current location
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          return [location.coords.latitude, location.coords.longitude];
        }
      } catch (error) {
        console.log('Could not get current location, using fallback');
      }

      // Fallback to default coordinates
      return [30.615529, -96.335246];
    };

    // Dynamically import Leaflet only when map is shown
    getInitialLocation().then(async (initialCenter) => {
      const L = await import('leaflet');
      
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      // Fix Leaflet icon paths (common issue with bundlers)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Determine initial center and zoom
      let center: [number, number] = initialCenter;
      let zoom = 15; // Zoomed in view

      // If props have coordinates, use those instead
      if (latitude != null && longitude != null) {
        center = [latitude, longitude];
        zoom = 15;
      }

        // Initialize map
        const map = L.map(mapContainerRef.current, {
          center,
          zoom,
          zoomControl: true,
          scrollWheelZoom: true,
        });

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

      mapInstanceRef.current = map;

      // Add marker if coordinates exist
      if (latitude != null && longitude != null) {
        const marker = L.marker([latitude, longitude], {
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;

        // Handle marker drag end
        marker.on('dragend', async (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          await updateLocationFromCoordinates(lat, lng);
        });
      }

      // Handle map click to add/move marker
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;
        
        // Remove existing marker if any
        if (markerRef.current) {
          map.removeLayer(markerRef.current);
        }

        // Add new marker at clicked location
        const marker = L.marker([lat, lng], {
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;

        // Handle marker drag end
        marker.on('dragend', async (dragEvent: any) => {
          const { lat: dragLat, lng: dragLng } = dragEvent.target.getLatLng();
          await updateLocationFromCoordinates(dragLat, dragLng);
        });

        // Update location
        await updateLocationFromCoordinates(lat, lng);
      });

      // Fit map to show marker if it exists
      if (markerRef.current) {
        map.fitBounds([markerRef.current.getLatLng()], { padding: [20, 20] });
      }
    });

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Update map when latitude/longitude change from props
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    import('leaflet').then((L) => {
      if (latitude != null && longitude != null) {
        const map = mapInstanceRef.current;
        
        // Remove existing marker
        if (markerRef.current) {
          map.removeLayer(markerRef.current);
        }

        // Add new marker
        const marker = L.marker([latitude, longitude], {
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;

        // Center map on marker
        map.setView([latitude, longitude], 15);

        // Handle marker drag end
        marker.on('dragend', async (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          await updateLocationFromCoordinates(lat, lng);
        });
      }
    });
  }, [latitude, longitude]);

  const geocodeAddress = async (address: string): Promise<LocationResult[]> => {
    try {
      const encodedAddress = encodeURIComponent(address);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=5`,
        {
          headers: {
            'User-Agent': 'Picky-Events-App',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding failed');
      }

      const data = await response.json();
      return data.map((item: any) => ({
        displayName: item.display_name,
        latitude: parseFloat(item.lat),
        longitude: parseFloat(item.lon),
      }));
    } catch (error) {
      console.error('Geocoding error:', error);
      return [];
    }
  };

  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'User-Agent': 'Picky-Events-App',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  const updateLocationFromCoordinates = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const address = await reverseGeocode(lat, lng);
      setInputValue(address);
      onLocationChange(address, lat, lng);
    } catch (error) {
      console.error('Error updating location from coordinates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    setShowSuggestions(true);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (!text.trim()) {
      setSuggestions([]);
      onLocationChange('', null, null);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      const results = await geocodeAddress(text);
      setSuggestions(results);
      setIsLoading(false);
    }, 500);
  };

  const selectSuggestion = async (result: LocationResult) => {
    setInputValue(result.displayName);
    onLocationChange(result.displayName, result.latitude, result.longitude);
    setSuggestions([]);
    setShowSuggestions(false);

    // Update map
    if (mapInstanceRef.current) {
      import('leaflet').then((L) => {
        const map = mapInstanceRef.current;
        
        // Remove existing marker
        if (markerRef.current) {
          map.removeLayer(markerRef.current);
        }

        // Add new marker at selected location
        const marker = L.marker([result.latitude, result.longitude], {
          draggable: true,
        }).addTo(map);

        markerRef.current = marker;

        // Center map on marker
        map.setView([result.latitude, result.longitude], 15);

        // Handle marker drag end
        marker.on('dragend', async (e: any) => {
          const { lat, lng } = e.target.getLatLng();
          await updateLocationFromCoordinates(lat, lng);
        });
      });
    }
  };

  const getCurrentLocation = async () => {
    try {
      setIsLoading(true);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Permission to access location was denied');
        setIsLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude: lat, longitude: lng } = location.coords;

      const reverseResults = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      let displayName: string;
      if (reverseResults.length > 0) {
        const address = reverseResults[0];
        displayName = [
          address.name,
          address.street,
          address.city,
          address.region,
          address.country,
        ]
          .filter(Boolean)
          .join(', ');
      } else {
        displayName = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      setInputValue(displayName);
      onLocationChange(displayName, lat, lng);

      // Update map
      if (mapInstanceRef.current) {
        import('leaflet').then((L) => {
          const map = mapInstanceRef.current;
          
          // Remove existing marker
          if (markerRef.current) {
            map.removeLayer(markerRef.current);
          }

          // Add new marker at current location
          const marker = L.marker([lat, lng], {
            draggable: true,
          }).addTo(map);

          markerRef.current = marker;

          // Center map on current location
          map.setView([lat, lng], 15);

          // Handle marker drag end
          marker.on('dragend', async (e: any) => {
            const { lat: dragLat, lng: dragLng } = e.target.getLatLng();
            await updateLocationFromCoordinates(dragLat, dragLng);
          });
        });
      }

      setSuggestions([]);
      setShowSuggestions(false);
      setIsLoading(false);
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Location error', 'Could not get current location');
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          value={inputValue}
          onChangeText={handleInputChange}
          onFocus={() => setShowSuggestions(true)}
          style={[
            styles.input,
            {
              color: textColor,
              backgroundColor: backgroundColor,
            },
          ]}
        />
        <Pressable
          onPress={getCurrentLocation}
          disabled={isLoading}
          style={[
            styles.locationButton,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={textColor} />
          ) : (
            <Ionicons name="location" size={20} color={textColor} />
          )}
        </Pressable>
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View
          style={[
            styles.suggestionsContainer,
            {
              backgroundColor: backgroundColor,
              borderColor: placeholderColor,
            },
          ]}
        >
          <ScrollView
            style={styles.suggestionsList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((result, index) => (
              <Pressable
                key={index}
                onPress={() => selectSuggestion(result)}
                style={styles.suggestionItem}
              >
                <Ionicons
                  name="location-outline"
                  size={16}
                  color={textColor}
                  style={styles.suggestionIcon}
                />
                <Text
                  style={[styles.suggestionText, { color: textColor }]}
                  numberOfLines={2}
                >
                  {result.displayName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.mapContainer}>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: '180px',
              borderRadius: '8px',
              overflow: 'hidden',
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '8px',
              left: '8px',
              right: '8px',
              backgroundColor: "rgba(225, 233, 225, 0.68)",
              padding: '8px',
              borderRadius: '6px',
              textAlign: 'center',
              pointerEvents: 'none',
              zIndex: 1000,
            }}
          >
            <span style={{ color: "rgba(7, 7, 7, 0.6)", fontSize: '12px', fontWeight: '500' }}>
              Click on the map to set location • Drag marker to move
            </span>
          </div>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
  },
  locationButton: {
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  mapToggleButton: {
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
  },
  suggestionsContainer: {
    marginTop: 4,
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000010',
  },
  suggestionIcon: {
    marginRight: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
  },
  mapContainer: {
    marginTop: 8,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00000020',
    position: 'relative',
  },
});
