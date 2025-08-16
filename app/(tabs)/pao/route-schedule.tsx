//app/(tabs)/pao/route-schedule.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  View
} from 'react-native';
import { API_BASE_URL } from "../../config";

const { width } = Dimensions.get('window');


type TimelineItem = {
  key: string;
  time: string;
  label: string;
  loc?: string;
  type: 'trip' | 'stop';
  duration?: string;
  isActive?: boolean;
};

// Helper to format time to 12-hour format with AM/PM
const formatTime = (time24: string): string => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

// Helper to calculate duration between two times
const calculateDuration = (start: string, end: string): string => {
  const startMinutes = parseInt(start.split(':')[0]) * 60 + parseInt(start.split(':')[1]);
  const endMinutes = parseInt(end.split(':')[0]) * 60 + parseInt(end.split(':')[1]);
  const duration = endMinutes - startMinutes;
  if (duration <= 0) return '';
  const hours = Math.floor(duration / 60);
  const mins = duration % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
};

// Helper to check if current time is within a time range like "1:30 PM - 2:10 PM"
const isCurrentlyActive = (timeRange: string): boolean => {
  if (!timeRange.includes(' - ')) return false;
  const [startStr, endStr] = timeRange.split(' - ');

  const toMinutes = (t: string) => {
    const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!m) return -1;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const period = m[3].toUpperCase();
    if (h === 12) h = 0;
    if (period === 'PM') h += 12;
    return h * 60 + min;
  };

  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const s = toMinutes(startStr);
  const e = toMinutes(endStr);
  if (s < 0 || e < 0) return false;

  // handle ranges that cross midnight
  return e >= s ? (nowMin >= s && nowMin <= e) : (nowMin >= s || nowMin <= e);
};

const TimelineRowItem = React.memo(function TimelineRowItem({
  item,
  index,
  isLast,                     // ← add
  fadeAnim,
  slideAnim,
}: {
  item: TimelineItem;
  index: number;
  isLast: boolean;            // ← add
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
}) {

  const itemAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(itemAnim, { toValue: 1, duration: 600, delay: index * 120, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, delay: index * 120, useNativeDriver: true }),
    ]).start();
  }, [index, itemAnim, scaleAnim]);

  return (
    <Animated.View
      style={[
        styles.timelineRow,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
      ]}
    >
      <View style={styles.timelineConnector}>
        <Animated.View
          style={[
            styles.timelineDot,
            item.type === 'trip' && styles.tripDot,
            item.isActive && styles.activeDot,
            {
              transform: [
                {
                  scale: item.isActive
                    ? itemAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.2] })
                    : 1,
                },
              ],
            },
          ]}
        >
          {item.isActive && (
            <Animated.View
              style={[
                styles.activePulse,
                {
                  transform: [{ scale: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                  opacity: itemAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0.2] }),
                },
              ]}
            />
          )}
          <Ionicons name={item.type === 'trip' ? 'bus' : 'location'} size={item.isActive ? 10 : 8} color="#fff" style={styles.dotIcon} />
        </Animated.View>

        {!isLast && (                 // ← instead of the placeholder condition
    <Animated.View style={[styles.timelineLine, { opacity: fadeAnim, transform: [{ scaleY: itemAnim }] }]} />
  )}

      </View>

      <Animated.View
        style={[
          styles.card,
          item.isActive && styles.activeCard,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        {item.isActive && (
          <Animated.View style={[styles.activeIndicator, { opacity: itemAnim }]}>
            <Ionicons name="radio-button-on" size={12} color="#fff" />
            <Text style={styles.activeIndicatorText}>LIVE</Text>
          </Animated.View>
        )}

        <View style={styles.cardHeader}>
          <View style={styles.timeContainer}>
            <View style={[styles.iconContainer, item.isActive && styles.activeIconContainer]}>
              <Ionicons name={item.type === 'trip' ? 'bus-outline' : 'location-outline'} size={18} color={item.isActive ? '#fff' : '#2E7D32'} />
            </View>
            <View style={styles.timeTextContainer}>
              <Text style={[styles.timeText, item.isActive && styles.activeTimeText]}>{item.time}</Text>
              <Text style={[styles.typeLabel, item.isActive && styles.activeTypeLabel]}>
                {item.type === 'trip' ? 'Journey' : 'Stop'}
              </Text>
            </View>
          </View>

          {item.duration && (
            <View style={[styles.durationBadge, item.isActive && styles.activeDurationBadge]}>
              <Ionicons name="time-outline" size={12} color={item.isActive ? '#4CAF50' : '#81C784'} />
              <Text style={[styles.durationText, item.isActive && styles.activeDurationText]}>{item.duration}</Text>
            </View>
          )}
        </View>

        <Text style={[styles.label, item.isActive && styles.activeLabel]}>{item.label}</Text>

        {item.loc && (
          <View style={styles.locationRow}>
            <View style={styles.routeContainer}>
              <Ionicons name="navigate" size={14} color={item.isActive ? '#4CAF50' : '#81C784'} />
              <Text style={[styles.locationText, item.isActive && styles.activeLocationText]}>{item.loc}</Text>
            </View>
            {item.type === 'trip' && (
              <View style={[styles.tripBadge, item.isActive && styles.activeTripBadge]}>
                <Text style={[styles.tripBadgeText, item.isActive && styles.activeTripBadgeText]}>In Transit</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
});

export default function PaoRouteSchedule() {
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;

  
  const buildTimeline = async () => {
    setLoading(true);
    setError(null);
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
  
    // helpers for robust dedupe
    const normText = (s = '') => s.replace(/\s+/g, ' ').trim().toLowerCase();
    const toMinutes = (t: string) => {
      // accepts "07:40", "7:40", "7:40 AM", "07:40 pm"
      const m = t.trim().match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (!m) return NaN;
      let h = parseInt(m[1], 10);
      const min = parseInt(m[2], 10);
      const period = (m[3] || '').toUpperCase();
      if (period) {
        if (h === 12) h = 0;
        if (period === 'PM') h += 12;
      }
      return h * 60 + min;
    };
    const normRange = (range = '') => {
      // unify -, – and —; return "startMin-endMin"
      const parts = range.replace(/[–—]/g, '-').split('-').map(p => p.trim());
      if (parts.length !== 2) return range;
      const a = toMinutes(parts[0]);
      const b = toMinutes(parts[1]);
      return isNaN(a) || isNaN(b) ? range : `${a}-${b}`;
    };
  
    try {
      const token = await AsyncStorage.getItem('@token');
      if (!token) throw new Error('Authentication token not found.');
  
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateForAPI = `${year}-${month}-${day}`;
  
      const tripsRes = await fetch(`${API_BASE_URL}/pao/bus-trips?date=${dateForAPI}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!tripsRes.ok) throw new Error('Failed to fetch schedule. Is the PAO assigned to a bus?');
  
      const trips = await tripsRes.json();
  
      type StopRow = { stop_name: string; arrive_time: string; depart_time: string };
      const timeline: TimelineItem[] = [];

      for (const t of trips) {
        const stopsRes = await fetch(`${API_BASE_URL}/pao/stop-times?trip_id=${t.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!stopsRes.ok) continue;
  
        const stops: StopRow[] = await stopsRes.json();
// helpers
const clean = (s: string = '') => s.replace(/\s+/g, ' ').trim();
const parseEndpointsFromTitle = (title: string) => {
  const parts = clean(title).split(/\s*[-–—→]\s*/);
  return parts.length >= 2 ? { origin: parts[0], destination: parts[1] } : null;
};

const hhmm = (s: string) => (s || '').slice(0, 5);
const tripStartHM = hhmm(t.start_time);
const tripEndHM   = hhmm(t.end_time);

// try stops first
const firstStop = stops[0]?.stop_name;
const lastStop  = stops[stops.length - 1]?.stop_name;
const sameEnds  = firstStop && lastStop && clean(firstStop).toLowerCase() === clean(lastStop).toLowerCase();

// try to parse from the trip "number" string if stops are missing/identical
const parsed = parseEndpointsFromTitle(t.number || '');
let origin = firstStop;
let destination = lastStop;
if (!origin || !destination || sameEnds) {
  if (parsed) {
    origin = parsed.origin;
    destination = parsed.destination;
  } else {
    origin = undefined as unknown as string;        // hide the location row if we can't infer
    destination = undefined as unknown as string;
  }
}

const tripTitle = clean(t.number || '');
const tripRange = `${formatTime(tripStartHM)} - ${formatTime(tripEndHM)}`;

timeline.push({
  key: `trip-full-${t.id}`,
  time: tripRange,
  label: tripTitle,                // ← no "Trip #"
  loc: (origin && destination) ? `${origin} → ${destination}` : undefined,
  type: 'trip',
  duration: calculateDuration(tripStartHM, tripEndHM),
  isActive: isCurrentlyActive(tripRange),
});





let prev: StopRow | null = null;
for (let i = 0; i < stops.length; i++) {
  const st = stops[i];

if (prev?.depart_time && st.arrive_time) {
  const legRange = `${formatTime(prev.depart_time)} - ${formatTime(st.arrive_time)}`;
  timeline.push({
    key: `trip-leg-${t.id}-${i}-${prev.depart_time}-${st.arrive_time}`,
    time: legRange,
    label: tripTitle,              // ← no "Trip #"
    loc: `${prev.stop_name} → ${st.stop_name}`,
    type: 'trip',
    duration: calculateDuration(prev.depart_time, st.arrive_time),
    isActive: isCurrentlyActive(legRange),
  });
}


  // Service stop dwell (keep your existing check)
  if (st.arrive_time && st.depart_time && st.arrive_time !== st.depart_time) {
    const timeRange = `${formatTime(st.arrive_time)} - ${formatTime(st.depart_time)}`;
    timeline.push({
      key: `stop-${t.id}-${i}-${st.arrive_time}-${st.depart_time}`,
      time: timeRange,
      label: 'Service Stop',
      loc: st.stop_name,
      type: 'stop',
      duration: calculateDuration(st.arrive_time, st.depart_time),
      isActive: isCurrentlyActive(timeRange),
    });
  }

  prev = st;
}

      }
  
      // Final-pass dedupe using normalized, DISPLAY values
      const seenDisplay = new Set<string>();
      const deduped = timeline.filter((it) => {
        const k = `${it.type}|${normText(it.label)}|${normText(it.loc || '')}|${normRange(it.time)}`;
        if (seenDisplay.has(k)) return false;
        seenDisplay.add(k);
        return true;
      });
  
      setEvents(deduped);
  
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
        Animated.timing(headerAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();
    } catch (e: any) {
      console.error(e.message);
      setError(e.message);
      setEvents([]);
      Alert.alert('Schedule Error', e.message, [{ text: 'OK', style: 'default' }]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  useEffect(() => {
    buildTimeline();
    // Animate header on mount
    Animated.timing(headerAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, [selectedDate]);

  const onRefresh = () => {
    setRefreshing(true);
    buildTimeline();
  };
  
  const onDateChange = (event: any, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const showDatePicker = () => {
    if (Platform.OS === 'android') {
      setShowPicker(true);
    } else {
      setShowPicker(!showPicker);
    }
  };

  const getDateDisplayText = () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (selectedDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (selectedDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else if (selectedDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return selectedDate.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const totalTrips = events.filter(e => e.type === 'trip').length;
  const activeEvents = events.filter(e => e.isActive).length;

 

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
        <Animated.View style={[styles.errorContainer, { opacity: headerAnim }]}>
          <View style={styles.errorIconContainer}>
            <Ionicons name="warning" size={80} color="#FF7043" />
            <Animated.View style={[styles.errorPulse, {
              transform: [{
                scale: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2],
                })
              }]
            }]} />
          </View>
          <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={buildTimeline}>
            <Ionicons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>
    );
    
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      
      <Animated.View style={[styles.header, { opacity: headerAnim }]}>
  <View style={styles.headerGradientOverlay} />

  <View style={styles.headerContent}>
    {/* TOP ROW: Icon + Title */}
    <View style={styles.headerTitleContainer}>
      <View style={styles.headerIcon}>
        <Ionicons name="bus" size={28} color="#fff" />
      </View>
      <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
        Bus Schedule
      </Text>
    </View>

    {/* BOTTOM ROW: Subtitle (left) + Date Pill (right) */}
    <View style={styles.headerBottomRow}>
      <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
        {isToday && activeEvents > 0
          ? `🟢 ${activeEvents} active • ${totalTrips} trips today`
          : `📅 ${totalTrips} trips scheduled`}
      </Text>

      <TouchableOpacity
        style={styles.dateButton}
        onPress={showDatePicker}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="calendar" size={18} color="#2E7D32" />
        <Text
          style={styles.dateButtonText}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
        >
          {getDateDisplayText()}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#2E7D32" />
      </TouchableOpacity>
    </View>
  </View>
</Animated.View>


      {!loading && events.length > 0 && (
        <Animated.View style={[styles.statsRow, { 
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }]}>
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="bus" size={20} color="#4CAF50" />
            </View>
            <Text style={styles.statNumber}>{totalTrips}</Text>
            <Text style={styles.statLabel}>Total Trips</Text>
          </View>
          
          <View style={styles.statCard}>
            <View style={styles.statIconContainer}>
              <Ionicons name="location" size={20} color="#81C784" />
            </View>
            <Text style={styles.statNumber}>{events.filter(e => e.type === 'stop').length}</Text>
            <Text style={styles.statLabel}>Service Stops</Text>
          </View>
          
          {isToday && (
            <View style={[styles.statCard, styles.activeStatCard]}>
              <View style={[styles.statIconContainer, styles.activeStatIcon]}>
                <Ionicons name="radio-button-on" size={20} color="#fff" />
              </View>
              <Text style={[styles.statNumber, { color: '#4CAF50' }]}>{activeEvents}</Text>
              <Text style={styles.statLabel}>Active Now</Text>
            </View>
          )}
        </Animated.View>
      )}

      {showPicker && (
        <DateTimePicker 
          value={selectedDate} 
          mode="date" 
          display={Platform.OS === 'ios' ? 'compact' : 'default'}
          onChange={onDateChange} 
          maximumDate={new Date(new Date().setDate(new Date().getDate() + 30))}
          minimumDate={new Date(new Date().setDate(new Date().getDate() - 30))}
        />
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <Animated.View style={[styles.loadingContainer, {
            transform: [{
              rotate: headerAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              })
            }]
          }]}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </Animated.View>
          <Text style={styles.loadingText}>Loading your schedule...</Text>
          <Text style={styles.loadingSubtext}>Please wait a moment</Text>
        </View>
      ) : events.length === 0 ? (
        <Animated.View style={[styles.centerContainer, { opacity: fadeAnim }]}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="calendar-clear" size={80} color="#C8E6C9" />
            <Animated.View style={[styles.emptyPulse, {
              transform: [{
                scale: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                })
              }]
            }]} />
          </View>
          <Text style={styles.emptyTitle}>No Schedule Available</Text>
          <Text style={styles.emptySubtitle}>
            There are no trips assigned for {getDateDisplayText().toLowerCase()}.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Ionicons name="refresh" size={20} color="#4CAF50" />
            <Text style={styles.refreshButtonText}>Refresh Schedule</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <FlatList
        data={events}
        keyExtractor={item => item.key}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4CAF50"
            colors={['#4CAF50']}
            progressBackgroundColor="#E8F5E8"
          />
        }
        renderItem={({ item, index }) => (
          <TimelineRowItem
            item={item}
            index={index}
            isLast={index === events.length - 1}
            fadeAnim={fadeAnim}
            slideAnim={slideAnim}
          />
        )}
        
      />
      
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F1F8E9' 
  },
  header: {
    backgroundColor: '#2E7D32',
    paddingTop: 10,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBottomRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: { 
    fontSize: 13, 
    color: '#C8E6C9',
    fontWeight: '500',
  },
  headerContent: {
    paddingTop: 8,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    shadowColor: '#1B5E20',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  
    maxWidth: '60%',   // keeps the pill compact on small screens
    flexShrink: 1,
    overflow: 'hidden',
  },
  dateButtonText: { 
    color: '#2E7D32', 
    fontWeight: '700', 
    marginHorizontal: 8,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 20,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  activeStatCard: {
    backgroundColor: '#4CAF50',
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activeStatIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  statNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#81C784',
    fontWeight: '600',
    textAlign: 'center',
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 20 
  },
  loadingContainer: {
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#2E7D32',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 6,
    fontSize: 14,
    color: '#81C784',
    fontWeight: '400',
  },
  emptyIconContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#C8E6C9',
    opacity: 0.3,
  },
  emptyTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#2E7D32',
    marginBottom: 8,
  },
  emptySubtitle: { 
    fontSize: 16, 
    color: '#81C784', 
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorIconContainer: {
    position: 'relative',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorPulse: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF7043',
    opacity: 0.2,
  },
  errorTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#FF7043',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorSubtitle: { 
    fontSize: 16, 
    color: '#81C784', 
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#E8F5E8',
  },
  refreshButtonText: {
    color: '#4CAF50',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF7043',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 25,
    shadowColor: '#FF7043',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 8,
    fontSize: 16,
  },
  list: { 
    padding: 20,
    paddingBottom: 40,
  },
  timelineRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineConnector: {
    alignItems: 'center',
    width: 35,
    marginRight: 16,
  },
  timelineDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#81C784',
    position: 'absolute',
    top: 25,
    zIndex: 3,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tripDot: {
    backgroundColor: '#4CAF50',
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  activeDot: {
    backgroundColor: '#FF9800',
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  activePulse: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF9800',
  },
  dotIcon: {
    marginTop: 1,
  },
  timelineLine: {
    flex: 1,
    width: 3,
    backgroundColor: '#C8E6C9',
    marginTop: 40,
    borderRadius: 2,
  
  },
  card: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },
  activeCard: {
    borderColor: '#FF9800',
    borderWidth: 2,
    shadowColor: '#FF9800',
    shadowOpacity: 0.25,
    backgroundColor: '#FFF8E1',
  },
  activeIndicator: {
    position: 'absolute',
    top: -1,
    right: -1,
    backgroundColor: '#FF9800',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FF9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  activeIndicatorText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeIconContainer: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  timeTextContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2E7D32',
    marginBottom: 2,
  },
  activeTimeText: {
    color: '#FF9800',
  },
  typeLabel: {
    fontSize: 12,
    color: '#81C784',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTypeLabel: {
    color: '#FF9800',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  activeDurationBadge: {
    backgroundColor: '#E8F5E8',
  },
  durationText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  activeDurationText: {
    color: '#4CAF50',
  },
  label: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 12,
  },
  activeLabel: {
    color: '#FF9800',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  locationText: {
    marginLeft: 8,
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  activeLocationText: {
    color: '#FF9800',
    fontWeight: '700',
  },
  tripBadge: {
    backgroundColor: '#C8E6C9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeTripBadge: {
    backgroundColor: '#FF9800',
  },
  tripBadgeText: {
    fontSize: 10,
    color: '#2E7D32',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTripBadgeText: {
    color: '#fff',
  },
});
