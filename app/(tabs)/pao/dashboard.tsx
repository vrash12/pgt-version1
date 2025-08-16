// app/(tabs)/pao/dashboard.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated, // 👈 add Animated
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL } from '../../config';

dayjs.extend(relativeTime);

const MQTT_URL  = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'vanrodolf';
const MQTT_PASS = 'Vanrodolf123.';

type LiveStats = { inside: number; entries: number; exits: number };
type ScheduleToday = { depart: string; arrive: string };
type TripRow = { id: number; number: string; start_time: string; end_time: string };

type Summary = {
  total: number;
  paid: number;
  pending: number;
  revenue: number; // paid revenue only
  lastAnnouncement?: { message: string; timestamp: string; author_name: string } | null;
};

type RecentTicket = {
  id: number;
  referenceNo: string;
  commuter: string;
  fare: string; // "123.45"
  paid: boolean;
  time: string; // "01:23 pm" etc
};

// Normalize stored bus id to topic form `bus-xx`
const toTopicId = (raw: string | null): string | null => {
  if (!raw) return null;
  if (raw.startsWith('bus-')) return raw;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : raw;
};

export default function PaoDashboard() {
  const router = useRouter();
  const mqttRef = useRef<MqttClient | null>(null);
  const fmt12 = (t?: string) => {
    if (!t) return '';
    const [hh = '0', mm = '00'] = t.split(':'); // ignore seconds if present
    let h = parseInt(hh, 10);
    if (!Number.isFinite(h)) return t;
    const period = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${mm.padStart(2, '0')} ${period}`;
  };
  const [greeting, setGreeting] = useState('Hello');
  const [name, setName] = useState('PAO');
  const [clock, setClock] = useState(
    new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  );

  const [busId, setBusId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // live stats + connectivity
  const [stats, setStats] = useState<LiveStats>({ inside: 0, entries: 0, exits: 0 });
  const [mqttConnected, setMqttConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);

  // schedule + KPIs + tickets + broadcast
  const [schedule, setSchedule] = useState<ScheduleToday | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [summary, setSummary] = useState<Summary>({ total: 0, paid: 0, pending: 0, revenue: 0, lastAnnouncement: null });
  const [recent, setRecent] = useState<RecentTicket[]>([]);

  // ✨ floating bubble animation (same approach as commuter header)
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
    float(bubble2, 2200, 7600);
    float(bubble3, 4000, 8200);
  }, [bubble1, bubble2, bubble3]);

  // bootstrap: identity, bus, today trips; first summary load
  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      const [token, fn, ln, busStored] = await Promise.all([
        AsyncStorage.getItem('@token'),
        AsyncStorage.getItem('@firstName'),
        AsyncStorage.getItem('@lastName'),
        AsyncStorage.getItem('@assignedBusId'),
      ]);

      setName([fn, ln].filter(Boolean).join(' ') || 'PAO');

      const topicBus = toTopicId(busStored);
      setBusId(topicBus || null);

      const h = new Date().getHours();
      setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

      if (topicBus && token) {
        try {
          const today = dayjs().format('YYYY-MM-DD');
          const headers: HeadersInit = { Authorization: `Bearer ${token}` };

          // today trips (first/last time)
          const resTrips = await fetch(`${API_BASE_URL}/pao/bus-trips?date=${today}`, { headers });
          if (resTrips.ok) {
            const tripsJson: TripRow[] = await resTrips.json();
            setTrips(tripsJson);
            if (tripsJson.length > 0) {
              setSchedule({ depart: tripsJson[0].start_time, arrive: tripsJson[tripsJson.length - 1].end_time });
            }
          }

          // initial summary + recent tickets
          await Promise.all([refreshSummary(headers), refreshRecent(headers)]);
        } catch (e) {
          console.error('Bootstrap error:', e);
        }
      }
      setLoading(false);
    };

    bootstrap();

    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
    }, 60_000);

    return () => clearInterval(t);
  }, []);

  // periodic refresh for KPIs + recent
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const token = await AsyncStorage.getItem('@token');
      if (!token) return;
      const headers: HeadersInit = { Authorization: `Bearer ${token}` };

      // refresh every 30s
      timer = setInterval(async () => {
        try {
          await Promise.all([refreshSummary(headers), refreshRecent(headers)]);
        } catch (e) {
          // non-fatal
        }
      }, 30_000);
    })();

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  // MQTT wiring
  useEffect(() => {
    if (!busId) return;

    const telemetryTopic = `device/${busId}/telemetry`;
    const peopleTopic    = `device/${busId}/people`;
    const fareTopic      = `device/${busId}/fare`;

    const client = mqtt.connect(MQTT_URL, { username: MQTT_USER, password: MQTT_PASS });
    mqttRef.current = client;

    client.on('connect', () => {
      setMqttConnected(true);
      client.subscribe([telemetryTopic, peopleTopic, fareTopic], { qos: 1 });
    });

    client.on('reconnect', () => setMqttConnected(false));
    client.on('close',     () => setMqttConnected(false));
    client.on('offline',   () => setMqttConnected(false));
    client.on('error',     () => setMqttConnected(false));

    client.on('message', async (topic, raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        setLastUpdate(Date.now());

        if (topic === telemetryTopic && typeof msg.people === 'number') {
          setStats(prev => ({ ...prev, inside: msg.people }));
        } else if (topic === peopleTopic) {
          setStats(prev => ({
            ...prev,
            entries: msg.in ?? prev.entries,
            exits:   msg.out ?? prev.exits,
            inside:  msg.total ?? prev.inside,
          }));
        } else if (topic === fareTopic && typeof msg.paid === 'number') {
          setSummary(prev => {
            const paid = msg.paid as number;
            const pending = Math.max(0, prev.total - paid);
            return { ...prev, paid, pending };
          });
        }
      } catch (e) {
        console.warn('MQTT message parse error:', e);
      }
    });

    return () => {
      client.end(true);
    };
  }, [busId]);

  // helpers
  const refreshSummary = async (headers: HeadersInit) => {
    const today = dayjs().format('YYYY-MM-DD');
    const res = await fetch(`${API_BASE_URL}/pao/summary?date=${today}`, { headers });
    if (res.ok) {
      const s = await res.json();
      setSummary({
        total: s.tickets_total ?? 0,
        paid: s.paid_count ?? 0,
        pending: s.pending_count ?? 0,
        revenue: s.revenue_total ?? 0,
        lastAnnouncement: s.last_announcement ?? null,
      });
    }
  };

  const refreshRecent = async (headers: HeadersInit) => {
    const res = await fetch(`${API_BASE_URL}/pao/recent-tickets?limit=5`, { headers });
    if (res.ok) {
      const rows = await res.json();
      setRecent(rows);
    }
  };

  const logout = () =>
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          await AsyncStorage.clear();
          router.replace('/signin');
        },
      },
    ]);

  // UI
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient colors={['#2E7D32', '#1B5E20', '#0D4F12']} style={styles.header}>
          {/* 🔵 animated bubbles */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.blob1,
              {
                transform: [
                  { translateY: bubble1.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
                  { translateX: bubble1.interpolate({ inputRange: [0, 1], outputRange: [0, 14] }) },
                  { scale:      bubble1.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.06, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.blob2,
              {
                transform: [
                  { translateY: bubble2.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                  { translateX: bubble2.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
                  { scale:      bubble2.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.05, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.blob3,
              {
                transform: [
                  { translateY: bubble3.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                  { translateX: bubble3.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                  { scale:      bubble3.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.04, 1] }) },
                ],
              },
            ]}
          />

          <View style={styles.topRow}>
            <View style={styles.profileRow}>
              <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.avatar}>
                <Ionicons name="person-circle" size={34} color="#fff" />
              </LinearGradient>
              <View>
                <Text style={styles.greet}>{greeting},</Text>
                <Text style={styles.user}>{name}</Text>
                <View style={styles.subRow}>
                  <View style={[styles.dot, { backgroundColor: mqttConnected ? '#34D399' : '#F87171' }]} />
                  <Text style={styles.subTxt}>
                    {mqttConnected ? 'Online' : 'Offline'}
                    {lastUpdate ? ` • updated ${dayjs(lastUpdate).fromNow()}` : ''}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {busId && (
            <View style={styles.busBadge}>
              <MaterialCommunityIcons name="bus" size={18} color="#fff" />
              <Text style={styles.busText}>{busId.toUpperCase()}</Text>
            </View>
          )}
        </LinearGradient>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2E7D32" />
          </View>
        ) : (
          <>
            {/* Live stats */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live Passenger Count</Text>
              <View style={styles.statsRow}>
                <KpiItem value={stats.entries} label="Entries" />
                <KpiItem value={stats.exits} label="Exits" />
                <KpiItem value={stats.inside} label="Inside" />
              </View>
            </View>

            {/* Today’s schedule */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today’s Schedule</Text>
              {trips.length > 0 ? (
                <View>
                  {schedule && (
                    <View style={[styles.scheduleRow, { marginBottom: 8 }]}>
                      <View style={styles.scheduleCol}>
                        <Text style={styles.scheduleLabel}>First</Text>
                        <Text style={styles.scheduleTime}>{fmt12(schedule.depart)}</Text>
                      </View>
                      <MaterialCommunityIcons name="arrow-right-bold" size={20} color="#4CAF50" />
                      <View style={styles.scheduleCol}>
                        <Text style={styles.scheduleLabel}>Last</Text>
                        <Text style={styles.scheduleTime}>{fmt12(schedule.arrive)}</Text>
                      </View>
                    </View>
                  )}
                  <View style={styles.tripList}>
                    {trips.map(t => (
                      <View key={t.id} style={styles.tripRow}>
                        <Text style={styles.tripTime}>{fmt12(t.start_time)}–{fmt12(t.end_time)}</Text>
                        <Text style={styles.tripNum}>#{t.number}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.noSchedule}>No schedule assigned today.</Text>
              )}
            </View>

            {/* Fare & ticket KPIs */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Tickets & Revenue (Today)</Text>
              <View style={styles.kpiGrid}>
                <KpiBox icon="pricetag" color="#2563EB" label="Issued"  value={summary.total} />
                <KpiBox icon="checkmark-done" color="#059669" label="Paid" value={summary.paid} />
                <KpiBox icon="time" color="#F59E0B" label="Pending" value={summary.pending} />
                <KpiBox icon="cash" color="#10B981" label="Revenue" value={`₱${summary.revenue.toFixed(2)}`} />
              </View>
            </View>

            {/* Latest broadcast (outgoing) */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Latest Broadcast</Text>
              {summary.lastAnnouncement ? (
                <View style={styles.annBox}>
                  <Text style={styles.annMsg}>{summary.lastAnnouncement.message}</Text>
                  <Text style={styles.annMeta}>
                    by {summary.lastAnnouncement.author_name} • {dayjs(summary.lastAnnouncement.timestamp).fromNow()}
                  </Text>
                </View>
              ) : (
                <Text style={styles.noSchedule}>No broadcasts yet.</Text>
              )}
            </View>

            {/* Recent tickets */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Recent Tickets</Text>
              {recent.length === 0 ? (
                <Text style={styles.noSchedule}>No tickets yet today.</Text>
              ) : (
                recent.map(r => (
                  <View key={r.id} style={styles.ticketRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ticketRef}>#{r.referenceNo}</Text>
                      <Text style={styles.ticketSub}>{r.commuter}</Text>
                    </View>
                    <View style={styles.ticketRight}>
                      <Text style={styles.ticketFare}>₱{r.fare}</Text>
                      <View style={[styles.badge, r.paid ? styles.badgePaid : styles.badgePending]}>
                        <Text style={[styles.badgeTxt, r.paid ? styles.badgeTxtPaid : styles.badgeTxtPending]}>
                          {r.paid ? 'PAID' : 'PENDING'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KpiItem({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value ?? '--'}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function KpiBox({
  icon,
  color,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: number | string;
}) {
  return (
    <View style={styles.kpiBox}>
      <View style={[styles.kpiIcon, { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf9' },

  header: { paddingTop: 36, paddingBottom: 28, paddingHorizontal: 20, overflow: 'hidden', borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },

  // original blobs turned into animated ones (sizes/positions kept)
  blob1: { position: 'absolute', width: 120, height: 120, borderRadius: 60, top: -40, right: -30, backgroundColor: 'rgba(255,255,255,0.15)' },
  blob2: { position: 'absolute', width: 80, height: 80, borderRadius: 40, top: 40, left: -20,  backgroundColor: 'rgba(255,255,255,0.10)' },
  blob3: { position: 'absolute', width: 50, height: 50, borderRadius: 25, bottom: -10, right: 60, backgroundColor: 'rgba(255,255,255,0.08)' },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileRow: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  greet: { color: '#c8e6c9', fontSize: 14 },
  user: { color: '#fff', fontSize: 18, fontWeight: '600' },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  subTxt: { color: '#c8e6c9', fontSize: 12 },
  logoutBtn: { padding: 4 },

  busBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  busText: { color: '#fff', marginLeft: 6, fontWeight: '600' },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 20, marginHorizontal: 20, marginTop: 24, elevation: 3 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#2E7D32', marginBottom: 14 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '800', color: '#1F2937' },
  statLabel: { fontSize: 13, color: '#6B7280' },

  scheduleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  scheduleCol: { alignItems: 'center' },
  scheduleLabel: { fontSize: 13, color: '#6B7280' },
  scheduleTime: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 4 },
  noSchedule: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiBox: {
    width: '47%',
    backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 12, padding: 12,
  },
  kpiIcon: { width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  kpiLabel: { fontSize: 12, color: '#6B7280' },
  kpiValue: { fontSize: 18, fontWeight: '700', color: '#111827' },

  annBox: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 10, padding: 12 },
  annMsg: { color: '#111827', fontSize: 14, marginBottom: 6 },
  annMeta: { color: '#6B7280', fontSize: 12 },

  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  ticketRef: { fontWeight: '700', color: '#111827' },
  ticketSub: { color: '#6B7280', fontSize: 12, marginTop: 2 },
  ticketRight: { alignItems: 'flex-end' },
  ticketFare: { fontWeight: '700', color: '#111827', marginBottom: 6 },

  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgePaid: { backgroundColor: '#D1FAE5' },
  badgePending: { backgroundColor: '#FEF3C7' },
  badgeTxt: { fontSize: 10, fontWeight: '800' },
  badgeTxtPaid: { color: '#065F46' },
  badgeTxtPending: { color: '#92400E' },

  tripList: { marginTop: 6 },
  tripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  tripTime: { fontSize: 13, color: '#1F2937', fontWeight: '600' },
  tripNum: { fontSize: 12, color: '#6B7280', marginLeft: 8 },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
});
