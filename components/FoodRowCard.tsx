import React, { memo, useState } from 'react';
import { View, Text, Pressable, Platform, Linking, Share, Image } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import LazyImage from '@/components/LazyImage';
import { ThreeDCard, ThreeDButton } from '@/components/ThreeD';
import type { Restaurant } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '@/theme/designTokens';
import { getRestaurantStatus } from '@/utils/restaurantHours';

export interface FoodRowCardProps {
  item: Restaurant;
  matchPercent?: number;
  distanceMiles?: number;
  onOpenDetails?: () => void;
  onSelect?: () => void; // for building a poll selection list
  selected?: boolean;
  isSaved?: boolean;
  onToggleSave?: (restaurantId: string) => void;
}

const FoodRowCard: React.FC<FoodRowCardProps> = memo(
  ({ item, matchPercent, distanceMiles, onOpenDetails, onSelect, selected, isSaved = false, onToggleSave }) => {
    const c = useThemeColors();
    const imgs: string[] = [item.main_image, item.image_1, item.image_2, item.image_3].filter(
      Boolean,
    ) as string[];
    const [imgIdx, setImgIdx] = useState(0);
    const thumb = imgs[imgIdx];
    const score = typeof matchPercent === 'number' ? matchPercent : (item as any).match_percent;
    const showScore = Number.isFinite(score);
    const { isOpen, status } = getRestaurantStatus(item);

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
                    <Text style={{ 
                      color: '#ffffffcc', 
                      fontSize: Typography.scale.caption.fontSize,
                      fontFamily: Typography.fontFamily.bodySemibold,
                      fontWeight: Typography.fontWeight.semibold,
                    }}>
                      No Image
                    </Text>
                  </View>
                </View>
              )}
            </View>
            <View style={{ flex: 1, minHeight: 96 }}>
              <Text style={{ 
                color: c.text, 
                fontWeight: Typography.fontWeight.bold,
                fontSize: 13,
                fontFamily: Typography.fontFamily.bodyBold,
              }} numberOfLines={1}>
                {item.restaurant_name}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, flexWrap: 'wrap' }}>
                <Text style={{ 
                  color: c.muted,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.body,
                }} numberOfLines={1}>
                  {[item.category, item.price_range].filter(Boolean).join(' • ')}
                </Text>
                <Text style={{ 
                  color: isOpen ? '#10b981' : '#ef4444', 
                  fontWeight: Typography.fontWeight.semibold,
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.bodySemibold,
                }}>
                  {status}
                </Text>
                {item.review_points ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="star" size={12} color="#fbbf24" />
                    <Text style={{ 
                      color: '#fbbf24', 
                      fontWeight: Typography.fontWeight.semibold,
                      fontSize: Typography.scale.bodySmall.fontSize,
                      fontFamily: Typography.fontFamily.bodySemibold,
                    }}>
                      {item.review_points}
                    </Text>
                  </View>
                ) : null}
                {typeof distanceMiles === 'number' && Number.isFinite(distanceMiles) ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="location" size={12} color={c.muted} />
                    <Text style={{ 
                      color: c.muted, 
                      fontSize: Typography.scale.bodySmall.fontSize,
                      fontFamily: Typography.fontFamily.bodySemibold,
                      fontWeight: Typography.fontWeight.semibold,
                    }}>
                      {distanceMiles < 0.1
                        ? '<0.1 mi'
                        : `${distanceMiles.toFixed(distanceMiles < 10 ? 1 : 0)} mi`}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={{ 
                color: c.muted, 
                fontSize: Typography.scale.bodySmall.fontSize,
                fontFamily: Typography.fontFamily.body,
                marginTop: 2,
              }} numberOfLines={1}>
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
                      style={{ padding: 4,  }}
                    >
                      <Text style={{ color: c.text, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>Website</Text>
                      {/* <Ionicons name="globe-outline" size={18} color={c.primary} /> */}
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
                  {onToggleSave ? (
                    <Pressable
                      onPress={(e?: any) => {
                        e?.stopPropagation?.();
                        onToggleSave?.(item.id);
                      }}
                      accessibilityLabel={isSaved ? 'Unsave restaurant' : 'Save restaurant'}
                      style={{ padding: 4 }}
                    >
                      <Ionicons
                        name={isSaved ? 'heart' : 'heart-outline'}
                        size={18}
                        color={isSaved ? c.primary : c.text}
                      />
                    </Pressable>
                  ) : null}
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
                        Poll
                        {/* <Ionicons name="stats-chart" size={16} color="#001219" /> */}
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
