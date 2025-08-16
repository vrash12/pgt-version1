import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config';

// Small reusable “dashlet” tile
const Dashlet = ({
  label,
  value,
  icon,
  onPress,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  onPress: () => void;
}) => (
  <TouchableOpacity style={styles.dashlet} activeOpacity={0.8} onPress={onPress}>
    <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.dashletBg}>
      {icon}
      <Text style={styles.dashVal}>{value}</Text>
      <Text style={styles.dashLbl}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
);

interface DashPayload {
  greeting: string;
  user_name: string;
  recent_tickets: number; // kept for API compatibility
  unread_messages: number;
  next_trip: null | { bus: string; start: string; end: string };

  // extra fields from API (not shown on minimalist UI)
  active_buses: number;
  today_trips: number;
  today_tickets: number;
  today_revenue: number;
  last_ticket?: {
    referenceNo: string;
    fare: string;
    paid: boolean;
    date: string;
    time: string;
  } | null;
  last_announcement?: {
    message: string;
    timestamp: string;
    author_name: string;
    bus_identifier: string;
  } | null;
  upcoming?: Array<{ bus: string; start: string; end: string }>;
  mini_schedules?: Array<{
    bus: string;
    items: Array<{ start: string; end: string; origin: string; destination: string }>;
  }>;
}

export default function CommuterDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [data, setData] = useState<DashPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [greetingText, setGreetingText] = useState('Hello');
  const [userName, setUserName] = useState('Commuter');

  // ✨ Floating bubbles anim
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = (v: Animated.Value, delay = 0, duration = 7000) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration, useNativeDriver: true }),
        ])
      ).start();

    float(bubble1, 0, 6500);
    float(bubble2, 2500, 7500);
    float(bubble3, 4000, 8000);
  }, [bubble1, bubble2, bubble3]);

  // Fetch dashboard payload
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('@token');
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/commuter/dashboard`, { headers });
      if (res.ok) {
        const json: DashPayload = await res.json();
        setData(json);
      } else {
        console.warn('Dashboard fetch failed:', res.status);
      }
    } catch (err) {
      console.warn('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Compute greeting & read cached name
  useEffect(() => {
    (async () => {
      const [first, last] = await Promise.all([
        AsyncStorage.getItem('@firstName'),
        AsyncStorage.getItem('@lastName'),
      ]);
      setUserName([first, last].filter(Boolean).join(' ') || 'Commuter');

      const hr = new Date().getHours();
      setGreetingText(hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening');
    })();
  }, []);

  // Initial load + on focus
  useEffect(() => {
    load();
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleLogout = useCallback(async () => {
    await AsyncStorage.clear();
    router.replace('/signin');
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* HEADER */}
        <LinearGradient
          colors={['#2E7D32', '#1B5E20', '#0D4F12']}
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          {/* Animated bubbles behind content */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              styles.bubbleTL,
              {
                transform: [
                  { translateY: bubble1.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
                  { translateX: bubble1.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
                  { scale: bubble1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              styles.bubbleBR,
              {
                transform: [
                  { translateY: bubble2.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                  { translateX: bubble2.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
                  { scale: bubble2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bubble,
              styles.bubbleC,
              {
                transform: [
                  { translateY: bubble3.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                  { translateX: bubble3.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                  { scale: bubble3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] }) },
                ],
              },
            ]}
          />

          <View style={styles.topRow}>
            <View style={styles.profileSection}>
              <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.profileIcon}>
                <Ionicons name="person" size={26} color="#fff" />
              </LinearGradient>
              <View style={styles.welcomeText}>
                <Text style={styles.greeting}>{greetingText},</Text>
                <Text style={styles.userType}>{userName}</Text>
              </View>
            </View>

            {/* Logout button */}
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.logoutIconBg}
              >
                <MaterialCommunityIcons name="logout" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* subtle last announcement pill */}
          {data?.last_announcement?.message ? (
            <View style={styles.announcementPill}>
              <Ionicons name="megaphone" size={14} color="#E8F5E8" />
              <Text style={styles.announcementText} numberOfLines={1}>
                {data.last_announcement.message}
              </Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* CONTENT */}
        {loading || !data ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* HERO: Next Trip (if any) */}
            {data.next_trip && (
              <LinearGradient colors={['#4CAF50', '#388E3C']} style={styles.nextTripBox}>
                <Text style={styles.tripBus}>{data.next_trip.bus}</Text>
                <Text style={styles.tripTime}>
                  {data.next_trip.start} – {data.next_trip.end}
                </Text>
                <TouchableOpacity onPress={() => router.push('./route-schedules')} style={styles.seeAllBtn}>
                  <Text style={styles.seeAllTxt}>See timetable →</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}

            {/* Minimal quick actions */}
            <View style={styles.dashStrip}>
              <Dashlet
                label="Announcements"
                value={data.unread_messages > 0 ? data.unread_messages : 'View'}
                onPress={() => router.push('./notifications')}
                icon={<Ionicons name="megaphone" size={22} color="#fff" />}
              />
              <Dashlet
                label="My Receipts"
                value="View"
                onPress={() => router.push('./my-receipts')}
                icon={<Ionicons name="receipt" size={22} color="#fff" />}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // bubbles
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    width: 110,
    height: 110,
  },
  bubbleTL: { top: -30, left: -20 },
  bubbleBR: { bottom: -25, right: -10, width: 90, height: 90 },
  bubbleC:  { top: 24, right: 80, width: 60, height: 60 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  profileSection: { flexDirection: 'row', alignItems: 'center' },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  welcomeText: { marginLeft: 16 },
  greeting: { color: '#E8F5E8', fontSize: 15, opacity: 0.9 },
  userType: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },

  logoutButton: { padding: 6 },
  logoutIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  announcementPill: {
    marginTop: 14,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    gap: 6,
  },
  announcementText: { color: '#E8F5E8', fontSize: 12, maxWidth: '90%' },

  // dashlets
  dashStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 20,
  },
  dashlet: { flex: 1, marginHorizontal: 4 },
  dashletBg: { borderRadius: 16, padding: 16, alignItems: 'center' },
  dashVal: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 },
  dashLbl: { color: '#C8E6C9', fontSize: 12, marginTop: 2 },

  // next trip hero
  nextTripBox: { margin: 20, borderRadius: 20, padding: 20 },
  tripBus: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tripTime: { color: '#fff', fontSize: 16, marginTop: 4 },
  seeAllBtn: { marginTop: 12, alignSelf: 'flex-end' },
  seeAllTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
