# Location Picker Feature

## Overview

The Location Picker feature enables users to add precise location information to events with automatic geocoding that converts location names to latitude/longitude coordinates. This feature works seamlessly across Android, iOS, and Web platforms.

## Features

### 🌍 Cross-Platform Support
- **Android**: Native location services with autocomplete
- **iOS**: Native location services with autocomplete  
- **Web**: Browser-based geocoding with autocomplete

### 📍 Location Capabilities
- **Autocomplete Search**: Type a location and get suggestions as you type
- **Current Location**: One-tap button to use device GPS location
- **Geocoding**: Automatically converts addresses to latitude/longitude
- **Reverse Geocoding**: Converts GPS coordinates back to readable addresses
- **Coordinate Display**: Shows exact lat/long for verification

### 🔒 Privacy & Permissions
- Requests location permissions only when needed
- Works without location access (manual entry still available)
- Uses OpenStreetMap's Nominatim API (no tracking, free tier)

## Implementation

### Database Schema

A new migration (`0032_events_lat_long.sql`) adds location coordinate fields:

```sql
alter table events add column if not exists latitude double precision;
alter table events add column if not exists longitude double precision;
create index if not exists idx_events_location on events (latitude, longitude);
```

### Component: LocationPicker

**File**: `components/LocationPicker.tsx`

**Props**:
- `value: string` - Current location text
- `latitude?: number | null` - Current latitude
- `longitude?: number | null` - Current longitude  
- `onLocationChange: (location, lat, lng) => void` - Callback when location changes
- `placeholder?: string` - Placeholder text
- `textColor: string` - Text color for theming
- `backgroundColor: string` - Background color for theming
- `placeholderColor: string` - Placeholder text color

**Features**:
- Debounced search (500ms) to avoid excessive API calls
- Displays up to 5 location suggestions
- GPS button for current location
- Shows coordinates when location is set
- Dismissible suggestions dropdown

### Updated Files

1. **types/models.ts**
   - Added `latitude?: number | null`
   - Added `longitude?: number | null`

2. **services/events.ts**
   - Updated `EventInput` type with lat/long fields
   - Modified `createEvent()` to save coordinates
   - Modified `updateEvent()` to save coordinates

3. **app/(tabs)/events.tsx**
   - Added LocationPicker component
   - Added lat/long state management
   - Replaced TextInput with LocationPicker

4. **app/(tabs)/my-events.tsx**
   - Added LocationPicker component
   - Added lat/long state management
   - Replaced TextInput with LocationPicker

## Usage Example

```tsx
import LocationPicker from '@/components/LocationPicker';

function EventForm() {
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);

  return (
    <LocationPicker
      value={location}
      latitude={latitude}
      longitude={longitude}
      onLocationChange={(loc, lat, lng) => {
        setLocation(loc);
        setLatitude(lat);
        setLongitude(lng);
      }}
      placeholder="Event Location"
      textColor="#000000"
      backgroundColor="#F5F5F5"
      placeholderColor="#888888"
    />
  );
}
```

## API Usage

### Geocoding (Address → Coordinates)

Uses OpenStreetMap Nominatim API:
```
GET https://nominatim.openstreetmap.org/search?format=json&q={address}&limit=5
```

**Response**:
```json
[
  {
    "display_name": "Empire State Building, 350, 5th Avenue, ...",
    "lat": "40.7484405",
    "lon": "-73.9856644"
  }
]
```

### Reverse Geocoding (Coordinates → Address)

Uses Expo Location's built-in reverse geocoding:
```typescript
await Location.reverseGeocodeAsync({
  latitude: 40.7484405,
  longitude: -73.9856644
});
```

## Testing

### Manual Testing Steps

1. **Create New Event**
   - Go to Events tab
   - Click "Add Event"
   - Click location picker
   - Type a location (e.g., "Central Park")
   - Select from suggestions
   - Verify coordinates appear below input

2. **Use Current Location**
   - Click location icon button
   - Grant location permission if prompted
   - Verify address populates from GPS
   - Verify coordinates are shown

3. **Edit Event**
   - Edit existing event
   - Verify location and coordinates load
   - Change location
   - Verify coordinates update

4. **Cross-Platform**
   - Test on iOS simulator/device
   - Test on Android emulator/device
   - Test on web browser

## Migration Instructions

### Database Migration

Run the migration to add lat/long columns:

```bash
# If using Supabase CLI
supabase db push

# Or manually execute:
# supabase/migrations/0032_events_lat_long.sql
```

### Existing Data

Existing events without coordinates will have `null` values for latitude/longitude. The location text field is preserved and still searchable.

## Performance Considerations

1. **Debouncing**: 500ms delay prevents excessive API calls while typing
2. **Caching**: Consider implementing client-side cache for repeated searches
3. **Rate Limiting**: Nominatim API has usage limits - respect their fair use policy
4. **Offline**: Component gracefully handles network failures

## Future Enhancements

- [ ] Map view for location selection
- [ ] Nearby events based on coordinates
- [ ] Distance filtering in event search
- [ ] Location-based event recommendations
- [ ] Cache geocoding results
- [ ] Support for custom map markers
- [ ] Integration with native map apps for directions

## Troubleshooting

### Location Permission Issues
- Ensure `expo-location` is properly installed
- Check app.json/app.config.ts for location permissions
- iOS: NSLocationWhenInUseUsageDescription in Info.plist
- Android: ACCESS_FINE_LOCATION in AndroidManifest.xml

### Geocoding Errors
- Check network connectivity
- Verify Nominatim API is accessible
- Check rate limiting (max 1 request/second recommended)
- Ensure User-Agent header is set (required by Nominatim)

### Web-Specific Issues
- Browser geolocation requires HTTPS in production
- Some browsers may block location API on localhost

## Dependencies

- `expo-location`: ^19.0.7 - Location services and geocoding
- `@expo/vector-icons`: Icons for UI
- OpenStreetMap Nominatim API (free, no key required)

## License & Attribution

This feature uses OpenStreetMap's Nominatim geocoding service. When displaying map data or using their APIs, please include appropriate attribution per OSM's license requirements.
