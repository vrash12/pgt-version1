//app/(tabs)/pao/dashboard.tsx
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/* ───────────────────────── CONFIG & TYPES ───────────────────────── */
const BACKEND = 'http://192.168.1.7:5000';
const MQTT_URL = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'vanrodolf';
const MQTT_PASS = 'Vanrodolf123.';

interface LiveStats {
  inside: number;
  entries: number;
  exits: number;
}
interface ScheduleToday {
  depart: string;
  arrive: string;
}

// ✅ 1. ADD THIS HELPER to ensure the bus ID format is correct for MQTT topics
const toTopicId = (raw: string | null): string | null => {
  if (!raw) return null;
  if (raw.startsWith('bus-')) return raw;
  const n = parseInt(raw, 10);
  return isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : raw;
};


/* ────────────────────── COMPONENT ─────────────────────── */
export default function PaoDashboard() {
  const router = useRouter();
  const mqttRef = useRef<MqttClient | null>(null);

  const [greeting, setGreeting] = useState('Hello');
  const [name, setName] = useState('PAO');
  const [clock, setClock] = useState(
    new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
  );
  const [busId, setBusId] = useState<string | null>(null);
  const [stats, setStats] = useState<LiveStats>({ inside: 0, entries: 0, exits: 0 });
  const [schedule, setSchedule] = useState<ScheduleToday | null>(null);
  const [loading, setLoading] = useState(true);

  // --- DATA FETCHING AND REAL-TIME SETUP ---

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      const [token, fn, ln, busRaw] = await Promise.all([
        AsyncStorage.getItem('@token'),
        AsyncStorage.getItem('@firstName'),
        AsyncStorage.getItem('@lastName'),
        AsyncStorage.getItem('@assignedBusId'),
      ]);

      setName([fn, ln].filter(Boolean).join(' ') || 'PAO');
      const formattedBusId = toTopicId(busRaw); // Use the helper
      setBusId(formattedBusId);

      const h = new Date().getHours();
      setGreeting(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening');

      if (formattedBusId && token) {
        try {
          const today = new Date().toISOString().slice(0, 10);
          const res = await fetch(`${BACKEND}/pao/bus-trips?date=${today}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const trips = await res.json();
            if (trips.length > 0) {
              setSchedule({ depart: trips[0].start_time, arrive: trips[trips.length - 1].end_time });
            }
          }
        } catch (error) {
          console.error("Failed to fetch schedule:", error);
        }
      }
      setLoading(false);
    };

    bootstrap();

    const t = setInterval(() => {
      setClock(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }));
    }, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!busId) return;

    // ✅ 2. DEFINE TOPICS for both telemetry and people counts
    const telemetryTopic = `device/${busId}/telemetry`;
    const peopleTopic = `device/${busId}/people`;

    const client = mqtt.connect(MQTT_URL, { username: MQTT_USER, password: MQTT_PASS });
    mqttRef.current = client;

    client.on('connect', () => {
      console.log(`[Dashboard] Subscribing to ${telemetryTopic} and ${peopleTopic}`);
      client.subscribe([telemetryTopic, peopleTopic], { qos: 1 });
    });

    client.on('message', (topic, raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // ✅ 3. HANDLE MESSAGES from both topics
        if (topic === telemetryTopic && typeof msg.people === 'number') {
          setStats(prev => ({ ...prev, inside: msg.people }));
        } else if (topic === peopleTopic) {
          setStats(prev => ({
            ...prev,
            entries: msg.in ?? prev.entries,
            exits: msg.out ?? prev.exits,
            inside: msg.total ?? prev.inside,
          }));
        }
      } catch (e) {
        console.warn('MQTT message parse error on dashboard:', e);
      }
    });

    return () => { client.end(true); };
  }, [busId]);

  /* ─── logout helper ─── */
  const logout = () => Alert.alert('Logout', 'Are you sure?', [
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

  /* ─── RENDER ─── */
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ───────────────── HEADER ───────────────── */}
        <LinearGradient colors={['#2E7D32', '#1B5E20', '#0D4F12']} style={styles.header}>
          {/* blobs */}
          <View style={styles.blob1} />
          <View style={styles.blob2} />
          <View style={styles.blob3} />

          {/* profile row */}
          <View style={styles.topRow}>
            <View style={styles.profileRow}>
              <LinearGradient colors={['#4CAF50', '#66BB6A']} style={styles.avatar}>
                <Ionicons name="person-circle" size={34} color="#fff" />
              </LinearGradient>
              <View style={styles.welcome}>
                <Text style={styles.greet}>{greeting},</Text>
                <Text style={styles.user}>{name}</Text>
                <View style={styles.onlineRow}>
                  <View style={styles.dot} />
                  <Text style={styles.onlineTxt}>{clock}</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
              <Ionicons name="log-out-outline" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* BUS TAG */}
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
            {/* ───────────── LIVE STATS CARD ───────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Live Passenger Count</Text>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats?.entries ?? '--'}</Text>
                  <Text style={styles.statLabel}>Entries</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats?.exits ?? '--'}</Text>
                  <Text style={styles.statLabel}>Exits</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{stats?.inside ?? '--'}</Text>
                  <Text style={styles.statLabel}>Inside</Text>
                </View>
              </View>
            </View>

            {/* ───────────── TODAY’S SCHEDULE CARD ───────────── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today’s Schedule</Text>
              {schedule ? (
                <View style={styles.scheduleRow}>
                  <View style={styles.scheduleCol}>
                    <Text style={styles.scheduleLabel}>Depart</Text>
                    <Text style={styles.scheduleTime}>{schedule.depart}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right-bold" size={24} color="#4CAF50" />
                  <View style={styles.scheduleCol}>
                    <Text style={styles.scheduleLabel}>Arrive</Text>
                    <Text style={styles.scheduleTime}>{schedule.arrive}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.noSchedule}>No schedule assigned today.</Text>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─────────────────── STYLES ─────────────────── */
const styles = StyleSheet.create({
  container:{ flex:1, backgroundColor:'#f8faf9' },

  /* header */
  header:{ paddingTop:36,paddingBottom:28,paddingHorizontal:20 },
  blob1:{ position:'absolute',width:120,height:120,borderRadius:60,top:-40,right:-30,opacity:.15,backgroundColor:'#fff'},
  blob2:{ position:'absolute',width:80,height:80,borderRadius:40,top:40,left:-20,opacity:.1,backgroundColor:'#fff'},
  blob3:{ position:'absolute',width:50,height:50,borderRadius:25,bottom:-10,right:60,opacity:.08,backgroundColor:'#fff'},
  topRow:{ flexDirection:'row',justifyContent:'space-between',alignItems:'center' },
  profileRow:{ flexDirection:'row',alignItems:'center' },
  avatar:{ width:46,height:46,borderRadius:23,justifyContent:'center',alignItems:'center',marginRight:12 },
  welcome:{ flexDirection:'column' },
  greet:{ color:'#c8e6c9',fontSize:14 },
  user:{ color:'#fff',fontSize:18,fontWeight:'600' },
  onlineRow:{ flexDirection:'row',alignItems:'center',marginTop:2 },
  dot:{ width:6,height:6,borderRadius:3,backgroundColor:'#4CAF50',marginRight:6 },
  onlineTxt:{ color:'#c8e6c9',fontSize:12 },
  logoutBtn:{ padding:4 },

  busBadge:{ flexDirection:'row',alignItems:'center',alignSelf:'flex-start',marginTop:16,
              backgroundColor:'rgba(255,255,255,0.15)',paddingHorizontal:10,paddingVertical:4,borderRadius:12 },
  busText:{ color:'#fff',marginLeft:6,fontWeight:'600' },

  /* generic card */
  card:{ backgroundColor:'#fff',borderRadius:14,padding:20,marginHorizontal:20,marginTop:24,elevation:3 },
  cardTitle:{ fontSize:16,fontWeight:'600',color:'#2E7D32',marginBottom:14 },

  /* live stats */
  statsRow:{ flexDirection:'row',justifyContent:'space-around' },
  statItem:{ alignItems:'center' },
  statValue:{ fontSize:26,fontWeight:'800',color:'#1F2937' },
  statLabel:{ fontSize:13,color:'#6B7280' },

  /* schedule */
  scheduleRow:{ flexDirection:'row',alignItems:'center',justifyContent:'space-around' },
  scheduleCol:{ alignItems:'center' },
  scheduleLabel:{ fontSize:13,color:'#6B7280' },
  scheduleTime:{ fontSize:20,fontWeight:'700',color:'#1F2937',marginTop:4 },
  noSchedule:{ fontSize:14,color:'#9CA3AF',textAlign:'center' },

  /* loading */
  loadingBox:{ paddingVertical:40,alignItems:'center' },
});
