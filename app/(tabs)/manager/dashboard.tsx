// app/(tabs)/manager/dashboard.tsx
import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

export default function ManagerDashboard() {
  const router = useRouter();

  // ─── user + clock ──────────────────────────
  const [greeting, setGreeting] = useState('Hello');
  const [name, setName]         = useState('Manager');
  const currentTime = new Date().toLocaleTimeString([], {
    hour:   'numeric',
    minute: '2-digit',
    hour12: true,
  });

  useEffect(() => {
    (async () => {
      const [fn, ln] = await Promise.all([
        AsyncStorage.getItem('@firstName'),
        AsyncStorage.getItem('@lastName'),
      ]);
      const full = [fn, ln].filter(Boolean).join(' ');
      setName(full || 'Manager');
      const h = new Date().getHours();
      setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');
    })();
  }, []);

  // ─── live KPIs ─────────────────────────────
  const [metrics, setMetrics]       = useState({
    tickets_today: 0,
    paid_today:    0,
    unpaid_today:  0,
    revenue_today: 0,
  });
  const [activeBuses, setActiveBuses] = useState(0);

  useEffect(() => {
    let timer: number;

    (async function fetchMetrics() {
      try {
        const tok = await AsyncStorage.getItem('@token');

        // 1) tickets KPIs
        const res = await fetch('http://192.168.1.7:5000/manager/metrics/tickets', {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (res.ok) {
          setMetrics(await res.json());
        }

        // 2) active buses (cached by bus-status screen)
        const DEVICES = ['bus-01', 'bus-02', 'bus-03'];
        let online = 0;
        for (const id of DEVICES) {
          if (await AsyncStorage.getItem(`lastBusStatus:${id}`)) online++;
        }
        setActiveBuses(online);

      } catch (err) {
        console.warn('Dashboard metric error', err);
      } finally {
        timer = setTimeout(fetchMetrics, 20_000);
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  // ─── logout ─────────────────────────────────
  const logout = () =>
    Alert.alert('Logout', 'Confirm?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.multiRemove(['@token', '@role']);
          router.replace('/signin');
        },
      },
    ]);

  // ─── quick‐action menu ──────────────────────
  const menu = [
    { title: 'Ticket Sales',   icon: 'ticket-alt',      iType: 'FontAwesome5',   c: '#C62828', bg: '#FFE5E5', href: './ticket-sales' },
    { title: 'View Schedules', icon: 'calendar-alt',    iType: 'FontAwesome5',   c: '#F57C00', bg: '#FFF3E0', href: './view-schedules' },
    { title: 'Track Bus',      icon: 'bus',             iType: 'Ionicons',       c: '#1976D2', bg: '#E3F2FD', href: './bus-status' },
    { title: 'Route Insights', icon: 'bar-chart',       iType: 'Ionicons',       c: '#512DA8', bg: '#EDE7F6', href: './route-insights' },
  ];

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* HEADER */}
        <LinearGradient colors={['#2E7D32', '#1B5E20', '#0D4F12']} style={s.header}>
          <View style={s.blob1} />
          <View style={s.blob2} />
          <View style={s.blob3} />

          <View style={s.topRow}>
            <View style={s.profileRow}>
              <LinearGradient colors={['#4CAF50', '#66BB6A']} style={s.avatar}>
                <Ionicons name="person" size={26} color="#fff" />
              </LinearGradient>
              <View style={s.welcome}>
                <Text style={s.greet}>{greeting},</Text>
                <Text style={s.user}>{name}</Text>
                <View style={s.onlineRow}>
                  <View style={s.dot} />
                  <Text style={s.onlineTxt}>{currentTime}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={logout} style={s.logoutBtn}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={s.logoutInner}
              >
                <MaterialCommunityIcons name="logout-variant" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* CURVED SHEET */}
        <View style={s.sheet}>
          {/* logo */}
          <View style={s.logoWrap}>
            <LinearGradient colors={['#4CAF50', '#66BB6A']} style={s.logoCircle}>
              <MaterialCommunityIcons name="bus" size={32} color="#fff" />
              <View style={s.pinBadge}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </LinearGradient>
          </View>

          {/* LIVE KPI STRIP */}
          <View style={s.kpiRow}>
            <View style={s.kpiCard}>
              <Ionicons name="bus" size={22} color="#2E7D32" />
              <Text style={s.kpiVal}>{activeBuses}</Text>
              <Text style={s.kpiLbl}>Active Buses</Text>
            </View>

            <View style={s.kpiCard}>
              <MaterialCommunityIcons name="ticket-confirmation" size={22} color="#2E7D32" />
              <Text style={s.kpiVal}>{metrics.tickets_today}</Text>
              <Text style={s.kpiLbl}>Tickets Today</Text>
            </View>

            <View style={s.kpiCard}>
              <Ionicons name="cash" size={22} color="#2E7D32" />
              <Text style={s.kpiVal}>₱{metrics.revenue_today.toFixed(2)}</Text>
              <Text style={s.kpiLbl}>Paid Today</Text>
            </View>

            <View style={s.kpiCard}>
              <FontAwesome5 name="exclamation-circle" size={20} color="#C62828" />
              <Text style={[s.kpiVal, { color: '#C62828' }]}>{metrics.unpaid_today}</Text>
              <Text style={s.kpiLbl}>Unpaid</Text>
            </View>
          </View>

          {/* MENU */}
          <Text style={s.menuTitle}>Quick Actions</Text>
          <View style={s.menuGrid}>
            {menu.map((m, i) => (
              <Link key={i} href={m.href as any} asChild>
                <TouchableOpacity style={s.menuItem}>
                  <LinearGradient colors={['#fff', '#f8f9fa']} style={s.menuInner}>
                    <View style={[s.menuIconWrap, { backgroundColor: m.bg }]}>
                      {m.iType === 'FontAwesome5' && (
                        <FontAwesome5 name={m.icon as any} size={20} color={m.c} />
                      )}
                      {m.iType === 'Ionicons' && (
                        <Ionicons name={m.icon as any} size={22} color={m.c} />
                      )}
                      {m.iType === 'MaterialCommunityIcons' && (
                        <MaterialCommunityIcons name={m.icon as any} size={22} color={m.c} />
                      )}
                    </View>
                    <Text style={s.menuTxt}>{m.title}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#C8E6C9" />
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* STYLES */
const blob = (w: number, c: string) => ({
  position: 'absolute' as const,
  width: w,
  height: w,
  borderRadius: w / 2,
  backgroundColor: c,
});
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { paddingTop: 20, paddingBottom: 40, paddingHorizontal: 20, overflow: 'hidden' },
  blob1: { ...blob(200, 'rgba(255,255,255,0.04)'), top: -50, right: -50 },
  blob2: { ...blob(150, 'rgba(255,255,255,0.05)'), bottom: -40, left: -40 },
  blob3: { ...blob(100, 'rgba(255,255,255,0.07)'), top: 80, left: width * 0.7 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  welcome: { marginLeft: 16 },
  greet: { color: '#E8F5E8', fontSize: 15, opacity: 0.9 },
  user: { color: '#fff', fontSize: 22, fontWeight: '700' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50', marginRight: 6 },
  onlineTxt: { color: '#A5D6A7', fontSize: 12, fontWeight: '500' },
  logoutBtn: { borderRadius: 22, overflow: 'hidden' },
  logoutInner: { padding: 12, borderRadius: 22 },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -20,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  logoWrap: { alignItems: 'center', marginBottom: 24 },
  logoCircle: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  pinBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FF5722', padding: 4, borderRadius: 12 },
  kpiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  kpiCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: '#E8F5E9',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
  },
  kpiVal: { fontSize: 18, fontWeight: '700', color: '#1B5E20', marginTop: 6 },
  kpiLbl: { fontSize: 12, color: '#1B5E20', marginTop: 2 },
  menuTitle: { fontSize: 20, fontWeight: '700', color: '#2E7D32', marginVertical: 14 },
  menuGrid: { gap: 12 },
  menuItem: { borderRadius: 16, elevation: 2 },
  menuInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },
  menuIconWrap: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  menuTxt: { flex: 1, color: '#2E7D32', fontSize: 16, fontWeight: '600' },
});
