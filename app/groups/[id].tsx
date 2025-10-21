import { useEffect } from 'react';
import { useLocalSearchParams, router } from 'expo-router';

export default function LegacyGroupRouteRedirect() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  useEffect(() => {
    if (id) {
      router.replace(`/(tabs)/groups/${id}`);
    } else {
      router.replace('/(tabs)/groups');
    }
  }, [id]);
  return null;
}
