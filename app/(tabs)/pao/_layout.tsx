// app/(tabs)/pao/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import React, { useEffect } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeProvider, useBadge } from './badge-ctx';
import usePushToken from './usePushToken';

/* ───────── config ───────── */
const VISIBLE = [
  'dashboard',
  'route-schedule',
  'announcement',
  'passenger-log',
  'ticket-registration',
] as const;

const COLORS = {
  primary:    '#8B0000',
  accent:     '#FF6B35',
  secondary:  '#B8860B',
  tertiary:   '#A0522D',
  background: '#FFFFFF',
  inactive:   '#9E9E9E',
  shadow:     'rgba(139,0,0,0.18)',
};

const TAB_CFG: Record<
  (typeof VISIBLE)[number],
  { on: ComponentProps<typeof Ionicons>['name']; off: ComponentProps<typeof Ionicons>['name']; tint: string }
> = {
  dashboard:            { on: 'home',          off: 'home-outline',          tint: COLORS.primary   },
  'route-schedule':     { on: 'calendar',      off: 'calendar-outline',      tint: COLORS.accent    },
  announcement:         { on: 'notifications', off: 'notifications-outline', tint: COLORS.accent    },
  'passenger-log':      { on: 'people',        off: 'people-outline',        tint: COLORS.secondary },
  'ticket-registration':{ on: 'ticket',        off: 'ticket-outline',        tint: COLORS.tertiary  },
};

/* ───── animated icon with optional badge ───── */
const AnimatedPaoIcon = ({
  route, focused, badge = 0,
}: { route: (typeof VISIBLE)[number]; focused: boolean; badge?: number }) => {
  const cfg     = TAB_CFG[route];
  const scale   = React.useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounce  = React.useRef(new Animated.Value(0)).current;
  const glow    = React.useRef(new Animated.Value(0)).current;
  const shimmer = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.2 : 0.85, useNativeDriver: true, tension: 260, friction: 10 }),
      Animated.sequence([
        Animated.timing(bounce, { toValue: focused ? -12 : 0, duration: 200, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: focused ? -6 : 0, useNativeDriver: true, tension: 260, friction: 8 }),
      ]),
      Animated.timing(glow, { toValue: focused ? 1 : 0, duration: 320, useNativeDriver: true }),
    ]).start();

    if (focused) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      shimmer.setValue(0);
    }
  }, [focused]);

  return (
    <View style={styles.iconWrap}>
      {badge > 0 && (
        <View style={styles.countBadge}>
          <Animated.Text style={styles.countTxt} numberOfLines={1}>
            {badge > 99 ? '99+' : badge}
          </Animated.Text>
        </View>
      )}

      {focused && (
        <Animated.View
          style={[
            styles.outerGlow,
            {
              borderColor: `${cfg.tint}20`,
              opacity: shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.8, 0.3] }),
              transform: [{ scale: shimmer.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1.8] }) }],
            },
          ]}
        />
      )}

      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}08`,
            opacity: glow,
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.4] }) }],
          },
        ]}
      />

      {focused && (
        <Animated.View
          style={[
            styles.innerHighlight,
            {
              backgroundColor: `${cfg.tint}15`,
              opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
            },
          ]}
        />
      )}

      <Animated.View
        style={{
          transform: [
            { scale },
            { translateY: bounce },
            { rotateY: focused ? glow.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '8deg'] }) : '0deg' },
          ],
        }}
      >
        <Ionicons
          name={focused ? cfg.on : cfg.off}
          size={focused ? 28 : 22}
          color={focused ? cfg.tint : COLORS.inactive}
          style={[styles.mainIcon, { textShadowColor: focused ? `${cfg.tint}60` : 'transparent', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 8 }]}
        />
      </Animated.View>
    </View>
  );
};

const icon = (route: (typeof VISIBLE)[number]) =>
  ({ focused }: { focused: boolean }) => <AnimatedPaoIcon route={route} focused={focused} />;

const PassengerLogIcon = ({ focused }: { focused: boolean }) => {
  const { passengerLog } = useBadge();
  return <AnimatedPaoIcon route="passenger-log" focused={focused} badge={passengerLog} />;
};

type AndroidRippleProp = NonNullable<PressableProps['android_ripple']>;
const TabButton = React.forwardRef<View, BottomTabBarButtonProps & { android_ripple?: AndroidRippleProp }>(
  ({ children, onPress, onLongPress, accessibilityLabel, accessibilityState, testID, android_ripple }, ref) => (
    <Pressable
      ref={ref}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      testID={testID}
      android_ripple={android_ripple}
      style={({ pressed }) => [
        { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
        pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
      ]}
    >
      {children}
    </Pressable>
  )
);
TabButton.displayName = 'TabButton';

/* ---------- Layout ---------- */
export default function PaoLayout() {
  usePushToken();
  const inset = useSafeAreaInsets();

  // If device has gesture nav, inset.bottom > 0. If it’s 3‑button (overlay),
  // inset.bottom can be 0 and system bar may cover absolute elements.
  // Add a small fallback pad so our tab bar never sits under nav keys.
  const NAV_FALLBACK_PAD = Platform.OS === 'android' && inset.bottom === 0 ? 24 : 0;
  const ANDROID_TAB_H = 66 + inset.bottom + NAV_FALLBACK_PAD;
  const IOS_TAB_H = 74 + inset.bottom;

  const CustomBar = (props: any) => {
    const pruned = {
      ...props.state,
      routes: props.state.routes.filter((r: any) =>
        ['dashboard', 'route-schedule', 'announcement', 'passenger-log', 'ticket-registration'].includes(r.name)
      ),
      index: Math.max(
        0,
        ['dashboard', 'route-schedule', 'announcement', 'passenger-log', 'ticket-registration']
          .indexOf(props.state.routes[props.state.index].name)
      ),
    };
    return <BottomTabBar {...props} state={pruned} />;
  };

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        // Go immersive; swipe from edge to show the system bar temporarily.
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        // Transparent so our background shows during reveal.
        await NavigationBar.setBackgroundColorAsync('#00000000');
      } catch {
        // no-op
      }
    })();
  }, []);

  return (
    <BadgeProvider>
      {/* Include bottom edge so Safe Area (if any) is respected */}
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: COLORS.background }}>
        <Tabs
          tabBar={(props) => <CustomBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarHideOnKeyboard: true, // hide bar when typing
            tabBarStyle: {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: Platform.OS === 'ios' ? IOS_TAB_H : ANDROID_TAB_H,
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
            tabBarButton: (props: BottomTabBarButtonProps) => <TabButton {...props} />,
          }}
        >
          <Tabs.Screen name="dashboard" options={{ tabBarIcon: icon('dashboard') }} />
          <Tabs.Screen name="route-schedule" options={{ tabBarIcon: icon('route-schedule') }} />
          <Tabs.Screen name="announcement" options={{ tabBarIcon: icon('announcement') }} />
          <Tabs.Screen name="passenger-log" options={{ tabBarIcon: (p) => <PassengerLogIcon {...p} /> }} />
          <Tabs.Screen name="ticket-registration" options={{ tabBarIcon: icon('ticket-registration') }} />
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </SafeAreaView>
    </BadgeProvider>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  iconWrap:       { alignItems: 'center', justifyContent: 'center', width: 52, height: 60, position: 'relative' },
  glowBg:         { position: 'absolute', width: 50, height: 50, borderRadius: 25 },
  outerGlow:      { position: 'absolute', width: 76, height: 76, borderRadius: 38, borderWidth: 2 },
  innerHighlight: { position: 'absolute', width: 60, height: 60, borderRadius: 30 },
  mainIcon:       { textAlign: 'center', zIndex: 10 },
  countBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
  },
  countTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
