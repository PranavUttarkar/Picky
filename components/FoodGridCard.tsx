import React, { memo, useState } from 'react';
import { View, Text, Pressable, Platform, Linking, Image } from 'react-native';
import { ThreeDCard, ThreeDButton } from '@/components/ThreeD';
import ImageGallery from '@/components/ImageGallery';
import { useThemeColors } from '@/theme/ThemeProvider';
import type { Restaurant } from '@/types/models';
import { Ionicons } from '@expo/vector-icons';
import FriendActivityIndicator from '@/components/FriendActivityIndicator';
import { Typography } from '@/theme/designTokens';
import { getRestaurantStatus } from '@/utils/restaurantHours';

export interface FoodGridCardProps {
  item: Restaurant;
  matchPercent?: number;
  distanceMiles?: number;
  onOpenDetails?: () => void;
  onSelect?: () => void;
  selected?: boolean;
  isSaved?: boolean;
  onToggleSave?: (restaurantId: string) => void;
}

const FoodGridCard: React.FC<FoodGridCardProps> = memo(
  ({ item, matchPercent, distanceMiles, onOpenDetails, onSelect, selected, isSaved = false, onToggleSave }) => {
    const c = useThemeColors();
    const [cardWidth, setCardWidth] = useState(0);
    const IMG_ASPECT = 16 / 9;
    const BODY_HEIGHT = 160;
    const imageHeight = cardWidth > 0 ? cardWidth / IMG_ASPECT : undefined;
    const imgs: string[] = [item.main_image, item.image_1, item.image_2, item.image_3].filter(
      Boolean,
    ) as string[];
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
        <ThreeDCard
          style={{
            overflow: 'hidden',
            height: imageHeight ? imageHeight + BODY_HEIGHT : undefined,
          }}
        >
          <View onLayout={(e) => setCardWidth(e.nativeEvent.layout.width)}>
            <View
              style={{
                width: '100%',
                height: imageHeight,
                aspectRatio: imageHeight ? undefined : 16 / 9,
              }}
            >
              {imgs.length ? (
                <ImageGallery
                  images={imgs}
                  height={imageHeight}
                  autoPlayOnHover={Platform.OS === 'web'}
                  showArrows
                  onPressImage={() => onOpenDetails?.()}
                />
              ) : (
                <View style={{ flex: 1, position: 'relative' }}>
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
                      fontSize: Typography.scale.bodySmall.fontSize,
                      fontFamily: Typography.fontFamily.bodyBold,
                      fontWeight: Typography.fontWeight.bold,
                    }}>
                      No Image
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View style={{ padding: 10, gap: 6, height: BODY_HEIGHT }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Text
                  style={{ 
                    color: c.text, 
                    fontWeight: Typography.fontWeight.bold,
                    fontSize: Typography.scale.bodyLarge.fontSize,
                    fontFamily: Typography.fontFamily.bodyBold,
                    flex: 1,
                  }}
                  numberOfLines={2}
                >
                  {item.restaurant_name}
                </Text>
                {showScore ? (
                  <View
                    style={{
                      backgroundColor: c.card,
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 999,
                      marginLeft: 8,
                    }}
                  >
                    <Text style={{ 
                      color: c.text, 
                      fontSize: Typography.scale.caption.fontSize,
                      fontFamily: Typography.fontFamily.bodyBold,
                      fontWeight: Typography.fontWeight.bold,
                    }}>
                      {score}% Match
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                      fontWeight: Typography.fontWeight.bold,
                      fontSize: Typography.scale.bodySmall.fontSize,
                      fontFamily: Typography.fontFamily.bodyBold,
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
              {item.address ? (
                <Text style={{ 
                  color: c.muted, 
                  fontSize: Typography.scale.bodySmall.fontSize,
                  fontFamily: Typography.fontFamily.body,
                }} numberOfLines={2}>
                  {item.address}
                  {item.city ? `, ${item.city}` : ''}
                </Text>
              ) : null}

              {/* Friend Activity */}
              <FriendActivityIndicator 
                itemId={item.id} 
                itemType="restaurant" 
              />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}
              >
                {item.website ? (
                  <Pressable
                    onPress={() => item.website && Linking.openURL(item.website)}
                    accessibilityLabel="Open website"
                    style={{ padding: 4 }}
                  >
                    <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' }}>Website</Text>
                    {/* <Ionicons name="globe-outline" size={18} color={c.text} /> */}
                  </Pressable>
                ) : (
                  <View />
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
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
                      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      textStyle={{ fontSize: 12 }}
                    />
                  ) : (
                    <ThreeDButton
                      title="Select"
                      onPress={(e?: any) => {
                        e?.stopPropagation?.();
                        onSelect?.();
                      }}
                      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
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

export default FoodGridCard;
