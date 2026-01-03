import React, { useCallback, useMemo, useState, memo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions, StyleSheet } from 'react-native';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';

export type SlotKey = string; // ISO string UTC

export interface AvailabilityGridProps {
  start: Date; // start of window, already snapped to slot interval
  days?: number;
  slotMinutes?: number;
  selected: Set<SlotKey>;
  onToggle: (slotIso: SlotKey) => void;
  counts?: Record<SlotKey, number>; // aggregated counts
  memberCount?: number; // for heatmap normalization
  initialHour?: number; // scroll to this hour on first render (e.g., 8)
}

function formatTimeLabel(date: Date) {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function dayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function dayLabelFull(date: Date) {
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${date.getMonth() + 1}/${date.getDate()}`;
}

// Memoized cell component
const GridCell = memo(function GridCell({
  iso,
  isSelected,
  count,
  memberCount,
  isPast,
  isToday,
  isCurrentSlot,
  colWidth,
  rowHeight,
  onToggle,
  colors,
  textColor,
  mutedColor,
  primaryColor,
  scheme,
  cellTimeLabel,
  dayFullLabel,
}: {
  iso: string;
  isSelected: boolean;
  count: number;
  memberCount: number;
  isPast: boolean;
  isToday: boolean;
  isCurrentSlot: boolean;
  colWidth: number;
  rowHeight: number;
  onToggle: (iso: string) => void;
  colors: { bg: string; border: string };
  textColor: string;
  mutedColor: string;
  primaryColor: string;
  scheme: string;
  cellTimeLabel: string;
  dayFullLabel: string;
}) {
  const handlePress = useCallback(() => {
    if (!isPast) {
      onToggle(iso);
    }
  }, [isPast, onToggle, iso]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={isPast}
      activeOpacity={0.7}
      accessibilityRole="switch"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${isSelected ? 'Selected' : 'Not selected'} availability ${cellTimeLabel} ${dayFullLabel}`}
      style={[
        styles.cell,
        {
          width: colWidth,
          height: rowHeight,
          borderColor: isToday ? `${primaryColor}40` : colors.border,
          backgroundColor: isPast 
            ? (scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
            : colors.bg,
          opacity: isPast ? 0.4 : 1,
        },
      ]}
    >
      {/* Count badge */}
      {count > 0 && !isSelected && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {count}{memberCount ? `/${memberCount}` : ''}
          </Text>
        </View>
      )}
      
      {/* Selected indicator */}
      {isSelected && (
        <View style={styles.checkmark}>
          <Ionicons name="checkmark-circle" size={16} color="white" />
        </View>
      )}
      
      {/* Current time indicator */}
      {isCurrentSlot && !isPast && (
        <View style={[styles.currentDot, { backgroundColor: primaryColor }]} />
      )}
    </TouchableOpacity>
  );
});

export default function AvailabilityGrid({
  start,
  days = 7,
  slotMinutes = 30,
  selected,
  onToggle,
  counts = {},
  memberCount = 0,
  initialHour = 8,
}: AvailabilityGridProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const { width } = useWindowDimensions();
  const slotsPerDay = Math.floor((24 * 60) / slotMinutes);
  
  // Responsive breakpoints
  const bp = width < 900 ? 'sm' : width < 1200 ? 'md' : 'lg';
  const rowHeight = bp === 'lg' ? 42 : bp === 'md' ? 36 : 32;

  // Responsive sizing
  const timeLabelWidth = bp === 'lg' ? 90 : bp === 'md' ? 75 : 65;
  const visibleDays = Math.min(days, 7);
  const minCol = bp === 'lg' ? 140 : bp === 'md' ? 110 : 90;
  const colWidth = Math.max(minCol, Math.floor((width - timeLabelWidth - 32) / visibleDays));
  const timeFontSize = bp === 'lg' ? 13 : bp === 'md' ? 12 : 11;

  // Memoize current time info
  const currentTime = useMemo(() => new Date(), []);
  const todayString = useMemo(() => currentTime.toDateString(), [currentTime]);
  const currentHour = currentTime.getHours();
  const currentMinutes = currentTime.getMinutes();

  const dayStarts = useMemo(() => {
    const arr: Date[] = [];
    for (let d = 0; d < days; d++) arr.push(new Date(start.getTime() + d * 24 * 60 * 60 * 1000));
    return arr;
  }, [start.getTime(), days]);

  const timeRows = useMemo(() => {
    const arr: Date[] = [];
    for (let i = 0; i < slotsPerDay; i++) {
      const dt = new Date(start);
      dt.setHours(0, 0, 0, 0);
      const rowTime = new Date(dt.getTime() + i * slotMinutes * 60 * 1000);
      arr.push(rowTime);
    }
    return arr;
  }, [start.getTime(), slotMinutes, slotsPerDay]);

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
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: c.primary, borderColor: c.primary }]} />
            <Text style={[styles.legendText, { color: c.muted }]}>Your availability</Text>
          </View>
          
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: 'rgba(59, 130, 246, 0.4)', borderColor: 'rgba(59, 130, 246, 0.6)' }]} />
            <Text style={[styles.legendText, { color: c.muted }]}>High overlap</Text>
          </View>
          
          <View style={styles.legendItem}>
            <View style={[
              styles.legendColor, 
              { 
                backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
              }
            ]} />
            <Text style={[styles.legendText, { color: c.muted }]}>No overlap</Text>
          </View>
        </View>
        
        <Text style={[styles.helpText, { color: c.muted }]}>
          Tap to select your availability • Colors show member overlap
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.gridContainer}>
          {/* Header row */}
          <View style={[
            styles.headerRow,
            { backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)' }
          ]}>
            <View style={[styles.cornerSpacer, { width: timeLabelWidth }]}>
              <Text style={[styles.cornerText, { color: c.muted }]}>Time</Text>
            </View>
            {dayStarts.map((d, i) => (
              <View 
                key={i} 
                style={[
                  styles.dayHeader,
                  { 
                    width: colWidth,
                    borderLeftWidth: i === 0 ? 1 : 0,
                    borderLeftColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                  }
                ]}
              >
                <Text style={[styles.dayName, { color: c.text }]}>{dayLabel(d)}</Text>
                <Text style={[styles.dayDate, { color: c.muted }]}>
                  {d.getMonth() + 1}/{d.getDate()}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid rows */}
          <View style={{ paddingBottom: rowHeight * 2 + 24 }}>
            {timeRows.map((rowBase, rowIdx) => {
              const isHighlightedTime = rowBase.getHours() % 4 === 0 && rowBase.getMinutes() === 0;
              
              return (
                <View 
                  key={rowIdx} 
                  style={[
                    styles.row,
                    { borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }
                  ]}
                >
                  {/* Time label */}
                  <View style={[
                    styles.timeLabel,
                    { 
                      width: timeLabelWidth,
                      backgroundColor: rowIdx % 2 === 0 
                        ? 'transparent' 
                        : (scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    }
                  ]}>
                    <Text style={[
                      styles.timeLabelText,
                      { 
                        color: isHighlightedTime ? c.text : c.muted,
                        fontSize: timeFontSize,
                        fontWeight: isHighlightedTime ? '600' : '400',
                      }
                    ]}>
                      {formatTimeLabel(rowBase)}
                    </Text>
                  </View>
                  
                  {/* Cells */}
                  {dayStarts.map((day, colIdx) => {
                    const cellTime = new Date(day);
                    cellTime.setHours(rowBase.getHours(), rowBase.getMinutes(), 0, 0);
                    const iso = cellTime.toISOString();
                    const isSelected = selected.has(iso);
                    const count = counts[iso] ?? 0;
                    const colors = getHeatColor(count, isSelected);
                    const isToday = day.toDateString() === todayString;
                    const isPast = cellTime < currentTime;
                    const isCurrentSlot = isToday && 
                      rowBase.getHours() === currentHour && 
                      rowBase.getMinutes() <= currentMinutes + 30;
                    
                    return (
                      <GridCell
                        key={colIdx}
                        iso={iso}
                        isSelected={isSelected}
                        count={count}
                        memberCount={memberCount}
                        isPast={isPast}
                        isToday={isToday}
                        isCurrentSlot={isCurrentSlot}
                        colWidth={colWidth}
                        rowHeight={rowHeight}
                        onToggle={onToggle}
                        colors={colors}
                        textColor={c.text}
                        mutedColor={c.muted}
                        primaryColor={c.primary}
                        scheme={scheme}
                        cellTimeLabel={formatTimeLabel(cellTime)}
                        dayFullLabel={dayLabelFull(day)}
                      />
                    );
                  })}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 11,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  gridContainer: {
    flexDirection: 'column',
  },
  headerRow: {
    flexDirection: 'row',
  },
  cornerSpacer: {
    paddingVertical: 12,
    paddingRight: 12,
    alignItems: 'flex-end',
  },
  cornerText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayHeader: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  dayName: {
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 2,
  },
  dayDate: {
    fontSize: 11,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  timeLabel: {
    paddingVertical: 8,
    alignItems: 'flex-end',
    paddingRight: 12,
    justifyContent: 'center',
  },
  timeLabelText: {
    // Dynamic styles applied inline
  },
  cell: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: 'center',
  },
  countText: {
    color: 'white',
    fontSize: 9,
    fontWeight: '700',
  },
  checkmark: {
    position: 'absolute',
    top: 2,
    left: 2,
  },
  currentDot: {
    position: 'absolute',
    bottom: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
