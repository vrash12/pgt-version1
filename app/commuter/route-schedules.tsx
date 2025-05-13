import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface ScheduleItem {
  id: string;
  type: 'stop' | 'trip';
  title: string;
  subtitle?: string;
  timeRange: string;
  active?: boolean;
}

export default function RouteSchedulesScreen() {
  const [date, setDate] = useState(new Date());
  const items: ScheduleItem[] = [
    { id: '1', type: 'stop', title: 'At Stop', subtitle: 'WalterMart Paniqui', timeRange: '6:30 – 6:50 AM' },
    { id: '2', type: 'trip', title: 'Trip no. 1', subtitle: 'Paniqui to SM Tarlac', timeRange: '6:50 – 7:50 AM', active: true },
    { id: '3', type: 'stop', title: 'At Stop', subtitle: 'SM Tarlac', timeRange: '7:50 – 8:00 AM' },
    { id: '4', type: 'trip', title: 'Trip no. 1', subtitle: 'SM Tarlac to Paniqui', timeRange: '8:00 – 9:00 AM' },
    { id: '5', type: 'stop', title: 'At Stop', subtitle: 'WalterMart Paniqui', timeRange: '9:00 – 9:10 AM' },
    { id: '6', type: 'trip', title: 'Trip no. 2', subtitle: 'Paniqui to SM Tarlac', timeRange: '9:10 – 10:10 AM' },
    { id: '7', type: 'stop', title: 'At Stop', subtitle: 'SM Tarlac', timeRange: '10:10 – 10:20 AM' },
    { id: '8', type: 'trip', title: 'Trip no. 2', subtitle: 'SM Tarlac to Paniqui', timeRange: '10:20 – 11:20 AM' },
  ];

  const onChooseDate = () => {
    // TODO: Open date picker
    alert('Date picker not implemented');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Ionicons name="chevron-back" size={24} color="#333" />
          <Text style={styles.headerDate}>{format(date, 'MMMM d, yyyy')}</Text>
          <Text style={styles.headerTime}>{format(date, 'h:mm a')}</Text>
        </View>
        <View style={styles.chooseDateRow}>
          <Text style={styles.chooseDateText}>Choose Date</Text>
          <TouchableOpacity onPress={onChooseDate}>
            <Ionicons name="calendar-outline" size={24} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity style={styles.scheduleButton}>
        <Text style={styles.scheduleButtonText}>ROUTE SCHEDULE</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.timelineContainer}>
        {items.map((item, index) => (
          <View key={item.id} style={styles.timelineRow}>
            <View style={styles.timelineIndicatorContainer}>
              {/* Top line */}
              {index !== 0 && <View style={styles.lineTop} />}
              {/* Circle */}
              <View style={[styles.circle, item.active && styles.activeCircle]} />
              {/* Bottom line */}
              {index !== items.length - 1 && <View style={styles.lineBottom} />}
            </View>

            <View style={[styles.card, item.type === 'trip' && styles.tripCard, item.active && styles.activeTripCard]}>
              <Text style={[styles.cardTitle, item.type === 'trip' && styles.tripTitle]}>{item.title}</Text>
              {item.subtitle && <Text style={styles.cardSubtitle}>{item.subtitle}</Text>}
              <Text style={styles.cardTime}>{item.timeRange}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 20, paddingTop: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerDate: { fontSize: 16, fontWeight: 'bold', color: '#000' },
  headerTime: { fontSize: 16, color: '#555' },
  chooseDateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  chooseDateText: { fontSize: 14, color: '#333', marginRight: 8 },

  scheduleButton: {
    margin: 20,
    backgroundColor: '#E3C200',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scheduleButtonText: { fontSize: 16, fontWeight: 'bold', color: '#000' },

  timelineContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  timelineRow: { flexDirection: 'row', marginBottom: 16 },

  timelineIndicatorContainer: {
    width: 24,
    alignItems: 'center',
  },
  lineTop: { flex: 1, width: 2, backgroundColor: '#CCC' },
  circle: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#CCC' },
  activeCircle: { backgroundColor: '#2C5E1A' },
  lineBottom: { flex: 1, width: 2, backgroundColor: '#CCC' },

  card: {
    flex: 1,
    marginLeft: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
    padding: 12,
  },
  tripCard: { backgroundColor: '#A8D5BA' },
  activeTripCard: { backgroundColor: '#2C5E1A' },

  cardTitle: { fontSize: 14, fontWeight: 'bold', color: '#000' },
  tripTitle: { color: '#fff' },
  cardSubtitle: { fontSize: 12, color: '#555', marginVertical: 4 },
  cardTime: { fontSize: 12, color: '#333' },
});
