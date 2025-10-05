import React, { memo } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import EventImages from '@/components/EventImages';
import dayjs from 'dayjs';
import { ThreeDCard, ThreeDButton } from '@/components/ThreeD';
import LazyImage from '@/components/LazyImage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { Event } from '@/types/models';
import { shareEvent } from '@/utils/share';

export interface EventRowCardProps {
  event: Event;
  isSaved: boolean;
  onToggleSave: (eventId: number) => void;
  onOpenDetails: () => void;
  onPoll?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isAdmin?: boolean;
  matchPercent?: number; // optional external override (e.g., personalized feed)
  pollButtonTitle?: string; // optional custom title for the poll button
}

/**
 * Horizontal row card: thumbnail + details + actions.
 * Keeps UI denser than vertical cards and improves scroll predictability (consistent height).
 */
export const EventRowCard: React.FC<EventRowCardProps> = memo(
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
    pollButtonTitle = 'Poll',
  }) => {
    const c = useThemeColors();
    const imgs: string[] = (event as any).image_urls?.length
      ? (event as any).image_urls
      : event.image_url
      ? [event.image_url]
      : [];
    const thumb = imgs[0];

    // Fallback to event.match_percent if matchPercent prop isn't provided
    const score = typeof matchPercent === 'number' ? matchPercent : (event as any).match_percent;
    const showScore = Number.isFinite(score);

    return (
      <Pressable
        onPress={onOpenDetails}
        accessibilityRole="button"
        accessibilityLabel={`Open details for ${event.title}`}
        style={Platform.select({ web: { cursor: 'pointer' }, default: undefined }) as any}
      >
        <ThreeDCard style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', padding: 10, gap: 12 }}>
            <View style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden' }}>
              {thumb ? (
                <LazyImage
                  uri={thumb}
                  width={'100%'}
                  height={'100%'}
                  borderRadius={12}
                  accessibilityLabel={`Image for ${event.title}`}
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    backgroundColor: '#00000015',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 12,
                  }}
                >
                  <Text style={{ color: c.muted, fontSize: 11 }}>No Image</Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, minHeight: 96 }}>
              {/* Title only in header to free space */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>
                  {event.title}
                </Text>
              </View>
              <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }} numberOfLines={1}>
                {dayjs(event.date_time).format('MMM D • h:mm A')}{' '}
                {event.location ? '• ' + event.location : ''}
              </Text>
              <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                {(event.tags ?? []).join(', ')}
              </Text>
              {/* Actions row with score chip at bottom-right */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      shareEvent(event);
                    }}
                    accessibilityLabel="Share event"
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={c.text} />
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation();
                      onToggleSave(event.id);
                    }}
                    accessibilityLabel={isSaved ? 'Unsave event' : 'Save event'}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={isSaved ? 'bookmark' : 'bookmark-outline'}
                      size={18}
                      color={isSaved ? c.primary : c.text}
                    />
                  </Pressable>
                  {onPoll ? (
                    <ThreeDButton
                      title={pollButtonTitle}
                      onPress={() => {
                        onPoll();
                      }}
                      style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      textStyle={{ fontSize: 12 }}
                    />
                  ) : null}
                  {isAdmin ? (
                    <>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          onEdit?.();
                        }}
                        accessibilityLabel="Edit event"
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="pencil" size={18} color={c.text} />
                      </Pressable>
                      <Pressable
                        onPress={(e) => {
                          e.stopPropagation();
                          onDelete?.();
                        }}
                        accessibilityLabel="Delete event"
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="trash" size={18} color={c.text} />
                      </Pressable>
                    </>
                  ) : null}
                </View>
                {showScore ? (
                  <LinearGradient
                    colors={['#34d399', '#3b82f6']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ padding: 1, borderRadius: 999 }}
                  >
                    <View
                      style={{
                        backgroundColor: c.card,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: c.text, fontSize: 11, fontWeight: '800' }}>
                        {score}% Match{score > 72 ? '!' : ''}
                      </Text>
                    </View>
                  </LinearGradient>
                ) : null}
              </View>
            </View>
          </View>
        </ThreeDCard>
      </Pressable>
    );
  },
);

export default EventRowCard;
