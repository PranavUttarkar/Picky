import { Tabs, usePathname } from 'expo-router';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { View, Text, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { useCallback, useMemo, useEffect } from 'react';
import { useSavedNotification } from '@/utils/SavedNotificationContext';

export default function TabsLayout() {
  const c = useThemeColors();
  const { toggleScheme, scheme } = useTheme();
  const pathname = usePathname();
  const { hasNewSavedItems, clearNotification } = useSavedNotification();

  // Clear notification when saved tab is accessed
  useEffect(() => {
    if (pathname === '/saved' && hasNewSavedItems) {
      clearNotification();
    }
  }, [pathname, hasNewSavedItems, clearNotification]);

  // Custom saved tab icon with notification dot
  const SavedTabIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => {
      return (
        <View style={{ position: 'relative' }}>
          <Ionicons name="bookmark" size={size} color={color} />
          {hasNewSavedItems && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#ef4444',
                zIndex: 1,
              }}
            />
          )}
        </View>
      );
    },
    [hasNewSavedItems],
  );

  const HeaderTitle = useCallback(
    () => (
      <Text
        style={{
          color: c.text,
          fontSize: 24,
          fontWeight: '900',
          // Use custom font if loaded globally
          // @ts-ignore - font may be loaded under this name
          fontFamily: 'Pacifico_400Regular',
        }}
      >
        Picky!
      </Text>
    ),
    [c.text],
  );

  const onShare = useCallback(async () => {
    try {
      const url = Linking.createURL(pathname || '/');
      try {
        await Clipboard.setStringAsync(url);
        Alert.alert('Link copied', 'Share this Picky link with friends.');
        return;
      } catch {}
      await Share.share({ message: url, url });
    } catch (e) {
      Alert.alert('Could not copy link');
    }
  }, [pathname]);

  const headerRight = useCallback(
    () => (
      <View style={{ flexDirection: 'row', gap: 12, marginRight: 8 }}>
        <Pressable onPress={toggleScheme} hitSlop={8}>
          <Ionicons name={scheme === 'dark' ? 'moon' : 'sunny'} size={22} color={c.text} />
        </Pressable>
      </View>
    ),
    [c.text, onShare, scheme, toggleScheme],
  );

  const screenOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: c.background },
      headerTitle: HeaderTitle,
      headerTitleAlign: 'left' as const,
      headerRight,
      tabBarStyle: { backgroundColor: c.card, borderTopColor: 'transparent' },
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: c.muted,
    }),
    [HeaderTitle, headerRight, c.background, c.card, c.primary, c.muted],
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home"
        options={{
          title: '',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: '',
          tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: '',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="groups/[id]" options={{ href: null }} />
      <Tabs.Screen name="polls/[id]" options={{ href: null }} />
      <Tabs.Screen name="polls/new" options={{ href: null }} />
      {/** decisions under tabs to preserve header/tab bar */}
      <Tabs.Screen name="decisions/[id]" options={{ href: null }} />
      <Tabs.Screen name="decisions/new" options={{ href: null }} />
      {/** hide Group Decide utility route from tab bar while keeping it navigable */}
      <Tabs.Screen name="group-decide" options={{ href: null }} />

      <Tabs.Screen
        name="saved"
        options={{
          title: '',
          tabBarIcon: SavedTabIcon,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
