import { useEffect } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';

export default function NewDecisionRedirect() {
  useEffect(() => {
    router.replace('/(tabs)/decisions/new');
  }, []);
  return <View />;
}
