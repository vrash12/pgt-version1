// app/(tabs) / commuter/ live-locations.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ExpoNotify from 'expo-notifications';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNotifications } from '../../lib/NotificationContext';
import { BAR_H } from './_layout';

interface LatLng { latitude: number; longitude: number; }
interface BusFix  { id: string; lat: number; lng: number; people: number; }

const MQTT_URL          = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER         = 'vanrodolf';
const MQTT_PASS         = 'Vanrodolf123.';
const TOPIC_TELEMETRY   = 'device/+/telemetry';
const TOPIC_REQ         = 'commuter/livestream/request';
const TOPIC_ACK         = 'commuter/livestream/ack';
const TOPIC_PAO_UPDATES = 'pao/passenger/updates';

const toTopicId = (raw: string) => {
  if (raw.startsWith('bus-')) return raw;
  const n = parseInt(raw, 10);
  return isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : raw;
};


export default function LiveLocationScreen() {
  const router       = useRouter();
  const insets       = useSafeAreaInsets();
  const mapRef       = useRef<MapView>(null);
  const TAB_H        = BAR_H + insets.bottom;
  const mqttRef      = useRef<MqttClient|null>(null);
  const { add:addNotice } = useNotifications();
  const pulseAnim    = useRef(new Animated.Value(1)).current;

  const [userId, setUserId]               = useState<string|null>(null);
  const [fixes, setFixes]                 = useState<Record<string,BusFix>>({});
  const [selectedId, setSelectedId]       = useState<string|null>(null);
  const [userLoc, setUserLoc]             = useState<LatLng|null>(null);
  const [etaMinutes, setEtaMinutes]       = useState(0);
  const [routeCoords, setRouteCoords]     = useState<LatLng[]>([]);
  const [loading, setLoading]             = useState(true);

  const [isSharing, setIsSharing]         = useState(false);
  const [remaining, setRemaining]         = useState(10);
  const [ackTime, setAckTime]             = useState<Date|null>(null);

  const windowH = Dimensions.get('window').height;

  // Pulse animation for active elements
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
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

  // restore preferred bus on mount
  useEffect(() => {
    AsyncStorage.getItem('@preferredBusId')
      .then(stored => {
        if (stored) {
          const norm = toTopicId(stored);
          console.log('[DEBUG] restoring preferred bus →', norm);
          setSelectedId(norm);
        }
      })
      .catch(e => console.warn('AsyncStorage error', e));
  }, []);

  // load userId
  useEffect(() => {
    AsyncStorage.getItem('@userId').then(id => {
      if (id) setUserId(id);
    });
  }, []);

// ✅ Run exactly once, on component mount
useEffect(() => {
  const client = mqtt.connect(MQTT_URL, {
    username: MQTT_USER,
    password: MQTT_PASS,
    keepalive: 30,
    reconnectPeriod: 2000,
    protocol: 'wss',
  });
  mqttRef.current = client;

  client.on('connect', () => {
    // subscribe to everything once
    client.subscribe([TOPIC_TELEMETRY, TOPIC_ACK]);
  });

client.on('message', (topic, raw) => {
  try {
    const [, deviceIdRaw, channel] = topic.split('/');
    const deviceId = toTopicId(deviceIdRaw);
    const msg = JSON.parse(raw.toString());

    console.log('Received message:', msg);  // Debugging log

    if (channel === 'telemetry') {
      const { lat, lng, people = 0 } = msg;
      setFixes(f => ({ ...f, [deviceId]: { id: deviceId, lat, lng, people } }));

      // ✅ choose a default only once
      setSelectedId(prev => prev ?? deviceId);
    }

    if (channel === 'ack' && msg.ok) {
      setAckTime(new Date());
    }
  } catch (e) {
    console.warn('MQTT parse error', e);
  }
});


  return () => {
    client.end(true);
    mqttRef.current = null;
  };
}, []);  // ← remove selectedId from deps!


  // watch user location
  useEffect(() => {
    let sub: Location.LocationSubscription|undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 5 },
          loc => setUserLoc({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
        );
      }
      setLoading(false);
    })();
    return () => sub?.remove();
  }, []);

  // push commuter location to PAO
  useEffect(() => {
    if (!mqttRef.current || !userId || !userLoc) return;
    const push = () => {
      mqttRef.current!.publish(
        TOPIC_PAO_UPDATES,
        JSON.stringify({ type: 'location', id: userId, lat: userLoc.latitude, lng: userLoc.longitude })
      );
    };
    push();
    const h = setInterval(push, 10000);
    return () => clearInterval(h);
  }, [userLoc, userId]);

  // compute route + ETA when either moves
  useEffect(() => {
    console.log('All buses data:', fixes); 
    const activeFix = selectedId ? fixes[selectedId] : undefined;
    if (!activeFix) {
  console.log('No active bus data available');
  return;  // If there's no active bus data, return early
}
    if (!activeFix || !userLoc) return;
    setRouteCoords([
      { latitude: activeFix.lat, longitude: activeFix.lng },
      userLoc
    ]);
    const dLat = activeFix.lat - userLoc.latitude;
    const dLng = activeFix.lng - userLoc.longitude;
    const distanceKm = Math.sqrt(dLat*dLat + dLng*dLng) * 111;
    setEtaMinutes(Math.max(1, Math.round(distanceKm / 0.4)));
    mapRef.current?.animateToRegion(
      { latitude: activeFix.lat, longitude: activeFix.lng, latitudeDelta: 0.03, longitudeDelta: 0.03 },
      500
    );
  }, [fixes, selectedId, userLoc]);

  // countdown share
  useEffect(() => {
    if (!isSharing) return;
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) {
        setIsSharing(false);
        setRemaining(10);
        setAckTime(null);
        return 10;
      }
      return r - 1;
    }), 60000);
    return () => clearInterval(t);
  }, [isSharing]);

  const notifyConductor = () => {
    if (!mqttRef.current) return;
    mqttRef.current.publish(TOPIC_REQ, JSON.stringify({ minutes: remaining }));
    if (userId) {
      mqttRef.current.publish(
        TOPIC_PAO_UPDATES,
        JSON.stringify({ type: 'request', id: userId, minutes: remaining, timestamp: Date.now() })
      );
    }
    setIsSharing(true);
    setAckTime(null);
    addNotice('Live Location Open', `Sharing for ${remaining} minutes`);
    ExpoNotify.scheduleNotificationAsync({
      content: {
        title: 'Live location is now open',
        body: `Sharing for ${remaining} minutes.`,
      },
      trigger: null,
    });
  };

  const closeShare = () => Alert.alert(
    'Close Live Location',
    'Stop sharing your live location?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop',
        style: 'destructive',
        onPress: () => {
          setIsSharing(false);
          setRemaining(10);
          setAckTime(null);
          addNotice('Live Location Closed', 'Sharing has been stopped.');
        }
      }
    ]
  );

  const activeFix = selectedId ? fixes[selectedId] : undefined;
  if (loading || !activeFix) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingCard}>
            <Animated.View style={[styles.loadingIconContainer, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="bus" size={48} color="#2E7D32" />
            </Animated.View>
            <Text style={styles.loadingTitle}>Connecting to Buses</Text>
            <Text style={styles.loadingSubtitle}>Establishing live connection...</Text>
            <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 16 }} />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      {/* Enhanced Header with Gradient Effect */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <View style={styles.backButtonInner}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </View>
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>🚍 Live Tracking</Text>
          <Text style={styles.headerSubtitle}>Real-time bus locations</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingBottom: TAB_H + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Bus Selector */}
        <View style={styles.fleetContainer}>
          <Text style={styles.fleetLabel}>Available Buses</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fleetBar}>
            {Object.keys(fixes).map(rawId => {
              const id = toTopicId(rawId);
              const isSelected = selectedId === id;
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.busChip, isSelected && styles.busChipActive]}
                  onPress={() => setSelectedId(id)}
                  onLongPress={() => {
                    AsyncStorage.setItem('@preferredBusId', id).catch(console.warn);
                    addNotice('Bus preference saved', `Now following ${id.toUpperCase()}`);
                  }}
                >
                  <View style={styles.busChipContent}>
                    <Ionicons 
                      name="bus" 
                      size={16} 
                      color={isSelected ? '#fff' : '#2E7D32'} 
                    />
                    <Text style={[styles.busChipTxt, isSelected && { color: '#fff' }]}>
                      {id.replace('bus-', '').toUpperCase()}
                    </Text>
                    {fixes[id] && (
                      <View style={[styles.occupancyDot, { backgroundColor: fixes[id].people > 10 ? '#FF5722' : '#4CAF50' }]} />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Enhanced Map with Modern Design */}
        <View style={styles.mapCard}>
          <View style={[styles.mapContainer, { height: windowH * 0.5 }]}>
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFillObject}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: activeFix.lat,
                longitude: activeFix.lng,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              showsUserLocation={false}
              showsCompass={false}
              customMapStyle={mapStyle}
            >
              {routeCoords.length >= 2 && (
                <Polyline
                  coordinates={routeCoords}
                  strokeColor="#2E7D32"
                  strokeWidth={6}
                  lineDashPattern={[10, 5]}
                />
              )}
          {Object.values(fixes).map(b => (
  <Marker key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }}>
    <Animated.View
      style={[
        styles.busMarker, 
        selectedId === b.id && styles.busMarkerActive,
        selectedId === b.id && { transform: [{ scale: pulseAnim }] }
      ]}
    >
      <Ionicons name="bus" size={20} color="#fff" />
      <View style={[styles.busMarkerDot, { backgroundColor: selectedId === b.id ? '#FF6B35' : '#4CAF50' }]} />
    </Animated.View>
  </Marker>
))}

              {userLoc && (
                <Marker coordinate={userLoc}>
                  <View style={styles.userMarker}>
                    <View style={styles.userMarkerRing} />
                    <View style={styles.userDot} />
                  </View>
                </Marker>
              )}
            </MapView>

            {/* Enhanced Info Overlays */}
            <View style={styles.mapOverlays}>
              <View style={styles.occupancyCard}>
                <Ionicons name="people" size={16} color="#fff" />
                <Text style={styles.occupancyText}>{activeFix.people}</Text>
                <Text style={styles.occupancyLabel}>passengers</Text>
              </View>
              
              <View style={styles.etaCard}>
                <View style={styles.etaHeader}>
                  <Ionicons name="time" size={18} color="#fff" />
                  <Text style={styles.etaHeaderText}>ETA</Text>
                </View>
                <Text style={styles.etaTime}>{etaMinutes}</Text>
                <Text style={styles.etaUnit}>{etaMinutes === 1 ? 'min' : 'mins'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Enhanced Action Panel */}
        {!isSharing ? (
          <View style={styles.actionPanel}>
            <View style={styles.durationSection}>
              <Text style={styles.sectionTitle}>Share Duration</Text>
              <View style={styles.durationCard}>
                <TouchableOpacity
                  onPress={() => setRemaining(r => Math.max(1, r - 1))}
                  style={styles.durationButton}
                >
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <View style={styles.durationDisplay}>
                  <Text style={styles.durationValue}>{remaining}</Text>
                  <Text style={styles.durationUnit}>minutes</Text>
                </View>
                <TouchableOpacity 
                  onPress={() => setRemaining(r => r + 1)} 
                  style={styles.durationButton}
                >
                  <Ionicons name="add" size={20} color="#2E7D32" />
                </TouchableOpacity>
              </View>
            </View>
            
            <TouchableOpacity style={styles.notifyButton} onPress={notifyConductor}>
              <View style={styles.notifyButtonContent}>
                <Ionicons name="radio" size={24} color="#fff" />
                <View style={styles.notifyButtonText}>
                  <Text style={styles.notifyTitle}>Notify Conductor</Text>
                  <Text style={styles.notifySubtitle}>Share your live location</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.actionPanel}>
            <TouchableOpacity style={styles.closeButton} onPress={closeShare}>
              <Ionicons name="close-circle" size={24} color="#fff" />
              <View style={styles.closeButtonContent}>
                <Text style={styles.closeTitle}>Stop Sharing</Text>
                <Text style={styles.closeSubtitle}>{remaining} minutes remaining</Text>
              </View>
            </TouchableOpacity>
            
            {ackTime ? (
              <View style={styles.acknowledgedCard}>
                <View style={styles.statusIcon}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusTitle}>Conductor Notified</Text>
                  <Text style={styles.statusTime}>
                    Acknowledged at {ackTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.waitingCard}>
                <View style={styles.statusIcon}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
                <View style={styles.statusContent}>
                  <Text style={styles.statusTitle}>Waiting for Response</Text>
                  <Text style={styles.statusSubtitle}>Conductor will be notified shortly</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Custom map style for a cleaner look
const mapStyle = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FFFE',
  },
  
  // Loading Screen
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    minWidth: 280,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1B5E20',
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2E7D32',
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  backButton: {
    marginRight: 16,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 2,
  },
  headerSpacer: {
    width: 56,
  },

  // Fleet Selector
  fleetContainer: {
    padding: 20,
    paddingBottom: 12,
  },
  fleetLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B5E20',
    marginBottom: 12,
  },
  fleetBar: {
    paddingRight: 20,
  },
  busChip: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginRight: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  busChipActive: {
    backgroundColor: '#2E7D32',
    borderColor: '#1B5E20',
    elevation: 8,
  },
  busChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
  },
  busChipTxt: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  occupancyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Map
  mapCard: {
    margin: 20,
    marginTop: 8,
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  mapContainer: {
    position: 'relative',
  },
  mapOverlays: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  occupancyCard: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  occupancyText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 6,
  },
  occupancyLabel: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.9,
  },
  etaCard: {
    backgroundColor: 'rgba(46, 125, 50, 0.95)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    minWidth: 80,
  },
  etaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  etaHeaderText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  etaTime: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    lineHeight: 24,
  },
  etaUnit: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },

  // Markers
  busMarker: {
    width: 44,
    height: 44,
    backgroundColor: '#2E7D32',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    borderWidth: 3,
    borderColor: '#fff',
  },
  busMarkerActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FFE0D6',
  },
  busMarkerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: 'absolute',
    top: -2,
    right: -2,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userMarker: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userMarkerRing: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(46, 125, 50, 0.3)',
    position: 'absolute',
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#2E7D32',
    borderWidth: 3,
    borderColor: '#fff',
  },

  // Action Panel
  actionPanel: {
    margin: 20,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1B5E20',
    marginBottom: 16,
  },
  durationSection: {
    marginBottom: 24,
  },
  durationCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  durationButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  durationDisplay: {
    alignItems: 'center',
    marginHorizontal: 32,
  },
  durationValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#2E7D32',
    lineHeight: 32,
  },
  durationUnit: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  
  // Buttons
  notifyButton: {
    backgroundColor: '#2E7D32',
    borderRadius: 20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  notifyButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  notifyButtonText: {
    marginLeft: 16,
    flex: 1,
  },
  notifyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  notifySubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },

  closeButton: {
    backgroundColor: '#F44336',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  closeButtonContent: {
    marginLeft: 16,
    flex: 1,
  },
  closeTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },

  // Status Cards
  acknowledgedCard: {
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  waitingCard: {
    backgroundColor: '#FF9800',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContent: {
    marginLeft: 16,
    flex: 1,
  },
  statusTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statusTime: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    marginTop: 2,
  },
  statusSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  }
  });