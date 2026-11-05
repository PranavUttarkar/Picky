import React, { memo, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { ThreeDCard, ThreeDButton } from '@/components/ThreeD';
import LazyImage from '@/components/LazyImage';
import ImageGallery from '@/components/ImageGallery';
import EventImagePlaceholder from '@/components/EventImagePlaceholder';
import Avatar from '@/components/Avatar';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Event } from '@/types/models';
import { shareEvent } from '@/utils/share';
import FriendActivityIndicator from '@/components/FriendActivityIndicator';
import { Typography } from '@/theme/designTokens';

export interface EventGridCardProps {
  event: Event;
  isSaved: boolean;
  onToggleSave: (eventId: number) => void;
  onOpenDetails: () => void;
  onPoll?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
  onManage?: () => void; // Navigate to manage page (organizer only)
  isAdmin?: boolean;
  matchPercent?: number;
  showVisibilityBadge?: boolean; // Show public/private badge
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
    onReport,
    onManage,
    isAdmin,
    matchPercent,
    showVisibilityBadge = false,
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

    // Visibility info
    const isPrivate = event.visibility === 'private';

    // Organization info
    const creator = event.creator;
    const isOrgEvent = creator?.account_type === 'organization';
    const orgName = creator?.display_name || creator?.username;

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
                  resizeMode="contain"
                  fallback={<EventImagePlaceholder />}
                  autoPlayOnHover={Platform.OS === 'web'}
                  onPressImage={() => onOpenDetails()}
                />
              ) : (
                <EventImagePlaceholder />
              )}
            </View>

            <View style={{ padding: 10, gap: 6, height: BODY_HEIGHT, overflow: 'hidden' }}>
              {/* Badges row: visibility, RSVP required, capacity */}
              {(showVisibilityBadge || event.rsvp_required) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 2 }}>
                  {showVisibilityBadge && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: isPrivate ? '#6366f120' : '#10b98120',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      gap: 4,
                    }}>
                      <Ionicons
                        name={isPrivate ? 'lock-closed' : 'globe'}
                        size={12}
                        color={isPrivate ? '#6366f1' : '#10b981'}
                      />
                      <Text style={{
                        color: isPrivate ? '#6366f1' : '#10b981',
                        fontSize: 11,
                        fontWeight: '600',
                      }}>
                        {isPrivate ? 'Private' : 'Public'}
                        {event.capacity ? ` • ${event.capacity} spots` : ''}
                      </Text>
                    </View>
                  )}
                  {event.rsvp_required && (
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#f59e0b20',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      gap: 4,
                    }}>
                      <Ionicons name="ticket" size={12} color="#f59e0b" />
                      <Text style={{ color: '#f59e0b', fontSize: 11, fontWeight: '600' }}>
                        RSVP Required
                      </Text>
                    </View>
                  )}
                </View>
              )}
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
                      <Text style={{ 
                        color: c.text, 
                        fontSize: Typography.scale.caption.fontSize,
                        fontFamily: Typography.fontFamily.bodyBold,
                        fontWeight: Typography.fontWeight.bold,
                      }}>
                        {score}% Match{score > 65 ? '!' : ''}
                      </Text>
                    </View>
                  </LinearGradient>
                ) : null}
              </View>
              {/* Organization affiliation */}
              {isOrgEvent && orgName && (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 6,
                  marginTop: -2,
                }}>
                  <Avatar uri={creator?.avatar_url} size={16} />
                  <Text style={{ 
                    color: c.primary, 
                    fontSize: Typography.scale.caption.fontSize,
                    fontFamily: Typography.fontFamily.body,
                    fontWeight: Typography.fontWeight.medium,
                  }} numberOfLines={1}>
                    {orgName}
                  </Text>
                </View>
              )}
              <Text style={{ 
                color: c.muted, 
                fontSize: Typography.scale.bodySmall.fontSize,
                fontFamily: Typography.fontFamily.body,
              }} numberOfLines={1}>
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
                <Text style={{ 
                  color: c.text, 
                  fontSize: 13,
                  fontFamily: Typography.fontFamily.body,
                }} numberOfLines={2}>
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
                      <Text style={{ 
                        color: c.text, 
                        fontSize: Typography.scale.caption.fontSize,
                        fontFamily: Typography.fontFamily.body,
                      }}>
                        {t}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* Friend Activity */}
              <FriendActivityIndicator 
                itemId={event.id} 
                itemType="event" 
              />

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
                      name={isSaved ? 'heart' : 'heart-outline'}
                      size={18}
                      color={isSaved ? c.primary : c.text}
                    />
                  </Pressable>
                  {onReport ? (
                    <Pressable
                      onPress={onReport}
                      accessibilityLabel="Report event"
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="flag-outline" size={18} color={c.text} />
                    </Pressable>
                  ) : null}
                  {onPoll ? (
                    <ThreeDButton
                      title="Poll"
                      onPress={onPoll}
                      style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                      textStyle={{ fontSize: 12 }}
                    >Poll</ThreeDButton>
                  ) : null}
                </View>
                {isAdmin ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {onManage && (
                      <Pressable
                        onPress={onManage}
                        accessibilityLabel="Manage event"
                        style={{ 
                          padding: 4,
                          backgroundColor: c.primary + '20',
                          borderRadius: 6,
                        }}
                      >
                        <Ionicons name="settings" size={16} color={c.primary} />
                      </Pressable>
                    )}
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
