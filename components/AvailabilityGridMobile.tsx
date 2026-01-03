import React, { useCallback, useMemo, useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';

export type SlotKey = string; // ISO string UTC

export interface AvailabilityGridMobileProps {
  start: Date; // start of window, already snapped to slot interval
  days?: number;
  slotMinutes?: number;
  selected: Set<SlotKey>;
  onToggle: (slotIso: SlotKey) => void;
  counts?: Record<SlotKey, number>;
  memberCount?: number;
  initialHour?: number; // default 8
}

function formatTimeLabel(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function dayLongLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

// Get time at specific slot index
function getTimeAtSlot(baseDate: Date, slotIdx: number, slotMinutes: number): Date {
  const result = new Date(baseDate);
  result.setHours(0, 0, 0, 0);
  const totalMinutes = slotIdx * slotMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  result.setHours(hours, minutes, 0, 0);
  return result;
}

// Memoized time slot component for better performance
const TimeSlot = memo(function TimeSlot({
  iso,
  cellTime,
  slotTime,
  isSelected,
  count,
  memberCount,
  isPast,
  isCurrentHour,
  onToggle,
  colors,
  textColor,
  mutedColor,
  primaryColor,
  scheme,
  rowHeight,
  dayLabel,
}: {
  iso: string;
  cellTime: Date;
  slotTime: Date;
  isSelected: boolean;
  count: number;
  memberCount: number;
  isPast: boolean;
  isCurrentHour: boolean;
  onToggle: (iso: string) => void;
  colors: { bg: string; border: string };
  textColor: string;
  mutedColor: string;
  primaryColor: string;
  scheme: string;
  rowHeight: number;
  dayLabel: string;
}) {
  const handlePress = useCallback(() => {
    if (!isPast) {
      onToggle(iso);
    }
  }, [isPast, onToggle, iso]);

  const isHighlightedTime = slotTime.getHours() % 4 === 0 && slotTime.getMinutes() === 0;

  return (
    <View style={styles.slotRow}>
      <View style={styles.timeLabel}>
        <Text style={[
          styles.timeLabelText,
          { color: isHighlightedTime ? textColor : mutedColor },
          isHighlightedTime && styles.timeLabelBold,
        ]}>
          {formatTimeLabel(cellTime)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={handlePress}
        disabled={isPast}
        activeOpacity={0.7}
        accessibilityRole="switch"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${isSelected ? 'Selected' : 'Not selected'} availability ${formatTimeLabel(cellTime)} on ${dayLabel}`}
        style={[
          styles.slotButton,
          {
            height: rowHeight - 8,
            borderWidth: isSelected ? 2 : 1,
            borderColor: isSelected ? primaryColor : colors.border,
            backgroundColor: isPast 
              ? (scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
              : colors.bg,
            opacity: isPast ? 0.4 : 1,
          },
        ]}
      >
        {isSelected && (
          <Ionicons name="checkmark-circle" size={18} color="white" />
        )}
        {count > 0 && (
          <View style={[
            styles.countBadge,
            { backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(59, 130, 246, 0.8)' }
          ]}>
            <Text style={styles.countText}>
              {count}{memberCount ? `/${memberCount}` : ''}
            </Text>
          </View>
        )}
        {isCurrentHour && !isPast && (
          <View style={[styles.currentDot, { backgroundColor: primaryColor }]} />
        )}
      </TouchableOpacity>
    </View>
  );
});

export default function AvailabilityGridMobile({
  start,
  days = 7,
  slotMinutes = 30,
  selected,
  onToggle,
  counts = {},
  memberCount = 0,
  initialHour = 8,
}: AvailabilityGridMobileProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const slotsPerDay = Math.floor((24 * 60) / slotMinutes);
  const rowHeight = 52;
  const [dayIndex, setDayIndex] = useState(0);
  const [startIdx, setStartIdx] = useState(() =>
    Math.max(0, Math.min(slotsPerDay - 1, Math.round((initialHour * 60) / slotMinutes))),
  );
  const visibleRows = Math.min(14, slotsPerDay);
  const stepSlots = Math.round(60 / slotMinutes);

  // Memoize current time to avoid recreating on every render
  const currentTime = useMemo(() => new Date(), []);
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();

  const dayStart = useMemo(
    () => new Date(start.getTime() + dayIndex * 24 * 60 * 60 * 1000),
    [start.getTime(), dayIndex],
  );

  const dayLabel = useMemo(() => dayLongLabel(dayStart), [dayStart.getTime()]);

  const timeRows = useMemo(() => {
    const arr: Date[] = [];
    const midnight = new Date(dayStart);
    midnight.setHours(0, 0, 0, 0);
    for (let i = 0; i < slotsPerDay; i++) {
      arr.push(new Date(midnight.getTime() + i * slotMinutes * 60 * 1000));
    }
    return arr;
  }, [dayStart.getTime(), slotMinutes, slotsPerDay]);

  // Pre-calculate visible slots data
  const visibleSlots = useMemo(() => {
    return Array.from({ length: visibleRows }).map((_, offset) => {
      const globalIdx = startIdx + offset;
      const slotTime = timeRows[globalIdx];
      if (!slotTime) return null;
      
      const cellTime = new Date(dayStart);
      cellTime.setHours(slotTime.getHours(), slotTime.getMinutes(), 0, 0);
      const iso = cellTime.toISOString();
      const isPast = cellTime < currentTime;
      const isCurrentHour = slotTime.getHours() === currentHour && 
                            slotTime.getMinutes() <= currentMinutes + 30;
      
      return {
        globalIdx,
        slotTime,
        cellTime,
        iso,
        isPast,
        isCurrentHour,
      };
    }).filter(Boolean);
  }, [startIdx, timeRows, dayStart.getTime(), currentTime.getTime(), visibleRows]);

  // Heat map color calculation
  const getHeatColor = useCallback((count: number, isSelected: boolean): { bg: string; border: string } => {
    if (isSelected) {
      return { bg: c.primary, border: c.primary };
    }
    
    if (!memberCount || !count) {
      return {
        bg: scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        border: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      };
    }

    const ratio = Math.max(0, Math.min(1, count / memberCount));
    
    if (ratio >= 0.8) {
      return { bg: 'rgba(59, 130, 246, 0.4)', border: 'rgba(59, 130, 246, 0.6)' };
    } else if (ratio >= 0.6) {
      return { bg: 'rgba(59, 130, 246, 0.3)', border: 'rgba(59, 130, 246, 0.5)' };
    } else if (ratio >= 0.4) {
      return { bg: 'rgba(59, 130, 246, 0.2)', border: 'rgba(59, 130, 246, 0.4)' };
    } else if (ratio >= 0.2) {
      return { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.3)' };
    } else {
      return { bg: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.2)' };
    }
  }, [c.primary, memberCount, scheme]);

  const goPrev = useCallback(() => setDayIndex((i) => Math.max(0, i - 1)), []);
  const goNext = useCallback(() => setDayIndex((i) => Math.min(days - 1, i + 1)), [days]);
  const scrollUp = useCallback(() => setStartIdx((i) => Math.max(0, i - stepSlots)), [stepSlots]);
  const scrollDown = useCallback(() => setStartIdx((i) => Math.min(slotsPerDay - visibleRows, i + stepSlots)), [stepSlots, slotsPerDay, visibleRows]);

  const canScrollUp = startIdx > 0;
  const canScrollDown = startIdx < slotsPerDay - visibleRows;

  return (
    <View style={[styles.container, { backgroundColor: c.card }]}>
      {/* Header with legend */}
      <View style={[
        styles.header,
        { 
          borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        }
      ]}>
        {/* Day navigation */}
        <View style={styles.dayNav}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={dayIndex === 0}
            activeOpacity={0.7}
            style={[styles.navButton, { backgroundColor: c.background, opacity: dayIndex === 0 ? 0.3 : 1 }]}
          >
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </TouchableOpacity>
          <View style={styles.dayLabelContainer}>
            <Text style={[styles.dayLabelText, { color: c.text }]}>
              {dayLabel}
            </Text>
            <Text style={[styles.timeRangeText, { color: c.muted }]}>
              {formatTimeLabel(getTimeAtSlot(dayStart, startIdx, slotMinutes))} - {formatTimeLabel(getTimeAtSlot(dayStart, startIdx + visibleRows, slotMinutes))}
            </Text>
          </View>
          <TouchableOpacity
            onPress={goNext}
            disabled={dayIndex === days - 1}
            activeOpacity={0.7}
            style={[styles.navButton, { backgroundColor: c.background, opacity: dayIndex === days - 1 ? 0.3 : 1 }]}
          >
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </TouchableOpacity>
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: c.primary }]} />
            <Text style={[styles.legendText, { color: c.muted }]}>Your selection</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'rgba(59, 130, 246, 0.4)' }]} />
            <Text style={[styles.legendText, { color: c.muted }]}>High overlap</Text>
          </View>
        </View>
      </View>

      {/* Time navigation */}
      <View style={[
        styles.timeNav,
        { 
          backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }
      ]}>
        <TouchableOpacity
          onPress={scrollUp}
          disabled={!canScrollUp}
          activeOpacity={0.7}
          style={[styles.timeNavButton, { backgroundColor: c.background, opacity: canScrollUp ? 1 : 0.3 }]}
        >
          <Ionicons name="chevron-up" size={18} color={c.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={scrollDown}
          disabled={!canScrollDown}
          activeOpacity={0.7}
          style={[styles.timeNavButton, { backgroundColor: c.background, opacity: canScrollDown ? 1 : 0.3 }]}
        >
          <Ionicons name="chevron-down" size={18} color={c.text} />
        </TouchableOpacity>
        <View style={styles.spacer} />
        <Text style={[styles.currentTimeRange, { color: c.muted }]}>
          {formatTimeLabel(getTimeAtSlot(dayStart, startIdx, slotMinutes))}
          {' - '}
          {formatTimeLabel(getTimeAtSlot(dayStart, startIdx + visibleRows, slotMinutes))}
        </Text>
      </View>

      {/* Slots list */}
      <View style={styles.slotsContainer}>
        {visibleSlots.map((slot) => {
          if (!slot) return null;
          const isSelected = selected.has(slot.iso);
          const count = counts[slot.iso] ?? 0;
          const colors = getHeatColor(count, isSelected);
          
          return (
            <TimeSlot
              key={slot.globalIdx}
              iso={slot.iso}
              cellTime={slot.cellTime}
              slotTime={slot.slotTime}
              isSelected={isSelected}
              count={count}
              memberCount={memberCount}
              isPast={slot.isPast}
              isCurrentHour={slot.isCurrentHour}
              onToggle={onToggle}
              colors={colors}
              textColor={c.text}
              mutedColor={c.muted}
              primaryColor={c.primary}
              scheme={scheme}
              rowHeight={rowHeight}
              dayLabel={dayLabel}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 12,
    borderBottomWidth: 1,
  },
  dayNav: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  navButton: {
    padding: 8,
    borderRadius: 10,
  },
  dayLabelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  dayLabelText: {
    fontWeight: '700',
    fontSize: 16,
  },
  timeRangeText: {
    fontSize: 12,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeNav: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
  },
  timeNavButton: {
    padding: 10,
    borderRadius: 10,
    marginRight: 8,
  },
  spacer: {
    flex: 1,
  },
  currentTimeRange: {
    fontSize: 12,
    fontWeight: '600',
  },
  slotsContainer: {
    paddingVertical: 8,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    height: 52,
  },
  timeLabel: {
    width: 80,
    paddingVertical: 10,
    paddingRight: 12,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  timeLabelText: {
    fontSize: 13,
    fontWeight: '400',
  },
  timeLabelBold: {
    fontWeight: '600',
  },
  slotButton: {
    flex: 1,
    marginVertical: 2,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  countBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  countText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  currentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
