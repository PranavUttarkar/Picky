import React from 'react';
import MapView, { Marker } from 'react-native-maps';
import { StyleSheet } from 'react-native';

interface RestaurantMapProps {
  latitude: number;
  longitude: number;
  restaurantName: string;
  address?: string | null;
  pageUrl?: string | null;
}

export default function RestaurantMap({ latitude, longitude, restaurantName, address }: RestaurantMapProps) {
  return (
    <MapView
      style={styles.map}
      initialRegion={{
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      <Marker
        coordinate={{ latitude, longitude }}
        title={restaurantName}
        description={address || undefined}
      />
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
});
