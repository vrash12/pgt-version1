import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Link, Redirect, useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import mqtt from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

// react-native-maps only on native
let MapView: typeof import('react-native-maps').default;
let Marker: typeof import('react-native-maps').Marker;
if (Platform.OS !== 'web') {
  const mapMod = require('react-native-maps') as typeof import('react-native-maps');
  MapView = mapMod.default;
  Marker = mapMod.Marker;
}

// Only start geofencing off Expo Go
if (Constants.appOwnership !== 'expo') {
  require('../lib/geofencing');
}

type BusFix = { id: string; lat: number; lng: number; people?: number };
type AppRole = 'commuter' | 'pao' | 'manager';
type JwtPayload = { role: AppRole; exp: number };

const MQTT_URL  = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'vanrodolf';
const MQTT_PASS = 'Vanrodolf123.';

const LOGO = require('../assets/images/logos.png');

export default function LandingFleetScreen() {
  const router = useRouter();
  const mapRef = useRef<any>(null);

  // auth/boot
  const [boot, setBoot] = useState<'checking'|'guest'|'authed'>('checking');
  const [role, setRole] = useState<AppRole | null>(null);

  // map state
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] =
    useState<'connecting'|'connected'|'disconnected'>('connecting');
  const [fixes, setFixes] = useState<Record<string, BusFix>>({});

  // 1) Check token once
  useEffect(() => {
    (async () => {
      const t = await AsyncStorage.getItem('@token');
      if (!t) { setBoot('guest'); return; }
      try {
        const payload = jwtDecode<JwtPayload>(t);
        const now = Math.floor(Date.now() / 1000);
        if (payload.exp && payload.exp > now) {
          setRole(payload.role);
          setBoot('authed');
        } else {
          await AsyncStorage.removeItem('@token');
          setBoot('guest');
        }
      } catch {
        await AsyncStorage.removeItem('@token');
        setBoot('guest');
      }
    })();
  }, []);

  // 2) MQTT – declare the hook ALWAYS; guard inside
  useEffect(() => {
    if (boot !== 'guest') return;       // only for landing (guests)
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      keepalive: 30,
      reconnectPeriod: 2000,
    });

    client.on('connect', () => {
      setConnection('connected');
      client.subscribe('device/+/telemetry', { qos: 1 }, (err) => {
        if (err) setConnection('disconnected');
      });
    });

    client.on('message', (topic, payload) => {
      if (!topic.endsWith('/telemetry')) return;
      try {
        const msg = JSON.parse(payload.toString());
        const parts = topic.split('/'); // ["device","bus-01","telemetry"]
        const busId = parts[1] || 'bus-??';
        if (msg?.lat != null && msg?.lng != null) {
          setFixes((prev) => ({
            ...prev,
            [busId]: { id: busId, lat: msg.lat, lng: msg.lng, people: msg.people ?? 0 },
          }));
          setLoading(false);
        }
      } catch {}
    });

    client.on('close', () => setConnection('disconnected'));
    client.on('error', () => setConnection('disconnected'));

    return () => { try { client.end(true); } catch {} };
  }, [boot]);

  // 3) Fit buses – declare the hook ALWAYS; guard inside
  useEffect(() => {
    if (boot !== 'guest') return;
    const coords = Object.values(fixes).map((b) => ({
      latitude: b.lat,
      longitude: b.lng,
    }));
    if (coords.length && mapRef.current) {
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }
  }, [boot, fixes]);

  // ✅ Now do conditional returns (after all hooks are declared)
  if (boot === 'checking') return null;
  if (boot === 'authed' && role) return <Redirect href={`/${role}`} />;

  // ---- Guest landing (web/native)
  const buses = Object.values(fixes);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2E7D32" />
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>Your App</Text>
        </View>
        <View style={styles.center}>
          <Text style={styles.title}>Live Fleet Tracking</Text>
          <Text style={styles.subtitle}>Open the mobile app to view buses on the map.</Text>
          <Link href="/signin" asChild>
            <TouchableOpacity style={styles.ctaBtn}>
              <Text style={styles.ctaTxt}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
        <View style={styles.header}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.brand}>Your App</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#1B5E20" />
          <Text style={styles.subtitle}>Connecting to buses…</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      <View style={styles.header}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.brand}>Your App</Text>
        <View style={styles.conn}>
          <View
            style={[
              styles.connDot,
              { backgroundColor: connection === 'connected' ? '#4CAF50' : '#FF5722' },
            ]}
          />
          <Text style={styles.connTxt}>
            {connection === 'connected' ? 'Live' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View style={styles.mapWrap}>
        {MapView && (
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: buses[0]?.lat ?? 14.5995,
              longitude: buses[0]?.lng ?? 120.9842,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {buses.map((b) => (
              <Marker
                key={b.id}
                coordinate={{ latitude: b.lat, longitude: b.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.busMarker}>
                  <Ionicons name="bus" size={18} color="#fff" />
                  <View style={styles.busDot} />
                </View>
              </Marker>
            ))}
          </MapView>
        )}

        <TouchableOpacity
          style={styles.centerBtn}
          onPress={() => {
            const coords = buses.map((b) => ({ latitude: b.lat, longitude: b.lng }));
            if (coords.length) {
              mapRef.current?.fitToCoordinates(coords, {
                edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
                animated: true,
              });
            }
          }}
        >
          <Text style={styles.centerBtnTxt}>🎯</Text>
        </TouchableOpacity>

        <View style={styles.bottomCard}>
          <Text style={styles.counterTxt}>
            {buses.length} bus{buses.length === 1 ? '' : 'es'} online
          </Text>
          <Link href="/signin" asChild>
            <TouchableOpacity style={styles.ctaBtn}>
              <Text style={styles.ctaTxt}>Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#1B5E20'
  },
  logo: { width: 36, height: 36, marginRight: 10 },
  brand: { color: '#fff', fontSize: 18, fontWeight: '800', flex: 1 },
  conn: { flexDirection: 'row', alignItems: 'center' },
  connDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  connTxt: { color: '#fff', fontSize: 12 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#555', textAlign: 'center' },
  mapWrap: { flex: 1, margin: 16, borderRadius: 16, overflow: 'hidden' },
  map: { flex: 1 },
  busMarker: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#2E7D32',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff', elevation: 6
  },
  busDot: {
    position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#FF6B35', borderWidth: 2, borderColor: '#fff'
  },
  centerBtn: {
    position: 'absolute', right: 16, bottom: 96, width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1B5E20', alignItems: 'center', justifyContent: 'center'
  },
  centerBtnTxt: { color: '#fff', fontSize: 20 },
  bottomCard: {
    position: 'absolute', left: 16, right: 16, bottom: 16, backgroundColor: '#fff',
    borderRadius: 14, padding: 14, elevation: 6, flexDirection: 'row', alignItems: 'center'
  },
  counterTxt: { flex: 1, fontWeight: '700', color: '#1B5E20' },
  ctaBtn: { backgroundColor: '#0D7A2B', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  ctaTxt: { color: '#fff', fontWeight: '700' },
});
