import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

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
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<SlotKey | null>(null);

  // Responsive sizing
  const timeLabelWidth = bp === 'lg' ? 90 : bp === 'md' ? 75 : 65;
  const visibleDays = Math.min(days, 7);
  const minCol = bp === 'lg' ? 140 : bp === 'md' ? 110 : 90;
  const colWidth = Math.max(minCol, Math.floor((width - timeLabelWidth - 32) / visibleDays));
  const timeFontSize = bp === 'lg' ? 13 : bp === 'md' ? 12 : 11;

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
      const midnight = dt;
      const rowTime = new Date(midnight.getTime() + i * slotMinutes * 60 * 1000);
      arr.push(rowTime);
    }
    return arr;
  }, [start.getTime(), slotMinutes, slotsPerDay]);

  // Enhanced heat map color with better gradient
  const getHeatColor = (count: number, isSelected: boolean): { bg: string; border: string } => {
    if (isSelected) {
      return {
        bg: c.primary,
        border: c.primary,
      };
    }
    
    if (!memberCount || !count) {
      return {
        bg: scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
        border: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
      };
    }

    const ratio = Math.max(0, Math.min(1, count / memberCount));
    
    // Gradient from light to dark blue based on overlap
    if (ratio >= 0.8) {
      return {
        bg: 'rgba(59, 130, 246, 0.4)', // High overlap
        border: 'rgba(59, 130, 246, 0.6)',
      };
    } else if (ratio >= 0.6) {
      return {
        bg: 'rgba(59, 130, 246, 0.3)',
        border: 'rgba(59, 130, 246, 0.5)',
      };
    } else if (ratio >= 0.4) {
      return {
        bg: 'rgba(59, 130, 246, 0.2)',
        border: 'rgba(59, 130, 246, 0.4)',
      };
    } else if (ratio >= 0.2) {
      return {
        bg: 'rgba(59, 130, 246, 0.1)',
        border: 'rgba(59, 130, 246, 0.3)',
      };
    } else {
      return {
        bg: 'rgba(59, 130, 246, 0.05)',
        border: 'rgba(59, 130, 246, 0.2)',
      };
    }
  };

  const handleCellInteraction = (iso: SlotKey, isSelected: boolean, action: 'press' | 'hover') => {
    if (action === 'hover' && !isDragging) {
      setHoveredSlot(iso);
      return;
    }

    if (isDragging && dragMode) {
      const curr = selected.has(iso);
      if ((dragMode === 'add' && !curr) || (dragMode === 'remove' && curr)) {
        onToggle(iso);
      }
    } else if (action === 'press') {
      onToggle(iso);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, overflow: 'hidden' }}>
      {/* Header with legend */}
      <View style={{
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: c.primary,
              borderWidth: 1,
              borderColor: c.primary,
            }} />
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
              Your availability
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
              borderWidth: 1,
              borderColor: 'rgba(59, 130, 246, 0.6)',
            }} />
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
              High overlap
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderWidth: 1,
              borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            }} />
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
              No overlap
            </Text>
          </View>
        </View>
        
        <Text style={{ color: c.muted, fontSize: 11 }}>
          Tap or drag to select your availability • Colors show member overlap
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <View style={{ flexDirection: 'column' }}>
          {/* Enhanced header row */}
          <View style={{ 
            flexDirection: 'row',
            backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
          }}>
            {/* Corner spacer for time labels */}
            <View style={{ 
              width: timeLabelWidth,
              paddingVertical: 12,
              paddingRight: 12,
              alignItems: 'flex-end',
            }}>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }}>
                Time
              </Text>
            </View>
            {dayStarts.map((d, i) => (
              <View 
                key={i} 
                style={{ 
                  width: colWidth, 
                  paddingVertical: 12, 
                  alignItems: 'center',
                  borderLeftWidth: i === 0 ? 1 : 0,
                  borderLeftColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                }}
              >
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13, marginBottom: 2 }}>
                  {dayLabel(d)}
                </Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>
                  {d.getMonth() + 1}/{d.getDate()}
                </Text>
              </View>
            ))}
          </View>

          {/* Grid (vertical scrolling handled by parent screen ScrollView) */}
          <View style={{ paddingBottom: rowHeight * 2 + 24 }}>
            {timeRows.map((rowBase, rowIdx) => (
              <View 
                key={rowIdx} 
                style={{ 
                  flexDirection: 'row',
                  borderBottomWidth: 1,
                  borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                }}
              >
                {/* Enhanced time label */}
                <View
                  style={{
                    width: timeLabelWidth,
                    paddingVertical: 8,
                    alignItems: 'flex-end',
                    paddingRight: 12,
                    justifyContent: 'center',
                    backgroundColor: rowIdx % 2 === 0 
                      ? 'transparent' 
                      : (scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                  }}
                >
                  <Text style={{ 
                    color: rowBase.getHours() % 4 === 0 && rowBase.getMinutes() === 0 ? c.text : c.muted,
                    fontSize: timeFontSize,
                    fontWeight: rowBase.getHours() % 4 === 0 && rowBase.getMinutes() === 0 ? '600' : '400',
                  }}>
                    {formatTimeLabel(rowBase)}
                  </Text>
                </View>
                {dayStarts.map((day, colIdx) => {
                  const cellTime = new Date(day);
                  cellTime.setHours(rowBase.getHours(), rowBase.getMinutes(), 0, 0);
                  const iso = cellTime.toISOString();
                  const isSelected = selected.has(iso);
                  const count = counts[iso] ?? 0;
                  const isHovered = hoveredSlot === iso;
                  const colors = getHeatColor(count, isSelected);
                  const isToday = day.toDateString() === new Date().toDateString();
                  const isPast = cellTime < new Date();
                  
                  return (
                    <Pressable
                      key={colIdx}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: isSelected }}
                      accessibilityLabel={`${
                        isSelected ? 'Selected' : 'Not selected'
                      } availability ${formatTimeLabel(cellTime)} ${dayLabelFull(day)}`}
                      onPress={() => handleCellInteraction(iso, isSelected, 'press')}
                      onPressIn={() => {
                        setIsDragging(true);
                        setDragMode(isSelected ? 'remove' : 'add');
                        handleCellInteraction(iso, isSelected, 'press');
                      }}
                      onHoverIn={() => handleCellInteraction(iso, isSelected, 'hover')}
                      onPressOut={() => {
                        setIsDragging(false);
                        setDragMode(null);
                      }}
                      disabled={isPast}
                      style={{
                        width: colWidth,
                        height: rowHeight,
                        borderWidth: isHovered ? 2 : 1,
                        borderColor: isHovered 
                          ? c.primary 
                          : (isToday ? `${c.primary}40` : colors.border),
                        backgroundColor: isPast 
                          ? (scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                          : colors.bg,
                        alignItems: 'center',
                        justifyContent: 'center',
                        position: 'relative',
                        opacity: isPast ? 0.4 : 1,
                        borderLeftWidth: colIdx === 0 ? 1 : 0,
                        borderLeftColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      }}
                    >
                      {/* Count badge */}
                      {count > 0 && !isSelected && (
                        <View style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          backgroundColor: 'rgba(59, 130, 246, 0.8)',
                          borderRadius: 8,
                          paddingHorizontal: 4,
                          paddingVertical: 1,
                          minWidth: 20,
                          alignItems: 'center',
                        }}>
                          <Text style={{ 
                            color: 'white', 
                            fontSize: 9, 
                            fontWeight: '700' 
                          }}>
                            {count}{memberCount ? `/${memberCount}` : ''}
                          </Text>
                        </View>
                      )}
                      
                      {/* Selected indicator */}
                      {isSelected && (
                        <View style={{
                          position: 'absolute',
                          top: 2,
                          left: 2,
                        }}>
                          <Ionicons name="checkmark-circle" size={16} color="white" />
                        </View>
                      )}
                      
                      {/* Today indicator */}
                      {isToday && rowBase.getHours() === new Date().getHours() && rowBase.getMinutes() <= new Date().getMinutes() + 30 && (
                        <View style={{
                          position: 'absolute',
                          bottom: 2,
                          left: '50%',
                          transform: [{ translateX: -4 }],
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: c.primary,
                        }} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}