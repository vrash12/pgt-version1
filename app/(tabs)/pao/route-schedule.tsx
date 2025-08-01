import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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

const API = 'http://192.168.1.7:5000';

type TimelineItem = {
  key: string;
  time: string;
  label: string;
  loc?: string;
  type: 'trip' | 'stop';
  duration?: string;
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
  return `${duration} min`;
};

export default function PaoRouteSchedule() {
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const buildTimeline = async () => {
    setLoading(true);
    fadeAnim.setValue(0);
    try {
      const token = await AsyncStorage.getItem('@token');
      if (!token) throw new Error('Authentication token not found.');

      // Correctly format the date to YYYY-MM-DD
      const year = selectedDate.getFullYear();
      const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
      const day = selectedDate.getDate().toString().padStart(2, '0');
      const dateForAPI = `${year}-${month}-${day}`;

      const tripsRes = await fetch(`${API}/pao/bus-trips?date=${dateForAPI}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!tripsRes.ok) {
        throw new Error('Failed to fetch schedule. Is the PAO assigned to a bus?');
      }

      const trips = await tripsRes.json();
      const timeline: TimelineItem[] = [];

      for (const t of trips) {
        const stopsRes = await fetch(`${API}/pao/stop-times?trip_id=${t.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!stopsRes.ok) continue;

        const stops = await stopsRes.json();
        let prevStop: any = null;

        stops.forEach((st: any) => {
          if (prevStop && prevStop.depart_time !== st.arrive_time) {
            timeline.push({
              key: `trip-${t.id}-${prevStop.stop_name}`,
              time: `${formatTime(prevStop.depart_time)} - ${formatTime(st.arrive_time)}`,
              label: `Trip #${t.number}`,
              loc: `${prevStop.stop_name} → ${st.stop_name}`,
              type: 'trip',
              duration: calculateDuration(prevStop.depart_time, st.arrive_time),
            });
          }
          if (st.arrive_time !== st.depart_time) {
            timeline.push({
              key: `stop-${t.id}-${st.stop_name}`,
              time: `${formatTime(st.arrive_time)} - ${formatTime(st.depart_time)}`,
              label: 'Service Stop',
              loc: st.stop_name,
              type: 'stop',
              duration: calculateDuration(st.arrive_time, st.depart_time),
            });
          }
          prevStop = st;
        });
      }
      setEvents(timeline);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (e: any) {
      console.error(e.message);
      setEvents([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    buildTimeline();
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

  const isToday = selectedDate.toDateString() === new Date().toDateString();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Bus Schedule</Text>
          <Text style={styles.headerSubtitle}>Timeline for your assigned bus</Text>
        </View>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={20} color="#8B0000" />
          <Text style={styles.dateButtonText}>
            {isToday ? 'Today' : selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>
        </TouchableOpacity>
      </View>

      {showPicker && (
        <DateTimePicker value={selectedDate} mode="date" display="default" onChange={onDateChange} />
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#8B0000" />
        </View>
      ) : events.length === 0 ? (
        <View style={styles.centerContainer}>
          <Ionicons name="calendar-clear-outline" size={64} color="#E0E0E0" />
          <Text style={styles.emptyTitle}>No Schedule Found</Text>
          <Text style={styles.emptySubtitle}>There are no trips assigned to your bus for this date.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={item => item.key}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B0000" />}
          renderItem={({ item, index }) => (
            <Animated.View style={[styles.timelineRow, { opacity: fadeAnim }]}>
              <View style={styles.timelineConnector}>
                <View style={[styles.timelineDot, item.type === 'trip' && styles.tripDot]} />
                {index < events.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.timeText}>{item.time}</Text>
                  {item.duration && <Text style={styles.durationText}>{item.duration}</Text>}
                </View>
                <Text style={styles.label}>{item.label}</Text>
                {item.loc && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color="#B8860B" />
                    <Text style={styles.locationText}>{item.loc}</Text>
                  </View>
                )}
              </View>
            </Animated.View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FFFFFF' },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
      backgroundColor: '#fff',
    },
    headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#8B0000' },
    headerSubtitle: { fontSize: 14, color: '#A0522D' },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF5F5',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 20,
    },
    dateButtonText: { color: '#8B0000', fontWeight: '600', marginLeft: 8 },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
    emptyTitle: { marginTop: 16, fontSize: 20, fontWeight: '600', color: '#333' },
    emptySubtitle: { marginTop: 8, fontSize: 14, color: '#999', textAlign: 'center' },
    list: { padding: 20 },
    timelineRow: {
      flexDirection: 'row',
    },
    timelineConnector: {
      alignItems: 'center',
      width: 30,
      marginRight: 10,
    },
    timelineDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#A0522D',
      position: 'absolute',
      top: 18,
    },
    tripDot: {
      backgroundColor: '#B8860B',
    },
    timelineLine: {
      flex: 1,
      width: 2,
      backgroundColor: '#F0F0F0',
    },
    card: {
      flex: 1,
      backgroundColor: '#fff',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#FFF5F5',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    timeText: {
      fontSize: 16,
      fontWeight: 'bold',
      color: '#8B0000',
    },
    durationText: {
      fontSize: 12,
      color: '#999',
      fontStyle: 'italic',
    },
    label: {
      fontSize: 18,
      fontWeight: '600',
      color: '#333',
      marginBottom: 6,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
    },
    locationText: {
      marginLeft: 6,
      color: '#B8860B',
      fontSize: 14,
    },
});