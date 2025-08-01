import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ExpoNotify from 'expo-notifications';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

ExpoNotify.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,   // ← newly required
    shouldShowList: true,     // ← newly required
  }),
});


/* ───────── CONFIG ───────── */
const MQTT_URL = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'vanrodolf';
const MQTT_PASS = 'Vanrodolf123.';

// Enhanced green theme colors
const COLORS = {
  primary: '#1B5E20',      // Dark green
  secondary: '#2E7D32',    // Medium green
  accent: '#4CAF50',       // Bright green
  light: '#C8E6C9',        // Light green
  surface: '#E8F5E8',      // Very light green
  background: '#F1F8E9',   // Subtle green tint
  white: '#FFFFFF',
  text: '#1B5E20',
  textSecondary: '#388E3C',
  textLight: '#81C784',
  warning: '#FF6F00',
  danger: '#D32F2F',
  shadow: 'rgba(27, 94, 32, 0.15)',
};

const { width } = Dimensions.get('window');

/* helpers that include busId */
const tBusTelem = (b?: string) =>
    b ? `device/${b}/telemetry` : 'device/telemetry';
  
  const tPaoUp = (b?: string) =>
    b ? `pao/${b}/passenger/updates` : 'pao/passenger/updates';
const tAckToBus = (b: string) => `pao/${b}/passenger/ack`;
const tAckToComm = (b: string) => `commuter/${b}/livestream/ack`;

/* ───────── types ───────── */
interface LatLng { latitude: number; longitude: number }
interface Passenger { id: string; location: LatLng }
interface RequestItem {
  id: string;
  time: Date;
  status: 'Waiting' | 'Waiting for Acknowledgement' | 'Acknowledged';
}

/* ───────── Enhanced Components ───────── */
const AnimatedCard = ({ children, style, delay = 0 }: any) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[style, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {children}
    </Animated.View>
  );
};

const PulsingDot = ({ size = 12, color = COLORS.accent }: any) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        transform: [{ scale: pulseAnim }],
      }}
    />
  );
};

const EnhancedStat = ({ label, value, danger, icon }: any) => {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start();
  }, [value]);

  return (
    <Animated.View style={[styles.statContainer, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.statIconContainer}>
        <Ionicons
          name={icon}
          size={20}
          color={danger ? COLORS.danger : COLORS.primary}
        />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statLabel}>{label}</Text>
        <View style={[styles.statValueContainer, danger && { backgroundColor: '#FFEBEE' }]}>
          <Text style={[styles.statValue, danger && { color: COLORS.danger }]}>
            {value}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
};

const AnimatedButton = ({ onPress, disabled, children, style }: any) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!disabled) {
      const glow = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: false,
          }),
        ])
      );
      glow.start();
      return () => glow.stop();
    }
  }, [disabled]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          shadowColor: disabled ? 'transparent' : COLORS.primary,
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: glowAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.3, 0.6],
          }),
          shadowRadius: 8,
          elevation: disabled ? 0 : 8,
        },
        style,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[styles.enhancedButton, disabled && styles.enhancedButtonDisabled]}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

/* ───────── component ───────── */
export default function PassengerLogScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const mqttRef = useRef<MqttClient | null>(null);
  const tabSlideAnim = useRef(new Animated.Value(0)).current;

  /* assigned busId comes from auth / AsyncStorage */
  const [busId, setBusId] = useState<string | null>(null);

  /* UI / data state */
  const [tab, setTab] = useState<'location' | 'info'>('location');
  const [busLoc, setBusLoc] = useState<LatLng | null>(null);
  const [occupied, setOccupied] = useState<number>(0);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [selReq, setSelReq] = useState<RequestItem | null>(null);

  const toTopicId = (raw: string) => {
    if (raw.startsWith('bus-')) return raw; // already correct
    const n = parseInt(raw, 10);
    return isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : raw;
  };
  const handleCardPress = (request: RequestItem) => {
    // Set the tapped request as the one to be acknowledged
    setSelReq(request);
  
    // Update the list to visually show which request is selected
    setRequests(prev =>
      prev.map(r => {
        // If this is the request that was just tapped, set its status
        if (r.id === request.id) {
          return { ...r, status: 'Waiting for Acknowledgement' };
        }
        // If another request was already selected, reset its status back to 'Waiting'
        if (r.status === 'Waiting for Acknowledgement') {
          return { ...r, status: 'Waiting' };
        }
        // Otherwise, leave the request as is
        return r;
      })
    );
  };

  const acknowledge = () => {
    if (selReq) {
      // Update the status in the local state array
      setRequests(prev =>
        prev.map(r =>
          r.id === selReq.id ? { ...r, status: 'Acknowledged' } : r
        )
      );

      // Publish the acknowledgement message via MQTT
      if (mqttRef.current && busId) {
        mqttRef.current.publish(
          tAckToComm(busId),
          JSON.stringify({ ok: true, id: selReq.id, ts: Date.now() })
        );
      }

      // Clear the current selection
      setSelReq(null);
    }
  };
  useEffect(() => {
    Animated.spring(tabSlideAnim, {
      toValue: tab === 'location' ? 0 : 1,
      useNativeDriver: false, // translateX is not compatible with native driver on all components
      bounciness: 8,
    }).start();
  }, [tab]);
  /* ----- 1) load busId once ----- */
  useEffect(() => {
    AsyncStorage.getItem('@assignedBusId')
      .then(id => {
        console.log('[DEBUG] got @assignedBusId →', id);
        if (id) {
          setBusId(toTopicId(id)); // ← convert numeric → "bus-01"
        } else {
          console.warn('[DEBUG] no assignedBusId, using fallback');
          setBusId('bus-01');
        }
      })
      .catch(e => console.error('[DEBUG] AsyncStorage error', e));
  }, []);

  /* ----- 2) MQTT once busId known ----- */
  useEffect(() => {
    if (!busId) return;
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      keepalive: 30,
      reconnectPeriod: 2000,
    });
    mqttRef.current = client;

    client.on('connect', () => {
      console.log('[DEBUG] MQTT connected for', busId);
      console.log('[DEBUG] subscribing →', tBusTelem(busId), tPaoUp(busId), tPaoUp(), tPaoUp(busId));
      client.subscribe(
        [
          tBusTelem(),            // device/telemetry          ← generic
          tBusTelem(busId),       // device/bus-01/telemetry   ← bus-scoped
          tPaoUp(),               // p​ao/passenger/updates     ← generic
          tPaoUp(busId)           // p​ao/bus-01/passenger/updates
        ],
        { qos: 1 }
      );
      
    });

    client.on('message', (topic, raw) => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
  
      if (topic === tBusTelem() || topic === tBusTelem(busId)) {
        if (msg.lat != null && msg.lng != null) {
          const loc = { latitude: msg.lat, longitude: msg.lng };
          setBusLoc(loc);
          mapRef.current?.animateToRegion({ ...loc, latitudeDelta: 0.05, longitudeDelta: 0.05 }, 500);
        }
        if (typeof msg.people === 'number') setOccupied(msg.people);
      }
  
      if (topic === tPaoUp() || topic === tPaoUp(busId)) {
        if (msg.type === 'location') {
          const upd: Passenger = { id: String(msg.id), location: { latitude: msg.lat, longitude: msg.lng } };
  
          // ✅ IMMUTABLE UPDATE LOGIC TO PREVENT INFINITE LOOPS
          setPassengers(prevPassengers => {
            const idx = prevPassengers.findIndex(p => p.id === upd.id);
  
            if (idx !== -1) { // Passenger exists, so we update their location
              const newPassengers = [...prevPassengers];
              newPassengers[idx] = upd;
              return newPassengers;
            } else { // This is a new passenger
              return [...prevPassengers, upd];
            }
          });
          
        } else if (msg.type === 'request') {
          const t = msg.timestamp ? new Date(msg.timestamp) : new Date();
          const newRequest = { id: String(msg.id), time: t, status: 'Waiting' as const };
  
          setRequests(existingRequests => {
            const isDuplicate = existingRequests.some(req => req.id === newRequest.id);
            if (isDuplicate) {
              return existingRequests;
            }
            ExpoNotify.scheduleNotificationAsync({
              content: {
                title: '🚍 New Pickup Request',
                body: `Commuter #${newRequest.id} is requesting to be picked up.`,
                data: { type: 'pickup_request', commuterId: newRequest.id },
              },
              trigger: null, // Show immediately
            });
            
            return [...existingRequests, newRequest];
          });
        }
      }
    });

    return () => {
      client.end(true);
    };
  }, [busId]);

  /* loader until first GPS fix */
  if (!busId || !busLoc) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />
        <View style={styles.loadingContent}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Connecting to Bus System...</Text>
          <View style={styles.loadingDots}>
            <PulsingDot size={8} />
            <PulsingDot size={8} />
            <PulsingDot size={8} />
          </View>
        </View>
      </View>
    );
  }
/* ----- 4) Enhanced UI ----- */
return (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="dark-content" backgroundColor={COLORS.background} />

    {/* ENHANCED HEADER */}
    <View style={styles.header}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color={COLORS.white} />
      </TouchableOpacity>
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Bus {busId?.replace('bus-', '').toUpperCase()}</Text>
        <Text style={styles.headerSubtitle}>Passenger Monitoring</Text>
      </View>
      <View style={styles.headerIcon}>
        <MaterialCommunityIcons name="bus" size={28} color={COLORS.white} />
      </View>
    </View>

    {/* ENHANCED TAB SWITCH */}
    <View style={styles.tabContainer}>
      <Animated.View
      pointerEvents="none"
        style={[styles.tabIndicator, {
          transform: [{
            translateX: tabSlideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, (width - 48) / 2],
            }),
          }],
        }]}
      />
      <TouchableOpacity style={styles.tabButton} onPress={() => setTab('location')}>
        <Ionicons name="location" size={20} color={tab === 'location' ? COLORS.white : COLORS.textSecondary} />
        <Text style={[styles.tabText, tab === 'location' && styles.tabTextActive]}>Location</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.tabButton} onPress={() => setTab('info')}>
        <Ionicons name="information-circle" size={20} color={tab === 'info' ? COLORS.white : COLORS.textSecondary} />
        <Text style={[styles.tabText, tab === 'info' && styles.tabTextActive]}>Information</Text>
      </TouchableOpacity>
    </View>

    {/* --- CONDITIONAL CONTENT BASED ON TAB --- */}
    {tab === 'location' ? (
      <View style={{ flex: 1 }}> 
        <AnimatedCard style={styles.mapCard} delay={200}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{ ...busLoc, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
          >
            <Marker coordinate={busLoc}>
              <View style={styles.busMarker}>
                <MaterialCommunityIcons name="bus" size={24} color={COLORS.white} />
              </View>
            </Marker>
            {passengers.map(p => (
              <Marker key={p.id} coordinate={p.location}>
                <View style={styles.passengerMarker}>
                  <PulsingDot size={12} color={COLORS.accent} />
                </View>
              </Marker>
            ))}
          </MapView>
        </AnimatedCard>

        <AnimatedCard style={styles.statsCard} delay={300}>
          <EnhancedStat label="Waiting Passengers" value={passengers.length} icon="people" />
          <View style={styles.statsDivider} />
          <EnhancedStat label="Bus Occupancy" value={occupied} icon="bus" />
          <View style={styles.statsDivider} />
          <EnhancedStat
            label="New Requests"
            value={requests.filter(r => r.status === 'Waiting').length}
            icon="notifications"
            danger={requests.some(r => r.status === 'Waiting')}
          />
        </AnimatedCard>
      </View>
    ) : (
      <>
        {/* INFO TAB CONTENT */}
        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="notifications-off-outline" size={64} color={COLORS.light} />
            <Text style={styles.emptyTitle}>No New Requests</Text>
            <Text style={styles.emptySubtitle}>Passenger pickup requests will appear here.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.infoScrollContainer} showsVerticalScrollIndicator={false}>
            {[...requests]
              .sort((a, b) => b.time.getTime() - a.time.getTime()) // Show newest first
              .map((r, index) => (
                <AnimatedCard key={r.id} delay={index * 100}>
                  <TouchableOpacity
                    style={[styles.requestCard, selReq?.id === r.id && styles.requestCardSelected]}
                    onPress={() => handleCardPress(r)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.requestHeader}>
                      <Text style={styles.requestId}>Commuter #{r.id.padStart(2, '0')}</Text>
                      <View style={[
                        styles.statusBadge,
                        r.status === 'Waiting' && styles.statusWaiting,
                        r.status === 'Acknowledged' && styles.statusAcknowledged
                      ]}>
                        <Text style={[
                          styles.statusText,
                          r.status === 'Waiting' && styles.statusTextWaiting,
                          r.status === 'Acknowledged' && styles.statusTextAcknowledged
                        ]}>
                          {r.status}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.requestTimeContainer}>
                      <Text style={styles.requestTimeText}>
                        {r.time.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                      </Text>
                      <Text style={styles.requestTimeText}>
                        {r.time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </AnimatedCard>
              ))}
          </ScrollView>
        )}

        <View style={styles.acknowledgeContainer}>
          <AnimatedButton
            onPress={acknowledge}
            disabled={!selReq || selReq.status !== 'Waiting for Acknowledgement'}
          >
            <Ionicons name="checkmark-circle" size={24} color={COLORS.white} />
            <Text style={styles.acknowledgeButtonText}>
              {selReq ? `ACKNOWLEDGE #${selReq.id.padStart(2, '0')}` : 'SELECT A REQUEST'}
            </Text>
          </AnimatedButton>
        </View>
      </>
    )}
  </SafeAreaView>
);
}


/* ───────── Enhanced Styles ───────── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  cardDate:          { fontSize:13, fontWeight:'600', color:COLORS.text },
cardTime:          { fontSize:13, fontWeight:'600', color:COLORS.text },
cardId:            { fontSize:22, fontWeight:'800', color:COLORS.primary },
emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 120,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  requestTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.surface,
    paddingTop: 12,
  },
  requestTimeText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  // Loading states
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 8,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Enhanced tabs
  tabContainer: {
    margin: 20,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  tabBackground: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 12,
  },
  tabIndicator: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: (width - 48) / 2,
      height: '100%',
      backgroundColor: COLORS.primary,
      borderRadius: 12,
      zIndex: -1,          // ① ← sits under the buttons
    },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.white,
  },

  // Map
  mapCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    height: 240,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  map: {
    flex: 1,
  },
  busMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  passengerMarker: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Stats
  statsCard: {
    margin: 20,
    marginTop: 16,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  statContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 16,
    color: COLORS.text,
    fontWeight: '500',
  },
  statValueContainer: {
    backgroundColor: COLORS.light,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statsDivider: {
    height: 1,
    backgroundColor: COLORS.surface,
    marginVertical: 16,
  },

  // Info/Requests
  infoScrollContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  requestCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  requestCardSelected: {
    backgroundColor: COLORS.light,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusWaiting: {
    backgroundColor: '#FFF3E0',
  },
  statusPending: {
    backgroundColor: '#E3F2FD',
  },
  statusAcknowledged: {
    backgroundColor: COLORS.light,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
  },
  statusTextWaiting: {
    color: COLORS.warning,
  },
  statusTextAcknowledged: {
    color: COLORS.primary,
  },
  requestDetails: {
    gap: 8,
  },
  requestDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  requestDetailText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Acknowledge button
  acknowledgeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    padding: 20,
    paddingBottom: 34,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  acknowledgeButtonContainer: {
    borderRadius: 16,
  },
  enhancedButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  enhancedButtonDisabled: {
    backgroundColor: COLORS.light,
  },
  acknowledgeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
});
