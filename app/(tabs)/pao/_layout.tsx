// app/(pao)/_layout.tsx
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

// ───────────── CONFIG WITH CONDUCTOR-APPROPRIATE COLORS ─────────────
const VISIBLE = [
  'dashboard',
  'route-schedule',         // ← added
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
  border:     '#FFF5F5',
  inactive:   '#9E9E9E',
  shadow:     'rgba(139,0,0,0.18)',
};

const TAB_CFG: Record<typeof VISIBLE[number], {
  on: ComponentProps<typeof Ionicons>['name'];
  off: ComponentProps<typeof Ionicons>['name'];
  tint: string;
}> = {
  dashboard:            { on: 'home',            off: 'home-outline',            tint: COLORS.primary   },
  'route-schedule':     { on: 'calendar',        off: 'calendar-outline',        tint: COLORS.accent    },  // ← config
  announcement:         { on: 'notifications',   off: 'notifications-outline',   tint: COLORS.accent    },
  'passenger-log':      { on: 'people',          off: 'people-outline',          tint: COLORS.secondary },
  'ticket-registration':{ on: 'ticket',          off: 'ticket-outline',          tint: COLORS.tertiary  },
};

/* ───────────── ENHANCED ANIMATED ICON ───────────── */
const AnimatedPaoIcon = ({
  route,
  focused
}: {
  route: typeof VISIBLE[number];
  focused: boolean;
}) => {
  const cfg      = TAB_CFG[route];
  const scale    = React.useRef(new Animated.Value(focused ? 1 : 0.85)).current;
  const bounce   = React.useRef(new Animated.Value(0)).current;
  const glow     = React.useRef(new Animated.Value(0)).current;
  const shimmer  = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: focused ? 1.2 : 0.85,
        useNativeDriver: true,
        tension: 260,
        friction: 10,
      }),
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: focused ? -12 : 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(bounce, {
          toValue: focused ? -6 : 0,
          useNativeDriver: true,
          tension: 260,
          friction: 8,
        }),
      ]),
      Animated.timing(glow, {
        toValue: focused ? 1 : 0,
        duration: 320,
        useNativeDriver: true,
      }),
    ]).start();

    if (focused) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      shimmer.setValue(0);
    }
  }, [focused]);

  return (
    <View style={styles.iconWrap}>
      {focused && (
        <Animated.View
          style={[
            styles.outerGlow,
            {
              borderColor: `${cfg.tint}20`,
              opacity: shimmer.interpolate({ inputRange: [0,0.5,1], outputRange: [0.3,0.8,0.3] }),
              transform: [{ scale: shimmer.interpolate({ inputRange: [0,1], outputRange: [1.2,1.8] }) }],
            }
          ]}
        />
      )}
      <Animated.View
        style={[
          styles.glowBg,
          {
            backgroundColor: `${cfg.tint}08`,
            opacity: glow,
            transform: [{ scale: glow.interpolate({ inputRange: [0,1], outputRange: [0.8,1.4] }) }],
          }
        ]}
      />
      {focused && (
        <Animated.View
          style={[
            styles.innerHighlight,
            {
              backgroundColor: `${cfg.tint}15`,
              opacity: glow.interpolate({ inputRange: [0,1], outputRange: [0,0.8] }),
              transform: [{ scale: glow.interpolate({ inputRange: [0,1], outputRange: [0.7,1.2] }) }],
            }
          ]}
        />
      )}
      <Animated.View
        style={{
          transform: [
            { scale },
            { translateY: bounce },
            { rotateY: focused ? glow.interpolate({ inputRange:[0,1], outputRange:['0deg','8deg'] }) : '0deg' },
          ],
        }}
      >
        <Ionicons
          name={ focused ? cfg.on : cfg.off }
          size={ focused ? 28 : 22 }
          color={ focused ? cfg.tint : COLORS.inactive }
          style={[
            styles.mainIcon,
            {
              textShadowColor: focused ? `${cfg.tint}60` : 'transparent',
              textShadowOffset: { width:0, height:4 },
              textShadowRadius: 8,
            }
          ]}
        />
      </Animated.View>
      {focused && (
        <>
          <Animated.View
            style={[
              styles.badgeIndicator,
              {
                backgroundColor: cfg.tint,
                opacity: glow,
                transform: [{ scale: glow }],
              }
            ]}
          />
          <Animated.View
            style={[
              styles.badgeShine,
              {
                backgroundColor: cfg.tint,
                opacity: shimmer.interpolate({ inputRange:[0,0.3,0.7,1], outputRange:[0,0.6,0.6,0] }),
                transform: [{ scale: shimmer.interpolate({ inputRange:[0,1], outputRange:[0.8,1.5] }) }],
              }
            ]}
          />
        </>
      )}
    </View>
  );
};

const icon = (route: typeof VISIBLE[number]) =>
  ({ focused }: { focused: boolean }) => (
    <AnimatedPaoIcon route={route} focused={focused} />
  );

export default function PaoLayout() {
  const inset = useSafeAreaInsets();
  const BAR_H  = (Platform.OS === 'ios' ? 74 : 66) + inset.bottom;

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
   <SafeAreaView style={{ flex: 1 }}>
      <Tabs
        tabBar={CustomBar}
        screenOptions={{
          headerShown:     false,
          tabBarShowLabel: false,
          tabBarStyle: {
            position:       'absolute',
            left:           0,
            right:          0,
            bottom:         0,
            height:         BAR_H,
            paddingBottom:  inset.bottom + 10,
            paddingTop:     14,
            paddingHorizontal: 18,
            backgroundColor: COLORS.background,
            borderTopWidth: 0,
            borderTopLeftRadius: 32,
            borderTopRightRadius: 32,
            shadowColor:    COLORS.shadow,
            shadowOffset:   { width: 0, height: -8 },
            shadowOpacity:  0.18,
            shadowRadius:   16,
            elevation:      20,
            overflow:       'hidden',
          },
          tabBarItemStyle: {
            flex: 1,
            marginHorizontal: 8,
            borderRadius: 20,
            paddingVertical: 8,
          },
          tabBarButton: (props) => (
            <Pressable
              android_ripple={{
                color: `${COLORS.primary}20`,
                borderless: true,
                radius: 36,
              }}
              {...props}
              style={({ pressed }) => [
                { flex: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 20 },
                pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
              ]}
            />
          ),
        }}
      >
        <Tabs.Screen name="dashboard"            options={{ tabBarIcon: icon('dashboard')            }} />
        <Tabs.Screen name="route-schedule"       options={{ tabBarIcon: icon('route-schedule')       }} />  {/* ← NEW */}
        <Tabs.Screen name="announcement"         options={{ tabBarIcon: icon('announcement')         }} />
        <Tabs.Screen name="passenger-log"        options={{ tabBarIcon: icon('passenger-log')        }} />
        <Tabs.Screen name="ticket-registration"  options={{ tabBarIcon: icon('ticket-registration')  }} />

        <Tabs.Screen name="index"   options={{ href: null }} />
        <Tabs.Screen name="profile" options={{ href: null }} />
      </Tabs>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor: COLORS.background },
  iconWrap:  { alignItems:'center', justifyContent:'center', width:52, height:60, position:'relative' },
  glowBg:    { position:'absolute', width:50, height:50, borderRadius:25 },
  outerGlow: { position:'absolute', width:76, height:76, borderRadius:38, borderWidth:2 },
  innerHighlight: { position:'absolute', width:60, height:60, borderRadius:30 },
  mainIcon: { textAlign:'center', zIndex:10 },
  badgeIndicator: { position:'absolute', bottom:4, width:10, height:6, borderRadius:3 },
  badgeShine: { position:'absolute', bottom:6, width:6, height:2, borderRadius:1 },
});
