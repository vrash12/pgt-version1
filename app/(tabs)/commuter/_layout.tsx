// app/(tabs)/commuter/_layout.tsx
import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import { Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE   = '#2E7D32';
const INACTIVE = '#9CA3AF';
export const BAR_H = Platform.OS === 'ios' ? 70 : 62;

const icon = (on: string, off: string) => ({ color, focused }: any) =>
  <Ionicons name={focused ? on : off} size={focused ? 28 : 24} color={color} />;

// 1) Custom “debug” tabBar that logs state & catches errors
function DebugBar(props: any) {
  console.log('🔥 TabBar props.state =', JSON.stringify(props.state, null, 2));
  try {
    return <BottomTabBar {...props} />;
  } catch (err: any) {
    console.error('❌ TabBar render error:', err);
    // render something so you don’t get a white‐screen
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: 'red' }}>TabBar error: {err.message}</Text>
      </View>
    );
  }
}

export default function CommuterTabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      // 2) Log *every* navigation state change too
      screenListeners={{
        state: ({ data }) => {
          console.log('➡️ Navigation state changed:', JSON.stringify(data.state, null, 2));
        },
      }}
      tabBar={DebugBar}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: BAR_H + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.12,
          shadowRadius: 12,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
      }}
    >
      <Tabs.Screen name="dashboard"       options={{ tabBarIcon: icon('home','home-outline') }} />
      <Tabs.Screen name="route-schedules" options={{ tabBarIcon: icon('calendar','calendar-outline') }} />
      <Tabs.Screen name="live-locations"  options={{ tabBarIcon: icon('navigate','navigate-outline') }} />
      <Tabs.Screen
        name="notifications"
        options={{ tabBarIcon: icon('notifications', 'notifications-outline') }}
      />
      <Tabs.Screen name="my-receipts"     options={{ tabBarIcon: icon('receipt','receipt-outline') }} />


      {/* if you have an index.tsx in this folder but don’t want it as a tab: */}
      <Tabs.Screen name="index"           options={{ href: null }} />
    </Tabs>
  );
}
