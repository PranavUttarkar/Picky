import { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useThemeColors } from '@/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { reportEvent } from '@/services/reports';
import type { ReportReason } from '@/types/models';

interface ReportEventModalProps {
  visible: boolean;
  onClose: () => void;
  eventId: number;
  eventTitle: string;
}

const REPORT_REASONS: { value: ReportReason; label: string; description: string }[] = [
  {
    value: 'inappropriate',
    label: 'Inappropriate Content',
    description: 'Contains offensive, harmful, or inappropriate material',
  },
  {
    value: 'spam',
    label: 'Spam',
    description: 'Promotional content or repeated posts',
  },
  {
    value: 'misinformation',
    label: 'Misinformation',
    description: 'Contains false or misleading information',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Something else that violates our guidelines',
  },
];

export default function ReportEventModal({
  visible,
  onClose,
  eventId,
  eventTitle,
}: ReportEventModalProps) {
  const c = useThemeColors();
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Required', 'Please select a reason for reporting this event.');
      return;
    }

    setSubmitting(true);
    try {
      await reportEvent(eventId, selectedReason, description.trim() || null);
      Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.', [
        { text: 'OK', onPress: onClose },
      ]);
      // Reset form
      setSelectedReason(null);
      setDescription('');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    if (submitting) return;
    setSelectedReason(null);
    setDescription('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'flex-end',
        }}
      >
        <View
          style={{
            backgroundColor: c.background,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            maxHeight: '90%',
            paddingBottom: Platform.OS === 'ios' ? 34 : 16,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: c.muted + '30',
            }}
          >
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '700' }}>
              Report Event
            </Text>
            <Pressable onPress={handleClose} disabled={submitting} style={{ padding: 4 }}>
              <Ionicons name="close" size={24} color={c.text} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Event Info */}
            <View
              style={{
                backgroundColor: c.card,
                padding: 12,
                borderRadius: 12,
                marginBottom: 20,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>
                Reporting:
              </Text>
              <Text style={{ color: c.text, fontSize: 16, fontWeight: '600' }}>
                {eventTitle}
              </Text>
            </View>

            {/* Reason Selection */}
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', marginBottom: 12 }}>
              Why are you reporting this event?
            </Text>

            {REPORT_REASONS.map((reason) => (
              <Pressable
                key={reason.value}
                onPress={() => setSelectedReason(reason.value)}
                disabled={submitting}
                style={{
                  backgroundColor: c.card,
                  padding: 16,
                  borderRadius: 12,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor:
                    selectedReason === reason.value ? c.primary : 'transparent',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: selectedReason === reason.value ? c.primary : c.muted,
                      backgroundColor:
                        selectedReason === reason.value ? c.primary : 'transparent',
                      marginRight: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {selectedReason === reason.value && (
                      <Ionicons name="checkmark" size={12} color="#000" />
                    )}
                  </View>
                  <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', flex: 1 }}>
                    {reason.label}
                  </Text>
                </View>
                <Text
                  style={{
                    color: c.muted,
                    fontSize: 13,
                    marginLeft: 32,
                    lineHeight: 18,
                  }}
                >
                  {reason.description}
                </Text>
              </Pressable>
            ))}

            {/* Additional Details */}
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '600', marginTop: 8, marginBottom: 12 }}>
              Additional Details (Optional)
            </Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Provide any additional context that might help us review this report..."
              placeholderTextColor={c.muted}
              multiline
              numberOfLines={4}
              editable={!submitting}
              style={{
                backgroundColor: c.card,
                borderRadius: 12,
                padding: 16,
                color: c.text,
                fontSize: 15,
                minHeight: 100,
                textAlignVertical: 'top',
                borderWidth: 1,
                borderColor: c.muted + '30',
              }}
            />
          </ScrollView>

          {/* Footer */}
          <View
            style={{
              padding: 16,
              borderTopWidth: 1,
              borderTopColor: c.muted + '30',
              gap: 12,
            }}
          >
            <Pressable
              onPress={handleSubmit}
              disabled={!selectedReason || submitting}
              style={{
                backgroundColor: selectedReason && !submitting ? '#ef4444' : c.muted,
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: selectedReason && !submitting ? 1 : 0.6,
              }}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  Submit Report
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleClose}
              disabled={submitting}
              style={{
                paddingVertical: 12,
                alignItems: 'center',
                opacity: submitting ? 0.5 : 1,
              }}
            >
              <Text style={{ color: c.muted, fontSize: 15 }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}