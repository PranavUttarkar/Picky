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
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

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

      {latitude && longitude && (
        <Text style={[styles.coordText, { color: placeholderColor }]}>
          📍 {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </Text>
      )}

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
});
