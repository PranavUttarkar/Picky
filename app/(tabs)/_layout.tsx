import { Tabs, usePathname, router } from 'expo-router';
import { useTheme, useThemeColors } from '@/theme/ThemeProvider';
import { View, Text, Pressable, Platform, StyleSheet, Dimensions, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useMemo, useEffect, useState } from 'react';
import { useSavedNotification } from '@/utils/SavedNotificationContext';
import { useGroupDecisionNotification } from '@/utils/GroupDecisionNotificationContext';
import { useFriendNotification } from '@/utils/FriendNotificationContext';
import { trackCTA, trackEvent } from '@/utils/analytics';
import { Typography, Spacing, Colors, BorderRadius } from '@/theme/designTokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/services/supabase';

// Handshake icons
const handshakeMuted = require('@/assets/handshake/handshake_muted.png');
const handshakeMutedDark = require('@/assets/handshake/handshake_muted_dark.png');
const handshakeAccent = require('@/assets/handshake/handshake_accent.png');

// Separate component for center button to handle press state properly
function CenterPickButton({ onPress, bottom, scheme }: { onPress: () => void; bottom: number; scheme: 'light' | 'dark' }) {
  const [isPressed, setIsPressed] = useState(false);
  
  // Use dark muted icon for dark mode, light muted icon for light mode
  const mutedIcon = scheme === 'dark' ? handshakeMutedDark : handshakeMuted;
  
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      style={[
        styles.centerButton,
        {
          transform: [{ scale: isPressed ? 0.92 : 1 }],
          bottom: bottom,
        }
      ]}
      accessibilityRole="button"
      accessibilityLabel="Group Pick"
    >
      <Image
        source={isPressed ? handshakeAccent : mutedIcon}
        style={{ width: 46, height: 46 }}
        resizeMode="contain"
      />
    </Pressable>
  );
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Custom Tab Bar Component with raised center button
function CustomTabBar({ state, descriptors, navigation }: any) {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { hasNewSavedItems } = useSavedNotification();
  const { hasNewGroupDecisions } = useGroupDecisionNotification();
  const { hasNewFriends } = useFriendNotification();
  const [isOrganization, setIsOrganization] = useState(false);

  // Check if user is an organization account
  useEffect(() => {
    const checkAccountType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('users')
          .select('account_type')
          .eq('id', user.id)
          .single();
        setIsOrganization(profile?.account_type === 'organization');
      }
    };
    checkAccountType();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      checkAccountType();
    });

    return () => {
      try { sub.subscription.unsubscribe(); } catch {}
    };
  }, []);

  // Tab configuration - icons only, no labels
  const tabConfig: Record<string, { icon: string; activeIcon: string; label: string }> = {
    home: { icon: 'home-outline', activeIcon: 'home', label: 'Home' },
    discover: { icon: 'compass-outline', activeIcon: 'compass', label: 'Discover' },
    groups: { icon: 'people-outline', activeIcon: 'people', label: 'Social' },
    profile: { icon: 'person-outline', activeIcon: 'person', label: 'Profile' },
  };

  // Only render visible tabs
  const visibleRoutes = state.routes.filter((route: any) => 
    ['home', 'discover', 'groups', 'profile'].includes(route.name)
  );

  const TAB_BAR_HEIGHT = 95;
  const ICON_SIZE = 25;
  const CENTER_BUTTON_WIDTH = 100;
  const CENTER_BUTTON_HEIGHT = 25;
  const CURVE_HEIGHT = 18;

  const onPickPress = () => {
    trackCTA('pick_button_pressed').catch(() => {});
    router.push('/QuickPick');
  };

  const renderTabButton = (route: any, index: number) => {
    let isFocused = state.index === state.routes.findIndex((r: any) => r.name === route.name);
    // If organizer profile is active, treat Home tab as focused for organizer accounts
    if (route.name === 'home' && pathname && pathname.includes('organizer-profile')) {
      isFocused = true;
    }
    const config = tabConfig[route.name];
    
    if (!config) return null;

    const showDot = route.name === 'groups' 
      ? (hasNewGroupDecisions || hasNewFriends)
      : route.name === 'profile' 
        ? hasNewSavedItems 
        : false;

    const onPress = () => {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        // For organizer accounts, redirect home to organizer-profile
        if (route.name === 'home' && isOrganization) {
          router.push('/(tabs)/organizer-profile');
        } else {
          navigation.navigate(route.name);
        }
      }
    };

    return (
      <Pressable
        key={route.key}
        onPress={onPress}
        style={styles.tabButton}
        accessibilityRole="button"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={config.label}
      >
        <View style={{ position: 'relative' }}>
          <Ionicons
            name={(isFocused ? config.activeIcon : config.icon) as any}
            size={ICON_SIZE}
            color={isFocused ? c.primary : c.muted}
          />
          {showDot && (
            <View style={[styles.notificationDot, { backgroundColor: '#EF4444' }]} />
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.tabBarWrapper}>
      {/* Main tab bar container */}
      <View style={[
        styles.tabBarContainer,
        { 
          backgroundColor: scheme === 'dark' ? '#1a1a2e' : '#ffffff',
          height: TAB_BAR_HEIGHT,
          paddingBottom: insets.bottom,
        }
      ]}>
        {/* Wide curved background for center button - only shows top portion */}
        <View style={[
          styles.centerCurve,
          {
            backgroundColor: scheme === 'dark' ?  '#1a1a2e': '#ffffff',
            width: CENTER_BUTTON_WIDTH,
            height: CENTER_BUTTON_HEIGHT + CURVE_HEIGHT/2,
            borderTopLeftRadius: CENTER_BUTTON_WIDTH / 2,
            borderTopRightRadius: CENTER_BUTTON_WIDTH / 2,
            bottom: TAB_BAR_HEIGHT - CURVE_HEIGHT,
          }
        ]} />

        {/* Tab buttons container */}
        <View style={styles.tabButtonsRow}>
          {/* Left side tabs */}
          <View style={styles.tabGroup}>
            {visibleRoutes.slice(0, 2).map(renderTabButton)}
          </View>

          {/* Center spacer */}
          <View style={{ width: CENTER_BUTTON_WIDTH + 20 }} />

          {/* Right side tabs */}
          <View style={styles.tabGroup}>
            {visibleRoutes.slice(2, 4).map(renderTabButton)}
          </View>
        </View>
      </View>

      {/* Center Pick Icon - positioned on the curved background */}
      <CenterPickButton 
        onPress={onPickPress}
        bottom={TAB_BAR_HEIGHT - CURVE_HEIGHT - 25 + insets.bottom/3.5}
        scheme={scheme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        // On iOS, ensure the tab bar wrapper stays anchored to the bottom
        // by using a fixed position approach that respects the safe area
      },
    }),
  },
  tabBarContainer: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
      },
      web: {
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
      },
    }),
  },
  centerCurve: {
    position: 'absolute',
    alignSelf: 'center',
    left: '50%',
    marginLeft: -50,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 -2px 0 rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  tabButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    height: '100%',
  },
  tabGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-evenly',
  },
  tabButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  centerButton: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationDot: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

export default function TabsLayout() {
  const c = useThemeColors();
  const { scheme } = useTheme();
  const pathname = usePathname();
  const { hasNewSavedItems, clearNotification } = useSavedNotification();
  const { hasNewGroupDecisions, clearNotification: clearGroupDecisionNotification } =
    useGroupDecisionNotification();

  // Clear saved notification when profile tab is accessed
  useEffect(() => {
    if (pathname === '/profile' && hasNewSavedItems) {
      clearNotification();
    }
  }, [pathname, hasNewSavedItems, clearNotification]);

  // Track tab views
  useEffect(() => {
    if (!pathname) return;
    const p = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const tab = p.split('/')[0];
    const known = ['home', 'discover', 'groups', 'profile'];
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

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      tabBarStyle: { display: 'none' as const },
    }),
    [],
  );

  return (
    <Tabs
      screenOptions={screenOptions}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: 'Discover',
        }}
      />
      {/* Hidden routes for backwards compatibility */}
      <Tabs.Screen name="events" options={{ href: null }} />
      <Tabs.Screen name="food" options={{ href: null }} />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Social',
        }}
      />
      <Tabs.Screen name="groups/[id]" options={{ href: null }} />
      <Tabs.Screen name="polls/[id]" options={{ href: null }} />
      <Tabs.Screen name="polls/new" options={{ href: null }} />
      <Tabs.Screen name="decisions/[id]" options={{ href: null }} />
      <Tabs.Screen name="decisions/new" options={{ href: null }} />
      <Tabs.Screen name="group-decide" options={{ href: null }} />
      <Tabs.Screen name="groups/[id]/availability" options={{ href: null }} />
      <Tabs.Screen name="saved" options={{ href: null }} />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
        }}
      />
      <Tabs.Screen name="my-events" options={{ href: null }} />
      <Tabs.Screen name="my-rsvps" options={{ href: null }} />
    </Tabs>
  );
}
