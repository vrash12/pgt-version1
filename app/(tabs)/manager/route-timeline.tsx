//app/(tabs)/manager/route-timeline.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useLocalSearchParams } from 'expo-router';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { API_BASE_URL } from "../../config";


type TimelineItem = {
  time: string;
  label: string;
  loc?: string;
  type: 'trip' | 'service';
};

export default function RouteTimeline() {
  const [buses, setBuses] = useState<{ id: number; identifier: string }[]>([]);
  const [busId, setBusId] = useState<number | undefined>();
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [selDate, setSelDate] = useState<Date>(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const params = useLocalSearchParams<{ tripId?: string }>();
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const insets = useSafeAreaInsets();

  // Enhanced error handling
  const showError = (message: string) => {
    Alert.alert('Error', message, [{ text: 'OK' }]);
  };

  useEffect(() => {
    if (params.tripId) {
      const loadTripDetails = async () => {
        setLoading(true); // Show loading indicator
        try {
          const tok = await AsyncStorage.getItem('@token');
          if (!tok) {
            showError('Authentication token not found');
            return;
          }

          const res = await fetch(`${API_BASE_URL}/manager/trips/${params.tripId}`, {
            headers: { Authorization: `Bearer ${tok}` },
          });

          if (!res.ok) {
            throw new Error('Failed to load details for the new trip.');
          }

          const tripDetails = await res.json();
          
          // Pre-select the bus and date based on the trip details
          if (tripDetails.bus_id && tripDetails.service_date) {
            setBusId(tripDetails.bus_id);
            // Convert the date string from the backend into a proper Date object
            const tripDate = new Date(tripDetails.service_date);
            
            setSelDate(tripDate);
            setTempDate(tripDate);
          }

        } catch (e: any) {
          console.error("Failed to pre-load timeline from tripId", e);
          showError(e.message || 'Could not load the specified trip.');
        } finally {
          // The other useEffect watching [busId, selDate] will handle the rest
        }
      };
      
      loadTripDetails();
    }
  }, [params.tripId]); // This effect depends on the tripId parameter
  useEffect(() => {
    loadBuses();
  }, []);

  const loadBuses = async () => {
    const tok = await AsyncStorage.getItem('@token');
    try {
      if (!tok) {
        showError('Authentication token not found');
        console.error("Token not found");
        return;
      }
  
      // ✅ FIX: Call the /buses endpoint to get the list of all buses.
      // This is the same endpoint your working "view-schedules" page uses.
      const url = `${API_BASE_URL}/manager/buses`;
      console.log("Request URL for buses:", url);
  
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${tok}` },
      });
  
      console.log('Buses Response Status:', res.status);
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
  
      const list = await res.json();
      setBuses(list);
    } catch (e) {
      console.error('❌ load buses error:', e);
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
    const tok = await AsyncStorage.getItem('@token');
    try {
      if (!tok) {
        showError('Authentication token not found');
        return;
      }
      if (!busId) {
        return; 
      }
  
      // 1️⃣ Format the date as YYYY-MM-DD
      const year       = selDate.getFullYear();
      const month      = String(selDate.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(selDate.getDate()).padStart(2, '0');
      const dateForAPI = `${year}-${month}-${dayOfMonth}`;
  
      // 2️⃣ Fetch trips for that bus + date
      const url = `${API_BASE_URL}/manager/bus-trips?bus_id=${busId}&date=${dateForAPI}`;
      console.log('[DEBUG] fetching trips from', url);
  
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 10000);
  
      const tripsRes = await fetch(url, {
        headers:   { Authorization: `Bearer ${tok}` },
        signal:    controller.signal,
      });
      clearTimeout(timeoutId);
  
      if (!tripsRes.ok) {
        throw new Error(`Failed to fetch trips: ${tripsRes.status} ${tripsRes.statusText}`);
      }
      const trips: { id: number; number: string; start_time: string; end_time: string }[] =
        await tripsRes.json();
  
      // 3️⃣ Build timeline
      const timeline: TimelineItem[] = [];
  
      for (const t of trips) {
        // 3a) Always push a Trip header
        timeline.push({
          time:  `${t.start_time} – ${t.end_time}`,
          label: `Trip ${t.number}`,
          type:  'trip',
        });
  
        // 3b) Fetch the stops for this trip
        const stopsRes = await fetch(
          `${API_BASE_URL}/manager/stop-times?trip_id=${t.id}`,
          { headers: { Authorization: `Bearer ${tok}` } }
        );
        if (!stopsRes.ok) continue;
  
        const stops: { stop_name: string; arrive_time: string; depart_time: string }[] =
          await stopsRes.json();
  
        // 3c) For each stop, add service‐stop entries and in‐transit segments
        let prev: typeof stops[0] | undefined;
        for (const st of stops) {
          // “In Transit” segment (if there’s a gap in times)
          if (prev && prev.depart_time !== st.arrive_time) {
            timeline.push({
              time:  `${prev.depart_time} – ${st.arrive_time}`,
              label: `Trip ${t.number}`,
              loc:   `${prev.stop_name} → ${st.stop_name}`,
              type:  'trip',
            });
          }
          // “Service Stop” entry
          if (st.arrive_time !== st.depart_time) {
            timeline.push({
              time:  `${st.arrive_time} – ${st.depart_time}`,
              label: 'Service Stop',
              loc:   st.stop_name,
              type:  'service',
            });
          }
          prev = st;
        }
      }
  
      // 4️⃣ Commit to state & animate
      setItems(timeline);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
  
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
  
  const selectedBus = buses.find(b => b.id === busId);

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
          <View style={[
            styles.typeBadge,
            item.type === 'trip' ? styles.tripBadge : styles.serviceBadge
          ]}>
            <Ionicons 
              name={item.type === 'trip' ? 'bus' : 'location'} 
              size={12} 
              color="#fff" 
            />
            <Text style={styles.badgeText}>{item.type === 'trip' ? 'TRIP' : 'STOP'}</Text>
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
    <View style={[styles.container, { paddingBottom: insets.bottom + 46 }]}>
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
    setBusId(v); // Ensure busId is set properly when user selects a bus
    setItems([]); // Clear the timeline items when a new bus is selected
    Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start();
  }}
  style={styles.picker}
>
  <Picker.Item label="Choose a bus..." value={undefined} />
  {buses.map((b) => (
    <Picker.Item key={b.id} label={b.identifier.replace(/^bus[-_]?/i, 'Bus ')} value={b.id} />
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
              <Text style={styles.statusText}>Bus {selectedBus.identifier}</Text>
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