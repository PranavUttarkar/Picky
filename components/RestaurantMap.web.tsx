import React, { useMemo } from 'react';

interface RestaurantMapProps {
  latitude: number;
  longitude: number;
  restaurantName: string;
  address?: string | null;
  pageUrl?: string | null;
}

// Web-only implementation: use an embedded map instead of fetching a static image
// to avoid DNS issues or blocked static map hosts. This uses OpenStreetMap's
// official embed, which doesn't require API keys.
export default function RestaurantMap({ latitude, longitude }: RestaurantMapProps) {
  const iframeSrc = useMemo(() => {
    
    const lat = Number(latitude).toFixed(6);
    const lon = Number(longitude).toFixed(6);
    // Google Maps embed without API key using q param
    // z=15 for a city-level zoom; output=embed ensures embeddable view
    return `https://www.google.com/maps?q=${lat},${lon}&z=15&output=embed`;
  }, [latitude, longitude]);

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden' }}>
      <iframe
        title="Map"
        src={iframeSrc}
        width="100%"
        height="400"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}
