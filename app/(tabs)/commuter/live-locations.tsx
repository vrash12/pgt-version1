// app/(tabs)/commuter/live-locations.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ExpoNotify from 'expo-notifications';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
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
import { BASE_TABBAR_HEIGHT } from './_layout';
type Coord = { latitude: number; longitude: number };

// Your user location extends Coord with quality info
type UserLoc = Coord & { accuracy: number; speedKmh: number };

interface BusFix  { id: string; lat: number; lng: number; people: number; }
const MQTT_URL            = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER           = 'vanrodolf';
const MQTT_PASS           = 'Vanrodolf123.';
const TOPIC_TELEMETRY_ALL = 'device/#';
const TOPIC_REQ           = 'commuter/livestream/request';
const tPaoUp = (b: string) => `pao/${b}/passenger/updates`;
const topicCommuterAck = (b: string) => `commuter/${b}/livestream/ack`;

const toTopicId = (raw: string) => {
  if (raw.startsWith('bus-')) return raw;
  const n = parseInt(raw, 10);
  return isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : raw;
};

export default function LiveLocationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const TAB_H = BASE_TABBAR_HEIGHT + insets.bottom;
  const mapRef = useRef<MapView | null>(null);

  const mqttRef = useRef<MqttClient | null>(null);
  const publishStop = (busId?: string) => {
    if (!mqttRef.current || !busId || !userId) return;
    mqttRef.current.publish(
      tPaoUp(busId),
      JSON.stringify({ type: 'location-stop', id: userId, timestamp: Date.now() })
    );
  };
  const { add: addNotice } = useNotifications();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const haversineKm = (a: Coord, b: Coord) => {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371; // km
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const lat1 = toRad(a.latitude);
    const lat2 = toRad(b.latitude);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  

// Track last position+time and movement streak
const lastPosRef = useRef<{ loc: UserLoc; ts: number } | null>(null);
const moveStreakRef = useRef(0);
const shareStartRef = useRef<number | null>(null);

// thresholds tuned for vehicles
const SPEED_KMH_THRESHOLD = 10;    // ✅ your requirement
const DISTANCE_M_THRESHOLD = 60;   // need ~60 m of real movement
const MOVING_STREAK_REQUIRED = 4;  // 4 consecutive updates ≈ ~30s+
const ACC_FILTER_MAX = 80;         // ignore fixes worse than 80 m
const ACC_FUDGE = 20;              // dead-band in meters

ExpoNotify.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});
const autoStopOnMove = async () => {
  setIsSharing(false);
  setRemaining(10);
  setAckTime(null);
  publishStop(selectedId!);
  await clearShareNotification();
  addNotice('Live Location Closed', 'Stopped because you started moving.');
  await ExpoNotify.scheduleNotificationAsync({
    content: {
      title: 'Live location closed',
      body: "You're on the move, so sharing has been stopped.",
      sound: 'default',
    },
    trigger: null,
  });
};


  const [userId, setUserId] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<string, BusFix>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [userLoc, setUserLoc] = useState<UserLoc | null>(null);
  const [etaMinutes, setEtaMinutes] = useState(0);
  const [routeCoords, setRouteCoords] = useState<Coord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [remaining, setRemaining] = useState(10);
  const [ackTime, setAckTime] = useState<Date | null>(null);
  // after: const [ackTime, setAckTime] = useState<Date | null>(null);
const [lockedBusId, setLockedBusId] = useState<string | null>(null);
const lockedBusIdRef = useRef<string | null>(null);
useEffect(() => { lockedBusIdRef.current = lockedBusId; }, [lockedBusId]);

  const windowH = Dimensions.get('window').height;

  const [showMovementModal, setShowMovementModal] = useState(false);


  const selectedIdRef = useRef(selectedId);
  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => {
    const activeFix = selectedId ? fixes[selectedId] : undefined;
    if (!activeFix || !userLoc) return;
  
    const route: Coord[] = [
      { latitude: activeFix.lat, longitude: activeFix.lng },
      { latitude: userLoc.latitude, longitude: userLoc.longitude },
    ];
    setRouteCoords(route);
  
    const dLat = activeFix.lat - userLoc.latitude;
    const dLng = activeFix.lng - userLoc.longitude;
    const distanceKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
    setEtaMinutes(Math.max(1, Math.round(distanceKm / 0.4)));
  
    mapRef.current?.fitToCoordinates(route, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  }, [fixes, selectedId, userLoc]);
  
const shareNotifIdRef = useRef<string | null>(null);

const updateShareNotification = async (minutes: number) => {
  try {
    // Replace previous one to update the body
    if (shareNotifIdRef.current) {
      await ExpoNotify.dismissNotificationAsync(shareNotifIdRef.current);
      shareNotifIdRef.current = null;
    }
    shareNotifIdRef.current = await ExpoNotify.presentNotificationAsync({
      title: 'Live location sharing',
      body: `${minutes} minute${minutes === 1 ? '' : 's'} remaining`,
      data: { deeplink: '/commuter/live-locations' },
      ...(Platform.OS === 'android'
        ? {
            // make it "ongoing" (not swipable) on Android
            sticky: true,
            channelId: 'commuter-acks', // you already create this channel
          }
        : {}),
    });
  } catch (e) {
    console.warn('updateShareNotification failed', e);
  }
};

const clearShareNotification = async () => {
  try {
    if (shareNotifIdRef.current) {
      await ExpoNotify.dismissNotificationAsync(shareNotifIdRef.current);
      shareNotifIdRef.current = null;
    }
  } catch (e) {
    // ignore
  }
};
useEffect(() => {
  if (!userLoc) return;

  // ignore very poor fixes outright
  if (userLoc.accuracy > ACC_FILTER_MAX) return;

  const now = Date.now();
  const last = lastPosRef.current;
  if (last) {
    const dtSec = Math.max(1, (now - last.ts) / 1000);

    const dKm = haversineKm(
      { latitude: last.loc.latitude, longitude: last.loc.longitude },
      { latitude: userLoc.latitude, longitude: userLoc.longitude }
    );
    const dMetersRaw = dKm * 1000;

    // subtract both accuracies + a small fudge band
    const accEnvelope = (last.loc.accuracy || 0) + (userLoc.accuracy || 0) + ACC_FUDGE;
    const dMeters = Math.max(0, dMetersRaw - accEnvelope);

    // use whichever is higher: reported speed or derived speed
    const derivedSpeedKmh = (dKm / (dtSec / 3600));
    const speedKmh = Math.max(userLoc.speedKmh, derivedSpeedKmh);

    const speedOK = speedKmh >= SPEED_KMH_THRESHOLD;
    const distanceOK = dMeters >= DISTANCE_M_THRESHOLD;

    const inShareGrace = !!shareStartRef.current && (now - shareStartRef.current) < 10_000; // 10s

    // 🚦 final decision: must be *both* fast and far enough
    const moving = !inShareGrace && speedOK && distanceOK;

    if (moving) {
      moveStreakRef.current += 1;
      if (isSharing && moveStreakRef.current >= MOVING_STREAK_REQUIRED) {
        autoStopOnMove(); // your existing closer
      }
    } else {
      moveStreakRef.current = 0;
    }
  }

  lastPosRef.current = { loc: userLoc, ts: now };
}, [userLoc, isSharing]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('commuter-acks', {
          name: 'Commuter Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 500],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }
    })();
  }, []);

  const confirmStopSharing = () => {
    setShowMovementModal(false);
    setIsSharing(false);
    setRemaining(10);
    setAckTime(null);
    publishStop(selectedId!);
    addNotice('Live Location Closed', 'Stopped due to inactivity.');
  };
  const userIdRef = useRef<string | null>(null);
  useEffect(() => { userIdRef.current = userId; }, [userId]);
  
  const isSharingRef = useRef(isSharing);
  useEffect(() => { isSharingRef.current = isSharing; }, [isSharing]);
  
  // Always compare bus IDs in a padded, canonical form
const canonicalBusId = (raw?: string | null) => {
  if (!raw) return '';
  const s = String(raw);
  const m = s.match(/^bus-(\d+)$/);
  if (m) return `bus-${parseInt(m[1], 10).toString().padStart(2, '0')}`;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : s;
};
  
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

// MQTT connect once
useEffect(() => {
  const client = mqtt.connect(MQTT_URL, { username: MQTT_USER, password: MQTT_PASS });
  mqttRef.current = client;

  client.on('connect', () => {
    client.subscribe(TOPIC_TELEMETRY_ALL, { qos: 1 });
    client.subscribe('commuter/+/livestream/ack', { qos: 1 }); // catch ACKs even if early
  });

  client.on('message', (topic, raw) => {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // --- Telemetry feed: device/<busId>/telemetry ---
    if (topic.includes('/telemetry')) {
      const [, deviceIdRaw] = topic.split('/'); // ['device','bus-01','telemetry']
      const deviceId = toTopicId(deviceIdRaw);
      const { lat, lng, people = 0 } = msg;
      setFixes(f => ({ ...f, [deviceId]: { id: deviceId, lat, lng, people } }));
      setSelectedId(prev => prev ?? deviceId);
      return;
    }

    // --- ACKs: commuter/<busId>/livestream/ack ---
    if (topic.startsWith('commuter/') && topic.endsWith('/livestream/ack')) {
      const parts = topic.split('/'); // ["commuter","bus-01","livestream","ack"]
      const topicBus = canonicalBusId(parts[1] || '');
      const currentBus = canonicalBusId(selectedIdRef.current);
      const currentUser = userIdRef.current;

      const ok = !!msg?.ok;
      const idMatches  = ok && currentUser != null && String(msg.id) === String(currentUser);
      const busMatches = ok && currentBus && topicBus === currentBus;

      // Accept if explicitly for me, OR if it’s for my selected bus while I’m sharing
      if (ok && (idMatches || (busMatches && isSharingRef.current))) {
        setAckTime(new Date());
        (async () => {
          await ExpoNotify.scheduleNotificationAsync({
            content: {
              title: '✅ Conductor acknowledged',
              body: 'Your pickup request was received.',
              sound: 'default',
              ...(Platform.OS === 'android' ? { channelId: 'commuter-acks' } : {}),
            },
            trigger: null,
          });
        })();
      } else {
        // Helpful debug if it still doesn’t show up
        console.log('[ACK ignored]', {
          topicBus, currentBus, currentUser, msgId: msg?.id, isSharing: isSharingRef.current
        });
      }
      return;
    }
  });

  return () => { client.end(true); mqttRef.current = null; };
}, []);



  // subscribe/unsubscribe to ACK topic per selection
  useEffect(() => {
    const client = mqttRef.current;
    if (!client || !selectedId) return;
    const ackTopic = topicCommuterAck(selectedId);
    client.subscribe(ackTopic);
    return () => { if (client.connected) client.unsubscribe(ackTopic); };
  }, [selectedId]);

  // load user + location
  useEffect(() => {
    AsyncStorage.getItem('@preferredBusId').then(stored => stored && setSelectedId(toTopicId(stored)));
    AsyncStorage.getItem('@userId').then(id => id && setUserId(id));

    let sub: Location.LocationSubscription | undefined;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        sub = await Location.watchPositionAsync(
          {
            accuracy: Platform.OS === 'android'
              ? Location.Accuracy.Balanced
              : Location.Accuracy.High,
            timeInterval: 7000,
            distanceInterval: 12,
            mayShowUserSettingsDialog: true,
          },
          loc => {
            // Expo types: number | null -> coerce to numbers
            const rawAcc   = loc.coords.accuracy;
            const rawSpeed = loc.coords.speed; // m/s or null
        
            const accuracy = typeof rawAcc === 'number' && Number.isFinite(rawAcc) ? rawAcc : 999;
            const speedKmh = typeof rawSpeed === 'number' && Number.isFinite(rawSpeed)
              ? rawSpeed * 3.6
              : 0;
        
            setUserLoc({
              latitude:  loc.coords.latitude,
              longitude: loc.coords.longitude,
              accuracy,
              speedKmh,
            });
          }
        );
        
      }
      setLoading(false);
    })();
    return () => sub?.remove();
  }, []);

  // publish commuter location
  useEffect(() => {
    if (!mqttRef.current || !userId || !userLoc || !selectedId) return;
    const topic = tPaoUp(selectedId);
    const payload = JSON.stringify({ type: 'location', id: userId, lat: userLoc.latitude, lng: userLoc.longitude });
    const push = () => mqttRef.current!.publish(topic, payload);
    push();
    const intervalId = setInterval(push, 10000);
    return () => clearInterval(intervalId);
  }, [userLoc, userId, selectedId]);

  // route + ETA
  useEffect(() => {
    const activeFix = selectedId ? fixes[selectedId] : undefined;
    if (!activeFix || !userLoc) return;
    const route = [{ latitude: activeFix.lat, longitude: activeFix.lng }, userLoc];
    setRouteCoords(route);

    const dLat = activeFix.lat - userLoc.latitude;
    const dLng = activeFix.lng - userLoc.longitude;
    const distanceKm = Math.sqrt(dLat * dLat + dLng * dLng) * 111;
    setEtaMinutes(Math.max(1, Math.round(distanceKm / 0.4)));

    mapRef.current?.fitToCoordinates(route, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  }, [fixes, selectedId, userLoc]);

  // countdown
  useEffect(() => {
    if (!isSharing) return;
    const t = setInterval(() => setRemaining(r => {
      if (r <= 1) {
        setIsSharing(false);
        setAckTime(null);
        publishStop(selectedId!);
        clearShareNotification();
        return 10;
      }
      
      const next = r - 1;
         updateShareNotification(next);
         return next;
    }), 60000);
    return () => clearInterval(t);
  }, [isSharing]);

  const notifyConductor = () => {
    if (!mqttRef.current || !selectedId) return;
  
    mqttRef.current.publish(TOPIC_REQ, JSON.stringify({ minutes: remaining }));
    if (userId) {
      mqttRef.current.publish(
        tPaoUp(selectedId),
        JSON.stringify({ type: 'request', id: userId, minutes: remaining, timestamp: Date.now() })
      );
    }
    setIsSharing(true);
     shareStartRef.current = Date.now(); 
    setAckTime(null);
    setLockedBusId(selectedId); // ⬅️ lock bus while sharing
  
    addNotice('Live Location Open', `Sharing for ${remaining} minutes`);
    ExpoNotify.scheduleNotificationAsync({
      content: { title: 'Live location is now open', body: `Sharing for ${remaining} minutes.` },
      trigger: null,
    });
  
    // show the persistent countdown notification immediately
    updateShareNotification(remaining);
  };
  
  const closeShare = () =>
    Alert.alert('Close Live Location', 'Stop sharing your live location?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Stop', style: 'destructive',
        onPress: () => {
          setIsSharing(false);
          setRemaining(10);
          setAckTime(null);
          publishStop(selectedId!);
          addNotice('Live Location Closed', 'Sharing has been stopped.');
        }
         }
    ]);

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

      {/* FIX 1: remove double top safe-area. Keep a small constant top pad. */}
      <View style={[styles.header, { paddingTop: 12 }]}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>🚍 Live Tracking</Text>
          <Text style={styles.headerSubtitle}>Real-time bus locations</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          // FIX 2: ensure content clears the absolute tab bar + leave extra room for the action panel
          paddingBottom: TAB_H + 10,
        }}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="always"
      >
 {/* Bus Selector */}
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
          // ⬇️ guard switching while locked
          onPress={() => {
            const locked = canonicalBusId(lockedBusId);
            const thisId = canonicalBusId(id);
            if (locked && thisId !== locked) {
              Alert.alert(
                'Live share in progress',
                `You’re sharing with ${locked.toUpperCase()}. Stop sharing to switch buses.`
              );
              return;
            }
            setSelectedId(id);
          }}
          onLongPress={() => {
            AsyncStorage.setItem('@preferredBusId', id).catch(console.warn);
            addNotice('Bus preference saved', `Now following ${id.toUpperCase()}`);
          }}
        >
          <View style={styles.busChipContent}>
            <Ionicons name="bus" size={16} color={isSelected ? '#fff' : '#2E7D32'} />
            <Text style={[styles.busChipTxt, isSelected && { color: '#fff' }]}>
              {id.replace('bus-', '').toUpperCase()}
            </Text>
            {fixes[id] && (
              <View
                style={[
                  styles.occupancyDot,
                  { backgroundColor: fixes[id].people > 10 ? '#FF5722' : '#4CAF50' },
                ]}
              />
            )}
          </View>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
</View>

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
                <Polyline coordinates={routeCoords} strokeColor="#2E7D32" strokeWidth={6} lineDashPattern={[10, 5]} />
              )}

              {Object.values(fixes).map(b => (
                <Marker key={b.id} coordinate={{ latitude: b.lat, longitude: b.lng }}>
                  <Animated.View
                    style={[
                      styles.busMarker,
                      selectedId === b.id && styles.busMarkerActive,
                      selectedId === b.id && { transform: [{ scale: pulseAnim }] },
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

            {/* overlays */}
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

        {/* Action Panel */}
        {!isSharing ? (
          <View style={[styles.actionPanel, { marginBottom: TAB_H + 12 }]}>
            <View style={styles.durationSection}>
              <Text style={styles.sectionTitle}>Share Duration</Text>
              <View style={styles.durationCard}>
                <TouchableOpacity onPress={() => setRemaining(r => Math.max(1, r - 1))} style={styles.durationButton}>
                  <Ionicons name="remove" size={20} color="#2E7D32" />
                </TouchableOpacity>
                <View style={styles.durationDisplay}>
                  <Text style={styles.durationValue}>{remaining}</Text>
                  <Text style={styles.durationUnit}>minutes</Text>
                </View>
                <TouchableOpacity onPress={() => setRemaining(r => r + 1)} style={styles.durationButton}>
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
          <View style={[styles.actionPanel, { marginBottom: TAB_H + 12 }]}>
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
        <View style={{ height: TAB_H + 24 }} />
      </ScrollView>

      {/* inactivity modal */}
      <Modal visible={showMovementModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 24, width: '100%', maxWidth: 340 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#1B5E20', marginBottom: 12 }}>No Movement Detected</Text>
            <Text style={{ fontSize: 15, color: '#333', marginBottom: 20 }}>
              We've noticed you haven't moved for a while. Your live location will be closed to save resources.
            </Text>
            <TouchableOpacity
              onPress={confirmStopSharing}
              style={{ backgroundColor: '#2E7D32', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const mapStyle = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FFFE' },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 32, alignItems: 'center',
    elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, minWidth: 280,
  },
  loadingIconContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#E8F5E8',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  loadingTitle: { fontSize: 22, fontWeight: 'bold', color: '#1B5E20', marginBottom: 8 },
  loadingSubtitle: { fontSize: 16, color: '#666', textAlign: 'center' },

  // Header (fixed small top pad, no extra safe-area stacking)
  header: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#2E7D32', paddingBottom: 20, paddingHorizontal: 20,
    borderBottomLeftRadius: 28, borderBottomRightRadius: 28,
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 12,
  },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#fff', textAlign: 'center' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', textAlign: 'center', marginTop: 2 },
  headerSpacer: { width: 56 },

  // Fleet Selector
  fleetContainer: { padding: 20, paddingBottom: 12 },
  fleetLabel: { fontSize: 18, fontWeight: '600', color: '#1B5E20', marginBottom: 12 },
  fleetBar: { paddingRight: 20 },
  busChip: {
    backgroundColor: '#fff', borderRadius: 20, marginRight: 12, elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4,
    borderWidth: 2, borderColor: 'transparent',
  },
  busChipActive: { backgroundColor: '#2E7D32', borderColor: '#1B5E20', elevation: 8 },
  busChipContent: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, position: 'relative' },
  busChipTxt: { color: '#2E7D32', fontWeight: '700', fontSize: 16, marginLeft: 8 },
  occupancyDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: 6, right: 6 },

  // Map
  mapCard: {
    margin: 20, marginTop: 8, borderRadius: 24, overflow: 'hidden',
    elevation: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16,
  },
  mapContainer: { position: 'relative' },
  mapOverlays: { position: 'absolute', top: 20, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between' },
  occupancyCard: {
    backgroundColor: 'rgba(244, 67, 54, 0.9)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  occupancyText: { color: '#fff', fontWeight: 'bold', fontSize: 16, marginLeft: 6 },
  occupancyLabel: { color: '#fff', fontSize: 12, marginLeft: 4, opacity: 0.9 },
  etaCard: { backgroundColor: 'rgba(46, 125, 50, 0.95)', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', minWidth: 80 },
  etaHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  etaHeaderText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  etaTime: { color: '#fff', fontSize: 24, fontWeight: 'bold', lineHeight: 24 },
  etaUnit: { color: '#fff', fontSize: 12, opacity: 0.9 },

  // Markers
  busMarker: {
    width: 44, height: 44, backgroundColor: '#2E7D32', borderRadius: 22, justifyContent: 'center', alignItems: 'center',
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6,
    borderWidth: 3, borderColor: '#fff',
  },
  busMarkerActive: { backgroundColor: '#FF6B35', borderColor: '#FFE0D6' },
  busMarkerDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', top: -2, right: -2, borderWidth: 2, borderColor: '#fff' },
  userMarker: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  userMarkerRing: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(46, 125, 50, 0.3)', position: 'absolute' },
  userDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2E7D32', borderWidth: 3, borderColor: '#fff' },

  // Action Panel
  actionPanel: { margin: 20, marginTop: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#1B5E20', marginBottom: 16 },
  durationSection: { marginBottom: 24 },
  durationCard: {
    backgroundColor: '#fff', borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8,
  },
  durationButton: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#E8F5E8', justifyContent: 'center', alignItems: 'center',
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  durationDisplay: { alignItems: 'center', marginHorizontal: 32 },
  durationValue: { fontSize: 32, fontWeight: 'bold', color: '#2E7D32', lineHeight: 32 },
  durationUnit: { fontSize: 14, color: '#666', marginTop: 4 },

  notifyButton: {
    backgroundColor: '#2E7D32', borderRadius: 20, elevation: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8,
  },
  notifyButtonContent: { flexDirection: 'row', alignItems: 'center', padding: 20 },
  notifyButtonText: { marginLeft: 16, flex: 1 },
  notifyTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  notifySubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },

  closeButton: {
    backgroundColor: '#F44336', borderRadius: 20, flexDirection: 'row', alignItems: 'center', padding: 20, marginBottom: 16,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  closeButtonContent: { marginLeft: 16, flex: 1 },
  closeTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  closeSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },

  acknowledgedCard: {
    backgroundColor: '#4CAF50', borderRadius: 20, flexDirection: 'row', alignItems: 'center', padding: 20,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  waitingCard: {
    backgroundColor: '#FF9800', borderRadius: 20, flexDirection: 'row', alignItems: 'center', padding: 20,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 6,
  },
  statusIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statusContent: { marginLeft: 16, flex: 1 },
  statusTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statusTime: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginTop: 2 },
  statusSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
});
