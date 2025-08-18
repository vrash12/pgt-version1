// app/(tabs)/commuter/notifications.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import io, { Socket } from 'socket.io-client';
import { API_BASE_URL } from '../../config';

const { width } = Dimensions.get('window');

import { useIsFocused } from '@react-navigation/native';
import { DeviceEventEmitter } from 'react-native';

type Announcement = {
  id: number;
  message: string;
  timestamp: string;
  bus_identifier: string;
};

type Bus = {
  id: number;
  identifier: string;
};

/** ---------- Helpers (module-scope, no hooks here) ---------- */

const parseServerDate = (s: string) => {
  if (!s) return new Date();
  const cleaned = s.replace(' ', 'T'); // handle "YYYY-MM-DD HH:mm:ss"
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(cleaned);
  return new Date(hasTZ ? cleaned : `${cleaned}Z`); // assume UTC if no TZ
};

// yyyy-mm-dd (local time)
const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};

const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const formatDateTime = (isoString: string) => {
  const date = parseServerDate(isoString);
  const now = new Date();

  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);

  const today = startOfDay();
  const yesterday = startOfDay(new Date(today.getTime() - 24 * 60 * 60 * 1000));
  const dateDay = startOfDay(date);

  if (dateDay.getTime() === today.getTime()) return `${diffHr}h ago`;
  if (dateDay.getTime() === yesterday.getTime()) return 'Yesterday';

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatFullDateTime = (isoString: string) => {
  const date = parseServerDate(isoString);
  return `${date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })} at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}`;
};

/** -------------------- Component -------------------- */

export default function NotificationsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);
  const tabBarHeight = useBottomTabBarHeight();

  // Filters: default to Today (non-nullable)
  const today = useMemo(() => startOfDay(), []);
  const [selectedBus, setSelectedBus] = useState<number | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [showPicker, setShowPicker] = useState(false);

  // Animations
  const filterHeight = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Realtime socket
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  const isFocused = useIsFocused();

  const markAllSeen = async (latestTs?: string) => {
    try {
      const ms = latestTs ? parseServerDate(latestTs).getTime() : Date.now();
      await AsyncStorage.setItem('@lastSeenAnnouncementTs', String(ms));
      DeviceEventEmitter.emit('announcements:seen', ms); // tell tab bar to clear badge instantly
    } catch {}
  };

  useEffect(() => {
    if (!isFocused) return;
    const newest = announcements[0]?.timestamp;
    markAllSeen(newest);
  }, [isFocused, announcements]);
  
  // OPTIONAL: let the poller know not to toast when this screen is in front
  useEffect(() => {
    AsyncStorage.setItem('@ann:screenFocused', isFocused ? '1' : '0').catch(() => {});
  }, [isFocused]);
  // Derive socket origin from API_BASE_URL
  const SOCKET_ORIGIN = useMemo(() => {
    try {
      return new URL(API_BASE_URL).origin; // strips path like /api
    } catch {
      return API_BASE_URL;
    }
  }, []);

  // Load buses once
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/commuter/buses`);
        if (res.ok) setBuses(await res.json());
      } catch {
        // noop
      }
    })();
  }, []);

  // Fetch announcements for the current filters (ALWAYS with date)
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      const params = new URLSearchParams();

      params.append('date', toYMD(selectedDate)); // <- always filter by a specific day
      if (selectedBus !== 'all') params.append('bus_id', String(selectedBus));

      try {
        const token = await AsyncStorage.getItem('@token');
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`${API_BASE_URL}/commuter/announcements?${params.toString()}`, { headers });
        if (res.ok) {
          const data: Announcement[] = await res.json();
          setAnnouncements(data);
          Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };
    fetchAnnouncements();
  }, [selectedBus, selectedDate, fadeAnim]);

  // Real-time: connect socket and handle live inserts (still respect filters)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = await AsyncStorage.getItem('@token');

      // Tear down old socket before creating a new one
      try {
        socketRef.current?.removeAllListeners();
        socketRef.current?.disconnect();
      } catch {}

      // Connect directly to your namespace
      const sock: Socket = io(`${SOCKET_ORIGIN}/rt`, {
        transports: ['websocket'],
        forceNew: true,
        path: '/socket.io',
        reconnectionAttempts: 8,
        reconnectionDelay: 1000,
        timeout: 8000,
        auth: token ? { token } : undefined,
      });

      socketRef.current = sock;

      sock.on('connect', () => { if (!cancelled) setConnected(true); });
      sock.on('disconnect', () => { if (!cancelled) setConnected(false); });

      if (selectedBus !== 'all') {
        sock.emit('subscribe', { bus_id: selectedBus });
      }

      sock.on('announcement:new', (ann: Announcement) => {
        if (cancelled) return;

        const passDate = isSameDay(parseServerDate(ann.timestamp), selectedDate);
        const passBus =
          selectedBus === 'all' ||
          (ann.bus_identifier || '')
            .replace(/^bus[-_]?/i, '')
            .toLowerCase()
            .includes(String(selectedBus).toLowerCase());

        if (passBus && passDate) {
          setAnnouncements(prev => (prev.find(p => p.id === ann.id) ? prev : [ann, ...prev]));
        }
      });
    })();

    return () => {
      cancelled = true;
      try {
        socketRef.current?.removeAllListeners();
        socketRef.current?.disconnect();
      } catch {}
    };
  }, [SOCKET_ORIGIN, selectedBus, selectedDate]);

  const onRefresh = () => {
    setRefreshing(true);
    setSelectedBus(prev => prev); // trigger re-fetch
  };

  const toggleFilters = () => {
    const toValue = filterExpanded ? 0 : 1;
    setFilterExpanded(!filterExpanded);
    Animated.spring(filterHeight, {
      toValue: toValue * 120,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const onDateChange = (_: any, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) setSelectedDate(startOfDay(date));
  };

  const clearFilters = () => {
    setSelectedBus('all');
    setSelectedDate(today);
  };

  const hasActiveFilters = selectedBus !== 'all' || !isSameDay(selectedDate, today);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />

      <LinearGradient colors={['#2E7D32', '#1B5E20', '#0D3F12']} style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="notifications" size={28} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Announcements</Text>
              <Text style={styles.headerSubtitle}>
                {loading ? 'Loading...' : `${announcements.length} ${announcements.length === 1 ? 'announcement' : 'announcements'}`}
                {connected}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.filterToggle, hasActiveFilters && styles.filterToggleActive]}
            onPress={toggleFilters}
          >
            <Ionicons
              name={filterExpanded ? 'chevron-up' : 'options'}
              size={20}
              color={hasActiveFilters ? '#2E7D32' : '#fff'}
            />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <Animated.View style={[styles.filterContainer, { height: filterHeight }]}>
        <View style={styles.filterContent}>
          <View style={styles.filterRow}>
            <View style={styles.pickerWrapper}>
              <Ionicons name="bus-outline" size={18} color="#2E7D32" style={styles.pickerIcon} />
              <Picker
                selectedValue={selectedBus}
                onValueChange={v => setSelectedBus(v)}
                style={styles.picker}
                dropdownIconColor="#2E7D32"
              >
                <Picker.Item label="All Buses" value="all" />
                {buses.map(bus => (
                  <Picker.Item
                    key={bus.id}
                    label={(bus.identifier || `bus-${bus.id}`).replace(/^bus[-_]?/i, 'Bus ')}
                    value={bus.id}
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
              <Ionicons name="calendar-outline" size={18} color="#2E7D32" />
              <Text style={styles.dateButtonText}>
                {selectedDate
                  ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                  : 'Date'}
              </Text>
            </TouchableOpacity>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Ionicons name="refresh-outline" size={16} color="#666" />
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {showPicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyTitle}>No Announcements Found</Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results.'
                : 'Check back later for new announcements.'}
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButtonEmpty} onPress={clearFilters}>
                <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <Animated.View style={[styles.listWrapper, { opacity: fadeAnim }]}>
          <FlatList
            data={announcements}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={[styles.listContainer, { paddingBottom: tabBarHeight + 54 }]}
            ListFooterComponent={<View style={{ height: tabBarHeight + 8 }} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2E7D32']}
                tintColor="#2E7D32"
              />
            }
            renderItem={({ item }) => (
              <Animated.View
                style={[
                  styles.card,
                  {
                    opacity: fadeAnim,
                    transform: [
                      {
                        translateY: fadeAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [50, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="megaphone" size={20} color="#2E7D32" />
                  </View>
                  <View style={styles.busTagContainer}>
                    <View style={styles.busTag}>
                      <Ionicons name="bus" size={10} color="#fff" />
                      <Text style={styles.busTagText}>
                        {item.bus_identifier.replace(/^bus[-_]?/i, '').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.messageText}>{item.message}</Text>

                <View style={styles.cardFooter}>
                  <View style={styles.timestampContainer}>
                    <Ionicons name="time-outline" size={12} color="#999" />
                    <Text style={styles.timestampText}>{formatDateTime(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.fullTimestamp}>{formatFullDateTime(item.timestamp)}</Text>
                </View>
              </Animated.View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

/** -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  headerGradient: { paddingTop: Platform.OS === 'ios' ? 50 : 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff', letterSpacing: -0.5 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterToggleActive: { backgroundColor: '#fff' },
  filterDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5722' },

  filterContainer: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E0E0E0', overflow: 'hidden' },
  filterContent: { padding: 16 },
  filterRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  pickerWrapper: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8F5E8',
    height: 48,
    marginRight: 12,
  },
  pickerIcon: { paddingLeft: 16 },
  picker: { flex: 1, height: 58, color: '#2E7D32' },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    minWidth: 100,
    justifyContent: 'center',
  },
  dateButtonText: { color: '#2E7D32', fontWeight: '600', marginLeft: 6, fontSize: 14 },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    alignSelf: 'center',
  },
  clearFiltersText: { color: '#666', fontSize: 12, fontWeight: '500', marginLeft: 4 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingContainer: { alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666', fontWeight: '500' },

  emptyContainer: { alignItems: 'center', maxWidth: 280 },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 16, color: '#666', textAlign: 'center', lineHeight: 24, marginBottom: 24 },
  clearFiltersButtonEmpty: { backgroundColor: '#2E7D32', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 24 },
  clearFiltersButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },

  listWrapper: { flex: 1 },
  listContainer: { padding: 20, paddingBottom: 100 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#E8F5E8', justifyContent: 'center', alignItems: 'center' },
  busTagContainer: { alignItems: 'flex-end' },
  busTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  busTagText: { color: '#fff', fontSize: 11, fontWeight: 'bold', marginLeft: 4, letterSpacing: 0.5 },
  messageText: { fontSize: 16, lineHeight: 24, color: '#333', marginBottom: 16, fontWeight: '400' },

  cardFooter: { borderTopWidth: 1, borderTopColor: '#F5F5F5', paddingTop: 12 },
  timestampContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  timestampText: { fontSize: 12, color: '#666', fontWeight: '600', marginLeft: 4 },
  fullTimestamp: { fontSize: 11, color: '#999', fontStyle: 'italic' },
});
