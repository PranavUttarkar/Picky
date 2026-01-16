// Stripe Connect OAuth Callback Handler
// This screen handles the redirect from Stripe after OAuth authorization

import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useThemeColors } from '@/theme/ThemeProvider';
import { handleStripeConnectCallback } from '@/services/stripe';

export default function StripeCallback() {
  const c = useThemeColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string; state?: string; error?: string }>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // Check for error from Stripe
      if (params.error) {
        Alert.alert('Connection Failed', params.error, [
          { text: 'OK', onPress: () => router.replace('/organizations/stripe-connect') },
        ]);
        return;
      }

      // Check for authorization code
      if (!params.code || !params.state) {
        Alert.alert('Error', 'Missing authorization code', [
          { text: 'OK', onPress: () => router.replace('/organizations/stripe-connect') },
        ]);
        return;
      }

      // Exchange code for account
      await handleStripeConnectCallback(params.code, params.state);

      Alert.alert('Success', 'Stripe account connected successfully!', [
        { text: 'OK', onPress: () => router.replace('/organizations/stripe-connect') },
      ]);
    } catch (error: any) {
      console.error('Stripe callback error:', error);
      Alert.alert('Error', error?.message || 'Failed to connect Stripe account', [
        { text: 'OK', onPress: () => router.replace('/organizations/stripe-connect') },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: c.background }}>
        <ActivityIndicator size="large" color={c.primary} />
        <Text style={{ color: c.text, marginTop: 16 }}>Connecting Stripe account...</Text>
      </View>
    );
  }

  return null;
}
