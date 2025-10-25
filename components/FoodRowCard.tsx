import React, { memo, useState } from 'react';
import { View, Text, Pressable, Platform, Linking, Share, Image } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import LazyImage from '@/components/LazyImage';
import { ThreeDCard, ThreeDButton } from '@/components/ThreeD';
import type { Restaurant } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';

export interface FoodRowCardProps {
  item: Restaurant;
  matchPercent?: number;
  onOpenDetails?: () => void;
  onSelect?: () => void; // for building a poll selection list
  selected?: boolean;
}

const FoodRowCard: React.FC<FoodRowCardProps> = memo(
  ({ item, matchPercent, onOpenDetails, onSelect, selected }) => {
    const c = useThemeColors();
    const imgs: string[] = [item.main_image, item.image_1, item.image_2, item.image_3].filter(
      Boolean,
    ) as string[];
    const [imgIdx, setImgIdx] = useState(0);
    const thumb = imgs[imgIdx];
    const score = typeof matchPercent === 'number' ? matchPercent : (item as any).match_percent;
    const showScore = Number.isFinite(score);

    return (
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${item.restaurant_name}`}
        style={Platform.select({ web: { cursor: 'pointer' }, default: undefined }) as any}
      >
        <ThreeDCard>
          <View style={{ flexDirection: 'row', padding: 10, gap: 12 }}>
            <View style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden' }}>
              {thumb ? (
                <LazyImage
                  key={thumb}
                  uri={thumb}
                  width={'100%'}
                  height={'100%'}
                  borderRadius={12}
                  onError={() => setImgIdx((i) => (i + 1 < imgs.length ? i + 1 : imgs.length))}
                />
              ) : (
                <View style={{ flex: 1 }}>
                  <Image
                    source={require('../assets/NoImageRestaurant.jpg')}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                  />
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#ffffffcc', fontSize: 11, fontWeight: '700' }}>
                      No Image
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View style={{ flex: 1, minHeight: 96 }}>
              <Text style={{ color: c.text, fontWeight: '800' }} numberOfLines={1}>
                {item.restaurant_name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <Text style={{ color: c.muted }} numberOfLines={1}>
                  {[item.category, item.price_range].filter(Boolean).join(' • ')}
                </Text>
                {item.review_points ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Text style={{ color: '#fbbf24', fontWeight: '700', fontSize: 12 }}>
                      {item.review_points}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ color: c.muted, marginTop: 2 }} numberOfLines={1}>
                {item.address}
                {item.city ? `, ${item.city}` : ''}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                {showScore ? (
                  <View
                    style={{
                      backgroundColor: c.card,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                    }}
                  >
                    <Text style={{ color: c.text, fontSize: 11, fontWeight: '800' }}>
                      {score}% Match
                    </Text>
                  </View>
                ) : (
                  <View />
                )}
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  {item.website ? (
                    <Pressable
                      onPress={() => item.website && Linking.openURL(item.website)}
                      accessibilityLabel="Open website"
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="globe-outline" size={18} color={c.primary} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={async () => {
                      const url = item.website || item.page_url || '';
                      try {
                        await Share.share({ message: url || item.restaurant_name, url });
                      } catch {}
                    }}
                    accessibilityLabel="Share restaurant"
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={c.text} />
                  </Pressable>
                  {onSelect ? (
                    selected ? (
                      <ThreeDButton
                        title={'Unselect'}
                        onPress={(e?: any) => {
                          e?.stopPropagation?.();
                          onSelect?.();
                        }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                        textStyle={{ fontSize: 12 }}
                      />
                    ) : (
                      <ThreeDButton
                        title="Select"
                        onPress={(e?: any) => {
                          e?.stopPropagation?.();
                          onSelect?.();
                        }}
                        style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      >
                        <Ionicons name="stats-chart" size={16} color="#001219" />
                      </ThreeDButton>
                    )
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </ThreeDCard>
      </Pressable>
    );
  },
);

export default FoodRowCard;
