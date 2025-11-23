import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

// Type definition for Region
type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

// Lazy load react-native-maps only when needed and only on native platforms
// This prevents web bundlers from trying to resolve the module
const getMapComponents = () => {
  if (Platform.OS === 'web') {
    return { MapView: null, Marker: null };
  }
  try {
    // Use dynamic require to prevent static analysis on web
    const moduleName = 'react-native-maps';
    // @ts-ignore - Dynamic require for platform-specific module
    const Maps = require(moduleName);
    return {
      MapView: Maps.default || Maps,
      Marker: Maps.Marker,
    };
  } catch (e) {
    return { MapView: null, Marker: null };
  }
};

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
 * Cross-platform location picker with autocomplete and geocoding
 * Works on Android, iOS, and Web
 * Converts user input to latitude/longitude coordinates
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
  const [showMap, setShowMap] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [markerCoordinate, setMarkerCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Initialize map region and marker from props
  useEffect(() => {
    if (latitude != null && longitude != null) {
      const region: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(region);
      setMarkerCoordinate({ latitude, longitude });
    } else if (!mapRegion) {
      // Default to a central location if no coordinates provided
      const defaultRegion: Region = {
        latitude: 37.7749, // San Francisco default
        longitude: -122.4194,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      setMapRegion(defaultRegion);
    }
  }, [latitude, longitude]);

  // Request location permissions on mount
  useEffect(() => {
    (async () => {
      if (Platform.OS !== 'web') {
        await Location.requestForegroundPermissionsAsync();
      }
    })();
  }, []);

  const geocodeAddress = async (address: string): Promise<LocationResult[]> => {
    try {
      // Use Nominatim (OpenStreetMap) geocoding API - free and works on all platforms
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
      if (Platform.OS !== 'web') {
        // Use expo-location for native platforms
        const reverseResults = await Location.reverseGeocodeAsync({
          latitude: lat,
          longitude: lng,
        });

        if (reverseResults.length > 0) {
          const address = reverseResults[0];
          return [
            address.name,
            address.street,
            address.city,
            address.region,
            address.country,
          ]
            .filter(Boolean)
            .join(', ');
        }
      }

      // Fallback to Nominatim for web or if expo-location fails
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

  const handleMapPress = async (event: any) => {
    // On web, react-native-maps may not support onPress the same way
    // We'll handle web in the web-specific component
    if (Platform.OS !== 'web' && event.nativeEvent?.coordinate) {
      const { latitude, longitude } = event.nativeEvent.coordinate;
      await updateLocationFromCoordinates(latitude, longitude);
    }
  };

  const handleMarkerDragEnd = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    await updateLocationFromCoordinates(latitude, longitude);
  };

  const updateLocationFromCoordinates = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const address = await reverseGeocode(lat, lng);
      setInputValue(address);
      setMarkerCoordinate({ latitude: lat, longitude: lng });
      
      // Update map region to center on new location
      const newRegion: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(newRegion);
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 300);
      }
      
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

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // If input is empty, clear suggestions
    if (!text.trim()) {
      setSuggestions([]);
      onLocationChange('', null, null);
      return;
    }

    // Debounce geocoding requests
    debounceTimer.current = setTimeout(async () => {
      setIsLoading(true);
      const results = await geocodeAddress(text);
      setSuggestions(results);
      setIsLoading(false);
    }, 500);
  };

  const selectSuggestion = (result: LocationResult) => {
    setInputValue(result.displayName);
    onLocationChange(result.displayName, result.latitude, result.longitude);
    setSuggestions([]);
    setShowSuggestions(false);
    
    // Update map to show selected location
    const newRegion: Region = {
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setMapRegion(newRegion);
    setMarkerCoordinate({ latitude: result.latitude, longitude: result.longitude });
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 300);
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

      // Reverse geocode to get address
      const reverseResults = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (reverseResults.length > 0) {
        const address = reverseResults[0];
        const displayName = [
          address.name,
          address.street,
          address.city,
          address.region,
          address.country,
        ]
          .filter(Boolean)
          .join(', ');

        setInputValue(displayName);
        onLocationChange(displayName, lat, lng);
      } else {
        // Fallback if reverse geocoding fails
        const displayName = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
        setInputValue(displayName);
        onLocationChange(displayName, lat, lng);
      }

      // Update map to show current location
      const newRegion: Region = {
        latitude: lat,
        longitude: lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
      setMapRegion(newRegion);
      setMarkerCoordinate({ latitude: lat, longitude: lng });
      if (mapRef.current) {
        mapRef.current.animateToRegion(newRegion, 300);
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
        <Pressable
          onPress={() => setShowMap(!showMap)}
          style={[
            styles.mapToggleButton,
            {
              backgroundColor: backgroundColor,
            },
          ]}
        >
          <Ionicons name={showMap ? "map-outline" : "map"} size={20} color={textColor} />
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

      {showMap && mapRegion && Platform.OS !== 'web' && (() => {
        const { MapView: MapViewComponent, Marker: MarkerComponent } = getMapComponents();
        if (!MapViewComponent || !MarkerComponent) {
          return null;
        }
        
        return (
          <View style={styles.mapContainer}>
            <MapViewComponent
              ref={mapRef}
              style={styles.map}
              region={mapRegion}
              onPress={handleMapPress}
              onRegionChangeComplete={setMapRegion}
            >
              {markerCoordinate && (
                <MarkerComponent
                  coordinate={markerCoordinate}
                  draggable={true}
                  onDragEnd={handleMarkerDragEnd}
                />
              )}
            </MapViewComponent>
          </View>
        );
      })()}
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
  coordText: {
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
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
  map: {
    width: '100%',
    height: 180,
  },
  mapOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  mapHint: {
    fontSize: 12,
    fontWeight: '500',
  },
});
