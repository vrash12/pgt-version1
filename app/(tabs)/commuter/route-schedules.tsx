//app/(tabs)/commuter/route-schedules.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL } from "../../config";


type TimelineItem = {
  time: string;
  label: string;
  loc?: string;
  type: 'trip' | 'service';
  // NEW:
  startHM: string; // "HH:MM"
  endHM: string;   // "HH:MM"
  live?: boolean;
};


export default function RouteTimeline() {
  const [buses, setBuses] = useState<{ id: number; identifier: string }[]>([]);
  const [busId, setBusId] = useState<number | undefined>();
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [selDate, setSelDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const friendlyBus = (identifier: string) => {
    const m = identifier.match(/bus-(\d+)/i);
    return m ? `Bus ${parseInt(m[1], 10)}` : identifier;
  };
  // Enhanced error handling
  const showError = (message: string) => {
    Alert.alert('Error', message, [{ text: 'OK' }]);
  };

  const hmToMins = (hm: string) => {
    const [h, m] = hm.split(':').map(Number);
    return h * 60 + m;
  };
  
  const isNowBetween = (selDate: Date, startHM: string, endHM: string) => {
    // Only mark live when viewing *today*
    const isToday = selDate.toDateString() === new Date().toDateString();
    if (!isToday) return false;
  
    const now = new Date();
    const nowM = now.getHours() * 60 + now.getMinutes();
    const s = hmToMins(startHM);
    const e = hmToMins(endHM);
  
    // simple same-day window; if you have cross-midnight events adjust here
    return s <= nowM && nowM < e;
  };
  

  // Load bus list with error handling
  useEffect(() => {
    loadBuses();
  }, []);

  const loadBuses = async () => {
    try {
      const tok = await AsyncStorage.getItem('@token');
      if (!tok) {
        showError('Authentication token not found');
        return;
      }
      
      const res = await fetch(`${API_BASE_URL}/commuter/buses`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      
      const list = await res.json();
      setBuses(list);
    } catch (e) {
      console.error('❌ load buses', e);
      showError('Failed to load bus list. Please check your connection.');
    }
  };

  // Enhanced date picker handlers
  const openPicker = () => setShowPicker(true);
  
  const onDatePick = (_: any, d?: Date) => {
    setShowPicker(false);
    if (d) {
      setTempDate(d);
      // Auto-apply if date is different
      if (d.toDateString() !== selDate.toDateString()) {
        setTimeout(() => applyDate(d), 100);
      }
    }
  };

  const applyDate = (date?: Date) => {
    const dateToApply = date || tempDate;
    setSelDate(dateToApply);
    setItems([]);
    
    // Animate fade out and in
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Pull to refresh handler
  const onRefresh = async () => {
    setRefreshing(true);
    await loadBuses();
    if (busId) {
      // Reload timeline
      applyDate();
    }
    setRefreshing(false);
  };

  // Enhanced timeline builder with better error handling
  useEffect(() => {
    if (!busId) return;
    
    setLoading(true);
    buildTimeline();
  }, [busId, selDate]);

  const buildTimeline = async () => {
    try {
      const tok = await AsyncStorage.getItem('@token');
      if (!tok) {
        showError('Authentication token not found');
        return;
      }
      const ymdLocal = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const day = ymdLocal(selDate);
  
      // Fetch trips with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
  
      type TripRec = { id: number; number: string; start_time: string; end_time: string };
      const tripsRes = await fetch(
        `${API_BASE_URL}/commuter/bus-trips?bus_id=${busId}&date=${day}`,
        { headers: { Authorization: `Bearer ${tok}` }, signal: controller.signal }
      );
  
      clearTimeout(timeoutId);
  
      if (!tripsRes.ok) {
        throw new Error(`Failed to fetch trips: ${tripsRes.statusText}`);
      }
  
      const trips: TripRec[] = await tripsRes.json();
// === Replace the whole "Process trips" block with this ===
type EventRec = {
  type: 'stop' | 'trip';
  label: string;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  description: string;
};

const timeline: TimelineItem[] = [];

for (const t of trips) {
  const evRes = await fetch(
    `${API_BASE_URL}/commuter/schedule?trip_id=${t.id}&date=${day}`,
    { headers: { Authorization: `Bearer ${tok}` } }
  );
  if (!evRes.ok) continue;

  const { events } = (await evRes.json()) as { events: EventRec[] };

  // chronological per trip just in case
  events.sort((a, b) => a.start_time.localeCompare(b.start_time));

  // Synthesize a pre segment if trip starts before first event
  const firstStart = events[0]?.start_time;
  if (firstStart && t.start_time < firstStart) {
    const live = isNowBetween(selDate, t.start_time, firstStart);
    timeline.push({
      time: `${t.start_time} – ${firstStart}`,
      label: `Trip ${t.number}`,
      loc: '',
      type: 'trip',
      startHM: t.start_time,
      endHM: firstStart,
      live,
    });
  }

  // Server events
  for (const ev of events) {
    const isTrip = ev.type === 'trip';
    const live = isNowBetween(selDate, ev.start_time, ev.end_time);
    timeline.push({
      time: `${ev.start_time} – ${ev.end_time}`,
      label: isTrip ? `Trip ${t.number}` : 'Service Stop',
      loc: ev.description,
      type: isTrip ? 'trip' : 'service',
      startHM: ev.start_time,
      endHM: ev.end_time,
      live,
    });
  }

  // Synthesize a post segment if trip ends after last event
  const lastEnd = events[events.length - 1]?.end_time;
  if (lastEnd && lastEnd < t.end_time) {
    const live = isNowBetween(selDate, lastEnd, t.end_time);
    timeline.push({
      time: `${lastEnd} – ${t.end_time}`,
      label: `Trip ${t.number}`,
      loc: '',
      type: 'trip',
      startHM: lastEnd,
      endHM: t.end_time,
      live,
    });
  }
}

// Global chronological sort across ALL trips
timeline.sort((a, b) => a.startHM.localeCompare(b.startHM));

setItems(timeline);


  
      // Animate fade in
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    } catch (err: any) {
      console.error('❌ timeline build failed', err);
      if (err.name === 'AbortError') {
        showError('Request timed out. Please try again.');
      } else {
        showError('Failed to load timeline data. Please try again.');
      }
      setItems([]);
    } finally {
      setLoading(false);
    }
  };
  

  // Get selected bus name
  const selectedBus = buses.find(b => b.id === busId);
  const LivePill = ({ text }: { text: string }) => {
    const pulse = React.useRef(new Animated.Value(0)).current;
  
    React.useEffect(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }, []);
  
    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.2] });
    const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  
    return (
      <View style={styles.liveBadge}>
        <Animated.View style={[styles.liveDot, { transform: [{ scale }], opacity }]} />
        <Text style={styles.liveText}>{text}</Text>
      </View>
    );
  };
  
  // Render timeline item with enhanced styling
  const renderTimelineItem = ({ item, index }: { item: TimelineItem; index: number }) => (
    <Animated.View 
      style={[
        styles.timelineRow,
        { 
          opacity: fadeAnim,
          transform: [{ 
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            })
          }]
        }
      ]}
    >
      {/* Timeline connector */}
      <View style={styles.timelineConnector}>
        <View style={styles.timelineDot} />
        {index < items.length - 1 && <View style={styles.timelineLine} />}
      </View>
      
      {/* Content */}
      <View style={styles.timelineContent}>
      <View style={styles.timeHeader}>
  <Text style={styles.timeText}>{item.time}</Text>
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
    {/* existing TRIP/STOP badge */}
    <View style={[
      styles.typeBadge,
      item.type === 'trip' ? styles.tripBadge : styles.serviceBadge
    ]}>
      <Ionicons name={item.type === 'trip' ? 'bus' : 'location'} size={12} color="#fff" />
      <Text style={styles.badgeText}>{item.type === 'trip' ? 'TRIP' : 'STOP'}</Text>
    </View>

    {/* NEW live pill */}
    {item.live && (
      <LivePill text={item.type === 'trip' ? 'IN TRANSIT' : 'AT STOP'} />
    )}
  </View>
</View>

        
        <Text style={styles.eventLabel}>{item.label}</Text>
        {item.loc && (
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color="#8fbc8f" />
            <Text style={styles.eventLoc}>{item.loc}</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      {/* Enhanced header with gradient */}
      <View style={styles.headerGradient}>
        <Text style={styles.headerTitle}>Route Timeline</Text>
        <Text style={styles.headerSubtitle}>Track bus schedules and stops</Text>

        {/* Enhanced bus selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>Select Bus</Text>
          <View style={styles.pickerContainer}>
            <View style={styles.pickerIcon}>
              <Ionicons name="bus" size={20} color="#2d5a2d" />
            </View>
            <Picker
              selectedValue={busId}
              onValueChange={(v) => {
                setBusId(v);
                setItems([]);
                Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
              }}
              style={styles.picker}
            >
              <Picker.Item label="Choose a bus..." value={undefined} />
              {buses.map((b) => (
                <Picker.Item
                key={b.id}
                label={friendlyBus(b.identifier)}  
                value={b.id}
              />
              ))}
            </Picker>
          </View>
        </View>

        {/* Enhanced date selector */}
        <View style={styles.selectorContainer}>
          <Text style={styles.selectorLabel}>Select Date</Text>
          <TouchableOpacity style={styles.dateSelector} onPress={openPicker}>
            <View style={styles.dateIconContainer}>
              <Ionicons name="calendar" size={20} color="#2d5a2d" />
            </View>
            <View style={styles.dateTextContainer}>
              <Text style={styles.dateText}>
                {tempDate.toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
              <Text style={styles.dateYear}>{tempDate.getFullYear()}</Text>
            </View>
            <Ionicons name="chevron-down" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Date picker modal */}
      {showPicker && (
        <DateTimePicker
          value={tempDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          onChange={onDatePick}
        />
      )}

      {/* Main content area */}
      <View style={styles.contentContainer}>
        {/* Status bar */}
        {selectedBus && (
          <View style={styles.statusBar}>
            <View style={styles.statusInfo}>
              <Ionicons name="bus" size={16} color="#2d5a2d" />
              <Text style={styles.statusText}>
  {selectedBus ? friendlyBus(selectedBus.identifier) : ''}
</Text>
            </View>
            <View style={styles.statusInfo}>
              <Ionicons name="calendar" size={16} color="#2d5a2d" />
              <Text style={styles.statusText}>
                {selDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
            </View>
            {items.length > 0 && (
              <View style={styles.statusInfo}>
                <Ionicons name="time" size={16} color="#2d5a2d" />
                <Text style={styles.statusText}>{items.length} events</Text>
              </View>
            )}
          </View>
        )}

        {/* Content states */}
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#2d5a2d" />
            <Text style={styles.loadingText}>Loading timeline...</Text>
          </View>
        ) : items.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyState}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            <View style={styles.emptyIconContainer}>
              <Ionicons 
                name={busId ? "time-outline" : "bus-outline"} 
                size={80} 
                color="#c8e6c9" 
              />
            </View>
            <Text style={styles.emptyTitle}>
              {busId ? 'No trips scheduled' : 'Select a bus to begin'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {busId
                ? 'This bus has no scheduled trips for the selected date.'
                : 'Choose a bus from the dropdown above to view its timeline.'}
            </Text>
            {busId && (
              <TouchableOpacity style={styles.retryButton} onPress={() => applyDate()}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item, idx) => `${item.time}-${idx}`}
            renderItem={renderTimelineItem}
            contentContainerStyle={styles.timelineList}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )}
      </View>
    </View>
  );
}

// Enhanced styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fdf8',
  },
  headerGradient: {
    backgroundColor: '#2d5a2d',
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 20,
  },
  selectorContainer: {
    marginBottom: 16,
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 8,
  },
  pickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingLeft: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickerIcon: {
    marginRight: 12,
  },
  picker: {
    flex: 1,
    color: '#2d5a2d',
    fontWeight: '600',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#E91E63', // will show as a pink-ish “live” pill
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
    marginRight: 6,
  },
  liveText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  
  dateIconContainer: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 12,
    marginRight: 16,
  },
  dateTextContainer: {
    flex: 1,
  },
  dateText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  dateYear: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 2,
  },
  contentContainer: {
    flex: 1,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#2d5a2d',
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    color: '#2d5a2d',
    fontWeight: '600',
    fontSize: 16,
  },
  emptyState: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    backgroundColor: 'rgba(200, 230, 201, 0.3)',
    padding: 30,
    borderRadius: 50,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2d5a2d',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8fbc8f',
    textAlign: 'center',
    lineHeight: 22,
  },
  retryButton: {
    backgroundColor: '#2d5a2d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 20,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  timelineList: {
    padding: 20,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineConnector: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2d5a2d',
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#e0e0e0',
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2d5a2d',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tripBadge: {
    backgroundColor: '#4CAF50',
  },
  serviceBadge: {
    backgroundColor: '#FF9800',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  eventLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d5a2d',
    marginBottom: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  eventLoc: {
    fontSize: 14,
    color: '#8fbc8f',
    marginLeft: 4,
    lineHeight: 18,
  },
});