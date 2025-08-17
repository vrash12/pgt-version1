// app/(tabs)/pao/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Vibration,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeProvider, useBadge } from './badge-ctx';
import usePushToken from './usePushToken';

/* ───────── visible routes ───────── */
const VISIBLE = [
  'dashboard',
  'route-schedule',
  'announcement',
  'passenger-log',
  'ticket-registration',
] as const;

/* ───────── theme (adds glass + status colors to your palette) ───────── */
const COLORS = {
  primary:    '#8B0000',
  accent:     '#FF6B35',
  secondary:  '#B8860B',
  tertiary:   '#A0522D',
  success:    '#2E7D32',
  warning:    '#F57C00',
  background: '#FFFFFF',
  glass:      'rgba(255,255,255,0.85)',
  glassBorder:'rgba(139,0,0,0.12)',
  inactive:   '#9E9E9E',
  shadow:     'rgba(139,0,0,0.18)',
};

const TAB_CFG: Record<
  (typeof VISIBLE)[number],
  {
    on: ComponentProps<typeof Ionicons>['name'];
    off: ComponentProps<typeof Ionicons>['name'];
    tint: string;
    magneticColor: string;
    statusIndicator?: 'online' | 'warning' | 'offline';
  }
> = {
  dashboard:            { on:'home',          off:'home-outline',          tint: COLORS.primary,   magneticColor:'#8B000015', statusIndicator:'online'  },
  'route-schedule':     { on:'calendar',      off:'calendar-outline',      tint: COLORS.accent,    magneticColor:'#FF6B3515', statusIndicator:'online'  },
  announcement:         { on:'notifications', off:'notifications-outline', tint: COLORS.accent,    magneticColor:'#FF6B3515', statusIndicator:'online'  },
  'passenger-log':      { on:'people',        off:'people-outline',        tint: COLORS.secondary, magneticColor:'#B8860B15', statusIndicator:'warning' },
  'ticket-registration':{ on:'ticket',        off:'ticket-outline',        tint: COLORS.tertiary,  magneticColor:'#A0522D15', statusIndicator:'offline' },
};

/* ───────── magnetic icon (manager-style) with numeric badge ───────── */
const MagneticPaoIcon = ({
  route, focused, badge = 0,
}: {
  route: (typeof VISIBLE)[number];
  focused: boolean;
  badge?: number;
}) => {
  const cfg = TAB_CFG[route];

  const scaleAnim   = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounceAnim  = useRef(new Animated.Value(0)).current;
  const glowAnim    = useRef(new Animated.Value(0)).current;
  const magnetic    = useRef(new Animated.Value(0)).current;
  const rotation    = useRef(new Animated.Value(0)).current;
  const ripple      = useRef(new Animated.Value(0)).current;
  const statusPulse = useRef(new Animated.Value(0)).current;
  const orbital     = useRef(new Animated.Value(0)).current;

  const [isMagnetic, setIsMagnetic] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: focused ? 1.25 : 0.85, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: focused ? -12 : 0, duration: 200, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: focused ? -6 : 0, useNativeDriver: true, tension: 300, friction: 10 }),
      ]),
      Animated.timing(glowAnim, { toValue: focused ? 1 : 0, duration: 350, useNativeDriver: true }),
      Animated.timing(rotation, { toValue: focused ? 1 : 0, duration: 400, useNativeDriver: true }),
    ]).start();

    if (focused) {
      const orb = Animated.loop(Animated.timing(orbital, { toValue: 1, duration: 4000, useNativeDriver: true }));
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(statusPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]));
      orb.start(); pulse.start();
      return () => { orb.stop(); pulse.stop(); };
    } else {
      orbital.setValue(0);
      statusPulse.setValue(0);
    }
  }, [focused]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(magnetic, { toValue: isMagnetic ? 1 : 0, useNativeDriver: true, tension: 400, friction: 8 }),
      Animated.timing(ripple, { toValue: isMagnetic ? 1 : 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [isMagnetic]);

  const onDown = () => { setIsMagnetic(true); if (Platform.OS === 'ios') Vibration.vibrate(40); };
  const onUp   = () => setIsMagnetic(false);

  const statusColor =
    cfg.statusIndicator === 'online'  ? COLORS.success :
    cfg.statusIndicator === 'warning' ? COLORS.warning :
    COLORS.inactive;

  return (
    <View style={styles.iconContainer}>
      {/* numeric badge */}
      {badge > 0 && (
        <View style={styles.countBadge}>
          <Animated.Text style={styles.countTxt} numberOfLines={1}>
            {badge > 99 ? '99+' : badge}
          </Animated.Text>
        </View>
      )}

      {/* magnetic field */}
      <Animated.View
        style={[
          styles.magneticField,
          {
            backgroundColor: cfg.magneticColor,
            opacity: magnetic.interpolate({ inputRange:[0,1], outputRange:[0, 0.8] }),
            transform: [{ scale: magnetic.interpolate({ inputRange:[0,1], outputRange:[0.8, 2.2] }) }],
          },
        ]}
      />

      {/* orbital particles */}
      {focused && (
        <>
          {[0,1,2].map(i => (
            <Animated.View
              key={i}
              style={[
                styles.orbitalParticle,
                {
                  backgroundColor: cfg.tint,
                  transform: [
                    { rotate: orbital.interpolate({ inputRange:[0,1], outputRange:[`${i*120}deg`, `${360 + i*120}deg`] }) },
                    { translateX: 30 },
                    { rotate: orbital.interpolate({ inputRange:[0,1], outputRange:[`${-i*120}deg`, `${-360 - i*120}deg`] }) },
                  ],
                },
              ]}
            />
          ))}
        </>
      )}

      {/* ripple */}
      <Animated.View
        style={[
          styles.rippleEffect,
          {
            borderColor: cfg.tint,
            opacity: magnetic.interpolate({ inputRange:[0,1], outputRange:[0, 0.6] }),
            transform: [{ scale: ripple.interpolate({ inputRange:[0,1], outputRange:[1, 3] }) }],
          },
        ]}
      />

      {/* glow bg */}
      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}15`,
            opacity: glowAnim,
            transform: [{ scale: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0.8, 1.4] }) }],
          },
        ]}
      />

      {/* glass layer */}
      {focused && (
        <Animated.View
          style={[
            styles.glassMorph,
            {
              opacity: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0, 0.9] }),
              transform: [{ scale: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0.6, 1.2] }) }],
            },
          ]}
        />
      )}

      {/* main icon */}
      <Animated.View
        onTouchStart={onDown}
        onTouchEnd={onUp}
        style={{
          transform: [
            { scale: scaleAnim },
            { translateY: bounceAnim },
            { rotateY: rotation.interpolate({ inputRange:[0,1], outputRange:['0deg', '10deg'] }) },
            { rotateZ: magnetic.interpolate({ inputRange:[0,1], outputRange:['0deg', '3deg'] }) },
          ],
        }}
      >
        <Ionicons
          name={focused ? cfg.on : cfg.off}
          size={focused ? 28 : 22}
          color={focused ? cfg.tint : COLORS.inactive}
          style={styles.mainIcon}
        />
      </Animated.View>

      {/* status dots */}
      {focused && (
        <>
          <Animated.View
            style={[
              styles.activeDot,
              {
                backgroundColor: statusColor,
                opacity: glowAnim,
                transform: [{ scale: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0, 1.4] }) }],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseDot,
              {
                backgroundColor: cfg.tint,
                opacity: statusPulse.interpolate({ inputRange:[0,1], outputRange:[0.4, 0] }),
                transform: [{ scale: statusPulse.interpolate({ inputRange:[0,1], outputRange:[1, 3] }) }],
              },
            ]}
          />
        </>
      )}
    </View>
  );
};

/* per-tab icon renderers */
const icon = (route: (typeof VISIBLE)[number]) =>
  ({ focused }: { focused: boolean }) => <MagneticPaoIcon route={route} focused={focused} />;

const PassengerLogIcon = ({ focused }: { focused: boolean }) => {
  const { passengerLog } = useBadge();
  return <MagneticPaoIcon route="passenger-log" focused={focused} badge={passengerLog} />;
};

/* ───────── enhanced tab button (press + haptic) ───────── */
const EnhancedTabButton = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  BottomTabBarButtonProps
>(({ onPress, onLongPress, accessibilityState, accessibilityLabel, testID, children }, ref) => {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const haptic    = useRef(new Animated.Value(0)).current;

  const handleIn = () => {
    Animated.parallel([
      Animated.spring(pressAnim, { toValue: 0.92, useNativeDriver: true, tension: 400, friction: 8 }),
      Animated.timing(haptic, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    if (Platform.OS === 'ios') Vibration.vibrate(30);
  };
  const handleOut = () => {
    Animated.parallel([
      Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 400, friction: 8 }),
      Animated.timing(haptic, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <Pressable
        ref={ref}
        android_ripple={{ color: '#8B000020', borderless: true, radius: 35, foreground: true }}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handleIn}
        onPressOut={handleOut}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          styles.enhancedButton,
          pressed && Platform.OS === 'ios' && { opacity: 0.85, transform: [{ scale: 0.96 }] },
        ]}
      >
        <Animated.View
          style={[
            styles.hapticRing,
            {
              opacity: haptic.interpolate({ inputRange:[0,1], outputRange:[0, 0.3] }),
              transform: [{ scale: haptic.interpolate({ inputRange:[0,1], outputRange:[1, 1.8] }) }],
            },
          ]}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
});
EnhancedTabButton.displayName = 'EnhancedTabButton';

/* ───────── glass morphic tab bar shell ───────── */
const GlassMorphicTabBar = (props: any) => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => setIsScrolling(Math.abs(value) > 10));
    return () => scrollY.removeListener(listener);
  }, []);

  return (
    <Animated.View
      style={[
        styles.glassTabBar,
        {
          backgroundColor: isScrolling ? COLORS.glass : COLORS.background,
          borderTopColor: isScrolling ? COLORS.glassBorder : 'transparent',
        },
      ]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
};

/* ---------- Layout ---------- */
export default function PaoLayout() {
  usePushToken();
  const insets = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 74 : 78) + insets.bottom;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    (async () => {
      try {
        await NavigationBar.setVisibilityAsync('hidden');
        await NavigationBar.setBehaviorAsync('overlay-swipe');
        await NavigationBar.setBackgroundColorAsync('#00000000');
      } catch {}
    })();
  }, []);

  const CustomBar = (props: any) => {
    const pruned = {
      ...props.state,
      routes: props.state.routes.filter((r: any) => VISIBLE.includes(r.name as any)),
      index: Math.max(0, VISIBLE.indexOf(props.state.routes[props.state.index].name as any)),
    };
    return <GlassMorphicTabBar {...props} state={pruned} />;
  };

  return (
    <BadgeProvider>
      <SafeAreaView style={styles.container}>
        <Tabs
          tabBar={CustomBar}
          screenOptions={{
            headerShown: false,
            tabBarShowLabel: false,
            tabBarHideOnKeyboard: true,
            tabBarStyle: {
              position: 'absolute',
              left: 8,
              right: 8,
              bottom: 8,
              height: BAR_H,
              paddingBottom: insets.bottom + 12,
              paddingTop: 16,
              paddingHorizontal: 20,
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              borderRadius: 32,
              shadowColor: COLORS.shadow,
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.25,
              shadowRadius: 20,
              elevation: 25,
              overflow: 'visible',
            },
            tabBarItemStyle: {
              flex: 1,
              marginHorizontal: 4,
              borderRadius: 22,
              paddingVertical: 8,
              overflow: 'visible',
            },
            tabBarButton: (props) => <EnhancedTabButton {...props} />,
          }}
        >
          <Tabs.Screen name="dashboard"            options={{ tabBarIcon: icon('dashboard') }} />
          <Tabs.Screen name="route-schedule"       options={{ tabBarIcon: icon('route-schedule') }} />
          <Tabs.Screen name="announcement"         options={{ tabBarIcon: icon('announcement') }} />
          <Tabs.Screen name="passenger-log"        options={{ tabBarIcon: (p) => <PassengerLogIcon {...p} /> }} />
          <Tabs.Screen name="ticket-registration"  options={{ tabBarIcon: icon('ticket-registration') }} />
          {/* hidden */}
          <Tabs.Screen name="profile" options={{ href: null }} />
        </Tabs>
      </SafeAreaView>
    </BadgeProvider>
  );
}

/* ---------- styles ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // icon stack
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 64,
    position: 'relative',
    overflow: 'visible',
  },
  mainIcon: { textAlign: 'center', zIndex: 10 },

  // numeric badge
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

  // magnetic field / particles / ripple / glow / glass
  magneticField: { position: 'absolute', width: 60, height: 60, borderRadius: 30, zIndex: 1 },
  orbitalParticle:{ position: 'absolute', width: 4, height: 4, borderRadius: 2, zIndex: 2 },
  rippleEffect:   { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1, zIndex: 3 },
  glowBg:         { position: 'absolute', width: 52, height: 52, borderRadius: 26, zIndex: 4 },
  glassMorph:     { position: 'absolute', width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', zIndex: 5 },

  // status dots
  activeDot: { position: 'absolute', bottom: 4, width: 10, height: 10, borderRadius: 5, zIndex: 6 },
  pulseDot:  { position: 'absolute', bottom: 6, width: 6, height: 6, borderRadius: 3, zIndex: 7 },

  // glass tab shell
  glassTabBar: {
    borderTopWidth: 1,
    backdropFilter: 'blur(20px)' as any, // web-only, ignored on native
    borderRadius: 32,
  },

  // enhanced button
  enhancedButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'visible',
    position: 'relative',
  },
  hapticRing: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: COLORS.primary },
});
