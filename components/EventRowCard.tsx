import React, { memo, useMemo } from 'react';
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
import { Typography } from '@/theme/designTokens';

export interface EventRowCardProps {
  event: Event;
  isSaved: boolean;
  onToggleSave: (eventId: number) => void;
  onOpenDetails: () => void;
  onPoll?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onReport?: () => void;
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
    onReport,
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
                  <Text style={{ 
                    color: c.muted, 
                    fontSize: Typography.scale.caption.fontSize,
                    fontFamily: Typography.fontFamily.body,
                  }}>
                    No Image
                  </Text>
                </View>
              )}
            </View>
            <View style={{ flex: 1, minHeight: 96 }}>
              {/* Title only in header to free space */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ 
                  color: c.text, 
                  fontWeight: Typography.fontWeight.semibold,
                  fontSize: 13,
                  fontFamily: Typography.fontFamily.bodySemibold,
                }} numberOfLines={1}>
                  {event.title}
                </Text>
              </View>
              <Text style={{ 
                color: c.muted, 
                fontSize: Typography.scale.bodySmall.fontSize,
                fontFamily: Typography.fontFamily.body,
                marginTop: 2,
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
              {(() => {
                const snippet = useMemo(() => {
                  const raw = (event.description ?? '').trim();
                  if (!raw) return '';
                  const parts = raw.split(/\s+/);
                  const take = parts.slice(0, 14).join(' ');
                  return parts.length > 14 ? take + '…' : take;
                }, [event.description]);
                return snippet ? (
                  <Text style={{ color: c.muted, fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                    {snippet}
                  </Text>
                ) : null;
              })()}
              {/* Actions row: score chip on the left, action icons on the right */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: 8,
                }}
              >
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
                      <Text style={{ 
                        color: c.text, 
                        fontSize: Typography.scale.caption.fontSize,
                        fontFamily: Typography.fontFamily.bodyBold,
                        fontWeight: Typography.fontWeight.bold,
                      }}>
                        {/*
                          If admin icons (edit/delete) are shown, display compact numeric percent like "86%".
                          Otherwise keep the friendly label "86% Match" and an optional exclamation.
                        */}
                        {isAdmin ? `${score}%` : `${score}% Match${score > 72 ? '!' : ''}`}
                      </Text>
                    </View>
                  </LinearGradient>
                ) : null}

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Pressable
                    onPress={(e: any) => {
                      e.stopPropagation();
                      shareEvent(event);
                    }}
                    accessibilityLabel="Share event"
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={c.text} />
                  </Pressable>
                  <Pressable
                    onPress={(e: any) => {
                      e.stopPropagation();
                      onToggleSave(event.id);
                    }}
                    accessibilityLabel={isSaved ? 'Unsave event' : 'Save event'}
                    style={{ padding: 4 }}
                  >
                    <Ionicons
                      name={isSaved ? 'heart' : 'heart-outline'}
                      size={18}
                      color={isSaved ? c.primary : c.text}
                    />
                  </Pressable>
                  {onReport ? (
                    <Pressable
                      onPress={(e: any) => {
                        e.stopPropagation();
                        onReport();
                      }}
                      accessibilityLabel="Report event"
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="flag-outline" size={18} color={c.text} />
                    </Pressable>
                  ) : null}
                  {onPoll ? (
                    <ThreeDButton
                      title={pollButtonTitle}
                      onPress={() => {
                        onPoll();
                      }}
                      style={{ paddingHorizontal: 10, paddingVertical: 6 }}
                      textStyle={{ fontSize: 12 }}
                    >Poll</ThreeDButton>
                  ) : null}
                  {isAdmin ? (
                    <>
                      <Pressable
                        onPress={(e: any) => {
                          e.stopPropagation();
                          onEdit?.();
                        }}
                        accessibilityLabel="Edit event"
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="pencil" size={18} color={c.text} />
                      </Pressable>
                      <Pressable
                        onPress={(e: any) => {
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
              </View>
            </View>
          </View>
        </ThreeDCard>
      </Pressable>
    );
  },
);

export default EventRowCard;
