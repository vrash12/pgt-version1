// app/(tabs)/manager/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import React from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ───────────── CONFIG ───────────── */
const VISIBLE = [
  'dashboard',
  'bus-status',
  'view-schedules',
  'route-insights',
  'ticket-sales',
] as const;

const COLORS = {
  primary:    '#1565C0',
  accent:     '#0288D1',
  secondary:  '#004BA0',
  background: '#FFFFFF',
  border:     '#E3F2FD',
  inactive:   '#9E9E9E',
  shadow:     'rgba(21,101,192,0.15)',
};

const TAB_CFG: Record<typeof VISIBLE[number], {
  on: ComponentProps<typeof Ionicons>['name'];
  off: ComponentProps<typeof Ionicons>['name'];
  tint: string;
}> = {
  dashboard       : { on: 'home',      off: 'home-outline',      tint: COLORS.primary },
  'bus-status'    : { on: 'bus',       off: 'bus-outline',       tint: COLORS.accent },
  'view-schedules': { on: 'calendar',  off: 'calendar-outline',  tint: COLORS.secondary },
  'route-insights': { on: 'pricetags', off: 'pricetags-outline', tint: COLORS.primary },
  'ticket-sales'  : { on: 'receipt',   off: 'receipt-outline',   tint: COLORS.accent },
};

/* ───────────── ENHANCED ANIMATED ICON ───────────── */
const AnimatedManagerIcon = ({
  route,
  focused,
}: {
  route: typeof VISIBLE[number];
  focused: boolean;
}) => {
  const cfg = TAB_CFG[route];
  const scaleAnim = React.useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounceAnim = React.useRef(new Animated.Value(0)).current;
  const glowAnim = React.useRef(new Animated.Value(0)).current;
  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.15 : 0.85,
        useNativeDriver: true,
        tension: 280,
        friction: 12,
      }),
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: focused ? -10 : 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: focused ? -5 : 0,
          useNativeDriver: true,
          tension: 280,
          friction: 8,
        }),
      ]),
      Animated.timing(glowAnim, {
        toValue: focused ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    if (focused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(0);
    }
  }, [focused]);

  return (
    <View style={styles.iconWrap}>
      {focused && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: `${cfg.tint}25`,
              opacity: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
            },
          ]}
        />
      )}

      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}12`,
            opacity: glowAnim,
            transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.3] }) }],
          },
        ]}
      />

      {focused && (
        <Animated.View
          style={[
            styles.innerRipple,
            {
              borderColor: `${cfg.tint}40`,
              opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.4] }) }],
            },
          ]}
        />
      )}

      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { translateY: bounceAnim },
            {
              rotate: focused
                ? (glowAnim as any).interpolate({ inputRange: [0, 1], outputRange: ['0deg', '5deg'] })
                : '0deg',
            },
          ],
        }}
      >
        <Ionicons
          name={focused ? cfg.on : cfg.off}
          size={focused ? 26 : 22}
          color={focused ? cfg.tint : COLORS.inactive}
          style={[
            styles.mainIcon,
            {
              textShadowColor: focused ? `${cfg.tint}50` : 'transparent',
              textShadowOffset: { width: 0, height: 3 },
              textShadowRadius: 6,
            },
          ]}
        />
      </Animated.View>

      {focused && (
        <>
          <Animated.View
            style={[
              styles.activeDot,
              {
                backgroundColor: cfg.tint,
                opacity: glowAnim,
                transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1.2] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseDot,
              {
                backgroundColor: cfg.tint,
                opacity: (pulseAnim as any).interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
                transform: [
                  { scale: (pulseAnim as any).interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) },
                ],
              },
            ]}
          />
        </>
      )}
    </View>
  );
};

const icon =
  (route: typeof VISIBLE[number]) =>
  ({ focused }: { focused: boolean }) =>
    <AnimatedManagerIcon route={route} focused={focused} />;
  const TabBarButtonInner = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  BottomTabBarButtonProps
>(({ onPress, onLongPress, accessibilityState, accessibilityLabel, testID, children }, ref) => {
  return (
    <Pressable
      ref={ref}
      android_ripple={{ color: '#1565C018', borderless: true, radius: 32 }}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityState={accessibilityState}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [
        { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
        pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
      ]}
    >
      {children}
    </Pressable>
  );
});
TabBarButtonInner.displayName = 'TabBarButtonInner';

const TabBarButton = TabBarButtonInner as unknown as React.ComponentType<BottomTabBarButtonProps>;

export default function ManagerLayout() {
  const inset = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 72 : 64) + inset.bottom;

  const CustomBar = (props: any) => {
    const pruned = {
      ...props.state,
      routes: props.state.routes.filter((r: any) => ['dashboard','bus-status','view-schedules','route-insights','ticket-sales'].includes(r.name)),
      index: Math.max(0, ['dashboard','bus-status','view-schedules','route-insights','ticket-sales'].indexOf(props.state.routes[props.state.index].name)),
    };
    return <BottomTabBar {...props} state={pruned} />;
  };
  return (
    <SafeAreaView style={styles.container}>
      <Tabs
        tabBar={CustomBar}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position: 'absolute',
            left: 0, right: 0, bottom: 0,
            height: BAR_H,
            paddingBottom: inset.bottom + 8,
            paddingTop: 12,
            paddingHorizontal: 16,
            backgroundColor: '#FFFFFF',
            borderTopWidth: 0,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor: 'rgba(21,101,192,0.15)',
            shadowOffset: { width: 0, height: -6 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 16,
            overflow: 'hidden',
          },
          tabBarItemStyle: { flex: 1, marginHorizontal: 6, borderRadius: 18, paddingVertical: 6 },
          tabBarButton: (props) => <TabBarButton {...props} />, // ✅ TS happy
        }}
      >
        <Tabs.Screen name="dashboard" options={{ tabBarIcon: icon('dashboard') }} />
        <Tabs.Screen name="bus-status" options={{ tabBarIcon: icon('bus-status') }} />
        <Tabs.Screen name="view-schedules" options={{ tabBarIcon: icon('view-schedules') }} />
        <Tabs.Screen name="route-insights" options={{ tabBarIcon: icon('route-insights') }} />
        <Tabs.Screen name="ticket-sales" options={{ tabBarIcon: icon('ticket-sales') }} />

        {/* hidden routes */}
        <Tabs.Screen name="index" options={{ href: null }} />

      </Tabs>
    </SafeAreaView>
  );
}

/* ─────────── STYLES ─────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 56,
    position: 'relative',
  },

  glowBg: { position: 'absolute', width: 48, height: 48, borderRadius: 24 },
  pulseRing: { position: 'absolute', width: 70, height: 70, borderRadius: 35, borderWidth: 2 },
  innerRipple: { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 1.5 },
  mainIcon: { textAlign: 'center', zIndex: 10 },
  activeDot: { position: 'absolute', bottom: 2, width: 8, height: 8, borderRadius: 4 },
  pulseDot: { position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2 },
});
