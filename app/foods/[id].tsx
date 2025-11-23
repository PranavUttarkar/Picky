import { View, Text, ScrollView, Pressable, Linking, Alert, Image, Platform } from 'react-native';
import { useLocalSearchParams, router, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { useThemeColors } from '@/theme/ThemeProvider';
import GradientBackground from '@/components/GradientBackground';
import GradientHeader from '@/components/GradientHeader';
import ImageGallery from '@/components/ImageGallery';
import { getRestaurantById, restaurantImages } from '@/services/food';
import Chip from '@/components/Chip';
import { Ionicons } from '@expo/vector-icons';
import RestaurantMap from '@/components/RestaurantMap';
import { getRestaurantStatus } from '@/utils/restaurantHours';

export default function FoodDetails() {
  const c = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const nav = useNavigation<any>();
  const [item, setItem] = useState<any | null>(null);
  const [faviconOk, setFaviconOk] = useState(true);
  const goBack = () => {
    try {
      if (nav?.canGoBack?.()) {
        nav.goBack();
      } else {
        router.replace('/(tabs)/food');
      }
    } catch {
      router.replace('/(tabs)/food');
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = id ? await getRestaurantById(String(id)) : undefined;
        setItem(r || null);
      } catch {
        setItem(null);
      }
    })();
  }, [id]);

  if (!item) {
    return (
      <GradientBackground variant="dim">
        <View style={{ flex: 1, padding: 16 }}>
          <GradientHeader title="Food" onBack={goBack} />
          <Text style={{ color: c.muted, marginTop: 12 }}>Restaurant not found.</Text>
        </View>
      </GradientBackground>
    );
  }

  const images = restaurantImages(item);
  const { isOpen, status } = getRestaurantStatus(item);
  const metaParts: React.ReactNode[] = [
    item.category,
    item.price_range,
    item.review_points != null
      ? (
        <Text key="rp" style={{ color: '#fce354ff' }}>
          {String(item.review_points)} ★
        </Text>
      )
      : null,
  ]
    .filter(Boolean)
    .map((v) => (typeof v === 'string' ? String(v).replace(/\b\w/g, (c) => c.toUpperCase()) : v));

  const meta = metaParts.reduce<React.ReactNode[]>((acc, part, i) => (i === 0 ? [part] : [...acc, ' • ', part]), []);
  const faviconUrl = item.website
    ? `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(item.website)}`
    : null;

  const lat = item.latitude != null ? Number(item.latitude) : null;
  const lon = item.longitude != null ? Number(item.longitude) : null;
  const hasCoords = lat != null && lon != null && isFinite(lat) && isFinite(lon);

  return (
    <GradientBackground variant="dim">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={{ padding: 16 }}>
          <GradientHeader title={item.restaurant_name} onBack={goBack} />
          {images.length ? (
            <View style={{ marginTop: 12 }}>
              <ImageGallery images={images} height={260} showArrows showDots />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
            <Ionicons name="location-sharp" size={16} color={c.muted} />
            <Text style={{ color: c.muted, marginLeft: 0 }}>{meta}</Text>
            <Text style={{ 
              color: isOpen ? '#10b981' : '#ef4444', 
              fontWeight: '700',
              fontSize: 14,
            }}>
              {status}
            </Text>
          </View>
          {item.address ? (
            <Text style={{ color: c.muted, marginTop: 4 }}>
              {item.address}
              {item.city ? `, ${item.city}` : ''}
            </Text>
          ) : null}

          {/* Description */}
          {item.description ? (
            <View style={{ backgroundColor: c.card, padding: 12, borderRadius: 12, marginTop: 12 }}>
              <Text style={{ color: c.text, fontWeight: '800', marginBottom: 6 }}>About Us</Text>
              <Text style={{ color: c.text }}>{item.description}</Text>
            </View>
          ) : null}

          {/* Tags (chips) derived from fields */}
          <View style={{ marginTop: 12 }}>
            <Text style={{ color: c.muted, marginBottom: 6 }}>Tags</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {[item.category, item.price_range, item.delivery, item.city, item.state]
                .filter((v) => !!v && String(v).trim().length > 0)
                .map((t, i) => (
                  <Chip key={`${t}-${i}`} label={String(t)} />
                ))}
            </View>
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
            {item.website ? (
              <Pressable
              onPress={() => item.website && Linking.openURL(item.website)}
              accessibilityLabel="Open website"
              style={{
                backgroundColor: c.card,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
              }}
              >
                                    <Text style={{ color: c.primary, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>Website</Text>

              {/* <Ionicons name="globe" size={18} color={c.primary} /> */}
              </Pressable>
            ) : null}
            {item.page_url ? (
              <Pressable
              onPress={() => item.page_url && Linking.openURL(item.page_url)}
              style={{
                backgroundColor: c.card,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
              }}
              >
                <Text style={{ color: c.text, fontWeight: '800' }}>Reviews & Directions</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                try {
                  const text = `${item.restaurant_name}${item.address ? ` • ${item.address}` : ''}`;
                  router.push({
                    pathname: '/polls/new',
                    params: { texts: JSON.stringify([text]) },
                  });
                } catch (e: any) {
                  Alert.alert('Could not start poll', e?.message ?? String(e));
                }
              }}
              style={{
                backgroundColor: c.primary,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: '#000', fontWeight: '800' }}>Poll this</Text>
            </Pressable>
          </View>

          {/* Opening hours / popular times (raw) */}
          <View style={{ backgroundColor: c.card, marginTop: 16, padding: 12, borderRadius: 12 }}>
            <Text style={{ color: c.text, fontWeight: '800' }}>Hours</Text>
            {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(
              (d) => {
                const key = `open_time_${d}` as const;
                const val = (item as any)[key];
                return val ? (
                  <Text key={d} style={{ color: c.muted, marginTop: 4 }}>
                    {val}
                  </Text>
                ) : null;
              },
            )}
          </View>

          {/* Map Section */}
          {hasCoords && (
            <View style={{ marginTop: 16 }}>
              <Text style={{ color: c.text, fontWeight: '800', marginBottom: 8 }}>Location</Text>
              <RestaurantMap
                latitude={lat!}
                longitude={lon!}
                restaurantName={item.restaurant_name}
                address={item.address}
                pageUrl={item.page_url}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </GradientBackground>
  );
}
