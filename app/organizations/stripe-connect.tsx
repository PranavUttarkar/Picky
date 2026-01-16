import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { Spacing } from '@/theme/designTokens';
import StripeConnectButton from '@/components/StripeConnectButton';
import HeaderSpacer from '@/components/HeaderSpacer';
import GradientHeader from '@/components/GradientHeader';
import { useRouter } from 'expo-router';

export default function StripeConnectScreen() {
  const c = useThemeColors();
  const router = useRouter();

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.background }}>
      <HeaderSpacer />
      <GradientHeader
        title="Stripe Connection"
        subtitle="Connect your Stripe account to sell tickets"
        onBack={() => router.back()}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
      >
        <View style={{ gap: Spacing.md }}>
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 12,
              padding: Spacing.md,
              gap: Spacing.sm,
            }}
          >
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>
              Why Connect Stripe?
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
              • Sell tickets directly through your events{'\n'}
              • Accept payments securely via Stripe{'\n'}
              • Manage ticket sales and revenue{'\n'}
              • Automatic RSVP when tickets are purchased{'\n'}
              • Support for multiple ticket tiers and early bird pricing
            </Text>
          </View>

          <StripeConnectButton
            onConnectionChange={() => {
              // Refresh or navigate back
              router.back();
            }}
          />

          <View
            style={{
              backgroundColor: c.card,
              borderRadius: 12,
              padding: Spacing.md,
              gap: Spacing.sm,
            }}
          >
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '700' }}>
              Test Mode
            </Text>
            <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>
              By default, Stripe connections use test mode. This allows you to test the ticket
              purchasing flow without processing real payments. Switch to live mode in your Stripe
              dashboard when you're ready to accept real payments.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
