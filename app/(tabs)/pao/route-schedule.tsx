/* -----------------------------------------------------------------------
 *  route-schedule.tsx   (PAO → Enhanced Timeline view - Modern Design)
 *  Path: app/(tabs)/pao/route-schedule.tsx
 * ---------------------------------------------------------------------- */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const BACKEND = 'http://192.168.1.7:5000';
const { width } = Dimensions.get('window');

type TimelineItem = {
  time:        string;
  label:       string;
  loc?:        string;
  type:        'trip' | 'stop';
  duration?:   string;
  nextStop?:   string;
};

export default function PaoRouteSchedule() {
  const [tempDate, setTempDate]     = useState(new Date());
  const [selDate, setSelDate]       = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);

  const [events, setEvents]         = useState<TimelineItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim]                  = useState(new Animated.Value(0));
  const [headerOpacity]             = useState(new Animated.Value(1));

  const showError = (msg: string) => {
    // replace with your Alert implementation
    console.warn('[PAO Schedule]', msg);
  };

  // Enhanced timeline building with better time formatting
  const buildTimeline = async () => {
    setLoading(true);
    try {
      const token   = await AsyncStorage.getItem('@token');
      const day     = selDate.toISOString().slice(0,10);

      // 1) fetch trips
      const tripsRes = await fetch(
        `${BACKEND}/pao/bus-trips?date=${day}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!tripsRes.ok) throw new Error('Failed to fetch trips');
      const trips = await tripsRes.json() as { id:number }[];

      // 2) for each trip, fetch stops & build events
      const timeline: TimelineItem[] = [];
      for (const t of trips) {
        const stopsRes = await fetch(
          `${BACKEND}/pao/stop-times?trip_id=${t.id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!stopsRes.ok) continue;
        const stops = await stopsRes.json() as {
          stop_name: string;
          arrive_time: string;
          depart_time: string;
        }[];

        let prev: typeof stops[0] | null = null;
        stops.forEach((st, index) => {
          // Format times better
          const arriveTime = formatTime(st.arrive_time);
          const departTime = formatTime(st.depart_time);
          
          // stop event
          timeline.push({
            time:  arriveTime === departTime ? arriveTime : `${arriveTime} - ${departTime}`,
            label: index === 0 ? 'Departure' : index === stops.length - 1 ? 'Final Stop' : 'Stop',
            loc:   st.stop_name,
            type:  'stop',
            duration: calculateDuration(st.arrive_time, st.depart_time),
            nextStop: index < stops.length - 1 ? stops[index + 1].stop_name : undefined
          });
          
          // trip segment
          if (prev && prev.depart_time !== st.arrive_time) {
            const tripDuration = calculateDuration(prev.depart_time, st.arrive_time);
            timeline.push({
              time:  `${formatTime(prev.depart_time)} - ${formatTime(st.arrive_time)}`,
              label: 'In Transit',
              loc:   `${prev.stop_name} → ${st.stop_name}`,
              type:  'trip',
              duration: tripDuration
            });
          }
          prev = st;
        });
      }

      // Sort by time
      timeline.sort((a, b) => {
        const timeA = a.time.split(' ')[0];
        const timeB = b.time.split(' ')[0];
        return timeA.localeCompare(timeB);
      });

      setEvents(timeline);
      
      // Stagger animation for items
      Animated.stagger(50, 
        timeline.map((_, index) => 
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
            delay: index * 50
          })
        )
      ).start();
      
    } catch (e:any) {
      console.error(e);
      showError('Could not load schedule');
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Helper functions
  const formatTime = (time: string): string => {
    // Convert 24h format to 12h format with AM/PM
    const [hours, minutes] = time.split(':');
    const hour24 = parseInt(hours);
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    return `${hour12}:${minutes} ${ampm}`;
  };

  const calculateDuration = (start: string, end: string): string => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    const duration = endMinutes - startMinutes;
    
    if (duration <= 0) return '';
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getCurrentStatus = (item: TimelineItem, index: number): 'upcoming' | 'current' | 'completed' => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    
    // This is a simplified logic - you'd want to implement proper time comparison
    return index === 0 ? 'current' : index < 3 ? 'upcoming' : 'completed';
  };

  useEffect(() => {
    buildTimeline();
  }, [selDate]);

  // pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    fadeAnim.setValue(0);
    buildTimeline();
  };

  // date picker handlers
  const onDatePick = (_: any, d?: Date) => {
    setShowPicker(false);
    if (d && d.toDateString() !== selDate.toDateString()) {
      setTempDate(d);
      setTimeout(() => setSelDate(d), 100);
      fadeAnim.setValue(0);
    }
  };

  const isToday = selDate.toDateString() === new Date().toDateString();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a4a1a" />
      
      {/* Enhanced header with gradient effect */}
      <Animated.View style={[styles.headerContainer, { opacity: headerOpacity }]}>
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.headerTitle}>Bus Schedule</Text>
            <TouchableOpacity 
              onPress={() => setShowPicker(true)} 
              style={styles.dateBtn}
              activeOpacity={0.8}
            >
              <Ionicons name="calendar" size={18} color="#fff" />
              <Text style={styles.dateTxt}>
                {isToday ? 'Today' : selDate.toLocaleDateString(undefined, { 
                  weekday: 'short',
                  month:'short', 
                  day:'numeric' 
                })}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {!loading && events.length > 0 && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{events.filter(e => e.type === 'stop').length}</Text>
                <Text style={styles.statLabel}>Stops</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{events.filter(e => e.type === 'trip').length}</Text>
                <Text style={styles.statLabel}>Trips</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {events.length > 0 ? formatTime(events[0].time.split(' ')[0]) : '--'}
                </Text>
                <Text style={styles.statLabel}>First</Text>
              </View>
            </View>
          )}
        </View>
      </Animated.View>

      {showPicker && (
        <View style={styles.pickerOverlay}>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display={Platform.OS==='ios'?'inline':'calendar'}
            onChange={onDatePick}
            themeVariant="light"
          />
        </View>
      )}

      {/* Enhanced content */}
      {loading ? (
        <View style={styles.center}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2d5a2d" />
            <Text style={styles.loadingText}>Loading your schedule...</Text>
          </View>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyContainer}>
            <Ionicons name="bus-outline" size={80} color="#e8f5e8" />
            <Text style={styles.emptyTitle}>No routes scheduled</Text>
            <Text style={styles.emptySubtitle}>
              {isToday ? 'No buses running today' : 'No buses scheduled for this date'}
            </Text>
            <TouchableOpacity style={styles.retryBtn} onPress={buildTimeline}>
              <Text style={styles.retryText}>Refresh</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl 
              refreshing={refreshing} 
              onRefresh={onRefresh}
              colors={['#2d5a2d']}
              tintColor="#2d5a2d"
            />
          }
          renderItem={({item, index}) => {
            const status = getCurrentStatus(item, index);
            const isTrip = item.type === 'trip';
            
            return (
              <Animated.View
                style={[
                  styles.row,
                  { 
                    opacity: fadeAnim,
                    transform:[{
                      translateY: fadeAnim.interpolate({
                        inputRange:[0,1], 
                        outputRange:[30,0]
                      })
                    }] 
                  }
                ]}
              >
                <View style={styles.rail}>
                  <View style={[
                    styles.dot,
                    status === 'current' && styles.dotCurrent,
                    status === 'completed' && styles.dotCompleted,
                    isTrip && styles.dotTrip
                  ]}>
                    {status === 'current' && (
                      <Animated.View style={styles.pulseRing} />
                    )}
                  </View>
                  {index < events.length-1 && (
                    <View style={[
                      styles.railLine,
                      status === 'completed' && styles.railLineCompleted
                    ]}/>
                  )}
                </View>
                
                <TouchableOpacity 
                  style={[
                    styles.card,
                    status === 'current' && styles.cardCurrent,
                    isTrip && styles.cardTrip
                  ]}
                  activeOpacity={0.95}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.timeContainer}>
                      <Text style={[
                        styles.timeTxt,
                        status === 'current' && styles.timeCurrentTxt
                      ]}>
                        {item.time}
                      </Text>
                      {item.duration && (
                        <Text style={styles.durationTxt}>{item.duration}</Text>
                      )}
                    </View>
                    
                    <View style={[
                      styles.badge,
                      isTrip ? styles.tripBadge : styles.stopBadge,
                      status === 'current' && styles.badgeCurrent
                    ]}>
                      <Ionicons
                        name={isTrip ? 'bus' : item.label === 'Departure' ? 'play' : 
                              item.label === 'Final Stop' ? 'flag' : 'location'}
                        size={12} 
                        color="#fff"
                      />
                      <Text style={styles.badgeTxt}>
                        {isTrip ? 'TRANSIT' : item.label.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={[
                    styles.labelTxt,
                    status === 'current' && styles.labelCurrentTxt
                  ]}>
                    {item.label}
                  </Text>
                  
                  {item.loc && (
                    <View style={styles.locRow}>
                      <Ionicons 
                        name={isTrip ? "arrow-forward" : "location"} 
                        size={14} 
                        color={status === 'current' ? '#2d5a2d' : '#8fbc8f'} 
                      />
                      <Text style={[
                        styles.locTxt,
                        status === 'current' && styles.locCurrentTxt
                      ]}>
                        {item.loc}
                      </Text>
                    </View>
                  )}
                  
                  {status === 'current' && (
                    <View style={styles.currentIndicator}>
                      <View style={styles.currentDot} />
                      <Text style={styles.currentText}>Current</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </Animated.View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f8fdf8' 
  },
  
  // Enhanced Header
  headerContainer: {
    backgroundColor: '#1a4a1a',
    paddingTop: Platform.OS === 'ios' ? 50 : 25,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: { 
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    marginBottom: 16
  },
  headerTitle: { 
    color: '#fff', 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: 0.5
  },
  dateBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.15)', 
    paddingHorizontal: 14,
    paddingVertical: 10, 
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)'
  },
  dateTxt: { 
    color: '#fff', 
    marginHorizontal: 8, 
    fontWeight: '600',
    fontSize: 15
  },
  
  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 12,
    marginTop: 8
  },
  statItem: {
    alignItems: 'center'
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700'
  },
  statLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2
  },

  // Picker
  pickerOverlay: {
    backgroundColor: '#fff',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // Center states
  center: { 
    flex: 1, 
    alignItems: 'center', 
    justifyContent: 'center',
    paddingHorizontal: 40
  },
  loadingContainer: {
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 16,
    color: '#607d8b',
    fontSize: 16,
    fontWeight: '500'
  },
  emptyContainer: {
    alignItems: 'center'
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2d5a2d',
    marginTop: 20,
    marginBottom: 8
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#8fbc8f',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24
  },
  retryBtn: {
    backgroundColor: '#2d5a2d',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    elevation: 2
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16
  },

  // Enhanced Timeline
  list: { 
    paddingHorizontal: 20,
    paddingVertical: 24
  },
  row: { 
    flexDirection: 'row', 
    marginBottom: 16
  },
  rail: { 
    width: 32, 
    alignItems: 'center',
    marginRight: 16
  },
  dot: { 
    width: 16, 
    height: 16, 
    borderRadius: 8, 
    backgroundColor: '#e0e0e0',
    marginBottom: 8,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  dotCurrent: {
    backgroundColor: '#4caf50',
    width: 20,
    height: 20,
    borderRadius: 10
  },
  dotCompleted: {
    backgroundColor: '#2d5a2d'
  },
  dotTrip: {
    backgroundColor: '#ff9800'
  },
  pulseRing: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.3)',
    zIndex: -1
  },
  railLine: { 
    flex: 1, 
    width: 3, 
    backgroundColor: '#e8e8e8',
    borderRadius: 1.5
  },
  railLineCompleted: {
    backgroundColor: '#c8e6c9'
  },

  // Enhanced Cards
  card: { 
    flex: 1, 
    backgroundColor: '#fff', 
    paddingHorizontal: 20,
    paddingVertical: 18, 
    borderRadius: 20, 
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#e8f5e8'
  },
  cardCurrent: {
    borderLeftColor: '#4caf50',
    backgroundColor: '#f8fff8',
    elevation: 6
  },
  cardTrip: {
    borderLeftColor: '#ff9800'
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 12
  },
  timeContainer: {
    flex: 1
  },
  timeTxt: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#2d5a2d',
    letterSpacing: 0.3
  },
  timeCurrentTxt: {
    color: '#1b5e20',
    fontSize: 17
  },
  durationTxt: {
    fontSize: 12,
    color: '#8fbc8f',
    fontWeight: '500',
    marginTop: 2
  },
  badge: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 16,
    elevation: 1
  },
  tripBadge: { 
    backgroundColor: '#ff9800' 
  },
  stopBadge: { 
    backgroundColor: '#4caf50' 
  },
  badgeCurrent: {
    backgroundColor: '#2d5a2d'
  },
  badgeTxt: { 
    color: '#fff', 
    fontSize: 10, 
    fontWeight: '700', 
    marginLeft: 4,
    letterSpacing: 0.5
  },
  labelTxt: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#2d5a2d', 
    marginBottom: 8,
    letterSpacing: 0.2
  },
  labelCurrentTxt: {
    color: '#1b5e20'
  },
  locRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 4,
    paddingHorizontal: 2
  },
  locTxt: { 
    marginLeft: 6, 
    fontSize: 15, 
    color: '#8fbc8f',
    fontWeight: '500',
    lineHeight: 20,
    flex: 1
  },
  locCurrentTxt: {
    color: '#2d5a2d',
    fontWeight: '600'
  },
  currentIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e8f5e8'
  },
  currentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4caf50',
    marginRight: 8
  },
  currentText: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  }
});