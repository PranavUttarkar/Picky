import { Tabs, usePathname, router } from 'expo-router';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { View, Text, Pressable, Alert, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { useCallback, useMemo, useEffect } from 'react';
import { useSavedNotification } from '@/utils/SavedNotificationContext';
import { useGroupDecisionNotification } from '@/utils/GroupDecisionNotificationContext';
import { useFriendNotification } from '@/utils/FriendNotificationContext';
import { trackCTA, trackEvent } from '@/utils/analytics';
import { Typography, Spacing, IconSizes, Colors } from '@/theme/designTokens';

export default function TabsLayout() {
  const c = useThemeColors();
  const { toggleScheme, scheme } = useTheme();
  const pathname = usePathname();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Show header on tablets/web only
  const { hasNewSavedItems, clearNotification } = useSavedNotification();
  const { hasNewGroupDecisions, clearNotification: clearGroupDecisionNotification } =
    useGroupDecisionNotification();
  const { hasNewFriends } = useFriendNotification();

  // Clear saved notification when profile tab is accessed (badge moved to profile)
  useEffect(() => {
    if (pathname === '/profile' && hasNewSavedItems) {
      clearNotification();
    }
  }, [pathname, hasNewSavedItems, clearNotification]);

  // Track tab views explicitly (in addition to global screen_view)
  useEffect(() => {
    if (!pathname) return;
    const p = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const tab = p.split('/')[0];
    const known = ['home', 'events', 'food', 'groups', 'profile', 'saved', 'my-events'];
    if (known.includes(tab)) {
      trackEvent('tab_view', { tab }).catch(() => {});
    }
  }, [pathname]);

  // Clear notification when groups tab is accessed
  useEffect(() => {
    if (pathname === '/groups' && hasNewGroupDecisions) {
      clearGroupDecisionNotification();
    }
  }, [pathname, hasNewGroupDecisions, clearGroupDecisionNotification]);

  // Custom profile tab icon with saved-notification dot
  const ProfileTabIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => {
      return (
        <View style={{ position: 'relative' }}>
          <Ionicons name="person" size={size} color={color} />
          {hasNewSavedItems && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: Colors.light.accent.warning,
                zIndex: 1,
              }}
            />
          )}
        </View>
      );
    },
    [hasNewSavedItems],
  );

  // Custom social tab icon with notification dot
  const SocialTabIcon = useCallback(
    ({ color, size }: { color: string; size: number }) => {
      const showDot = hasNewGroupDecisions || hasNewFriends;
      return (
        <View style={{ position: 'relative' }}>
          <Ionicons name="people" size={size} color={color} />
          {showDot && (
            <View
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: Colors.light.accent.warning,
                zIndex: 1,
              }}
            />
          )}
        </View>
      );
    },
    [hasNewGroupDecisions, hasNewFriends],
  );

  const HeaderTitle = useCallback(
    () => (
      <Pressable
        onPress={() => {
          trackCTA('header_title_pressed').catch(() => {});
          router.push('/(tabs)/home');
        }}
        accessibilityRole="button"
        accessibilityLabel="Go to Home"
      >
        <Text
          style={{
            color: c.text,
            fontSize: Typography.scale.heading1.fontSize,
            lineHeight: Typography.scale.heading1.lineHeight,
            // Use brand font for logo
            // @ts-ignore - font may be loaded under this name
            fontFamily: Typography.fontFamily.brand,
            fontWeight: Typography.fontWeight.regular,
          }}
        >
          Picky!
        </Text>
      </Pressable>
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
      <View style={{ flexDirection: 'row', gap: Spacing.md - 4, marginRight: Spacing.sm }}>
        <Pressable
          onPress={() => {
            trackCTA('toggle_theme', { next: scheme === 'dark' ? 'light' : 'dark' }).catch(
              () => {},
            );
            toggleScheme();
          }}
          hitSlop={Spacing.sm}
        >
          <Ionicons name={scheme === 'dark' ? 'moon' : 'sunny'} size={IconSizes.medium} color={c.text} />
        </Pressable>
      </View>
    ),
    [c.text, onShare, scheme, toggleScheme],
  );

  const screenOptions = useMemo(
    () => ({
      headerShown: isLargeScreen,
      headerStyle: { backgroundColor: c.background },
      headerTitle: HeaderTitle,
      headerTitleAlign: 'left' as const,
      headerRight,
      tabBarStyle: { backgroundColor: c.card, borderTopColor: 'transparent' },
      tabBarActiveTintColor: c.primary,
      tabBarInactiveTintColor: c.muted,
    }),
    [HeaderTitle, headerRight, c.background, c.card, c.primary, c.muted, isLargeScreen, scheme], //Header hidden on small screens.
  );

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="home"
        options={{
          title: '',
          headerShown: false, // Hide header on home tab since it has its own custom header
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
        name="food"
        options={{
          title: '',
          tabBarIcon: ({ color, size }) => <Ionicons name="fast-food" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: '',
          tabBarIcon: SocialTabIcon,
        }}
      />
      <Tabs.Screen name="groups/[id]" options={{ href: null }} />
      <Tabs.Screen name="polls/[id]" options={{ href: null }} />
      <Tabs.Screen name="polls/new" options={{ href: null }} />
      {/** decisions under tabs to preserve header/tab bar */}
      <Tabs.Screen name="decisions/[id]" options={{ href: null }} />
      <Tabs.Screen name="decisions/new" options={{ href: null }} />
      {/** hide utility routes from tab bar while keeping it navigable */}
      <Tabs.Screen name="group-decide" options={{ href: null }} />
      <Tabs.Screen name="groups/[id]/availability" options={{ href: null }} />

      {/* Hide Saved tab from navbar but keep route navigable */}
      <Tabs.Screen name="saved" options={{ href: null }} />

      <Tabs.Screen
        name="profile"
        options={{
          title: '',
          tabBarIcon: ProfileTabIcon,
        }}
      />
      {/* Hidden route for viewing user's created events */}
      <Tabs.Screen name="my-events" options={{ href: null }} />
    </Tabs>
  );
}
