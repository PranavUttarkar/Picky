import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

export default function DecisionRedirect() {
  const { id, code } = useLocalSearchParams<{ id: string; code?: string }>();
  useEffect(() => {
    const q = code ? `?code=${code}` : '';
    router.replace(`/(tabs)/decisions/${id}${q}`);
  }, [id, code]);
  return <View />;
}
