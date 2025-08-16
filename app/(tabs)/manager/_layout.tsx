// app/(tabs)/manager/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, type BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Vibration,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ───────────── ADVANCED CONFIG ───────────── */
const VISIBLE = [
  'dashboard',
  'bus-status', 
  'view-schedules',
  'route-insights',
  'ticket-sales',
] as const;

const COLORS = {
  primary: '#1565C0',
  accent: '#0288D1',
  secondary: '#004BA0',
  tertiary: '#FF6B35',
  success: '#2E7D32',
  warning: '#F57C00',
  background: '#FFFFFF',
  glass: 'rgba(255,255,255,0.85)',
  glassBorder: 'rgba(21,101,192,0.12)',
  border: '#E3F2FD',
  inactive: '#9E9E9E',
  shadow: 'rgba(21,101,192,0.15)',
  magnetic: '#E3F2FD',
};

const TAB_CFG: Record<typeof VISIBLE[number], {
  on: ComponentProps<typeof Ionicons>['name'];
  off: ComponentProps<typeof Ionicons>['name'];
  tint: string;
  magneticColor: string;
  statusIndicator?: 'online' | 'warning' | 'offline';
}> = {
  dashboard: { 
    on: 'home', off: 'home-outline', 
    tint: COLORS.primary, 
    magneticColor: '#1565C010',
    statusIndicator: 'online'
  },
  'bus-status': { 
    on: 'bus', off: 'bus-outline', 
    tint: COLORS.accent, 
    magneticColor: '#0288D110',
    statusIndicator: 'warning'
  },
  'view-schedules': { 
    on: 'calendar', off: 'calendar-outline', 
    tint: COLORS.secondary, 
    magneticColor: '#004BA010',
    statusIndicator: 'online'
  },
  'route-insights': { 
    on: 'analytics', off: 'analytics-outline', 
    tint: COLORS.tertiary, 
    magneticColor: '#FF6B3510',
    statusIndicator: 'offline'
  },
  'ticket-sales': { 
    on: 'card', off: 'card-outline', 
    tint: COLORS.success, 
    magneticColor: '#2E7D3210',
    statusIndicator: 'online'
  },
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/* ───────────── ADVANCED MAGNETIC ANIMATED ICON ───────────── */
const MagneticManagerIcon = ({
  route,
  focused,
  index,
}: {
  route: typeof VISIBLE[number];
  focused: boolean;
  index: number;
}) => {
  const cfg = TAB_CFG[route];
  
  // Animation values
  const scaleAnim = useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const magneticAnim = useRef(new Animated.Value(0)).current;
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const statusPulse = useRef(new Animated.Value(0)).current;
  const orbitalAnim = useRef(new Animated.Value(0)).current;
  
  // Magnetic interaction state
  const [isMagnetic, setIsMagnetic] = useState(false);
  
  useEffect(() => {
    // Main focus animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.25 : 0.85,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
      Animated.sequence([
        Animated.timing(bounceAnim, {
          toValue: focused ? -15 : 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(bounceAnim, {
          toValue: focused ? -8 : 0,
          useNativeDriver: true,
          tension: 300,
          friction: 10,
        }),
      ]),
      Animated.timing(glowAnim, {
        toValue: focused ? 1 : 0,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(rotationAnim, {
        toValue: focused ? 1 : 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous animations for focused tab
    if (focused) {
      // Orbital particles
      const orbital = Animated.loop(
        Animated.timing(orbitalAnim, {
          toValue: 1,
          duration: 4000,
          useNativeDriver: true,
        })
      );
      
      // Status pulse
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(statusPulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(statusPulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
        ])
      );

      
      
      orbital.start();
      pulse.start();
      
      return () => {
        orbital.stop();
        pulse.stop();
      };
    } else {
      orbitalAnim.setValue(0);
      statusPulse.setValue(0);
    }
  }, [focused]);

  // Magnetic animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(magneticAnim, {
        toValue: isMagnetic ? 1 : 0,
        useNativeDriver: true,
        tension: 400,
        friction: 8,
      }),
      Animated.timing(rippleAnim, {
        toValue: isMagnetic ? 1 : 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isMagnetic]);

  const handlePressIn = () => {
    setIsMagnetic(true);
    if (Platform.OS === 'ios') {
      Vibration.vibrate(50);
    }
  };

  const handlePressOut = () => {
    setIsMagnetic(false);
  };

  const getStatusColor = () => {
    switch (cfg.statusIndicator) {
      case 'online': return COLORS.success;
      case 'warning': return COLORS.warning;
      case 'offline': return COLORS.inactive;
      default: return COLORS.success;
    }
  };

  return (
    <View style={styles.iconContainer}>
      {/* Magnetic field effect */}
      <Animated.View
        style={[
          styles.magneticField,
          {
            backgroundColor: cfg.magneticColor,
            opacity: magneticAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.8]
            }),
            transform: [
              {
                scale: magneticAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 2.2]
                })
              }
            ],
          },
        ]}
      />

      {/* Orbital particles for focused tab */}
      {focused && (
        <>
          {[0, 1, 2].map((i) => (
            <Animated.View
              key={i}
              style={[
                styles.orbitalParticle,
                {
                  backgroundColor: cfg.tint,
                  transform: [
                    {
                      rotate: orbitalAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [`${i * 120}deg`, `${360 + i * 120}deg`]
                      })
                    },
                    { translateX: 30 },
                    {
                      rotate: orbitalAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [`${-i * 120}deg`, `${-360 - i * 120}deg`]
                      })
                    }
                  ]
                }
              ]}
            />
          ))}
        </>
      )}

      {/* Ripple effect */}
      <Animated.View
        style={[
          styles.rippleEffect,
          {
            borderColor: cfg.tint,
            opacity: rippleAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.6]
            }),
            transform: [
              {
                scale: rippleAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 3]
                })
              }
            ],
          },
        ]}
      />

      {/* Main glow background */}
      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}15`,
            opacity: glowAnim,
            transform: [
              {
                scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.4]
                })
              }
            ],
          },
        ]}
      />

      {/* Glass morphism layer */}
      {focused && (
        <Animated.View
          style={[
            styles.glassMorph,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.9]
              }),
              transform: [
                {
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1.2]
                  })
                }
              ],
            },
          ]}
        />
      )}

      {/* Main icon with advanced transforms */}
      <Animated.View
        style={{
          transform: [
            { scale: scaleAnim },
            { translateY: bounceAnim },
            {
              rotateY: rotationAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '10deg']
              })
            },
            {
              rotateZ: magneticAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '3deg']
              })
            },
          ],
        }}
        onTouchStart={handlePressIn}
        onTouchEnd={handlePressOut}
      >
        <Ionicons
          name={focused ? cfg.on : cfg.off}
          size={focused ? 30 : 24}
          color={focused ? cfg.tint : COLORS.inactive}
          style={[
            styles.mainIcon,
            {
              textShadowColor: focused ? `${cfg.tint}60` : 'transparent',
              textShadowOffset: { width: 0, height: 4 },
              textShadowRadius: 8,
            },
          ]}
        />
      </Animated.View>

     

      {/* Active indicator dots */}
      {focused && (
        <>
          <Animated.View
            style={[
              styles.activeDot,
              {
                backgroundColor: cfg.tint,
                opacity: glowAnim,
                transform: [
                  {
                    scale: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1.5]
                    })
                  }
                ],
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseDot,
              {
                backgroundColor: cfg.tint,
                opacity: statusPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.4, 0]
                }),
                transform: [
                  {
                    scale: statusPulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 3]
                    })
                  }
                ],
              },
            ]}
          />
        </>
      )}
    </View>
  );
};

/* ───────────── GLASSMORPHIC TAB BAR ───────────── */
const GlassMorphicTabBar = (props: any) => {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isScrolling, setIsScrolling] = useState(false);

  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      setIsScrolling(Math.abs(value) > 10);
    });
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

/* ───────────── ENHANCED TAB BUTTON ───────────── */
const EnhancedTabButton = React.forwardRef<
  React.ElementRef<typeof Pressable>,
  BottomTabBarButtonProps & { route?: string }
>(({ onPress, onLongPress, accessibilityState, accessibilityLabel, testID, children, route }, ref) => {
  const pressAnim = useRef(new Animated.Value(1)).current;
  const hapticFeedback = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.parallel([
      Animated.spring(pressAnim, {
        toValue: 0.92,
        useNativeDriver: true,
        tension: 400,
        friction: 8,
      }),
      Animated.timing(hapticFeedback, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    if (Platform.OS === 'ios') {
      Vibration.vibrate(30);
    }
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(pressAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 400,
        friction: 8,
      }),
      Animated.timing(hapticFeedback, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: pressAnim }],
      }}
    >
      <Pressable
        ref={ref}
        android_ripple={{ 
          color: '#1565C020', 
          borderless: true, 
          radius: 35,
          foreground: true 
        }}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityState={accessibilityState}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [
          styles.enhancedButton,
          pressed && Platform.OS === 'ios' && { 
            opacity: 0.85,
            transform: [{ scale: 0.96 }] 
          },
        ]}
      >
        <Animated.View
          style={[
            styles.hapticRing,
            {
              opacity: hapticFeedback.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 0.3]
              }),
              transform: [
                {
                  scale: hapticFeedback.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.8]
                  })
                }
              ],
            },
          ]}
        />
        {children}
      </Pressable>
    </Animated.View>
  );
});

EnhancedTabButton.displayName = 'EnhancedTabButton';

/* ───────────── MAIN LAYOUT ───────────── */
export default function AdvancedManagerLayout() {
  const insets = useSafeAreaInsets();
  const BAR_H = (Platform.OS === 'ios' ? 85 : 78) + insets.bottom;

  const icon = (route: typeof VISIBLE[number], index: number) =>
    ({ focused }: { focused: boolean }) => (
      <MagneticManagerIcon route={route} focused={focused} index={index} />
    );

  const CustomBar = (props: any) => {
    const pruned = {
      ...props.state,
      routes: props.state.routes.filter((r: any) => 
        VISIBLE.includes(r.name as typeof VISIBLE[number])
      ),
      index: Math.max(0, VISIBLE.indexOf(
        props.state.routes[props.state.index].name as typeof VISIBLE[number]
      )),
    };
    return <GlassMorphicTabBar {...props} state={pruned} />;
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
        <Tabs.Screen name="dashboard" options={{ tabBarIcon: icon('dashboard', 0) }} />
        <Tabs.Screen name="bus-status" options={{ tabBarIcon: icon('bus-status', 1) }} />
        <Tabs.Screen name="view-schedules" options={{ tabBarIcon: icon('view-schedules', 2) }} />
        <Tabs.Screen name="route-insights" options={{ tabBarIcon: icon('route-insights', 3) }} />
        <Tabs.Screen name="ticket-sales" options={{ tabBarIcon: icon('ticket-sales', 4) }} />

        {/* Hidden routes */}
        <Tabs.Screen name="index" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

/* ───────────── ADVANCED STYLES ───────────── */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background,
  },
  
  // Icon container styles
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 64,
    position: 'relative',
    overflow: 'visible',
  },

  // Magnetic field effect
  magneticField: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    zIndex: 1,
  },

  // Orbital particles
  orbitalParticle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    zIndex: 2,
  },

  // Ripple effect
  rippleEffect: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 3,
  },

  // Main glow background
  glowBg: { 
    position: 'absolute', 
    width: 52, 
    height: 52, 
    borderRadius: 26,
    zIndex: 4,
  },

  // Glass morphism layer
  glassMorph: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 5,
  },

  // Main icon
  mainIcon: { 
    textAlign: 'center', 
    zIndex: 10,
  },



  // Active indicators
  activeDot: { 
    position: 'absolute', 
    bottom: 4, 
    width: 10, 
    height: 10, 
    borderRadius: 5,
    zIndex: 6,
  },
  
  pulseDot: { 
    position: 'absolute', 
    bottom: 6, 
    width: 6, 
    height: 6, 
    borderRadius: 3,
    zIndex: 7,
  },

  // Glass morphic tab bar
  glassTabBar: {
    borderTopWidth: 1,
    backdropFilter: 'blur(20px)',
    borderRadius: 32,
  },

  // Enhanced button
  enhancedButton: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
    overflow: 'visible',
    position: 'relative',
  },

  // Haptic feedback ring
  hapticRing: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
});