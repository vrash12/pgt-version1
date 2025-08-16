//app/(tabs)/manager/bus-status.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from "../../config";
   
   /* ── constants ───────────────────────────────────────────────────── */

   const MQTT_BROKER_URL  = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
   const MQTT_USERNAME    = 'vanrodolf';
   const MQTT_PASSWORD    = 'Vanrodolf123.';
   const { height: SCREEN_H } = Dimensions.get('window');
   const MAP_HEIGHT = Math.min(180, SCREEN_H * 0.60); // ~60% of screen, capped
   const TOPIC_TELEMETRY  = 'device/+/telemetry';
   const TOPIC_PEOPLE     = 'device/+/people';
   const TOPIC_FARE       = 'device/+/fare';
   const OFFLINE_GRACE_MS = 20_000;
   const CACHE_KEY_STATUS = 'lastBusStatus';
   const CACHE_KEY_SENSOR = 'lastSensorData';
   
   const DEVICES = ['bus-01', 'bus-02', 'bus-03'] as const;
   type DeviceId = (typeof DEVICES)[number];
   
   /* ── helpers ─────────────────────────────────────────────────────── */
   function isDeviceId(id: string): id is DeviceId {
     return (DEVICES as readonly string[]).includes(id);
   }
   const busToDeviceId = (raw: string): DeviceId | null => {
     const norm = raw.trim().toLowerCase().replace(/\s+/g, '-');
     return isDeviceId(norm) ? norm : null;
   };
   
   /* ── types ───────────────────────────────────────────────────────── */
   interface BusStatus {
     id: string;               // device topic id
     lat: number;
     lng: number;
     passengers: number;
     paid: number;
   }
   interface SensorData { id: string; in: number; out: number; total: number; }
   
   /* ── component ───────────────────────────────────────────────────── */
   export default function BusStatusScreen() {
     const router   = useRouter();
     const mapRef   = useRef<MapView | null>(null); 
     const mqttRef  = useRef<MqttClient | null>(null);
     const lastSeenRef = useRef<Record<DeviceId, number>>({} as any);

     /* layout helpers */
     const insets         = useSafeAreaInsets();
     const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 72 : 64) + insets.bottom;
   
     /* state */
     const [token, setToken]           = useState<string | null>(null);
     const [mqttState, setMqttState]   = useState<'connecting' | 'connected' | 'error'>('connecting');
     const [statuses, setStatuses]     = useState<Record<DeviceId, BusStatus>>({} as any);
     const [sensors, setSensors]       = useState<Record<DeviceId, SensorData>>({} as any);
     const [counting, setCounting]     = useState<'0' | '1' | null>(null);
     const [selectedId, setSelectedId] = useState<'all' | DeviceId>('all');
     const [fullMap, setFullMap] = useState(false);
     /* convenience */
     const activeStatus = selectedId !== 'all' ? statuses[selectedId] : undefined;
     const activeSensor = selectedId !== 'all' ? sensors[selectedId]  : undefined;

// force periodic re-evaluation of freshness even if no new MQTT messages arrive
const [heartbeat, setHeartbeat] = React.useState(0);
React.useEffect(() => {
  const iv = setInterval(() => setHeartbeat(h => (h + 1) % 1_000_000), 1000); // 1s
  return () => clearInterval(iv);
}, []);

       // 1) helper (inside BusStatusScreen, before you compute `visible`)
const isFresh = React.useCallback(
  (id: DeviceId, now = Date.now()) =>
    now - (lastSeenRef.current[id] ?? 0) <= OFFLINE_GRACE_MS,
  []
);


const freshList = React.useMemo(() => {
  const now = Date.now();
  return (Object.values(statuses) as BusStatus[]).filter(bs =>
    isFresh(bs.id as DeviceId, now)
  );
}, [statuses, isFresh, heartbeat]); // 👈 add heartbeat



const visible = React.useMemo(() => {
  if (selectedId === 'all') return freshList;
  const one = freshList.find(b => b.id === selectedId);
  return one ? [one] : [];
}, [freshList, selectedId]);
   
     /* ── init: token + cached data ────────────────────────────────── */
     useEffect(() => { AsyncStorage.getItem('@token').then(setToken); }, []);
   
     useEffect(() => {
       (async () => {
         const s: any = {}, se: any = {};
         for (const id of DEVICES) {
           const st = await AsyncStorage.getItem(`${CACHE_KEY_STATUS}:${id}`);
           if (st) s[id]  = { id, ...JSON.parse(st) };
           const sr = await AsyncStorage.getItem(`${CACHE_KEY_SENSOR}:${id}`);
           if (sr) se[id] = { id, ...JSON.parse(sr) };
         }
         setStatuses(s);
         setSensors(se);
         
         // ⬇️ mark hydrated entries as stale; prune will remove them if no fresh data
         Object.keys(s).forEach(id => {
           lastSeenRef.current[id as DeviceId] = 0;
         });
       })();
     }, []);
   
     /* helper to merge PAID count without losing other fields */
     const mergePaidCount = (deviceId: DeviceId, paid: number) =>
       setStatuses(prev => {
         const base   = prev[deviceId] ?? { id: deviceId, lat:0, lng:0, passengers:0, paid:0 };
         const merged = { ...prev, [deviceId]: { ...base, paid } };
         AsyncStorage.mergeItem(`${CACHE_KEY_STATUS}:${deviceId}`, JSON.stringify({ paid }));
         return merged;
       });
// keep selected bus in a ref so the MQTT effect doesn't depend on it
const selectedRef = React.useRef<'all' | DeviceId>('all');
useEffect(() => { selectedRef.current = selectedId; }, [selectedId]);

useEffect(() => {
  if (!token) return;

  setMqttState('connecting');

  // poll counting flag
  const poll = setInterval(async () => {
    setCounting((await AsyncStorage.getItem('@countingActive')) as '0' | '1' | null);
  }, 2000);

  // stable MQTT connection with auto-reconnect
  const client = mqtt.connect(MQTT_BROKER_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    protocol: 'wss',
    keepalive: 30,
    clean: true,
    reconnectPeriod: 3000,
    connectTimeout: 10_000,
    clientId: `manager-${Math.random().toString(16).slice(2)}`,
  });
  mqttRef.current = client;

  const subscribeAll = () => {
    client.subscribe([TOPIC_TELEMETRY, TOPIC_PEOPLE, TOPIC_FARE], { qos: 1 });
  };

  client.on('connect', () => {
    setMqttState('connected');
    subscribeAll(); // runs on initial connect and after reconnect
  });
  client.on('reconnect', () => setMqttState('connecting'));
  client.on('close',     () => setMqttState('connecting'));
  client.on('offline',   () => setMqttState('connecting'));
  client.on('error', (err) => {
    console.warn('[mqtt] error:', err?.message);
    // DO NOT end() here; let mqtt.js auto-reconnect
  });

  client.on('message', (topic, raw) => {
    const [, deviceId, channel] = topic.split('/');
    if (!isDeviceId(deviceId)) return;

    const msg = JSON.parse(raw.toString());
    // mark last-seen for offline pruning
    lastSeenRef.current[deviceId] = Date.now();

    if (channel === 'telemetry') {
      const { lat, lng, people, paid = 0 } = msg;
      setStatuses(prev => {
        const next = { ...prev, [deviceId]: { id: deviceId, lat, lng, passengers: people, paid } };
        AsyncStorage.setItem(`${CACHE_KEY_STATUS}:${deviceId}`, JSON.stringify({ lat, lng, people, paid }));
        return next;
      });
      return;
    }

    if (channel === 'people') {
      const se: SensorData = {
        id: deviceId,
        in: +msg.in || 0,
        out: +msg.out || 0,
        total: +msg.total || 0,
      };
      setSensors(prev => {
        const next = { ...prev, [deviceId]: se };
        AsyncStorage.setItem(`${CACHE_KEY_SENSOR}:${deviceId}`, JSON.stringify(se));
        return next;
      });
      if (counting === '1') {
        fetch(`${API_BASE_URL}/manager/sensor-readings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ deviceId, ...se }),
        }).catch(() => {});
      }
      return;
    }

    if (channel === 'fare') {
      mergePaidCount(deviceId, Number(msg.paid) || 0);
    }
  });

  // prune offline devices inside this effect
  const prune = setInterval(() => {
    const now = Date.now();
    const staleIds = (Object.keys(lastSeenRef.current) as DeviceId[]).filter(
      id => now - (lastSeenRef.current[id] ?? 0) > OFFLINE_GRACE_MS
    );
    if (!staleIds.length) return;

    setStatuses(prev => {
      const next = { ...prev };
      staleIds.forEach(id => delete next[id]);
      return next;
    });
    setSensors(prev => {
      const next = { ...prev };
      staleIds.forEach(id => delete next[id]);
      return next;
    });

    // if currently viewing a bus that went offline, jump back to "all"
    if (staleIds.includes(selectedRef.current as DeviceId)) {
      setSelectedId('all');
    }

    staleIds.forEach(id => { delete lastSeenRef.current[id]; });
  }, 5000);

  return () => {
    clearInterval(poll);
    clearInterval(prune);
    client.end(true);
  };
}, [token, counting]); // note: no selectedId here

    
   
     /* ── backend poll every 15 s to reconcile paid counters ───────── */
     useEffect(() => {
       if (!token) return;
   // inside useEffect(() => { … }, [token])
const run = async () => {
  try {
    const day   = dayjs().format('YYYY-MM-DD');
    const res   = await fetch(`${API_BASE_URL}/manager/tickets?date=${day}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const json  = await res.json();
    const list  = Array.isArray(json) ? json : json.tickets;

    const perBus: Record<DeviceId, number> = {} as any;
    list.forEach((t: any) => {
      /* if backend supplies a paid flag, respect it;
         otherwise assume every ticket is paid           */
      if (t.paid === false) return;

      const id = busToDeviceId(t.bus);
      if (id) perBus[id] = (perBus[id] || 0) + 1;
    });

    Object.entries(perBus).forEach(([id, paid]) =>
      mergePaidCount(id as DeviceId, paid as number)
    );
  } catch {/* silent */}
};

       run();
       const id = setInterval(run, 15000);
       return () => clearInterval(id);
     }, [token]);
   
     /* pan to bus when selected */
     useEffect(() => {
      if (
            selectedId !== 'all' &&
            activeStatus &&
            Number.isFinite(activeStatus.lat) &&
            Number.isFinite(activeStatus.lng) &&
            mapRef.current
          ) {
         mapRef.current.animateToRegion({
           latitude:   activeStatus.lat,
           longitude:  activeStatus.lng,
           latitudeDelta: 0.002,
           longitudeDelta: 0.002,
         }, 400);
       }
     }, [selectedId, activeStatus]);
   
   // 3) totals should use only fresh buses
   const activeBuses     = freshList.length;
   const totalPassengers = freshList.reduce((s, b) => s + (b.passengers || 0), 0);
   const totalPaid       = freshList.reduce((s, b) => s + (b.paid || 0), 0);
   
   
     /* UI helpers */
     const mqttColor = mqttState === 'connected' ? '#10B981'
                    : mqttState === 'error'     ? '#EF4444'
                    : '#F59E0B';
     const mqttIcon  = mqttState === 'connected' ? '✓' : mqttState === 'error' ? '✗' : '⟳';
     const mqttText  = mqttState === 'connected' ? 'Connected'
                    : mqttState === 'error'     ? 'Connection Error' : 'Connecting…';
   
     /* ── render ──────────────────────────────────────────────────── */
     return (
       <LinearGradient colors={['#059669', '#047857', '#065F46']} style={styles.container}>
         <SafeAreaView style={styles.safeArea}>
           {/* header */}
           <View style={styles.header}>
             <View style={styles.headerContent}>
               <Text style={styles.titleLine1}>🚌 Bus Fleet Monitor</Text>
               <Text style={styles.titleLine2}>Real-time Tracking</Text>
             </View>
           </View>
   
           {/* connection / counting */}
           <View style={styles.statusRow}>
             <View style={[styles.statusCard, styles.mqttCard]}>
               <View style={styles.statusCardHeader}>
                 <View style={[styles.statusIcon, { backgroundColor: mqttColor }]}>
                   <Text style={styles.statusIconText}>{mqttIcon}</Text>
                 </View>
                 <View>
                   <Text style={styles.statusCardTitle}>Connection</Text>
                   <Text style={[styles.statusCardValue, { color: mqttColor }]}>{mqttText}</Text>
                 </View>
               </View>
             </View>
   
      
           </View>
   
           {/* overview */}
           <View style={styles.overviewRow}>
             <Overview value={`${activeBuses}/${DEVICES.length}`} label="Active Buses" />
             <Overview value={String(totalPassengers)}            label="Passengers"  />
             <Overview value={String(totalPaid)}                  label="Paid Fares" />
           </View>
   
           {/* fleet selector chips */}
           <FleetSelector
             selectedId={selectedId}
             setSelectedId={setSelectedId}
             statuses={statuses}
             isFresh={isFresh}  
           />
   
           {/* scroll area */}
           <ScrollView
             contentContainerStyle={[styles.scrollContent, { paddingBottom: TAB_BAR_HEIGHT + 16 }]}
             showsVerticalScrollIndicator={false}
           >
             <LiveMap
               mapRef={mapRef}
               buses={visible}
               selectedId={selectedId}
               setSelectedId={setSelectedId}
               setFullMap={setFullMap} 
             />
   
             <StatsSection
               selectedId={selectedId}
               activeStatus={activeStatus}
               activeSensor={activeSensor}
               statuses={statuses}
               sensors={sensors}
               setSelectedId={setSelectedId}  
               isFresh={isFresh}    
             />
       <Modal
  visible={fullMap}
  animationType="fade"
  onRequestClose={() => setFullMap(false)}
>
  <View style={{ flex: 1, backgroundColor: '#000' }}>
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: 15.67,
        longitude: 120.63,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }}
    >
      {visible
        .filter(bs => Number.isFinite(bs.lat) && Number.isFinite(bs.lng))
        .map(bs => (
          <Marker
            key={bs.id}
            pinColor={bs.id === selectedId ? '#10B981' : '#059669'}
            coordinate={{ latitude: bs.lat, longitude: bs.lng }}
            title={bs.id.toUpperCase()}
            description={`${bs.passengers} passengers • ${bs.paid} paid`}
          />
        ))}
    </MapView>

    {/* top controls */}
    <View style={styles.fullscreenTopBar}>
      <TouchableOpacity style={styles.fullscreenBtn} onPress={() => setFullMap(false)}>
        <Text style={styles.fullscreenBtnTxt}>⤡  Close map</Text>
      </TouchableOpacity>

      <View style={styles.fullscreenPill}>
        <Text style={styles.fullscreenPillTxt}>{visible.length} active</Text>
      </View>
    </View>
  </View>
</Modal>

           </ScrollView>
         </SafeAreaView>
       </LinearGradient>
     );
   }
   
   /* ── small presentational helpers ───────────────────────────────── */
   const Overview = ({ value, label }: { value: string; label: string }) => (
     <View style={styles.overviewCard}>
       <Text style={styles.overviewValue}>{value}</Text>
       <Text style={styles.overviewLabel}>{label}</Text>
     </View>
   );
   const FleetSelector = ({
    selectedId,
    setSelectedId,
    statuses,
    isFresh,
  }: {
    selectedId: 'all' | DeviceId;
    setSelectedId: (v: 'all' | DeviceId) => void;
    statuses: Record<DeviceId, BusStatus>;
    isFresh: (id: DeviceId) => boolean;
  }) => (
    <View style={styles.fleetSection}>
      <Text style={styles.sectionTitle}>🚍 Select Bus</Text>
  
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.fleetBarContent}
        decelerationRate="fast"
        snapToAlignment="start"
        snapToInterval={116}
        pagingEnabled={false}
      >
        <Chip
          id="all"
          selected={selectedId === 'all'}
          label="ALL BUSES"
          sub="Fleet View"
          onPress={() => setSelectedId('all')}
        />
  
        {DEVICES.map((id: DeviceId) => {
          const online = isFresh(id);
          const pax = statuses[id]?.passengers ?? 0;
  
          return (
            <Chip
              key={id}
              id={id}
              selected={selectedId === id}
              label={id.toUpperCase()}
              sub={online ? `${pax} pax` : 'Offline'}
              onPress={() => setSelectedId(id)}
              online={online}
            />
          );
        })}
      </ScrollView>
    </View>
  );
  
  const Chip = ({
    id,
    selected,
    label,
    sub,
    onPress,
    online = false,
  }: {
    id: string;
    selected: boolean;
    label: string;
    sub: string;
    onPress: () => void;
    online?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.busChip, selected && styles.busChipActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.busChipContent}>
        <Text style={[styles.busChipTxt, selected && styles.busChipTxtActive]}>{label}</Text>
        <Text style={[styles.busChipSubtxt, selected && styles.busChipSubtxtActive]}>{sub}</Text>
      </View>
  
      {online && <View style={[styles.busStatusDot, { backgroundColor: '#10B981' }]} />}
    </TouchableOpacity>
  );
  
   
   const LiveMap = ({
    mapRef,
    buses,
    selectedId,
    setSelectedId,
    setFullMap,
  }: {
    mapRef: React.RefObject<MapView | null>;
    buses: BusStatus[];
    selectedId: 'all' | DeviceId;
    setSelectedId: (id: DeviceId) => void;
    setFullMap: (v: boolean) => void;
  }) => (
    <View style={styles.mapSection}>
      <Text style={styles.sectionTitle}>📍 Live Location</Text>
  
      {/* use dynamic height */}
      <View style={[styles.mapWrapper, { height: MAP_HEIGHT }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: 15.67,
            longitude: 120.63,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          onPress={() => setFullMap(true)}  // 👈 tap anywhere to expand
        >
          {buses
            .filter(bs => Number.isFinite(bs.lat) && Number.isFinite(bs.lng))
            .map(bs => (
              <Marker
                key={bs.id}
                pinColor={bs.id === selectedId ? '#10B981' : '#059669'}
                coordinate={{ latitude: bs.lat, longitude: bs.lng }}
                title={bs.id.toUpperCase()}
                description={`${bs.passengers} passengers • ${bs.paid} paid`}
                onPress={() => setSelectedId(bs.id as DeviceId)}
              />
            ))}
        </MapView>
  
        {/* small overlay count */}
        <View style={styles.mapOverlay}>
          <Text style={styles.mapOverlayText}>{buses.length} buses tracked</Text>
        </View>
  
        {/* expand to fullscreen via FAB as well */}
        <TouchableOpacity style={styles.mapFab} onPress={() => setFullMap(true)}>
          <Text style={{ color: '#fff', fontWeight: '800' }}>⤢</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
  
   
   const StatsSection = ({
     selectedId,
     activeStatus,
     activeSensor,
     statuses,
     sensors,
     setSelectedId,
     isFresh,     
   }: {
     selectedId: 'all' | DeviceId;
     activeStatus: BusStatus | undefined;
     activeSensor: SensorData | undefined;
     statuses: Record<DeviceId, BusStatus>;
     sensors: Record<DeviceId, SensorData>;
     isFresh: (id: DeviceId) => boolean;
     setSelectedId: (id: DeviceId) => void
   }) => {
     if (selectedId === 'all') {
       return (
         <View style={styles.card}>
           <View style={styles.cardHeader}>
             <Text style={styles.cardTitle}>Fleet Overview</Text>
             <View style={styles.cardBadge}>
               <Text style={styles.cardBadgeText}>{DEVICES.length} Buses</Text>
             </View>
           </View>
   
           <View style={styles.tableHeader}>
             <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Bus ID</Text>
             <Text style={[styles.tableHeaderText, { flex: 1 }]}>Passenger</Text>
             <Text style={[styles.tableHeaderText, { flex: 1 }]}>Paid</Text>
             <Text style={[styles.tableHeaderText, { flex: 1 }]}>Inside</Text>
             <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Status</Text>
           </View>
   
           <ScrollView style={{ maxHeight: 300 }}>
             {DEVICES.map(id => {
               const bs = statuses[id];
               const se = sensors[id];
               const online = isFresh(id); 
               const pax = statuses[id]?.passengers ?? 0;
               return (
                <TouchableOpacity
                key={id}
                style={[styles.tableRow, online && styles.tableRowOnline]}
                onPress={() => setSelectedId(id)}
                activeOpacity={0.8}
              >
                {/* Bus ID */}
                <View style={[styles.tableCell, { flex: 1.2 }]}>
                  <Text style={[styles.tableCellText, { fontWeight: '600' }]}>
                    {id.toUpperCase()}
                  </Text>
                </View>
              
                {/* Passengers */}
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <Text style={styles.tableCellText}>
                    {bs?.passengers ?? '–'}
                  </Text>
                </View>
              
                {/* Paid */}
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <Text style={styles.tableCellText}>
                    {bs?.paid ?? '–'}
                  </Text>
                </View>
              
                {/* Inside */}
                <View style={[styles.tableCell, { flex: 1 }]}>
                  <Text style={styles.tableCellText}>
                    {se?.total ?? '–'}
                  </Text>
                </View>
              
                {/* Status */}
                <View style={[styles.tableCell, { flex: 0.8, alignItems: 'center' }]}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: online ? '#10B981' : '#9CA3AF' },
                    ]}
                  />
                </View>
              </TouchableOpacity>
              
               );
             })}
           </ScrollView>
         </View>
       );
     }
   
     /* individual bus view */
     return (
       <>
         <View style={styles.card}>
         <View style={styles.cardHeader}>
  <Text style={styles.cardTitle}>🚌 {selectedId?.toUpperCase()} Status</Text>
  <View style={[styles.cardBadge, { backgroundColor: isFresh(selectedId as DeviceId) ? '#DCFCE7' : '#F3F4F6' }]}>
    <Text style={[styles.cardBadgeText, { color: isFresh(selectedId as DeviceId) ? '#166534' : '#6B7280' }]}>
      {isFresh(selectedId as DeviceId) ? 'Online' : 'Offline'}
    </Text>
  </View>
</View>

   
           {activeStatus ? (
             <View style={styles.statsGrid}>
               <View style={styles.statCard}>
                 <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
                   <Text style={styles.statIconText}>👥</Text>
                 </View>
                 <Text style={styles.statValue}>{activeStatus.passengers}</Text>
                 <Text style={styles.statLabel}>Passenger</Text>
               </View>
   
               <View style={styles.statCard}>
                 <View style={[styles.statIcon, { backgroundColor: '#D1FAE5' }]}>
                   <Text style={styles.statIconText}>💰</Text>
                 </View>
                 <Text style={styles.statValue}>{activeStatus.paid}</Text>
                 <Text style={styles.statLabel}>Paid Fares</Text>
               </View>
             </View>
           ) : (
             <View style={styles.emptyState}>
               <Text style={styles.emptyStateIcon}>📡</Text>
               <Text style={styles.emptyStateText}>Waiting for bus data…</Text>
               <Text style={styles.emptyStateSubtext}>Make sure the selected bus is online</Text>
             </View>
           )}
         </View>
   
         <View style={styles.card}>
           <View style={styles.cardHeader}>
             <Text style={styles.cardTitle}>🔢 Sensor Readings</Text>
             <View
               style={[
                 styles.cardBadge,
                 { backgroundColor: activeSensor ? '#DCFCE7' : '#F3F4F6' },
               ]}
             >
               <Text
                 style={[
                   styles.cardBadgeText,
                   { color: activeSensor ? '#166534' : '#6B7280' },
                 ]}
               >
                 {activeSensor ? 'Active' : 'No Data'}
               </Text>
             </View>
           </View>
   
           {activeSensor ? (
             <View style={styles.statsGrid}>
               <View style={styles.statCard}>
                 <View style={[styles.statIcon, { backgroundColor: '#DCFCE7' }]}>
                   <Text style={styles.statIconText}>↗️</Text>
                 </View>
                 <Text style={styles.statValue}>{activeSensor.in}</Text>
                 <Text style={styles.statLabel}>Entries</Text>
               </View>
               <View style={styles.statCard}>
                 <View style={[styles.statIcon, { backgroundColor: '#FEE2E2' }]}>
                   <Text style={styles.statIconText}>↙️</Text>
                 </View>
                 <Text style={styles.statValue}>{activeSensor.out}</Text>
                 <Text style={styles.statLabel}>Exits</Text>
               </View>
               <View style={styles.statCard}>
                 <View style={[styles.statIcon, { backgroundColor: '#DBEAFE' }]}>
                   <Text style={styles.statIconText}>👤</Text>
                 </View>
                 <Text style={styles.statValue}>{activeSensor.total}</Text>
                 <Text style={styles.statLabel}>Inside</Text>
               </View>
             </View>
           ) : (
             <View style={styles.emptyState}>
               <Text style={styles.emptyStateIcon}>📊</Text>
               <Text style={styles.emptyStateText}>No sensor data available</Text>
               <Text style={styles.emptyStateSubtext}>Waiting for passenger counting data</Text>
             </View>
           )}
         </View>
       </>
     );
   };
   
   /* ───────── styles (unchanged from your previous file) ─────────── */
   const styles = StyleSheet.create({
     container: { flex: 1 },
     safeArea: { flex: 1, paddingHorizontal: 16 },
   
     /* Header */
     header: { flexDirection: 'row', alignItems: 'center', marginTop: 8, marginBottom: 16, paddingHorizontal: 4 },
     headerContent: { flex: 1 },
     titleLine1: { fontSize: 24, fontWeight: 'bold', color: '#FFF', marginBottom: 2 },
     titleLine2: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
   
     /* Status cards */
     statusRow: { flexDirection: 'row', marginBottom: 16, gap: 12 },
     statusCard: { flex: 1, backgroundColor: '#FFF', borderRadius: 16, padding: 16,
       shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
       shadowRadius: 8, elevation: 3 },
     mqttCard: {},
     countingCard: {},
     statusCardHeader: { flexDirection: 'row', alignItems: 'center' },
     statusIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center',
       justifyContent: 'center', marginRight: 12 },
     statusIconText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
     statusCardTitle: { fontSize: 12, color: '#6B7280', fontWeight: '500', marginBottom: 2 },
     statusCardValue: { fontSize: 14, fontWeight: '600' },
   
     /* Overview */
     overviewRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
     overviewCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 12,
       padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
     overviewValue: { fontSize: 20, fontWeight: 'bold', color: '#FFF', marginBottom: 4 },
     overviewLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '500' },
   
     /* Fleet selector */
     fleetSection: { marginBottom: 16 },
     sectionTitle: { fontSize: 18, fontWeight: '700', color: '#FFF', marginBottom: 12, paddingHorizontal: 4 },
     fleetBarContent: { paddingHorizontal: 4 },
     busChip: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, marginRight: 12,
       paddingHorizontal: 16, paddingVertical: 12, minWidth: 100, borderWidth: 1,
       borderColor: 'rgba(255,255,255,0.2)', position: 'relative' },
     busChipActive: { backgroundColor: '#FFF', borderColor: '#10B981', borderWidth: 2 },
     busChipContent: { alignItems: 'center' },
     busChipTxt: { fontSize: 14, fontWeight: '700', color: '#FFF', marginBottom: 2 },
     busChipTxtActive: { color: '#059669' },
     busChipSubtxt: { fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
     busChipSubtxtActive: { color: '#6B7280' },
     busStatusDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
   
     /* Scroll/Map */
     scrollContent: {},
     mapSection: { marginBottom: 20 },
     mapWrapper: {
      // height removed here because we now set it inline with MAP_HEIGHT
      borderRadius: 16,
      overflow: 'hidden',
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5,
    },
    mapFab: {
      position: 'absolute',
      right: 12,
      top: 12,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    // NEW: fullscreen overlay
    fullscreenWrap: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: '#000',
      zIndex: 999,
    },
    fullscreenTopBar: {
      position: 'absolute',
      top: 40,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    fullscreenBtn: {
      backgroundColor: '#E8F5E8',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
    },
    fullscreenBtnTxt: {
      color: '#1B5E20',
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    fullscreenPill: {
      backgroundColor: '#E8F5E8',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
    },
    fullscreenPillTxt: {
      color: '#1B5E20',
      fontWeight: '800',
    },
  
     map: { flex: 1 },
     mapOverlay: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.9)',
       paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
     mapOverlayText: { fontSize: 12, fontWeight: '600', color: '#374151' },
   
     /* Cards & tables */
     card: { backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 16,
       shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1,
       shadowRadius: 8, elevation: 3 },
     cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
     cardTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
     cardBadge: { backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
     cardBadgeText: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
   
     tableHeader: { flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 4,
       backgroundColor: '#F9FAFB', borderRadius: 8, marginBottom: 8 },
     tableHeaderText: { fontSize: 12, fontWeight: '700', color: '#374151', textAlign: 'center' },
     tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
       paddingHorizontal: 4, borderRadius: 8, marginBottom: 4 },
     tableRowOnline: { backgroundColor: '#F0FDF4' },
      tableCell:      { flex: 1 },                       // <- contains layout props only
      tableCellText:  { fontSize: 14,                   // <- new style JUST for <Text>
                        color: '#1F2937',
                        textAlign: 'center' },
     statusDot: { width: 8, height: 8, borderRadius: 4 },
   
     /* small stat cards */
     statsGrid: { flexDirection: 'row', gap: 12 },
     statCard: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 16, alignItems: 'center',
       borderWidth: 1, borderColor: '#E2E8F0' },
     statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
       marginBottom: 8 },
     statIconText: { fontSize: 16 },
     statValue: { fontSize: 24, fontWeight: 'bold', color: '#1F2937', marginBottom: 4 },
     statLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500', textAlign: 'center' },
   
     /* empty */
     emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
     emptyStateIcon: { fontSize: 48, marginBottom: 12 },
     emptyStateText: { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 },
     emptyStateSubtext: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
   });
   