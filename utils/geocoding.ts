/**
 * Rate-Limited Geocoding Utilities
 * 
 * Provides geocoding functionality with built-in rate limiting
 * to comply with Nominatim's usage policy (max 1 req/sec).
 */

import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { createRateLimiter, RateLimitError } from './rateLimiter';

// ============================================================================
// Types
// ============================================================================

export interface GeocodingResult {
  displayName: string;
  latitude: number;
  longitude: number;
  type?: string;
  importance?: number;
}

export interface ReverseGeocodingResult {
  displayName: string;
  address?: {
    name?: string;
    street?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
  };
}

// ============================================================================
// Rate Limiter for Nominatim API
// ============================================================================

// Nominatim requires max 1 request per second
const nominatimLimiter = createRateLimiter({
  maxRequests: 1,
  windowMs: 1100, // Slightly over 1 second to be safe
  strategy: 'cooldown',
  key: 'nominatim',
  waitOnLimit: true, // Queue requests instead of rejecting
  maxWaitMs: 10000, // Max wait 10 seconds
  errorMessage: 'Geocoding service is busy. Please wait a moment.',
});

// ============================================================================
// Geocoding Functions
// ============================================================================

/**
 * Forward geocode an address to coordinates using Nominatim
 * Rate limited to 1 request per second
 */
export async function geocodeAddress(
  address: string,
  limit: number = 5
): Promise<GeocodingResult[]> {
  if (!address.trim()) return [];

  return nominatimLimiter.execute(async () => {
    const encodedAddress = encodeURIComponent(address.trim());
    
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=${limit}`,
      {
        headers: {
          'User-Agent': 'Picky-Events-App/1.0 (+https://usepicky.app)',
          'Accept-Language': 'en',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();
    
    return data.map((item: any) => ({
      displayName: item.display_name,
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      type: item.type,
      importance: item.importance,
    }));
  });
}

/**
 * Reverse geocode coordinates to an address
 * Uses expo-location on native, falls back to Nominatim
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodingResult> {
  // Try expo-location first on native platforms (doesn't count against Nominatim rate limit)
  if (Platform.OS !== 'web') {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (results.length > 0) {
        const addr = results[0];
        const parts = [
          addr.name,
          addr.street,
          addr.city,
          addr.region,
          addr.country,
        ].filter(Boolean);
        
        return {
          displayName: parts.join(', ') || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          address: {
            name: addr.name ?? undefined,
            street: addr.street ?? undefined,
            city: addr.city ?? undefined,
            region: addr.region ?? undefined,
            country: addr.country ?? undefined,
            postalCode: addr.postalCode ?? undefined,
          },
        };
      }
    } catch {
      // Fall through to Nominatim
    }
  }

  // Fallback to Nominatim (rate limited)
  return nominatimLimiter.execute(async () => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
      {
        headers: {
          'User-Agent': 'Picky-Events-App/1.0 (+https://usepicky.app)',
          'Accept-Language': 'en',
        },
      }
    );

    if (!response.ok) {
      return {
        displayName: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      };
    }

    const data = await response.json();
    
    return {
      displayName: data.display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      address: data.address ? {
        name: data.address.name,
        street: data.address.road,
        city: data.address.city || data.address.town || data.address.village,
        region: data.address.state,
        country: data.address.country,
        postalCode: data.address.postcode,
      } : undefined,
    };
  });
}

/**
 * Get current location with reverse geocoding
 * Returns both coordinates and address
 */
export async function getCurrentLocationWithAddress(): Promise<{
  latitude: number;
  longitude: number;
  address: ReverseGeocodingResult;
} | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = location.coords;
    const address = await reverseGeocode(latitude, longitude);

    return { latitude, longitude, address };
  } catch {
    return null;
  }
}

/**
 * Check if geocoding rate limit is available
 */
export async function canGeocode(): Promise<boolean> {
  const result = await nominatimLimiter.check();
  return result.allowed;
}

/**
 * Get time until next geocoding request is allowed
 */
export async function getGeocodingWaitTime(): Promise<number> {
  const result = await nominatimLimiter.check();
  return result.retryAfterMs ?? 0;
}

// Export error type for handling
export { RateLimitError };

