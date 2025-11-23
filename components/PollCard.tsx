import React, { useState, useEffect } from 'react';
import { View, Text, Image } from 'react-native';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import LazyImage from '@/components/LazyImage';
import Chip from '@/components/Chip';
import type { PollOptionView } from '@/services/polls';
import type { Restaurant } from '@/types/models';
import { Typography } from '@/theme/designTokens';

export interface PollCardProps {
  option: PollOptionView;
  isLeader?: boolean;
  variant?: 'swipe' | 'leader' | 'list';
  foodDetails?: Partial<Restaurant> | null;
  foodThumb?: string | null;
  colors: { background: string; card: string; text: string; muted: string; primary: string; accent: string };
  // Optionally pass poll mode to decide rating summary display
  pollMode?: 'vote' | 'rating' | string | undefined;
  // User preference: whether to show distance (if available on option data)
  showDistance?: boolean;
}

// Internal helper to detect FOOD| token
function parseFoodToken(t: string | undefined): string | null {
  const s = (t || '').trim();
  if (!s.startsWith('FOOD|')) return null;
  const parts = s.split('|');
  if (parts.length < 2) return null;
  const placeId = parts[1]?.trim();
  return placeId || null;
}

export const PollCard: React.FC<PollCardProps> = ({
  option,
  isLeader,
  variant = 'swipe',
  foodDetails,
  foodThumb,
  colors: c,
  pollMode,
  showDistance,
}) => {
  const isFood = option.kind === 'text' && parseFoodToken((option as any).text);
  const ev = (option as any).event || {};
  const rest = isFood ? foodDetails || null : null;
  const images = isFood ? (foodThumb ? [foodThumb] : []) : (ev.image_urls?.length ? ev.image_urls : ev.image_url ? [ev.image_url] : []);
  const thumb = images[0];

  const title = isFood ? rest?.restaurant_name ?? 'Restaurant' : ev.title ?? `Event #${option.id}`;
  const description = isFood ? rest?.description ?? '' : ev.description ?? '';
  const rawTags: string[] = isFood
    ? (rest?.category
        ? String(rest.category)
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : [])
    : Array.isArray(ev.tags)
    ? (ev.tags as string[])
    : [];
  const tags = rawTags.slice(0, 6);
  const matchPercent = (option as any).match_percent; // may be undefined for food
  const love = (option as any).love_it;
  const fine = (option as any).fine;
  const nope = (option as any).not_for_me;
  const hasRatingBuckets = love != null || fine != null || nope != null;
  const reviewPoints = isFood ? rest?.review_points : (ev.review_points ?? undefined);

  // Distance: look for distance fields precomputed elsewhere
  const distanceMeters: number | undefined = (option as any).distance_meters ?? (rest as any)?.distance_meters ?? (ev as any)?.distance_meters;
  const distanceKm: number | undefined = (option as any).distance_km ?? (rest as any)?.distance_km ?? (ev as any)?.distance_km ?? (distanceMeters != null ? distanceMeters / 1000 : undefined);
  const distanceDisplay = showDistance && distanceKm != null ? `${distanceKm < 1 ? Math.round(distanceKm * 1000) + ' m' : distanceKm.toFixed(1) + ' km'} away` : null;

  const metaLine = (() => {
    if (isFood) {
      const parts = [rest?.address, rest?.city].filter(Boolean);
      return parts.join(' • ');
    }
    const start = ev?.date_time ? dayjs(ev.date_time) : null;
    const end = ev?.end_time ? dayjs(ev.end_time) : null;
    if (start) {
      const sameDay = end ? start.isSame(end, 'day') : true;
      const timePart = end
        ? sameDay
          ? `${start.format('MMM D • h:mm')}–${end.format('h:mm A')}`
          : `${start.format('MMM D • h:mm A')} → ${end.format('MMM D h:mm A')}`
        : `${start.format('MMM D • h:mm A')}`;
      return `${timePart}${ev.location ? ' • ' + ev.location : ''}`;
    }
    return ev?.location ?? '';
  })();

  const snippet = description.trim().split(/\s+/).slice(0, 24).join(' ');
  const longDescWordCount = description.trim().split(/\s+/).length;

  // Aspect ratios differ slightly for leader view for nicer layout
  const imageAspect = variant === 'leader' ? 1.4 : 1.1;

  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [thumb]);

  return (
    <View style={{ width: '100%', position: 'relative' }}>
      {isLeader ? (
        <View
          style={{
            position: 'absolute',
            top: variant === 'leader' ? -36 : 8,
            right: variant === 'leader' ? -36 : 8,
            transform: [{ rotate: '45deg' }],
            backgroundColor: 'transparent',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 999,
            zIndex: 5,
          }}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Text style={{ fontSize: variant === 'leader' ? 34 : 34 }}>👑</Text>
        </View>
      ) : null}

      {/* Top image */}
      <View
        style={{
          width: '100%',
          aspectRatio: imageAspect,
          borderRadius: 12,
          overflow: 'hidden',
          backgroundColor: '#00000015',
        }}
      >
        {thumb && !imageFailed ? (
          <LazyImage
            key={`${option.kind}-${option.id}-${!!thumb}`}
            uri={thumb}
            width={'100%'}
            height={'100%'}
            borderRadius={12}
            accessibilityLabel={`Image for ${title}`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <Image
            source={require('../assets/NoImageRestaurant.jpg')}
            style={{ width: '100%', height: '100%', borderRadius: 12 }}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Info block */}
      <View
        style={{
          width: '100%',
          aspectRatio: imageAspect,
          marginTop: 8,
          backgroundColor: c.background,
          borderRadius: 12,
          padding: 10,
          gap: 6,
        }}
      >
        <Text style={{ color: c.text, fontWeight: '800', fontSize: 18 }}>{title}</Text>
        {metaLine ? <Text style={{ color: c.muted }}>{metaLine}</Text> : null}
        {snippet ? (
          <Text style={{ color: c.muted }} numberOfLines={3}>
            {snippet}
            {longDescWordCount > 24 ? '…' : ''}
          </Text>
        ) : null}
        {tags.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tags.map((t) => (
              <Chip key={t} label={t} />
            ))}
          </View>
        ) : null}
        {matchPercent != null ? (
          <Text style={{ color: c.muted }}>{matchPercent}% match for group</Text>
        ) : null}
        {isFood && (rest?.price_range || rest?.review_points) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {rest?.price_range ? <Chip label={rest.price_range} /> : null}
            {rest?.review_points ? <Chip label={`${rest.review_points}★`} /> : null}
          </View>
        ) : null}
        {/* Rating summary (swipe variant primarily) */}
        {variant === 'swipe' ? (
          <>
            {pollMode === 'rating' && hasRatingBuckets ? (
              <Text style={{ 
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                fontFamily: Typography.fontFamily.body,
              }}>
                ❤️ {love ?? 0} • 👍 {fine ?? 0} • 👎 {nope ?? 0}
              </Text>
            ) : null}
            {distanceDisplay ? (
              <Text style={{ 
                color: c.muted,
                fontSize: Typography.scale.bodySmall.fontSize,
                fontFamily: Typography.fontFamily.body,
              }}>
                {distanceDisplay}
              </Text>
            ) : null}
          </>
        ) : null}
      </View>
    </View>
  );
};

export default PollCard;
