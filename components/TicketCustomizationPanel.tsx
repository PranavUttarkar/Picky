import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import type { TicketCustomization } from '@/types/models';

interface TicketCustomizationPanelProps {
  customization: TicketCustomization | null;
  onSave: (customization: TicketCustomization) => Promise<void>;
  onCancel: () => void;
}

export default function TicketCustomizationPanel({
  customization,
  onSave,
  onCancel,
}: TicketCustomizationPanelProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();

  const [primaryColor, setPrimaryColor] = useState(customization?.primary_color || '#FF6F61');
  const [secondaryColor, setSecondaryColor] = useState(customization?.secondary_color || '#EEF2FF');
  const [accentColor, setAccentColor] = useState(customization?.accent_color || '#4F46E5');
  const [logoUrl, setLogoUrl] = useState(customization?.logo_url || '');
  const [ticketDesign, setTicketDesign] = useState<TicketCustomization['ticket_design']>(
    customization?.ticket_design || 'standard'
  );
  const [showOrganizerBranding, setShowOrganizerBranding] = useState(
    customization?.show_organizer_branding ?? true
  );

  const handleSave = async () => {
    try {
      await onSave({
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        accent_color: accentColor,
        logo_url: logoUrl || undefined,
        ticket_design: ticketDesign,
        show_organizer_branding: showOrganizerBranding,
      });
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save customization');
    }
  };

  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: BorderRadius.md,
        padding: Spacing.md,
        gap: Spacing.md,
      }}
    >
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '700', marginBottom: Spacing.sm }}>
        Ticket Customization
      </Text>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Primary Color
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: BorderRadius.sm,
              backgroundColor: primaryColor,
              borderWidth: 2,
              borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            }}
          />
          <TextInput
            value={primaryColor}
            onChangeText={setPrimaryColor}
            placeholder="#FF6F61"
            placeholderTextColor={c.muted}
            style={{
              flex: 1,
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: BorderRadius.sm,
              padding: Spacing.sm,
              color: c.text,
              fontSize: 14,
            }}
          />
        </View>
      </View>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Secondary Color
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: BorderRadius.sm,
              backgroundColor: secondaryColor,
              borderWidth: 2,
              borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            }}
          />
          <TextInput
            value={secondaryColor}
            onChangeText={setSecondaryColor}
            placeholder="#EEF2FF"
            placeholderTextColor={c.muted}
            style={{
              flex: 1,
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: BorderRadius.sm,
              padding: Spacing.sm,
              color: c.text,
              fontSize: 14,
            }}
          />
        </View>
      </View>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Accent Color
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' }}>
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: BorderRadius.sm,
              backgroundColor: accentColor,
              borderWidth: 2,
              borderColor: scheme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)',
            }}
          />
          <TextInput
            value={accentColor}
            onChangeText={setAccentColor}
            placeholder="#4F46E5"
            placeholderTextColor={c.muted}
            style={{
              flex: 1,
              backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
              borderRadius: BorderRadius.sm,
              padding: Spacing.sm,
              color: c.text,
              fontSize: 14,
            }}
          />
        </View>
      </View>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Logo URL (optional)
        </Text>
        <TextInput
          value={logoUrl}
          onChangeText={setLogoUrl}
          placeholder="https://..."
          placeholderTextColor={c.muted}
          style={{
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            borderRadius: BorderRadius.sm,
            padding: Spacing.sm,
            color: c.text,
            fontSize: 14,
          }}
        />
      </View>

      <View>
        <Text style={{ color: c.text, fontSize: 14, fontWeight: '600', marginBottom: 4 }}>
          Ticket Design
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          {(['standard', 'minimal', 'bold'] as const).map((design) => (
            <Pressable
              key={design}
              onPress={() => setTicketDesign(design)}
              style={{
                flex: 1,
                backgroundColor: ticketDesign === design ? c.primary : (scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                padding: Spacing.sm,
                borderRadius: BorderRadius.sm,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: ticketDesign === design ? '#000' : c.text,
                  fontSize: 12,
                  fontWeight: '600',
                  textTransform: 'capitalize',
                }}
              >
                {design}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm }}>
        <Pressable
          onPress={onCancel}
          style={{
            flex: 1,
            backgroundColor: scheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
            paddingVertical: 12,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: c.text, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={handleSave}
          style={{
            flex: 1,
            backgroundColor: c.primary,
            paddingVertical: 12,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#000', fontWeight: '700' }}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}
