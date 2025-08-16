// app/(tabs)/commuter/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, type ComponentProps } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config';

export const BASE_TABBAR_HEIGHT = Platform.OS === 'ios' ? 74 : 26;

/* ───────── visible routes ───────── */
const VISIBLE = [
  'dashboard',
  'route-schedules',
  'live-locations',
  'notifications',
  'my-receipts',
] as const;

const COLORS = {
  primary:    '#8B0000',
  accent:     '#FF6B35',
  secondary:  '#2E7D32',
  tertiary:   '#A0522D',
  background: '#FFFFFF',
  inactive:   '#9E9E9E',
  shadow:     'rgba(139,0,0,0.18)',
};

const TAB_CFG: Record<(typeof VISIBLE)[number], {
  on: ComponentProps<typeof Ionicons>['name'];
  off: ComponentProps<typeof Ionicons>['name'];
  tint: string;
}> = {
  'dashboard':        { on: 'home',            off: 'home-outline',            tint: COLORS.primary   },
  'route-schedules':  { on: 'calendar',        off: 'calendar-outline',        tint: COLORS.accent    },
  'live-locations':   { on: 'navigate',        off: 'navigate-outline',        tint: COLORS.secondary },
  'notifications':    { on: 'notifications',   off: 'notifications-outline',   tint: COLORS.accent    },
  'my-receipts':      { on: 'reader',          off: 'reader-outline',          tint: COLORS.tertiary  },
};

/* ───── animated icon ───── */
const AnimatedIcon = ({
  route,
  focused,
  showBadge = false,
}: {
  route: (typeof VISIBLE)[number];
  focused: boolean;
  showBadge?: boolean;
}) => {
  const cfg     = TAB_CFG[route];
  const scale   = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounce  = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale,  { toValue: focused ? 1.2 : 0.85, useNativeDriver: true, tension: 260, friction: 10 }),
      Animated.sequence([
        Animated.timing(bounce, { toValue: focused ? -10 : 0, duration: 180, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: focused ? -4 : 0,  useNativeDriver: true, tension: 260, friction: 9 }),
      ]),
      Animated.timing(glow,   { toValue: focused ? 1 : 0, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [focused]);

  return (
    <View style={styles.iconWrap}>
      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}10`,
            opacity: glow,
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.35] }) }],
          },
        ]}
      />
      <Animated.View style={{ transform: [{ scale }, { translateY: bounce }] }}>
        <Ionicons
          name={focused ? cfg.on : cfg.off}
          size={focused ? 28 : 22}
          color={focused ? cfg.tint : COLORS.inactive}
          style={styles.mainIcon}
        />
        {showBadge && <View style={styles.badgeDot} />}
      </Animated.View>
    </View>
  );
};

/* ───── simple Pressable-based tab button (untyped to avoid ref/style TS drama) ───── */
const TabButton = (props: any) => {
  const {
    children,
    style,
    android_ripple,
    onPress,
    onLongPress,
    onLayout,
    accessibilityRole,
    accessibilityState,
    testID,
  } = props;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      onLayout={onLayout}
      accessibilityRole={accessibilityRole}
      accessibilityState={accessibilityState}
      testID={testID}
      android_ripple={android_ripple}
      style={(pressedState) => [
        { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
        typeof style === 'function' ? style(pressedState) : style,
        pressedState.pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}
    >
      {children}
    </Pressable>
  );
};

/* ───── Main layout ───── */
export default function CommuterTabLayout() {
  const inset = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 74 : 96) + inset.bottom;

  const [notifUnread, setNotifUnread] = React.useState(false);
  const iconFor = (route: (typeof VISIBLE)[number]) =>
    ({ focused }: { focused: boolean }) => (
      <AnimatedIcon
        route={route}
        focused={focused}
        showBadge={route === 'notifications' && notifUnread}
      />
    );

  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;

    const check = async () => {
      try {
        const token = await AsyncStorage.getItem('@token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/commuter/announcements?limit=1`, { headers });
        if (!res.ok) return;
        const rows: Array<{ timestamp: string }> = await res.json();
        const latest = rows[0]?.timestamp;
        if (!latest) return;
        const seenStr = await AsyncStorage.getItem('@lastSeenAnnouncementTs');
        const seenMs = seenStr ? Date.parse(seenStr) : 0;
        const latestMs = Date.parse(latest);
        setNotifUnread(latestMs > seenMs);
      } catch {}
    };

    check();
    t = setInterval(check, 30_000);
    return () => { if (t) clearInterval(t); };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      NavigationBar.setPositionAsync('absolute').catch(() => {});
      NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
    }
  }, []);

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{ flex: 1, backgroundColor: COLORS.background }}
    >
      <Tabs
        // Keep this a lambda (not a typed FC) to satisfy the expected signature.
        tabBar={(props) => {
          const pruned = {
            ...props.state,
            routes: props.state.routes.filter((r) => VISIBLE.includes(r.name as any)),
            index: Math.max(0, VISIBLE.indexOf(props.state.routes[props.state.index].name as any)),
          };
          return <BottomTabBar {...props} state={pruned} />;
        }}
        // NOTE: Do NOT pass sceneContainerStyle; some versions of expo-router don't type it here.
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: BAR_H,
            paddingBottom: 10,
            paddingTop: 14,
            paddingHorizontal: 18,
            backgroundColor: COLORS.background,
            borderTopWidth: 0,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.18,
            shadowRadius: 16,
            elevation: 20,
            overflow: 'hidden',
          },
          tabBarItemStyle: {
            flex: 1,
            marginHorizontal: 8,
            borderRadius: 20,
            paddingVertical: 8,
          },
          tabBarButton: (btnProps) => {
            // Drop ref from props to avoid type mismatch with Pressable
            const { ref: _ignore, ...rest } = btnProps as any;
            return (
              <TabButton
                {...rest}
                android_ripple={{ color: `${COLORS.primary}20`, borderless: true, radius: 36 }}
              />
            );
          },
        }}
      >
        <Tabs.Screen name="dashboard"       options={{ tabBarIcon: iconFor('dashboard') }} />
        <Tabs.Screen name="route-schedules" options={{ tabBarIcon: iconFor('route-schedules') }} />
        <Tabs.Screen name="live-locations"  options={{ tabBarIcon: iconFor('live-locations') }} />
        <Tabs.Screen name="notifications"   options={{ tabBarIcon: iconFor('notifications') }} />
        <Tabs.Screen name="my-receipts"     options={{ tabBarIcon: iconFor('my-receipts') }} />

        {/* hidden routes under this tab group */}
        <Tabs.Screen name="receipt/[id]" options={{ href: null }} />
        <Tabs.Screen name="index"        options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  iconWrap:  { alignItems: 'center', justifyContent: 'center', width: 52, height: 60, position: 'relative' },
  glowBg:    { position: 'absolute', width: 52, height: 52, borderRadius: 26 },
  mainIcon:  { textAlign: 'center', zIndex: 10 },
  badgeDot: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF3B30',
    borderWidth: 2,
    borderColor: COLORS.background,
  },
});
