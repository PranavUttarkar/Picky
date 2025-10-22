import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, useWindowDimensions } from 'react-native';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';

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
  return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${
    date.getMonth() + 1
  }/${date.getDate()}`;
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
  // Breakpoints: small < 900, medium < 1200, large >= 1200
  const bp = width < 900 ? 'sm' : width < 1200 ? 'md' : 'lg';
  const rowHeight = bp === 'lg' ? 40 : bp === 'md' ? 36 : 32;
  const vScrollRef = useRef<ScrollView | null>(null);
  const [didInitialScroll, setDidInitialScroll] = useState(false);

  // Responsive sizing: allocate a relative column width per day and a time-label gutter
  const timeLabelWidth = bp === 'lg' ? 84 : bp === 'md' ? 72 : 56;
  const visibleDays = Math.min(days, 7);
  const minCol = bp === 'lg' ? 180 : bp === 'md' ? 140 : 110;
  const colWidth = Math.max(minCol, Math.floor((width - timeLabelWidth) / visibleDays));
  const timeFontSize = bp === 'lg' ? 14 : bp === 'md' ? 12 : 11;

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

  const [isMouseDown, setIsMouseDown] = useState(false);
  const [dragMode, setDragMode] = useState<'add' | 'remove' | null>(null);

  const heatColor = (count: number): string => {
    if (!memberCount || !count) return 'transparent';
    const r = Math.max(0, Math.min(1, count / memberCount));
    // blend primary with transparent based on r
    // approximate by adjusting alpha; on native we can set rgba
    return `rgba(99, 102, 241, ${0.1 + 0.35 * r})`; // indigo-ish
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 8 }}
    >
      <View style={{ flexDirection: 'column' }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row' }}>
          {/* Corner spacer for time labels */}
          <View style={{ width: timeLabelWidth }} />
          {dayStarts.map((d, i) => (
            <View key={i} style={{ width: colWidth, paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: c.text, fontWeight: '800' }}>{dayLabel(d)}</Text>
            </View>
          ))}
        </View>

        {/* Grid */}
        <ScrollView
          ref={vScrollRef}
          showsVerticalScrollIndicator
          contentContainerStyle={{ paddingBottom: rowHeight * 2 + 24 }}
          onTouchEnd={() => {
            setIsMouseDown(false);
            setDragMode(null);
          }}
          onScrollEndDrag={() => {
            setIsMouseDown(false);
            setDragMode(null);
          }}
          onLayout={() => {
            if (didInitialScroll) return;
            const targetIdx = Math.max(
              0,
              Math.min(slotsPerDay - 1, Math.round((initialHour * 60) / slotMinutes)),
            );
            const y = targetIdx * rowHeight;
            try {
              vScrollRef.current?.scrollTo({ y, animated: false });
              setDidInitialScroll(true);
            } catch {}
          }}
        >
          {timeRows.map((rowBase, rowIdx) => (
            <View key={rowIdx} style={{ flexDirection: 'row' }}>
              {/* Time label */}
              <View
                style={{
                  width: timeLabelWidth,
                  paddingVertical: 8,
                  alignItems: 'flex-end',
                  paddingRight: 8,
                }}
              >
                <Text style={{ color: c.text, fontSize: timeFontSize }}>
                  {formatTimeLabel(rowBase)}
                </Text>
              </View>
              {dayStarts.map((day, colIdx) => {
                const cellTime = new Date(day);
                cellTime.setHours(rowBase.getHours(), rowBase.getMinutes(), 0, 0);
                const iso = cellTime.toISOString();
                const isSelected = selected.has(iso);
                const count = counts[iso] ?? 0;
                return (
                  <Pressable
                    key={colIdx}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isSelected }}
                    accessibilityLabel={`${
                      isSelected ? 'Selected' : 'Not selected'
                    } availability ${formatTimeLabel(cellTime)} ${dayLabel(day)}`}
                    onPress={() => onToggle(iso)}
                    onPressIn={() => {
                      setIsMouseDown(true);
                      setDragMode(isSelected ? 'remove' : 'add');
                    }}
                    onHoverIn={() => {
                      if (!isMouseDown || !dragMode) return;
                      const curr = selected.has(iso);
                      if ((dragMode === 'add' && !curr) || (dragMode === 'remove' && curr)) {
                        onToggle(iso);
                      }
                    }}
                    onPressOut={() => {
                      setIsMouseDown(false);
                      setDragMode(null);
                    }}
                    style={{
                      width: colWidth,
                      height: rowHeight,
                      borderWidth: 1,
                      borderColor: scheme === 'dark' ? '#000000a3' : '#0a0b0b20',
                      backgroundColor: isSelected ? c.accent : heatColor(count),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: c.text, fontSize: 12 }}>
                      {count > 0 ? `${count}${memberCount ? `/${memberCount}` : ''}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}
