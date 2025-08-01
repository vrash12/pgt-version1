// app/(tabs)/manager/bus-status.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import mqtt, { MqttClient } from 'mqtt';
import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
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

interface BusStatus {
  id: string;
  lat: number;
  lng: number;
  passengers: number;
  paid: number;
}

interface SensorData {
  id: string;
  in: number;
  out: number;
  total: number;
}

interface Schedule {
  id: number;
  route_id: string;
  origin_lat: number;
  origin_lng: number;
  dest_lat: number;
  dest_lng: number;
  buffer_m: number;
  depart_time: string; // "HH:mm"
  arrive_time: string; // "HH:mm"
}

const BACKEND = 'http://192.168.1.7:5000';
const MQTT_BROKER_URL = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USERNAME   = 'vanrodolf';
const MQTT_PASSWORD   = 'Vanrodolf123.';

const TOPIC_TELEMETRY = 'device/+/telemetry';
const TOPIC_PEOPLE    = 'device/+/people';

const CACHE_KEY_STATUS = 'lastBusStatus';
const CACHE_KEY_SENSOR = 'lastSensorData';

const DEVICES = ['bus-01', 'bus-02', 'bus-03'] as const;
type DeviceId = typeof DEVICES[number];

const { width } = Dimensions.get('window');

export default function BusStatusScreen() {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const mqttRef = useRef<MqttClient | null>(null);

  const [token, setToken] = useState<string | null>(null);
  const [mqttState, setMqttState] = useState<'connecting' | 'connected' | 'error'>('connecting');

  const [statuses, setStatuses] = useState<Record<DeviceId, BusStatus>>({} as any);
  const [sensors,   setSensors]   = useState<Record<DeviceId, SensorData>>({} as any);

  const [selectedId, setSelectedId] = useState<'all' | DeviceId>('all');
  const [schedules,        setSchedules] = useState<Schedule[]>([]);
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [countingActive,  setCountingActive] = useState<'0' | '1' | null>(null);

  // Safe-area & tab-bar offset
  const insets = useSafeAreaInsets();
  const TAB_BAR_HEIGHT = (Platform.OS === 'ios' ? 72 : 64) + insets.bottom;

  /* ── helpers ────────────────────────────────────────────────── */
  const activeStatus = selectedId !== 'all' ? statuses[selectedId] : undefined;
  const activeSensor = selectedId !== 'all' ? sensors[selectedId]   : undefined;
  const visibleStatuses = selectedId === 'all'
  ? Object.values(statuses)
  : (statuses[selectedId] ? [statuses[selectedId]] : []);

  useEffect(() => {
    if (selectedId !== 'all' && activeStatus && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: activeStatus.lat,
          longitude: activeStatus.lng,
          latitudeDelta: 0.002,
          longitudeDelta: 0.002,
        },
        400            // ms animation
      );
    }
  }, [selectedId, activeStatus]);
  
  const getMqttStatusColor = () => {
    if (mqttState === 'connected') return '#10B981';
    if (mqttState === 'error')     return '#EF4444';
    return '#F59E0B';
  };
  const getMqttStatusText = () => {
    if (mqttState === 'connected') return 'Connected';
    if (mqttState === 'error')     return 'Connection Error';
    return 'Connecting...';
  };
  const getMqttStatusIcon = () => {
    if (mqttState === 'connected') return '✓';
    if (mqttState === 'error')     return '✗';
    return '⟳';
  };

  /* ── effects ────────────────────────────────────────────────── */
  useEffect(() => {
    AsyncStorage.getItem('@token').then(t => setToken(t));
  }, []);

  useEffect(() => {
    (async () => {
      const newS: any = {}, newSe: any = {};
      for (const id of DEVICES) {
        const st = await AsyncStorage.getItem(`${CACHE_KEY_STATUS}:${id}`);
        if (st) newS[id] = { id, ...JSON.parse(st) };
        const sr = await AsyncStorage.getItem(`${CACHE_KEY_SENSOR}:${id}`);
        if (sr) newSe[id] = { id, ...JSON.parse(sr) };
      }
      setStatuses(newS);
      setSensors(newSe);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      // fetch schedules, pick next…
      // start geofencing…
    })();
  }, [currentSchedule]);

  useEffect(() => {
    if (!token) return;
    const poll = setInterval(async () => {
      const flag = await AsyncStorage.getItem('@countingActive');
      setCountingActive(flag as any);
    }, 2000);

    const client = mqtt.connect(MQTT_BROKER_URL, {
      username: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      keepalive: 30,
      reconnectPeriod: 2000,
      protocol: 'wss',
    });
    mqttRef.current = client;

    client.on('connect', () => {
      setMqttState('connected');
      client.subscribe([TOPIC_TELEMETRY, TOPIC_PEOPLE], { qos: 1 });
    });
    client.on('error', err => {
      setMqttState('error');
      client.end();
    });
    client.on('message', async (topic, raw) => {
      const [, deviceId, channel] = topic.split('/');
      if (!DEVICES.includes(deviceId as any)) return;
      const msg = JSON.parse(raw.toString());
      if (channel === 'telemetry') {
        const { lat, lng, people, paid = 0 } = msg;
        setStatuses(prev => {
          const updated = {
            ...prev,
            [deviceId]: { id: deviceId, lat, lng, passengers: people, paid },
          };
          AsyncStorage.setItem(
            `${CACHE_KEY_STATUS}:${deviceId}`,
            JSON.stringify({ lat, lng, people, paid })
          );
          return updated;
        });
      }
      if (channel === 'people') {
        const se: SensorData = {
          id: deviceId,
          in: Number(msg.in) || 0,
          out: Number(msg.out) || 0,
          total: Number(msg.total) || 0,
        };
        setSensors(prev => {
          const updated = { ...prev, [deviceId]: se };
          AsyncStorage.setItem(
            `${CACHE_KEY_SENSOR}:${deviceId}`,
            JSON.stringify(se)
          );
          return updated;
        });
        if (countingActive === '1') {
          fetch(`${BACKEND}/manager/sensor-readings`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ deviceId, ...se }),
          });
        }
      }
    });

    return () => {
      clearInterval(poll);
      client.end(true);
    };
  }, [token, countingActive]);

  const totalBuses = DEVICES.length;
  const activeBuses = Object.keys(statuses).length;
  const totalPassengers = Object.values(statuses).reduce((sum, bus) => sum + (bus.passengers || 0), 0);
  const totalPaid = Object.values(statuses).reduce((sum, bus) => sum + (bus.paid || 0), 0);

  /* ── render ────────────────────────────────────────────────── */
  return (
    <LinearGradient colors={['#059669', '#047857', '#065F46']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Enhanced Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <View style={styles.backBtnInner}>
              <Text style={styles.backTxt}>←</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.titleLine1}>
              🚌 Bus Fleet Monitor
            </Text>
            <Text style={styles.titleLine2}>
              {currentSchedule ? `Route Active • ${currentSchedule.depart_time}` : 'Real-time Tracking'}
            </Text>
          </View>
        </View>

        {/* Enhanced Status Cards Row */}
        <View style={styles.statusRow}>
          <View style={[styles.statusCard, styles.mqttCard]}>
            <View style={styles.statusCardHeader}>
              <View style={[styles.statusIcon, { backgroundColor: getMqttStatusColor() }]}>
                <Text style={styles.statusIconText}>{getMqttStatusIcon()}</Text>
              </View>
              <View>
                <Text style={styles.statusCardTitle}>Connection</Text>
                <Text style={[styles.statusCardValue, { color: getMqttStatusColor() }]}>
                  {getMqttStatusText()}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusCard, styles.countingCard]}>
            <View style={styles.statusCardHeader}>
              <View style={[styles.statusIcon, { 
                backgroundColor: countingActive === '1' ? '#10B981' : '#EF4444' 
              }]}>
                <Text style={styles.statusIconText}>
                  {countingActive === '1' ? '▶' : '⏸'}
                </Text>
              </View>
              <View>
                <Text style={styles.statusCardTitle}>Counting</Text>
                <Text style={[styles.statusCardValue, { 
                  color: countingActive === '1' ? '#10B981' : '#EF4444' 
                }]}>
                  {countingActive === '1' ? 'Active' : 'Paused'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Fleet Overview Cards */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewValue}>{activeBuses}/{totalBuses}</Text>
            <Text style={styles.overviewLabel}>Active Buses</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewValue}>{totalPassengers}</Text>
            <Text style={styles.overviewLabel}>Total Passengers</Text>
          </View>
          <View style={styles.overviewCard}>
            <Text style={styles.overviewValue}>{totalPaid}</Text>
            <Text style={styles.overviewLabel}>Paid Fares</Text>
          </View>
        </View>

        {/* Enhanced Fleet Selector */}
        <View style={styles.fleetSection}>
          <Text style={styles.sectionTitle}>🚍 Select Bus</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.fleetBar}
            contentContainerStyle={styles.fleetBarContent}
          >
            <TouchableOpacity
              style={[styles.busChip, selectedId === 'all' && styles.busChipActive]}
              onPress={() => setSelectedId('all')}
            >
              <View style={styles.busChipContent}>
                <Text style={[styles.busChipTxt, selectedId === 'all' && styles.busChipTxtActive]}>
                  ALL BUSES
                </Text>
                <Text style={[styles.busChipSubtxt, selectedId === 'all' && styles.busChipSubtxtActive]}>
                  Fleet View
                </Text>
              </View>
            </TouchableOpacity>
            {DEVICES.map(id => {
              const isActive = selectedId === id;
              const busStatus = statuses[id];
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.busChip, isActive && styles.busChipActive]}
                  onPress={() => setSelectedId(id)}
                >
                  <View style={styles.busChipContent}>
                    <Text style={[styles.busChipTxt, isActive && styles.busChipTxtActive]}>
                      {id.toUpperCase()}
                    </Text>
                    <Text style={[styles.busChipSubtxt, isActive && styles.busChipSubtxtActive]}>
                      {busStatus ? `${busStatus.passengers} pax` : 'Offline'}
                    </Text>
                  </View>
                  {busStatus && (
                    <View style={[styles.busStatusDot, { backgroundColor: '#10B981' }]} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main scrollable content */}
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: TAB_BAR_HEIGHT + 16 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Enhanced Map */}
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>📍 Live Location</Text>
            <View style={styles.mapWrapper}>
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: 15.67,
                  longitude: 120.63,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01
                }}
              >
              {visibleStatuses.map(bs => (
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
              <View style={styles.mapOverlay}>
                <Text style={styles.mapOverlayText}>
                  {Object.keys(statuses).length} buses tracked
                </Text>
              </View>
            </View>
          </View>

          {/* Enhanced Statistics Section */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>📊 Live Statistics</Text>

            {selectedId === 'all' ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Fleet Overview</Text>
                  <View style={styles.cardBadge}>
                    <Text style={styles.cardBadgeText}>{DEVICES.length} Buses</Text>
                  </View>
                </View>
                
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderText, { flex: 1.2 }]}>Bus ID</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Passengers</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Paid</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Inside</Text>
                  <Text style={[styles.tableHeaderText, { flex: 0.8 }]}>Status</Text>
                </View>
                
                <ScrollView style={{ maxHeight: 300 }}>
                  {DEVICES.map(id => {
                    const bs = statuses[id];
                    const se = sensors[id];
                    const isOnline = !!bs;
                    return (
                      <TouchableOpacity
                        key={id}
                        style={[styles.tableRow, isOnline && styles.tableRowOnline]}
                        onPress={() => setSelectedId(id)}
                      >
                        <Text style={[styles.tableCell, { flex: 1.2, fontWeight: '600' }]}>
                          {id.toUpperCase()}
                        </Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>
                          {bs?.passengers ?? '–'}
                        </Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>
                          {bs?.paid ?? '–'}
                        </Text>
                        <Text style={[styles.tableCell, { flex: 1 }]}>
                          {se?.total ?? '–'}
                        </Text>
                        <View style={[styles.tableCell, { flex: 0.8 }]}>
                          <View style={[styles.statusDot, { 
                            backgroundColor: isOnline ? '#10B981' : '#9CA3AF' 
                          }]} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            ) : (
              <>
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>
                      🚌 {selectedId?.toUpperCase()} Status
                    </Text>
                    <View style={[styles.cardBadge, { 
                      backgroundColor: activeStatus ? '#DCFCE7' : '#F3F4F6' 
                    }]}>
                      <Text style={[styles.cardBadgeText, { 
                        color: activeStatus ? '#166534' : '#6B7280' 
                      }]}>
                        {activeStatus ? 'Online' : 'Offline'}
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
                        <Text style={styles.statLabel}>Passengers</Text>
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
                      <Text style={styles.emptyStateText}>Waiting for bus data...</Text>
                      <Text style={styles.emptyStateSubtext}>
                        Make sure the selected bus is online
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>🔢 Sensor Readings</Text>
                    <View style={[styles.cardBadge, { 
                      backgroundColor: activeSensor ? '#DCFCE7' : '#F3F4F6' 
                    }]}>
                      <Text style={[styles.cardBadgeText, { 
                        color: activeSensor ? '#166534' : '#6B7280' 
                      }]}>
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
                      <Text style={styles.emptyStateSubtext}>
                        Waiting for passenger counting data
                      </Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, paddingHorizontal: 16 },
  
  // Enhanced Header
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  countingCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  mqttCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  backBtn: { marginRight: 12 },
  backBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backTxt: { fontSize: 20, color: '#FFF', fontWeight: '600' },
  headerContent: { flex: 1 },
  titleLine1: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#FFF',
    marginBottom: 2,
  },
  titleLine2: { 
    fontSize: 14, 
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },

  // Status Cards Row
  statusRow: { 
    flexDirection: 'row', 
    marginBottom: 16,
    gap: 12,
  },
  statusCard: { 
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusIconText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  statusCardTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  statusCardValue: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Overview Cards
  overviewRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 8,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
  },
  overviewLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Fleet Section
  fleetSection: { marginBottom: 16 },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#FFF', 
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  fleetBar: { },
  fleetBarContent: { paddingHorizontal: 4 },
  busChip: { 
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    marginRight: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    position: 'relative',
  },
  busChipActive: { 
    backgroundColor: '#FFF',
    borderColor: '#10B981',
    borderWidth: 2,
  },
  busChipContent: {
    alignItems: 'center',
  },
  busChipTxt: { 
    fontSize: 14, 
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  busChipTxtActive: { color: '#059669' },
  busChipSubtxt: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  busChipSubtxtActive: { color: '#6B7280' },
  busStatusDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Scrollable Content
  scrollContent: { paddingBottom: 0 },

  // Map Section
  mapSection: { marginBottom: 20 },
  mapWrapper: { 
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  map: { flex: 1 },
  mapOverlay: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  mapOverlayText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },

  // Stats Section
  statsSection: { marginBottom: 20 },
  card: { 
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '700',
    color: '#1F2937',
  },
  cardBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },

  // Table Styles
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 8,
    marginBottom: 4,
  },
  tableRowOnline: {
    backgroundColor: '#F0FDF4',
  },
  tableCell: {
    fontSize: 14,
    color: '#1F2937',
    textAlign: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statIconText: {
    fontSize: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});