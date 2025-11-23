import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';
import { reportEvent } from '@/services/reports';
import type { ReportReason } from '@/types/models';
import HeaderSpacer from '@/components/HeaderSpacer';
import { BlurView } from 'expo-blur';
import { useColorScheme } from 'react-native';

interface ReportEventModalProps {
  visible: boolean;
  eventId: number;
  eventTitle: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate', label: 'Inappropriate Content' },
  { value: 'spam', label: 'Spam' },
  { value: 'misinformation', label: 'Misinformation' },
  { value: 'other', label: 'Other' },
];

export default function ReportEventModal({
  visible,
  eventId,
  eventTitle,
  onClose,
  onSuccess,
}: ReportEventModalProps) {
  const c = useThemeColors();
  const scheme = useColorScheme();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Required', 'Please select a reason for reporting this event');
      return;
    }

    setSubmitting(true);
    try {
      await reportEvent(eventId, selectedReason, description.trim() || null);
      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.', [
        {
          text: 'OK',
          onPress: () => {
            setSelectedReason(null);
            setDescription('');
            onClose();
            onSuccess?.();
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!submitting) {
      setSelectedReason(null);
      setDescription('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} transparent>
      <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <HeaderSpacer />
        <Pressable style={{ flex: 1 }} onPress={handleClose}>
          <View style={{ flex: 1 }} />
        </Pressable>
        <BlurView intensity={30} tint={scheme === 'dark' ? 'dark' : 'light'}>
          <View
            style={{
              backgroundColor: c.card,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
              maxHeight: '90%',
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ color: c.text, fontSize: 20, fontWeight: '800' }}>Report Event</Text>
              <Pressable onPress={handleClose} disabled={submitting} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={c.text} />
              </Pressable>
            </View>

            {/* Event Title */}
            <Text style={{ color: c.muted, fontSize: 14, marginBottom: 4 }}>Event:</Text>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 20 }}>{eventTitle}</Text>

            {/* Reason Selection */}
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Reason *</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {REPORT_REASONS.map((reason) => (
                <Pressable
                  key={reason.value}
                  onPress={() => setSelectedReason(reason.value)}
                  disabled={submitting}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: selectedReason === reason.value ? c.primary + '20' : '#00000010',
                    borderWidth: 1,
                    borderColor: selectedReason === reason.value ? c.primary : 'transparent',
                  }}
                >
                  <Ionicons
                    name={selectedReason === reason.value ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selectedReason === reason.value ? c.primary : c.muted}
                  />
                  <Text style={{ color: c.text, marginLeft: 12, fontSize: 15 }}>{reason.label}</Text>
                </Pressable>
              ))}
            </View>

            {/* Description */}
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Additional Details (Optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide any additional information..."
              placeholderTextColor={c.muted}
              multiline
              numberOfLines={4}
              editable={!submitting}
              style={{
                color: c.text,
                backgroundColor: '#00000010',
                borderRadius: 12,
                padding: 12,
                minHeight: 100,
                textAlignVertical: 'top',
                fontSize: 15,
                marginBottom: 20,
              }}
            />

            {/* Submit Button */}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting || !selectedReason}
              style={{
                backgroundColor: submitting || !selectedReason ? c.muted + '40' : c.primary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'row',
                gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Submitting...</Text>
                </>
              ) : (
                <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>Submit Report</Text>
              )}
            </Pressable>
          </View>
        </BlurView>
      </SafeAreaView>
    </Modal>
  );
}

