import React, { useMemo, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
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
  const rowHeight = 44;
  const [dayIndex, setDayIndex] = useState(0);
  const [startIdx, setStartIdx] = useState(() =>
    Math.max(0, Math.min(slotsPerDay - 1, Math.round((initialHour * 60) / slotMinutes))),
  );
  const toggledDuringDrag = useRef<Set<number>>(new Set());
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);
  const [dragging, setDragging] = useState(false);
  const visibleRows = Math.min(20, slotsPerDay); // show ~10 hours (20 slots)
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

  const heatColor = (count: number): string => {
    if (!memberCount || !count) return 'transparent';
    const r = Math.max(0, Math.min(1, count / memberCount));
    return `rgba(99, 102, 241, ${0.1 + 0.35 * r})`;
  };

  const goPrev = () => setDayIndex((i) => Math.max(0, i - 1));
  const goNext = () => setDayIndex((i) => Math.min(days - 1, i + 1));

  return (
    <View style={{ flex: 1 }}>
      {/* Day navigation */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Pressable
          onPress={goPrev}
          disabled={dayIndex === 0}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          style={{ opacity: dayIndex === 0 ? 0.5 : 1, padding: 8 }}
        >
          <Ionicons name="chevron-back" size={18} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: c.text, fontWeight: '800' }}>{dayLongLabel(dayStart)}</Text>
        </View>
        <Pressable
          onPress={goNext}
          disabled={dayIndex === days - 1}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          style={{ opacity: dayIndex === days - 1 ? 0.5 : 1, padding: 8 }}
        >
          <Ionicons name="chevron-forward" size={18} color={c.text} />
        </Pressable>
      </View>

      {/* Vertical navigation for hours */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 }}>
        <Pressable
          onPress={() => setStartIdx((i) => Math.max(0, i - stepSlots))}
          accessibilityRole="button"
          accessibilityLabel="Scroll up by 1 hour"
          style={{ backgroundColor: c.card, padding: 8, borderRadius: 8 }}
        >
          <Ionicons name="chevron-up" size={18} color={c.text} />
        </Pressable>
        <Pressable
          onPress={() => setStartIdx((i) => Math.min(slotsPerDay - visibleRows, i + stepSlots))}
          accessibilityRole="button"
          accessibilityLabel="Scroll down by 1 hour"
          style={{ backgroundColor: c.card, padding: 8, borderRadius: 8 }}
        >
          <Ionicons name="chevron-down" size={18} color={c.text} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Text style={{ color: c.muted, fontSize: 12 }}>
          {formatTimeLabel(new Date(new Date(dayStart).setHours(0, startIdx * slotMinutes, 0, 0)))}
          {' - '}
          {formatTimeLabel(
            new Date(new Date(dayStart).setHours(0, (startIdx + visibleRows) * slotMinutes, 0, 0)),
          )}
        </Text>
      </View>

      {/* Slots list (no native scroll; supports drag selection) */}
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
        style={{ height: rowHeight * visibleRows }}
      >
        {Array.from({ length: visibleRows }).map((_, offset) => {
          const globalIdx = startIdx + offset;
          const slotTime = timeRows[globalIdx];
          const cellTime = new Date(dayStart);
          cellTime.setHours(slotTime.getHours(), slotTime.getMinutes(), 0, 0);
          const iso = cellTime.toISOString();
          const isSelected = selected.has(iso);
          const count = counts[iso] ?? 0;
          return (
            <View key={globalIdx} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{ width: 80, paddingVertical: 10, paddingRight: 8, alignItems: 'flex-end' }}
              >
                <Text style={{ color: c.muted, fontSize: 12 }}>{formatTimeLabel(cellTime)}</Text>
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
                  marginVertical: 6,
                  marginRight: 12,
                  height: rowHeight - 12,
                  borderWidth: 1,
                  borderColor: scheme === 'dark' ? '#00000075' : '#00000020',
                  backgroundColor: isSelected ? c.accent : heatColor(count),
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: c.text, fontSize: 12 }}>
                  {count > 0 ? `${count}${memberCount ? `/${memberCount}` : ''}` : ''}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
