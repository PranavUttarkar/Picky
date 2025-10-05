import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/theme/ThemeProvider';

export const GroupsBenefitsEmptyState: React.FC = () => {
  const c = useThemeColors();

  return (
    <View style={{ paddingTop: 24, paddingHorizontal: 8 }}>
      <Text
        style={{
          color: c.text,
          fontSize: 20,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 16,
        }}
      >
        Join Your First Group!
      </Text>
      <Text
        style={{
          color: c.muted,
          textAlign: 'center',
          marginBottom: 24,
          fontSize: 16,
        }}
      >
        Groups unlock the full Picky experience
      </Text>

      {/* Benefits List */}
      <View style={{ gap: 16, marginBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              backgroundColor: c.primary,
              padding: 8,
              borderRadius: 8,
            }}
          >
            <Ionicons name="people" size={20} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>
              Create Polls & Decisions
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              Vote with friends on events, restaurants, and activities
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              backgroundColor: c.primary,
              padding: 8,
              borderRadius: 8,
            }}
          >
            <Ionicons name="heart" size={20} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>
              Personalized Recommendations
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              Get events that match your group's vibe and preferences.
            </Text>
          </View>
        </View>

        {/* <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View
            style={{
              backgroundColor: c.primary,
              padding: 8,
              borderRadius: 8,
            }}
          >
            <Ionicons name="chatbubbles" size={20} color="#000" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>
              Social Decision Making
            </Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              Never wonder "what should we do?" again
            </Text>
          </View>
        </View> */}
      </View>
    </View>
  );
};
