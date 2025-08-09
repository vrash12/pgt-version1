// app/(tabs)/commuter/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type ComponentProps,
  type ForwardedRef,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

/* ───────── config ───────── */
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

const TAB_CFG: Record<typeof VISIBLE[number], {
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

/* ───── animated icon (same vibe as PAO) ───── */
const AnimatedIcon = ({
  route,
  focused,
}: {
  route: typeof VISIBLE[number];
  focused: boolean;
}) => {
  const cfg     = TAB_CFG[route];
  const scale   = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounce  = useRef(new Animated.Value(0)).current;
  const glow    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: focused ? 1.2 : 0.85, useNativeDriver: true, tension: 260, friction: 10 }),
      Animated.sequence([
        Animated.timing(bounce, { toValue: focused ? -10 : 0, duration: 180, useNativeDriver: true }),
        Animated.spring(bounce, { toValue: focused ? -4 : 0,  useNativeDriver: true, tension: 260, friction: 9 }),
      ]),
      Animated.timing(glow, { toValue: focused ? 1 : 0, duration: 280, useNativeDriver: true }),
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
      </Animated.View>
    </View>
  );
};

const icon = (route: typeof VISIBLE[number]) =>
  ({ focused }: { focused: boolean }) => <AnimatedIcon route={route} focused={focused} />;

/* ───── custom TabBarButton (ripple + press feedback) ───── */
const TabButton = React.forwardRef(
  (
    { android_ripple, ...rest }: any,
    ref: ForwardedRef<View>
  ) => (
    <Pressable
      ref={ref}
      android_ripple={android_ripple}
      {...rest}
      style={({ pressed }) => [
        { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
        pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
      ]}
    />
  )
);

/* ───── Main layout ───── */
export default function CommuterTabLayout() {
  const inset = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 74 : 66) + inset.bottom;

  // Hide Android system nav bar (requires a dev build with expo-navigation-bar)
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      NavigationBar.setPositionAsync('absolute').catch(() => {});
      NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
    }
  }, []);

  // Trim to only visible tabs (defensive)
  const CustomBar = (props: any) => {
    const pruned = {
      ...props.state,
      routes: props.state.routes.filter((r: any) => VISIBLE.includes(r.name as any)),
      index: Math.max(0, VISIBLE.indexOf(props.state.routes[props.state.index].name as any)),
    };
    return <BottomTabBar {...props} state={pruned} />;
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <Tabs
        tabBar={CustomBar}
        // keep this OUTSIDE screenOptions to avoid TS error
        sceneContainerStyle={{ backgroundColor: COLORS.background }}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: BAR_H,
            paddingBottom: 10,            // only visual padding; BAR_H already includes inset
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
          tabBarButton: (props) => (
            <TabButton
              {...props}
              android_ripple={{ color: `${COLORS.primary}20`, borderless: true, radius: 36 }}
            />
          ),
        }}
      >
        <Tabs.Screen name="dashboard"       options={{ tabBarIcon: icon('dashboard') }} />
        <Tabs.Screen name="route-schedules" options={{ tabBarIcon: icon('route-schedules') }} />
        <Tabs.Screen name="live-locations"  options={{ tabBarIcon: icon('live-locations') }} />
        <Tabs.Screen name="notifications"   options={{ tabBarIcon: icon('notifications') }} />
        <Tabs.Screen name="my-receipts"     options={{ tabBarIcon: icon('my-receipts') }} />

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
});
