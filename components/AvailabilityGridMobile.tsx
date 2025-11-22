import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
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
  const toggledDuringDrag = useRef<Set<number>>(new Set());
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);
  const [dragging, setDragging] = useState(false);
  const visibleRows = Math.min(14, slotsPerDay); // show ~7 hours (14 slots)
  const stepSlots = 12; // 1 hour per press

  const dayStart = useMemo(
    () => new Date(start.getTime() + dayIndex * 24 * 60 * 60 * 1000),
    [start.getTime(), dayIndex],
  );

  const timeRows = useMemo(() => {
    const arr: Date[] = [];
    const midnight = new Date(dayStart);
    midnight.setHours(0, 0, 0, 0);
    for (let i = 0; i < slotsPerDay; i++) {
      arr.push(new Date(midnight.getTime() + i * slotMinutes * 60 * 1000));
    }
    return arr;
  }, [dayStart.getTime(), slotMinutes, slotsPerDay]);

  // Enhanced heat map color
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
    
    if (ratio >= 0.8) {
      return {
        bg: 'rgba(59, 130, 246, 0.4)',
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

  const goPrev = () => setDayIndex((i) => Math.max(0, i - 1));
  const goNext = () => setDayIndex((i) => Math.min(days - 1, i + 1));

  return (
    <View style={{ flex: 1, backgroundColor: c.card, borderRadius: 16, overflow: 'hidden' }}>
      {/* Enhanced header with legend */}
      <View style={{
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
      }}>
        {/* Day navigation */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Pressable
            onPress={goPrev}
            disabled={dayIndex === 0}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
            style={{ 
              opacity: dayIndex === 0 ? 0.3 : 1, 
              padding: 8,
              backgroundColor: c.background,
              borderRadius: 10,
              marginRight: 12,
            }}
          >
            <Ionicons name="chevron-back" size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>
              {dayLongLabel(dayStart)}
            </Text>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>
              {formatTimeLabel(new Date(new Date(dayStart).setHours(0, startIdx * slotMinutes, 0, 0)))} - {formatTimeLabel(new Date(new Date(dayStart).setHours(0, (startIdx + visibleRows) * slotMinutes, 0, 0)))}
            </Text>
          </View>
          <Pressable
            onPress={goNext}
            disabled={dayIndex === days - 1}
            accessibilityRole="button"
            accessibilityLabel="Next day"
            style={{ 
              opacity: dayIndex === days - 1 ? 0.3 : 1, 
              padding: 8,
              backgroundColor: c.background,
              borderRadius: 10,
              marginLeft: 12,
            }}
          >
            <Ionicons name="chevron-forward" size={20} color={c.text} />
          </Pressable>
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: c.primary,
            }} />
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>
              Your selection
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              backgroundColor: 'rgba(59, 130, 246, 0.4)',
            }} />
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>
              High overlap
            </Text>
          </View>
        </View>
      </View>

      {/* Time navigation */}
      <View style={{ 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 12,
        backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
        borderBottomWidth: 1,
        borderBottomColor: scheme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
      }}>
        <Pressable
          onPress={() => setStartIdx((i) => Math.max(0, i - stepSlots))}
          accessibilityRole="button"
          accessibilityLabel="Scroll up by 1 hour"
          style={{ 
            backgroundColor: c.background, 
            padding: 10, 
            borderRadius: 10,
            marginRight: 8,
          }}
        >
          <Ionicons name="chevron-up" size={18} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => setStartIdx((i) => Math.min(slotsPerDay - visibleRows, i + stepSlots))}
          accessibilityRole="button"
          accessibilityLabel="Scroll down by 1 hour"
          style={{ 
            backgroundColor: c.background, 
            padding: 10, 
            borderRadius: 10,
          }}
        >
          <Ionicons name="chevron-down" size={18} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>
          {formatTimeLabel(new Date(new Date(dayStart).setHours(0, startIdx * slotMinutes, 0, 0)))}
          {' - '}
          {formatTimeLabel(
            new Date(new Date(dayStart).setHours(0, (startIdx + visibleRows) * slotMinutes, 0, 0)),
          )}
        </Text>
      </View>

      {/* Enhanced slots list */}
      <View
        onStartShouldSetResponder={() => true}
        onResponderGrant={(e) => {
          setDragging(true);
          toggledDuringDrag.current.clear();
          const y = e.nativeEvent.locationY;
          const localIdx = Math.floor(y / rowHeight);
          const idx = Math.max(0, Math.min(visibleRows - 1, localIdx));
          const globalIdx = startIdx + idx;
          const slotTime = timeRows[globalIdx];
          if (!slotTime) return;
          const cellTime = new Date(dayStart);
          cellTime.setHours(slotTime.getHours(), slotTime.getMinutes(), 0, 0);
          const iso = cellTime.toISOString();
          const initiallySelected = selected.has(iso);
          setDragMode(initiallySelected ? 'remove' : 'add');
          onToggle(iso);
          toggledDuringDrag.current.add(globalIdx);
        }}
        onResponderMove={(e) => {
          if (!dragging || !timeRows.length) return;
          const y = e.nativeEvent.locationY;
          const localIdx = Math.floor(y / rowHeight);
          const idx = Math.max(0, Math.min(visibleRows - 1, localIdx));
          const globalIdx = startIdx + idx;
          if (toggledDuringDrag.current.has(globalIdx)) return;
          const slotTime = timeRows[globalIdx];
          if (!slotTime) return;
          const cellTime = new Date(dayStart);
          cellTime.setHours(slotTime.getHours(), slotTime.getMinutes(), 0, 0);
          const iso = cellTime.toISOString();
          const isSelected = selected.has(iso);
          if ((dragMode === 'add' && !isSelected) || (dragMode === 'remove' && isSelected)) {
            onToggle(iso);
            toggledDuringDrag.current.add(globalIdx);
          }
        }}
        onResponderRelease={() => {
          setDragging(false);
          setDragMode(null);
          toggledDuringDrag.current.clear();
        }}
        style={{ 
          height: rowHeight * visibleRows,
          paddingVertical: 8,
        }}
      >
        {Array.from({ length: visibleRows }).map((_, offset) => {
          const globalIdx = startIdx + offset;
          const slotTime = timeRows[globalIdx];
          const cellTime = new Date(dayStart);
          cellTime.setHours(slotTime.getHours(), slotTime.getMinutes(), 0, 0);
          const iso = cellTime.toISOString();
          const isSelected = selected.has(iso);
          const count = counts[iso] ?? 0;
          const colors = getHeatColor(count, isSelected);
          const isPast = cellTime < new Date();
          const isCurrentHour = slotTime.getHours() === new Date().getHours() && 
                                slotTime.getMinutes() <= new Date().getMinutes() + 30;
          
          return (
            <View 
              key={globalIdx} 
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center',
                paddingHorizontal: 12,
                paddingVertical: 4,
              }}
            >
              <View
                style={{ 
                  width: 80, 
                  paddingVertical: 10, 
                  paddingRight: 12, 
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ 
                  color: slotTime.getHours() % 4 === 0 && slotTime.getMinutes() === 0 
                    ? c.text 
                    : c.muted,
                  fontSize: 13,
                  fontWeight: slotTime.getHours() % 4 === 0 && slotTime.getMinutes() === 0 
                    ? '600' 
                    : '400',
                }}>
                  {formatTimeLabel(cellTime)}
                </Text>
              </View>
              <View
                accessible
                accessibilityRole="switch"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={`${
                  isSelected ? 'Selected' : 'Not selected'
                } availability ${formatTimeLabel(cellTime)} on ${dayLongLabel(dayStart)}`}
                style={{
                  flex: 1,
                  marginVertical: 2,
                  height: rowHeight - 8,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? c.primary : colors.border,
                  backgroundColor: isPast 
                    ? (scheme === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                    : colors.bg,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'row',
                  gap: 8,
                  opacity: isPast ? 0.4 : 1,
                }}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color="white" />
                )}
                {count > 0 && (
                  <View style={{
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.2)' : 'rgba(59, 130, 246, 0.8)',
                    borderRadius: 10,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                  }}>
                    <Text style={{ 
                      color: 'white', 
                      fontSize: 11, 
                      fontWeight: '700' 
                    }}>
                      {count}{memberCount ? `/${memberCount}` : ''}
                    </Text>
                  </View>
                )}
                {isCurrentHour && !isPast && (
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: c.primary,
                  }} />
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}