import React, { useState } from 'react';
import { Platform, View, Text, Pressable, TextInput } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import dayjs from 'dayjs';

interface Props {
  value: string | null; // ISO string or null
  onChange: (iso: string | null) => void;
  colorPalette: {
    text: string;
    muted: string;
    card: string;
    background: string;
    primary: string;
  };
}

// A small extracted component to pick a deadline date & time (UTC naive -> ISO) or clear it.
// Web: two controlled text inputs (date YYYY-MM-DD, time HH:mm) for maximum reliability.
// Native: sequential date and time pickers triggered by press.
export const PollDeadlinePicker: React.FC<Props> = ({ value, onChange, colorPalette: c }) => {
  const current = value ? dayjs(value) : null;
  const [showDate, setShowDate] = useState(false);
  const [showTime, setShowTime] = useState(false);

  const dateStr = current ? current.format('YYYY-MM-DD') : '';
  const timeStr = current ? current.format('HH:mm') : '';

  const apply = (d: dayjs.Dayjs | null, t: dayjs.Dayjs | null) => {
    // Combine date (d) and time (t) components (if provided) else keep existing parts
    const base = current ?? dayjs();
    const datePart = d ?? base;
    const timePart = t ?? base;
    const combined = datePart
      .hour(timePart.hour())
      .minute(timePart.minute())
      .second(0)
      .millisecond(0);
    onChange(combined.toISOString());
  };

  const clear = () => onChange(null);

  if (Platform.OS === 'web') {
    return (
      <View style={{ marginTop: 16 }}>
        <Text style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>
          Deadline (optional)
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <TextInput
            placeholder="YYYY-MM-DD"
            value={dateStr}
            onChangeText={(txt) => {
              if (/^\d{4}-\d{2}-\d{2}$/.test(txt)) {
                const parts = txt.split('-').map(Number);
                const dt = dayjs(value ?? undefined)
                  .year(parts[0])
                  .month(parts[1] - 1)
                  .date(parts[2]);
                if (timeStr) {
                  const [hh, mm] = timeStr.split(':').map(Number);
                  onChange(dt.hour(hh).minute(mm).second(0).millisecond(0).toISOString());
                } else {
                  onChange(dt.hour(23).minute(59).second(0).millisecond(0).toISOString());
                }
              } else if (txt === '') {
                onChange(null);
              }
            }}
            style={{
              borderWidth: 1,
              borderColor: c.background,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              minWidth: 140,
              backgroundColor: c.card,
              color: c.text,
            }}
          />
          <TextInput
            placeholder="HH:mm"
            value={timeStr}
            onChangeText={(txt) => {
              if (/^\d{2}:\d{2}$/.test(txt)) {
                const [hh, mm] = txt.split(':').map(Number);
                const base = current ?? dayjs();
                const applied = base.hour(hh).minute(mm).second(0).millisecond(0);
                onChange(applied.toISOString());
              } else if (txt === '') {
                // keep date but remove time -> set to 23:59 for end-of-day semantics
                if (current) {
                  onChange(current.hour(23).minute(59).second(0).millisecond(0).toISOString());
                }
              }
            }}
            style={{
              borderWidth: 1,
              borderColor: c.background,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderRadius: 8,
              minWidth: 100,
              backgroundColor: c.card,
              color: c.text,
            }}
          />
          <Pressable
            onPress={() => {
              if (!current) {
                const base = dayjs().add(1, 'day').hour(23).minute(59).second(0).millisecond(0);
                onChange(base.toISOString());
              } else clear();
            }}
            style={{
              backgroundColor: c.background,
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: c.text, fontWeight: '700' }}>
              {current ? 'Clear' : 'Set +1d'}
            </Text>
          </Pressable>
        </View>
        {current ? (
          <Text style={{ color: c.muted, marginTop: 6 }}>
            Closes {current.toDate().toLocaleString()}
          </Text>
        ) : (
          <Text style={{ color: c.muted, marginTop: 6 }}>No deadline set.</Text>
        )}
      </View>
    );
  }

  // Native platforms
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ color: c.text, fontWeight: '700', marginBottom: 8 }}>Deadline (optional)</Text>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Pressable
          onPress={() => setShowDate(true)}
          style={{
            backgroundColor: c.card,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: c.text }}>{dateStr || 'Pick date'}</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowTime(true)}
          disabled={!current}
          style={{
            backgroundColor: c.card,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
            opacity: current ? 1 : 0.5,
          }}
        >
          <Text style={{ color: c.text }}>{timeStr || 'Pick time'}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!current) {
              const base = dayjs().add(1, 'day').hour(23).minute(59).second(0).millisecond(0);
              onChange(base.toISOString());
            } else clear();
          }}
          style={{
            backgroundColor: c.background,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderRadius: 10,
          }}
        >
          <Text style={{ color: c.text, fontWeight: '700' }}>{current ? 'Clear' : 'Set +1d'}</Text>
        </Pressable>
      </View>
      {current ? (
        <Text style={{ color: c.muted, marginTop: 6 }}>
          Closes {current.toDate().toLocaleString()}
        </Text>
      ) : (
        <Text style={{ color: c.muted, marginTop: 6 }}>No deadline set.</Text>
      )}
      {showDate && (
        <DateTimePicker
          value={current?.toDate() ?? dayjs().add(1, 'day').toDate()}
          mode="date"
          display="default"
          onChange={(_, d) => {
            setShowDate(false);
            if (d) {
              const picked = dayjs(d);
              if (!current) {
                // default to end of day
                const end = picked.hour(23).minute(59).second(0).millisecond(0);
                onChange(end.toISOString());
              } else {
                const updated = current
                  .year(picked.year())
                  .month(picked.month())
                  .date(picked.date());
                onChange(updated.toISOString());
              }
            }
          }}
        />
      )}
      {showTime && (
        <DateTimePicker
          value={current?.toDate() ?? dayjs().toDate()}
          mode="time"
          display="default"
          onChange={(_, d) => {
            setShowTime(false);
            if (d) {
              const picked = dayjs(d);
              if (!current) {
                onChange(picked.second(0).millisecond(0).toISOString());
              } else {
                const updated = current.hour(picked.hour()).minute(picked.minute());
                onChange(updated.toISOString());
              }
            }
          }}
        />
      )}
    </View>
  );
};

export default PollDeadlinePicker;
