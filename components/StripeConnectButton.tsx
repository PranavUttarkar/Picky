import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, useTheme } from '@/theme/ThemeProvider';
import { BorderRadius, Spacing } from '@/theme/designTokens';
import { createStripeConnectLink, disconnectStripeAccount, getOrganizationStripeAccount, isStripeConnected } from '@/services/stripe';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';

interface StripeConnectButtonProps {
  onConnectionChange?: () => void;
}

export default function StripeConnectButton({ onConnectionChange }: StripeConnectButtonProps) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isTestMode, setIsTestMode] = useState(true);

  useEffect(() => {
    loadConnectionStatus();
  }, []);

  const loadConnectionStatus = async () => {
    setLoading(true);
    try {
      const account = await getOrganizationStripeAccount();
      setConnected(account !== null && account.stripe_account_status === 'active');
      setIsTestMode(account?.is_test_mode ?? true);
    } catch (err) {
      console.error('Failed to load Stripe connection status:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const oauthUrl = await createStripeConnectLink(isTestMode);
      
      // Open in browser
      const result = await WebBrowser.openBrowserAsync(oauthUrl, {
        showTitle: true,
        enableBarCollapsing: false,
      });

      if (result.type === 'success') {
        // Check if we got redirected back with a code
        // In a real implementation, you'd handle the OAuth callback
        Alert.alert(
          'Connection Started',
          'Please complete the Stripe onboarding process. You will be redirected back when done.',
          [{ text: 'OK' }]
        );
        // Reload status after a delay
        setTimeout(() => {
          loadConnectionStatus();
          onConnectionChange?.();
        }, 2000);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to connect Stripe account');
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert(
      'Disconnect Stripe',
      'Are you sure you want to disconnect your Stripe account? You will not be able to sell tickets until you reconnect.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              await disconnectStripeAccount();
              setConnected(false);
              onConnectionChange?.();
              Alert.alert('Disconnected', 'Your Stripe account has been disconnected');
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to disconnect Stripe account');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={{ padding: Spacing.md, alignItems: 'center' }}>
        <ActivityIndicator size="small" color={c.primary} />
      </View>
    );
  }

  return (
    <View style={{ gap: Spacing.sm }}>
      {connected && (
        <View
          style={{
            backgroundColor: scheme === 'dark' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.1)',
            padding: Spacing.md,
            borderRadius: BorderRadius.md,
            borderLeftWidth: 3,
            borderLeftColor: '#22c55e',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>
              Stripe Connected {isTestMode && '(Test Mode)'}
            </Text>
          </View>
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
            You can now create ticketed events and sell tickets.
          </Text>
        </View>
      )}

      {connected ? (
        <Pressable
          onPress={handleDisconnect}
          style={{
            backgroundColor: '#ff444420',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#ff4444', fontWeight: '700', fontSize: 14 }}>
            Disconnect Stripe
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={handleConnect}
          disabled={connecting}
          style={({ pressed }) => ({
            backgroundColor: connecting
              ? '#6b7280'
              : pressed
              ? `${c.primary}dd`
              : c.primary,
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: BorderRadius.md,
            alignItems: 'center',
            opacity: connecting ? 0.6 : 1,
          })}
        >
          {connecting ? (
            <ActivityIndicator size="small" color="#000" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="card" size={20} color="#000" />
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>
                Connect Stripe Account
              </Text>
            </View>
          )}
        </Pressable>
      )}

      {!connected && (
        <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center', marginTop: 4 }}>
          Connect your Stripe account to start selling tickets for your events
        </Text>
      )}
    </View>
  );
}
