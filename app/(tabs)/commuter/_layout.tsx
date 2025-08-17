// app/(tabs)/commuter/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomTabBar, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import * as NavigationBar from 'expo-navigation-bar';
import { Tabs } from 'expo-router';
import React, { useEffect, useRef, useState, type ComponentProps } from 'react';
import type { PressableProps } from 'react-native';
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
import { API_BASE_URL } from '../../config';

export const BASE_TABBAR_HEIGHT = Platform.OS === 'ios' ? 74 : 78;

/* ───────── Visible routes ───────── */
const VISIBLE = [
  'dashboard',
  'route-schedules',
  'live-locations',
  'notifications',
  'my-receipts',
] as const;

/* ───────── Theme ───────── */
const COLORS = {
  primary:    '#8B0000',
  accent:     '#FF6B35',
  secondary:  '#2E7D32',
  tertiary:   '#A0522D',
  success:    '#2E7D32',
  warning:    '#F57C00',
  background: '#FFFFFF',

  glass: 'rgba(235, 255, 240, 0.75)',
  glassBlur: 'rgba(225, 255, 235, 0.85)',
  glassBorder: 'rgba(185, 225, 195, 0.3)',
  glassHighlight: 'rgba(255, 255, 255, 0.6)',
  glassDepth: 'rgba(105, 155, 115, 0.1)',

  border:     '#FCE4E4',
  inactive:   '#9E9E9E',
  shadow:     'rgba(139,0,0,0.18)',
};

const TAB_CFG: Record<(typeof VISIBLE)[number], {
  on: ComponentProps<typeof Ionicons>['name'];
  off: ComponentProps<typeof Ionicons>['name'];
  tint: string;
  magneticColor: string;
  statusIndicator?: 'online'|'warning'|'offline';
}> = {
  'dashboard':        { on:'home',          off:'home-outline',          tint: COLORS.primary,   magneticColor:'#8B000015', statusIndicator:'online'  },
  'route-schedules':  { on:'calendar',      off:'calendar-outline',      tint: COLORS.accent,    magneticColor:'#FF6B3515', statusIndicator:'online'  },
  'live-locations':   { on:'navigate',      off:'navigate-outline',      tint: COLORS.secondary, magneticColor:'#2E7D3215', statusIndicator:'warning' },
  'notifications':    { on:'notifications', off:'notifications-outline', tint: COLORS.accent,    magneticColor:'#FF6B3515', statusIndicator:'online'  },
  'my-receipts':      { on:'reader',        off:'reader-outline',        tint: COLORS.tertiary,  magneticColor:'#A0522D15', statusIndicator:'offline' },
};

/* ───────── Icon (stacking fixed) ───────── */
const MagneticCommuterIcon = ({
  route,
  focused,
  showBadge = false,
}: {
  route: (typeof VISIBLE)[number];
  focused: boolean;
  showBadge?: boolean;
}) => {
  const cfg = TAB_CFG[route];

  const scaleAnim     = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounceAnim    = useRef(new Animated.Value(0)).current;
  const glowAnim      = useRef(new Animated.Value(0)).current;
  const magneticAnim  = useRef(new Animated.Value(0)).current;
  const rotationAnim  = useRef(new Animated.Value(0)).current;
  const rippleAnim    = useRef(new Animated.Value(0)).current;
  const statusPulse   = useRef(new Animated.Value(0)).current;
  const orbitalAnim   = useRef(new Animated.Value(0)).current;
  const glassReflectionAnim = useRef(new Animated.Value(0)).current;

  const [isMagnetic, setIsMagnetic] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: focused ? 1.25 : 0.85, useNativeDriver: true, tension: 300, friction: 8 }),
      Animated.sequence([
        Animated.timing(bounceAnim, { toValue: focused ? -12 : 0, duration: 200, useNativeDriver: true }),
        Animated.spring(bounceAnim, { toValue: focused ? -6 : 0, useNativeDriver: true, tension: 300, friction: 10 }),
      ]),
      Animated.timing(glowAnim, { toValue: focused ? 1 : 0, duration: 350, useNativeDriver: true }),
      Animated.timing(rotationAnim, { toValue: focused ? 1 : 0, duration: 400, useNativeDriver: true }),
    ]).start();

    if (focused) {
      const orbital = Animated.loop(Animated.timing(orbitalAnim, { toValue: 1, duration: 4000, useNativeDriver: true }));
      const pulse   = Animated.loop(Animated.sequence([
        Animated.timing(statusPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(statusPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]));
      const reflection = Animated.loop(
        Animated.sequence([
          Animated.timing(glassReflectionAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(glassReflectionAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      );
      orbital.start(); pulse.start(); reflection.start();
      return () => { orbital.stop(); pulse.stop(); reflection.stop(); };
    } else {
      orbitalAnim.setValue(0);
      statusPulse.setValue(0);
      glassReflectionAnim.setValue(0);
    }
  }, [focused]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(magneticAnim, { toValue: isMagnetic ? 1 : 0, useNativeDriver: true, tension: 400, friction: 8 }),
      Animated.timing(rippleAnim, { toValue: isMagnetic ? 1 : 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [isMagnetic]);

  const handlePressIn = () => { setIsMagnetic(true); if (Platform.OS === 'ios') Vibration.vibrate(40); };
  const handlePressOut = () => setIsMagnetic(false);

  const statusColor =
    cfg.statusIndicator === 'online'  ? COLORS.success :
    cfg.statusIndicator === 'warning' ? COLORS.warning :
    COLORS.inactive;

  return (
    <View style={styles.iconContainer}>
      {/* Decorative layers (non-interactive, underneath) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.magneticField,
          {
            backgroundColor: cfg.magneticColor,
            opacity: magneticAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] }),
            transform: [{ scale: magneticAnim.interpolate({ inputRange:[0,1], outputRange:[0.8, 2.2] }) }],
          },
        ]}
      />

      {focused && (
        <>
          {[0,1,2].map(i => (
            <Animated.View
              pointerEvents="none"
              key={i}
              style={[
                styles.orbitalParticle,
                {
                  backgroundColor: cfg.tint,
                  transform: [
                    { rotate: orbitalAnim.interpolate({ inputRange:[0,1], outputRange:[`${i*120}deg`, `${360 + i*120}deg`] }) },
                    { translateX: 30 },
                    { rotate: orbitalAnim.interpolate({ inputRange:[0,1], outputRange:[`${-i*120}deg`, `${-360 - i*120}deg`] }) },
                  ],
                },
              ]}
            />
          ))}
        </>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.rippleEffect,
          {
            borderColor: cfg.tint,
            opacity: rippleAnim.interpolate({ inputRange:[0,1], outputRange:[0, 0.6] }),
            transform: [{ scale: rippleAnim.interpolate({ inputRange:[0,1], outputRange:[1, 3] }) }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}15`,
            opacity: glowAnim,
            transform: [{ scale: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0.8, 1.4] }) }],
          },
        ]}
      />

      {focused && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glassMorph,
              {
                opacity: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0, 0.9] }),
                transform: [{ scale: glowAnim.interpolate({ inputRange:[0,1], outputRange:[0.6, 1.2] }) }],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.glassDepth,
              {
                opacity: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] }),
                transform: [{ scale: glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }],
              },
            ]}
          />
        </>
      )}

      {/* ICON LAYER ON TOP */}
      <Animated.View
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
        style={[
          styles.iconTop,
          {
            transform: [
              { scale: scaleAnim },
              { translateY: bounceAnim },
              { rotateY: rotationAnim.interpolate({ inputRange:[0,1], outputRange:['0deg', '10deg'] }) },
              { rotateZ: magneticAnim.interpolate({ inputRange:[0,1], outputRange:['0deg', '3deg'] }) },
            ],
          },
        ]}
      >
        <Ionicons
          name={focused ? cfg.on : cfg.off}
          size={focused ? 28 : 22}
          color={focused ? cfg.tint : COLORS.inactive}
        />
        {showBadge && <View style={styles.badgeDot} />}
      </Animated.View>

      {/* status dots */}
      {focused && (
        <>
          <Animated.View
            pointerEvents="none"
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
            pointerEvents="none"
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

/* ───────── Debug helpers ───────── */
const TAB_DEBUG = __DEV__;
const pretty = (obj: any, space = 2) => { try { return JSON.stringify(obj, null, space); } catch { return String(obj); } };

function validateTabs(props: any, label = 'CommuterTabBar') {
  const { state, descriptors } = props;
  const routeNames = state.routes.map((r: any) => r.name);
  const routeKeys  = state.routes.map((r: any) => r.key);

  const missing = routeKeys.filter((k: string) => !descriptors[k]);
  const badIndex = state.index < 0 || state.index >= state.routes.length;

  if (TAB_DEBUG) {
    console.log(`[${label}] routes:`, routeNames);
    console.log(`[${label}] keys:`, routeKeys);
    console.log(`[${label}] index:`, state.index, 'focused route:', state.routes[state.index]?.name);
    if (missing.length) {
      console.warn(`[${label}] ❌ descriptors missing for keys:`, missing);
      console.warn(`[${label}] descriptors keys:`, Object.keys(descriptors));
    }
    if (badIndex) {
      console.warn(`[${label}] ❌ bad state.index=${state.index} for routes.length=${state.routes.length}`);
    }
  }

  return {
    hasProblem: !!(missing.length || badIndex),
    missingKeys: missing,
    badIndex,
    dump: { routeNames, routeKeys, index: state.index, descriptorKeys: Object.keys(descriptors) },
  };
}

const DebugBanner = ({ text }: { text: string }) => (
  <View style={{
    position: 'absolute', top: -22, left: 0, right: 0, paddingHorizontal: 8, height: 22,
    backgroundColor: 'rgba(220,0,0,0.85)', justifyContent: 'center', zIndex: 9999, borderTopLeftRadius: 12, borderTopRightRadius: 12
  }}>
    <Animated.Text style={{ color: '#fff', fontSize: 11 }} numberOfLines={1}>{text}</Animated.Text>
  </View>
);

class DebugBoundary extends React.Component<{ propsForChild: any; children?: React.ReactNode }, { error?: Error; info?: any }> {
  constructor(p: any) { super(p); this.state = {}; }
  componentDidCatch(error: Error, info: any) {
    console.error('[CommuterTabBar] render error:', error, info);
    this.setState({ error, info });
  }
  render() {
    if (!this.state.error) return this.props.children as any;
    const { state, navigation } = this.props.propsForChild || {};
    return (
      <View style={{ padding: 8, backgroundColor: '#400', borderRadius: 16 }}>
        <Animated.Text style={{ color: '#fff', fontWeight: '700', marginBottom: 6 }}>
          TabBar crashed: {String(this.state.error?.message || this.state.error)}
        </Animated.Text>
        <Animated.Text style={{ color: '#ffdddd', fontSize: 11 }} numberOfLines={3}>
          {String(this.state.info?.componentStack || '')}
        </Animated.Text>
        {state ? (
          <View style={{ flexDirection: 'row', padding: 8, backgroundColor: '#330000', borderRadius: 16 }}>
            {state.routes.map((r: any, i: number) => {
              const focused = state.index === i;
              return (
                <Pressable
                  key={r.key}
                  onPress={() => navigation.navigate(r.name)}
                  style={{
                    flex: 1, paddingVertical: 10, marginHorizontal: 4, borderRadius: 12,
                    backgroundColor: focused ? '#AA0000' : '#550000', alignItems: 'center'
                  }}
                >
                  <Animated.Text style={{ color: 'white', fontSize: 12 }}>{r.name}</Animated.Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }
}

/* ───────── Tab filter ───────── */
function filterTabs(props: any, visible: readonly string[]) {
  const { state, descriptors } = props;
  const keptIdx = state.routes
    .map((r: any, i: number) => (visible.includes(r.name) ? i : -1))
    .filter((i: number) => i !== -1);

  const routes = keptIdx.map((i: number) => state.routes[i]);
  const newIndexInKept = keptIdx.indexOf(state.index);
  const index = newIndexInKept >= 0 ? newIndexInKept : 0;
  const newState = { ...state, routes, index };

  const newDescriptors: Record<string, any> = {};
  keptIdx.forEach((i: number) => {
    const key = state.routes[i].key;
    newDescriptors[key] = descriptors[key];
  });

  return { ...props, state: newState, descriptors: newDescriptors };
}

/* ───────── Tab bar shell (FIXED) ───────── */
const GlassMorphicTabBar = (rawProps: any) => {
  const check = validateTabs(rawProps, 'CommuterTabBar');

  const scrollY = useRef(new Animated.Value(0)).current;
  const glassShineAnim = useRef(new Animated.Value(0)).current;
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => setIsScrolling(Math.abs(value) > 10));
    const shineAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glassShineAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(glassShineAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    shineAnimation.start();
    return () => { scrollY.removeListener(listener); shineAnimation.stop(); };
  }, []);

  return (
    // IMPORTANT: Apply rawProps.style so RN gives us size/position!
    <View style={[styles.glassTabBarContainer, rawProps.style]} pointerEvents="box-none">
      {check.hasProblem && (
        <DebugBanner
          text={`TabBar mismatch – missing desc: ${check.missingKeys.length}, badIndex: ${check.badIndex} (see Metro logs)`}
        />
      )}

      {/* Background glass layers BELOW */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.glassBase]} />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.glassShine,
          {
            opacity: glassShineAnim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.6] }),
            transform: [{ translateX: glassShineAnim.interpolate({ inputRange: [0, 1], outputRange: [-100, 100] }) }],
          },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFillObject,
          styles.glassOverlay,
          { backgroundColor: isScrolling ? COLORS.glassBlur : COLORS.glass, borderTopColor: COLORS.glassBorder },
        ]}
      />

      {/* Real BottomTabBar ABOVE backgrounds */}
      <DebugBoundary propsForChild={rawProps}>
        <View style={{ zIndex: 10, elevation: 10 }}>
          <BottomTabBar
            {...rawProps}
            // Make the default bar transparent; we provide our own background.
            style={[{ backgroundColor: 'transparent', borderTopWidth: 0 }]}
          />
        </View>
      </DebugBoundary>
    </View>
  );
};

type TabBtnProps = BottomTabBarButtonProps & { route?: string };

function EnhancedTabButton({
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityLabel,
  testID,
  children,
  ...rest
}: TabBtnProps) {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const haptic    = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(pressAnim, { toValue: 0.92, useNativeDriver: true, tension: 400, friction: 8 }),
      Animated.timing(haptic, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    if (Platform.OS === 'ios') Vibration.vibrate(30);
  };
  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressAnim, { toValue: 1, useNativeDriver: true, tension: 400, friction: 8 }),
      Animated.timing(haptic, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const mergeStyle: PressableProps['style'] = (state) => {
    const base = [
      styles.enhancedButton,
      Platform.OS === 'ios' && state.pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
    ];
    const user = typeof (rest as any).style === 'function'
      ? (rest as any).style(state)
      : (rest as any).style;
    return user == null ? base : [...base, user];
  };

  return (
    <Animated.View style={{ transform: [{ scale: pressAnim }] }}>
      <Pressable
        android_ripple={{ color: '#20C05020', borderless: true, radius: 35, foreground: true }}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={mergeStyle}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 50,
            height: 50,
            borderRadius: 25,
            borderWidth: 2,
            borderColor: styles.hapticRing.borderColor,
            opacity: haptic.interpolate({ inputRange: [0, 1], outputRange: [0, 0.3] }),
            transform: [{ scale: haptic.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }],
          }}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
}

/* ───────── Main layout ───────── */
export default function CommuterTabLayout() {
  const insets = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 74 : 78) + insets.bottom;

  const [notifUnread, setNotifUnread] = useState(false);

  const iconFor = (route: (typeof VISIBLE)[number]) =>
    ({ focused }: { focused: boolean }) => (
      <MagneticCommuterIcon
        route={route}
        focused={focused}
        showBadge={route === 'notifications' && notifUnread}
      />
    );

  // Badge polling
  useEffect(() => {
    let t: ReturnType<typeof setInterval> | null = null;
    const check = async () => {
      try {
        const token = await AsyncStorage.getItem('@token');
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/commuter/announcements?limit=1`, { headers });
        if (!res.ok) return;
        const rows: Array<{ timestamp: string }> = await res.json();
        const latest = rows[0]?.timestamp;
        if (!latest) return;
        const seenStr = await AsyncStorage.getItem('@lastSeenAnnouncementTs');
        const seenMs = seenStr ? Date.parse(seenStr) : 0;
        const latestMs = Date.parse(latest);
        setNotifUnread(latestMs > seenMs);
      } catch (e) {
        if (TAB_DEBUG) console.warn('[Announcements poll] failed:', e);
      }
    };
    check();
    t = setInterval(check, 30_000);
    return () => { if (t) clearInterval(t); };
  }, []);

  // Android system nav styling
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden').catch(() => {});
      NavigationBar.setBehaviorAsync('overlay-swipe').catch(() => {});
      NavigationBar.setPositionAsync('absolute').catch(() => {});
      NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
    }
  }, []);

  const CustomBar = (props: any) => {
    const filtered = filterTabs(props, VISIBLE as unknown as string[]);
    if (TAB_DEBUG) {
      try {
        console.log('[CommuterTabLayout] filtered routes:', filtered.state.routes.map((r: any) => r.name), 'index:', filtered.state.index);
      } catch {}
    }
    return <GlassMorphicTabBar {...filtered} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Tabs
        tabBar={CustomBar}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          // These styles are forwarded to rawProps.style -> we apply them on the wrapper
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
            // shadow on the wrapper:
            shadowColor: COLORS.shadow,
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.25,
            shadowRadius: 18,
            elevation: 20,
            overflow: 'visible',
          },
          tabBarItemStyle: {
            flex: 1,
            marginHorizontal: 4,
            borderRadius: 22,
            paddingVertical: 8,
            overflow: 'visible',
          },
          tabBarButton: (props: BottomTabBarButtonProps) => <EnhancedTabButton {...props} />,
        }}
      >
        <Tabs.Screen name="dashboard"       options={{ tabBarIcon: iconFor('dashboard') }} />
        <Tabs.Screen name="route-schedules" options={{ tabBarIcon: iconFor('route-schedules') }} />
        <Tabs.Screen name="live-locations"  options={{ tabBarIcon: iconFor('live-locations') }} />
        <Tabs.Screen name="notifications"   options={{ tabBarIcon: iconFor('notifications') }} />
        <Tabs.Screen name="my-receipts"     options={{ tabBarIcon: iconFor('my-receipts') }} />
        {/* hidden routes */}
        <Tabs.Screen name="receipt/[id]" options={{ href: null }} />
        <Tabs.Screen name="index"        options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

/* ───────── Styles ───────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Icon container stack
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 64,
    position: 'relative',
    overflow: 'visible'
  },

  // Icon layer on top
  iconTop: {
    position: 'absolute',
    zIndex: 100,
    elevation: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Decorative layers (below)
  magneticField: { position: 'absolute', width: 60, height: 60, borderRadius: 30, zIndex: 1 },
  orbitalParticle: { position: 'absolute', width: 4, height: 4, borderRadius: 2, zIndex: 2 },
  rippleEffect: { position: 'absolute', width: 40, height: 40, borderRadius: 20, borderWidth: 1, zIndex: 3 },
  glowBg: { position: 'absolute', width: 52, height: 52, borderRadius: 26, zIndex: 4 },
  glassMorph: {
    position: 'absolute',
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.glass,
    borderWidth: 1, borderColor: COLORS.glassBorder,
    zIndex: 5, shadowColor: COLORS.glassDepth,
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3
  },
  glassDepth: { position: 'absolute', width: 46, height: 46, borderRadius: 23, backgroundColor: COLORS.glassDepth, top: 1, left: 1, zIndex: 4 },

  activeDot: { position: 'absolute', bottom: 4, width: 10, height: 10, borderRadius: 5, zIndex: 6 },
  pulseDot: { position: 'absolute', bottom: 6, width: 6, height: 6, borderRadius: 3, zIndex: 7 },

  badgeDot: { position: 'absolute', top: -2, right: -6, width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF3B30', borderWidth: 2, borderColor: COLORS.background },

  // Glass shell wrapper: now ALSO takes rawProps.style from navigator
  glassTabBarContainer: {
    borderRadius: 32,
    overflow: 'visible',
  },
  glassBase: {
    borderRadius: 32,
    backgroundColor: COLORS.glassDepth,
  },
  glassShine: {
    borderRadius: 32,
    // simple vertical shine band
    left: 0, width: 60,
    backgroundColor: COLORS.glassHighlight,
    transform: [{ skewX: '-20deg' }],
  },
  glassOverlay: {
    borderRadius: 32,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
  },

  // Tab button
  enhancedButton: { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 22, overflow: 'visible', position: 'relative' },
  hapticRing: { position: 'absolute', width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: COLORS.glassBorder },
});
