import React, { memo, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { ThreeDCard, ThreeDButton } from '@/components/ThreeD';
import LazyImage from '@/components/LazyImage';
import ImageGallery from '@/components/ImageGallery';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Event } from '@/types/models';
import { shareEvent } from '@/utils/share';

export interface EventGridCardProps {
  event: Event;
  isSaved: boolean;
  onToggleSave: (eventId: number) => void;
  onOpenDetails: () => void;
  onPoll?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  matchPercent?: number;
}

/**
 * Vertical grid card for larger screens: cover image, title, datetime/location,
 * description snippet, tags row, actions, and optional match badge.
 */
export const EventGridCard: React.FC<EventGridCardProps> = memo(
  ({
    event,
    isSaved,
    onToggleSave,
    onOpenDetails,
    onPoll,
    onEdit,
    onDelete,
    isAdmin,
    matchPercent,
  }) => {
    const c = useThemeColors();
    // Measure width to compute a consistent total height (image 16:9 + fixed body height)
    const [cardWidth, setCardWidth] = useState(0);
    const IMG_ASPECT = 16 / 9;
    const BODY_HEIGHT = 200; // tune if needed to fit 2-line title, meta, 2-3 line desc, tags, actions
    const imageHeight = cardWidth > 0 ? cardWidth / IMG_ASPECT : undefined;
    const totalHeight = cardWidth > 0 && imageHeight ? imageHeight + BODY_HEIGHT : undefined;
    const imgs: string[] = (event as any).image_urls?.length
      ? (event as any).image_urls
      : event.image_url
      ? [event.image_url]
      : [];
    const cover = imgs[0];
    const score = typeof matchPercent === 'number' ? matchPercent : (event as any).match_percent;
    const showScore = Number.isFinite(score);

    return (
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${event.title}`}
        style={Platform.select({ web: { cursor: 'pointer' }, default: undefined }) as any}
      >
        <ThreeDCard style={{ overflow: 'hidden', height: totalHeight }}>
          <View
            onLayout={(e) => {
              const w = e.nativeEvent.layout.width;
              if (w && w !== cardWidth) setCardWidth(w);
            }}
          >
            {/* Cover image: swipeable gallery; on web, auto-play on hover */}
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
                  onPressImage={() => onOpenDetails()}
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#00000010',
                  }}
                >
                  <Text style={{ color: c.muted, fontSize: 12 }}>No Image</Text>
                </View>
              )}
            </View>

            <View style={{ padding: 10, gap: 6, height: BODY_HEIGHT, overflow: 'hidden' }}>
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <Text
                  style={{ color: c.text, fontWeight: '800', fontSize: 16, flex: 1 }}
                  numberOfLines={2}
                >
                  {event.title}
                </Text>
                {showScore ? (
                  <LinearGradient
                    colors={['#34d399', '#3b82f6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 1, borderRadius: 999, marginLeft: 8 }}
                  >
                    <View
                      style={{
                        backgroundColor: c.card,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 999,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: c.text, fontSize: 11, fontWeight: '800' }}>
                        {score}% Match{score > 65 ? '!' : ''}
                      </Text>
                    </View>
                  </LinearGradient>
                ) : null}
              </View>
              <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                {(() => {
                  const start = dayjs(event.date_time);
                  const end = (event as any).end_time ? dayjs((event as any).end_time) : null;
                  const sameDay = end ? start.isSame(end, 'day') : true;
                  const timePart = end
                    ? sameDay
                      ? `${start.format('MMM D • h:mm')}–${end.format('h:mm A')}`
                      : `${start.format('MMM D • h:mm A')} → ${end.format('MMM D h:mm A')}`
                    : `${start.format('MMM D • h:mm A')}`;
                  return `${timePart}${event.location ? ' • ' + event.location : ''}`;
                })()}
              </Text>
              {event.description ? (
                <Text style={{ color: c.text, fontSize: 13 }} numberOfLines={2}>
                  {event.description}
                </Text>
              ) : null}
              {(event.tags ?? []).length ? (
                <View
                  style={{ flexDirection: 'row', flexWrap: 'nowrap', gap: 6, overflow: 'hidden' }}
                >
                  {(event.tags ?? []).slice(0, 6).map((t, i) => (
                    <View
                      key={`${t}-${i}`}
                      style={{
                        backgroundColor: '#00000020',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                      }}
                    >
                      <Text style={{ color: c.text, fontSize: 11 }}>{t}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Actions */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 4,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    onPress={() => shareEvent(event)}
                    accessibilityLabel="Share event"
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={c.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => onToggleSave(event.id)}
                    accessibilityLabel={isSaved ? 'Unsave event' : 'Save event'}
                    style={{ padding: 6 }}
                  >
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={isSaved ? c.primary : c.text}
                    />
                  </Pressable>
                  {onPoll ? (
                    <ThreeDButton
                      title="Poll"
                      onPress={onPoll}
                      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      textStyle={{ fontSize: 12 }}
                    />
                  ) : null}
                </View>
                {isAdmin ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Pressable
                      onPress={onEdit}
                      accessibilityLabel="Edit event"
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="pencil" size={18} color={c.text} />
                    </Pressable>
                    <Pressable
                      onPress={onDelete}
                      accessibilityLabel="Delete event"
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash" size={18} color={c.text} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        </ThreeDCard>
      </Pressable>
    );
  },
);

export default EventGridCard;
