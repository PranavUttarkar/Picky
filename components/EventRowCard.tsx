import React, { memo, useMemo, useState } from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import EventImages from '@/components/EventImages';
import EventImagePlaceholder from '@/components/EventImagePlaceholder';
import Avatar from '@/components/Avatar';
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
  onManage?: () => void; // Navigate to manage page (organizer only)
  isAdmin?: boolean;
  matchPercent?: number; // optional external override (e.g., personalized feed)
  pollButtonTitle?: string; // optional custom title for the poll button
  showVisibilityBadge?: boolean; // Show public/private badge
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
    onManage,
    isAdmin,
    matchPercent,
    pollButtonTitle = 'Poll',
    showVisibilityBadge = false,
  }) => {
    const c = useThemeColors();
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const imgs: string[] = (event as any).image_urls?.length
      ? (event as any).image_urls
      : event.image_url
      ? [event.image_url]
      : [];
    const thumb = imgs[0];

    // Fallback to event.match_percent if matchPercent prop isn't provided
    const score = typeof matchPercent === 'number' ? matchPercent : (event as any).match_percent;
    const showScore = Number.isFinite(score);

    // Visibility info
    const isPrivate = event.visibility === 'private';
    const hasCapacity = event.capacity !== null && event.capacity !== undefined;

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
        <ThreeDCard style={{ overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', padding: 10, gap: 12 }}>
            <View style={{ width: 96, height: 96, borderRadius: 12, overflow: 'hidden' }}>
              {thumb ? (
                <LazyImage
                  uri={thumb}
                  width={'100%'}
                  height={'100%'}
                  borderRadius={12}
                  resizeMode="contain"
                  fallback={<EventImagePlaceholder borderRadius={12} />}
                  accessibilityLabel={`Image for ${event.title}`}
                />
              ) : (
                <EventImagePlaceholder borderRadius={12} />
              )}
            </View>
            <View
              style={{ flex: 1, minHeight: 96 }}
              onLayout={(e) => {
                // capture width for tag layout
                setContainerWidth?.(e.nativeEvent.layout.width);
              }}
            >
              {/* Title and badges */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ 
                  color: c.text, 
                  fontWeight: Typography.fontWeight.semibold,
                  fontSize: 13,
                  fontFamily: Typography.fontFamily.bodySemibold,
                  flex: 1,
                }} numberOfLines={1}>
                  {event.title}
                </Text>
                {/* RSVP Required badge */}
                {event.rsvp_required && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#f59e0b20',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 10,
                    gap: 3,
                  }}>
                    <Ionicons name="ticket" size={10} color="#f59e0b" />
                    <Text style={{ color: '#f59e0b', fontSize: 9, fontWeight: '600' }}>
                      RSVP
                    </Text>
                  </View>
                )}
                {showVisibilityBadge && (
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: isPrivate ? '#6366f120' : '#10b98120',
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 10,
                    gap: 3,
                  }}>
                    <Ionicons
                      name={isPrivate ? 'lock-closed' : 'globe'}
                      size={10}
                      color={isPrivate ? '#6366f1' : '#10b981'}
                    />
                    <Text style={{
                      color: isPrivate ? '#6366f1' : '#10b981',
                      fontSize: 9,
                      fontWeight: '600',
                    }}>
                      {isPrivate ? 'Private' : 'Public'}
                    </Text>
                  </View>
                )}
              </View>
              {/* Organization affiliation */}
              {isOrgEvent && orgName && (
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  gap: 4,
                  marginTop: 1,
                }}>
                  <Avatar uri={creator?.avatar_url} size={12} />
                  <Text style={{ 
                    color: c.primary, 
                    fontSize: 10,
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
                      {onManage && (
                        <Pressable
                          onPress={(e: any) => {
                            e.stopPropagation();
                            onManage();
                          }}
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
              {/* Tag chips: show 2-6 top tags depending on available width */}
              {(() => {
                const tags: string[] = (event.tags ?? []) as string[];
                if (!tags || tags.length === 0) return null;
                const available = containerWidth ?? 240; // conservative fallback
                // approximate chip width including margin: 72px; compute fit
                const approxChip = 72;
                const fit = Math.max(2, Math.min(6, Math.floor(available / approxChip)));
                const toShow = tags.slice(0, fit);
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
                    {toShow.map((t, i) => (
                      <View
                        key={i}
                        style={{
                          backgroundColor: '#00000020',
                          paddingHorizontal: 8,
                          paddingVertical: 4,
                          borderRadius: 999,
                          marginRight: 8,
                          marginBottom: 6,
                        }}
                      >
                        <Text style={{ color: c.text, fontSize: Typography.scale.caption.fontSize, fontFamily: Typography.fontFamily.body }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}
            </View>
          </View>
        </ThreeDCard>
      </Pressable>
    );
  },
);

export default EventRowCard;
