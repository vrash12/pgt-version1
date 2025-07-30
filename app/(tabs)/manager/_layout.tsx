// app/(manager)/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
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
] as const;

const COLORS = {
  primary:    '#1565C0',           // deep blue
  accent:     '#0288D1',           // lighter blue
  secondary:  '#004BA0',           // dark blue
  background: '#FFFFFF',
  border:     '#E3F2FD',
  inactive:   '#9E9E9E',
  shadow:     'rgba(21,101,192,0.15)',
};

/**
 * Map each route name → its ACTIVE / INACTIVE icon & active tint
 */
const TAB_CFG: Record<typeof VISIBLE[number], {
  on: ComponentProps<typeof Ionicons>['name'];
  off: ComponentProps<typeof Ionicons>['name'];
  tint: string;
}> = {
  dashboard      : { on: 'home',           off: 'home-outline',            tint: COLORS.primary   },
  'bus-status'   : { on: 'bus',            off: 'bus-outline',             tint: COLORS.accent    },
  'view-schedules':{ on: 'calendar',       off: 'calendar-outline',        tint: COLORS.secondary },
  'route-insights' : { on: 'pricetags',      off: 'pricetags-outline',       tint: COLORS.primary   },
};

/* ───────────── ENHANCED ANIMATED ICON ───────────── */
const AnimatedManagerIcon = ({ 
  route, 
  focused 
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
    // Main animations
    Animated.parallel([
      // Scale and bounce
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
      // Glow effect
      Animated.timing(glowAnim, {
        toValue: focused ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous pulse for active state
    if (focused) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1500,
            useNativeDriver: true,
          }),
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
      {/* Outer pulse ring */}
      {focused && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              borderColor: `${cfg.tint}25`,
              opacity: pulseAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 0],
              }),
              transform: [{
                scale: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 2],
                })
              }]
            }
          ]}
        />
      )}

      {/* Glow background */}
      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}12`,
            opacity: glowAnim,
            transform: [{
              scale: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1.3],
              })
            }]
          }
        ]}
      />
      
      {/* Inner ripple */}
      {focused && (
        <Animated.View
          style={[
            styles.innerRipple,
            {
              borderColor: `${cfg.tint}40`,
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.7],
              }),
              transform: [{
                scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 1.4],
                })
              }]
            }
          ]}
        />
      )}

      {/* Main icon with enhanced animations */}
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { translateY: bounceAnim },
            {
              rotate: focused ? 
                glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', '5deg'],
                }) : '0deg'
            }
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
            }
          ]}
        />
      </Animated.View>

      {/* Enhanced active indicator */}
      {focused && (
        <>
          {/* Main dot */}
          <Animated.View
            style={[
              styles.activeDot,
              {
                backgroundColor: cfg.tint,
                opacity: glowAnim,
                transform: [{
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1.2],
                  })
                }]
              }
            ]}
          />
          
          {/* Pulsing dot */}
          <Animated.View
            style={[
              styles.pulseDot,
              {
                backgroundColor: cfg.tint,
                opacity: pulseAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.6, 0],
                }),
                transform: [{
                  scale: pulseAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 2.5],
                  })
                }]
              }
            ]}
          />
        </>
      )}
    </View>
  );
};

/* ───────────── ICON FACTORY ───────────── */
const icon = (route: typeof VISIBLE[number]) => 
  ({ focused }: { focused: boolean }) => (
    <AnimatedManagerIcon route={route} focused={focused} />
  );

/* ───────────── LAYOUT ───────────── */
export default function ManagerLayout() {
  const inset = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 72 : 64) + inset.bottom; // Increased height

  // Filter out non-visible routes before they reach <BottomTabBar/>
  const CustomBar = (props: any) => {
    const pruned = {
      ...props.state,
      routes: props.state.routes.filter((r: any) =>
        VISIBLE.includes(r.name as any)
      ),
      index: Math.max(
        0,
        VISIBLE.indexOf(props.state.routes[props.state.index].name as any)
      ),
    };
    return <BottomTabBar {...props} state={pruned} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Tabs
        tabBar={CustomBar}
        screenOptions={{
          headerShown:     false,
          tabBarShowLabel: false, // Remove text labels
          tabBarStyle: {
            position:       'absolute',
            left:           0,
            right:          0,
            bottom:         0,
            height:         BAR_H,
            paddingBottom:  inset.bottom + 8,
            paddingTop:     12,
            paddingHorizontal: 16,
            backgroundColor: COLORS.background,
            borderTopWidth: 0,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            shadowColor:    COLORS.shadow,
            shadowOffset:   { width: 0, height: -6 },
            shadowOpacity:  0.15,
            shadowRadius:   12,
            elevation:      16,
            overflow:       'hidden',
          },
          tabBarItemStyle: { 
            flex: 1, 
            marginHorizontal: 6, 
            borderRadius: 18,
            paddingVertical: 6,
          },
          tabBarButton: (props) => (
            <Pressable
              android_ripple={{
                color: `${COLORS.primary}18`,
                borderless: true,
                radius: 32,
              }}
              {...props}
              style={({ pressed }) => [
                { 
                  flex: 1, 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  borderRadius: 18,
                },
                pressed && { 
                  opacity: 0.8,
                  transform: [{ scale: 0.95 }],
                },
              ]}
            />
          ),
        }}
      >

        {/* ─────────── VISIBLE TABS ─────────── */}
        <Tabs.Screen
          name="dashboard"
          options={{ tabBarIcon: icon('dashboard') }}
        />
        <Tabs.Screen
          name="bus-status"
          options={{ tabBarIcon: icon('bus-status') }}
        />
        <Tabs.Screen
          name="view-schedules"
          options={{ tabBarIcon: icon('view-schedules') }}
        />
        <Tabs.Screen
          name="route-insights"
          options={{ tabBarIcon: icon('route-insights') }}
        />

        {/* ─── any other manager routes: hide from the bar */} 
        <Tabs.Screen name="index"   options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

/* ─────────── ENHANCED STYLES ─────────── */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  
  iconWrap: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: 50,
    height: 56,
    position: 'relative',
  },

  // Glow and animation elements
  glowBg: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
  },

  pulseRing: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
  },

  innerRipple: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
  },

  mainIcon: {
    textAlign: 'center',
    zIndex: 10,
  },

  // Enhanced active indicators
  activeDot: {
    position: 'absolute',
    bottom: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  pulseDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});