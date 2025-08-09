// app/(tabs)/manager/route-insights.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from "../../config";

const { width } = Dimensions.get('window');

/* ────── types ────── */
interface TimePoint {
  time: string;
  passengers?: number;
  tickets?: number;
  revenue?: number;
}
interface Bus { id: number; identifier: string; capacity?: number }
interface Trip { id: number; number: string; start_time: string; end_time: string; route_id?: number }

/* helper */
const fmtHHMM = (d: Date) => dayjs(d).format('HH:mm');
// bucket points by N-minute intervals
const toBuckets = (pairs: { time: string; value: number }[], step = 5, agg: 'sum' | 'max' = 'sum') => {
  const map = new Map<string, number>();
  for (const { time, value } of pairs) {
    const [H, M] = time.split(':').map(Number);
    const mm = Math.floor(M / step) * step;
    const key = `${String(H).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, agg === 'max' ? value : 0);
    map.set(key, agg === 'max' ? Math.max(map.get(key)!, value) : map.get(key)! + value);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([time, value]) => ({ time, value }));
};

// show every Nth label to reduce clutter
const thinLabels = (labels: string[], every = 2) =>
  labels.map((l, i) => (i % every === 0 ? l : ''));


export default function RouteInsights() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const tabBarHeight = useBottomTabBarHeight();
  const OCC_COLOR = '#2d5a2d';  // occupied (dark green)
  const AVAIL_COLOR = '#E0E0E0'; // available (neutral gray)
  
  const [date, setDate] = useState(new Date());
  const [buses, setBuses] = useState<Bus[]>([]);
  const [busId, setBusId] = useState<number>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<number>();

  /* time-window (window mode support later) */
  const [startTime, setStart] = useState(dayjs().startOf('hour').toDate());
  const [endTime, setEnd] = useState(dayjs().startOf('hour').add(1, 'hour').toDate());

  /* loading & data */
  const [showDate, setShowDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [occ, setOcc] = useState<TimePoint[]>([]);
  const [tix, setTix] = useState<TimePoint[]>([]);

  /* ─── 1. load buses once ─── */
  useEffect(() => {
    (async () => {
      try {
        const tok = await AsyncStorage.getItem('@token');
        const res = await fetch(`${API_BASE_URL}/manager/buses`, {
          headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        });
        setBuses(await res.json());
      } catch (e) {
        console.error('[RouteInsights] bus list error', e);
      }
    })();
  }, []);

  /* ─── 2. load trips whenever BUS or DATE changes ─── */
  useEffect(() => {
    if (!busId) {
      setTrips([]);
      setTripId(undefined);
      return;
    }
    (async () => {
      try {
        const tok = await AsyncStorage.getItem('@token');
        const day = dayjs(date).format('YYYY-MM-DD');
        const url = `${API_BASE_URL}/manager/bus-trips?bus_id=${busId}&date=${day}`;
        const list = await (await fetch(url, { headers: tok ? { Authorization: `Bearer ${tok}` } : {} })).json();
        setTrips(list);
        setTripId(list[0]?.id);
      } catch (e) {
        console.error('[RouteInsights] trip list error', e);
      }
    })();
  }, [busId, date]);

// ─── 3. fetch insights ───
const fetchInsights = async () => {
  if (!tripId) return;
  setLoading(true);
  try {
    const tok = await AsyncStorage.getItem('@token');
    if (!tok) return;

    // just pass the tripId — backend derives bus/date/window
    const res = await fetch(
      `${API_BASE_URL}/manager/route-insights?trip_id=${tripId}`,
      { headers: { Authorization: `Bearer ${tok}` } }
    );
    

    if (!res.ok) throw new Error(await res.text());
    const j = await res.json();

    // j.occupancy = [{ time: '07:00', passengers: 12 }, ...]
    // j.tickets   = [{ time: '07:01', tickets: 2, revenue: 30.0 }, ...]
    setOcc(j.occupancy || []);
    setTix(j.tickets || []);

    // optional: log to verify
    console.log('INSIGHTS', j.meta, 'occ=', (j.occupancy||[]).length, 'tix=', (j.tickets||[]).length);
    setOcc(j.occupancy || []);
    setTix(j.tickets || []);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  } catch (e) {
    console.error('[RouteInsights] insights error', e);
  } finally {
    setLoading(false);
  }
};

  /* ─── derive chart series ─── */
  const times = Array.from(new Set([...occ.map(o => o.time), ...tix.map(t => t.time)])).sort();
// bucket size (5 min for short trips, 10 for longer)
const bucketStep = 5;

// bucketed series
const paxBuckets     = toBuckets(occ.map(o => ({ time: o.time, value: o.passengers ?? 0 })), bucketStep, 'max');
const ticketBuckets  = toBuckets(tix.map(t => ({ time: t.time, value: t.tickets ?? 0 })), bucketStep, 'sum');
const revenueBuckets = toBuckets(tix.map(t => ({ time: t.time, value: t.revenue ?? 0 })), bucketStep, 'sum');

// unified labels from pax (fallback to tickets if empty)
const labels = (paxBuckets.length ? paxBuckets : ticketBuckets).map(b => b.time);

const passengerSeries = labels.map(t => paxBuckets.find(b => b.time === t)?.value ?? 0);
const ticketSeries    = labels.map(t => ticketBuckets.find(b => b.time === t)?.value ?? 0);
const revenueSeries   = labels.map(t => revenueBuckets.find(b => b.time === t)?.value ?? 0);

// thin labels so they don't overlap
const thin = thinLabels(labels, 2);

const PER_LABEL_PX = 38;                      // tweak if labels are dense (minutes)
const CHART_MIN_W  = width - 60;              // current card width
const chartWidth   = Math.max(CHART_MIN_W, labels.length * PER_LABEL_PX);
  /* ─── calculate summary stats ─── */
  const totalPassengers = passengerSeries.reduce((sum, val) => sum + val, 0);
  const totalTickets = ticketSeries.reduce((sum, val) => sum + val, 0);
  const totalRevenue = revenueSeries.reduce((sum, val) => sum + val, 0);
  const avgOccupancy = passengerSeries.length > 0 ? totalPassengers / passengerSeries.length : 0;
  const peakPassengers = Math.max(...passengerSeries, 0);
  const selectedBus = buses.find(b => b.id === busId);
  const occupancyRate = selectedBus?.capacity ? (avgOccupancy / selectedBus.capacity) * 100 : 0;

  /* ─── chart configs ─── */
  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0 as const,
    color: (opacity = 1) => `rgba(45, 90, 45, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(107, 114, 128, ${opacity})`,
    formatYLabel: (y: string) => {
      const n = parseFloat(y);
      return Number.isFinite(n) ? n.toFixed(0) : '0';
    },
    propsForDots: { r: '4', strokeWidth: '2', stroke: '#2d5a2d' },
    strokeWidth: 3,
  };

  const revenueChartConfig = {
    ...chartConfig,
    color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
    formatYLabel: (y: string) => {
      const n = parseFloat(y);
      return Number.isFinite(n) ? `₱${n.toFixed(0)}` : '₱0';
    },
  };

  const cap = selectedBus?.capacity || 0;
  const avgOcc2 = Number(avgOccupancy.toFixed(2)); // 2 decimals for display & chart
  const occupiedPct = cap ? Number(((avgOcc2 / cap) * 100).toFixed(2)) : 0;
  const availablePct = Math.max(0, Number((100 - occupiedPct).toFixed(2)));
  
  const pieData = [
    {
      name: `Occupied `,
      population: occupiedPct,
      color: OCC_COLOR,
      legendFontColor: '#2d5a2d',
      legendFontSize: 12,
    },
    {
      name: `Available`,
      population: availablePct,
      color: AVAIL_COLOR,
      legendFontColor: '#6b7280',
      legendFontSize: 12,
    },
  ];
  
  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.headerContainer}>
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>

            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Route Data Insights</Text>
              <Text style={styles.headerSubtitle}>Analytics & Performance Metrics</Text>
            </View>

            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="stats-chart" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingBottom: insets.bottom + tabBarHeight + 24, 
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Enhanced Filters Card */}
        <View style={styles.filtersCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="options" size={20} color="#2d5a2d" />
            <Text style={styles.cardTitle}>Filters & Selection</Text>
          </View>

          {/* Bus selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Select Bus</Text>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerWrap}>
                <Ionicons name="bus" size={18} color="#8fbc8f" />
                <Picker
                  selectedValue={busId}
                  onValueChange={setBusId}
                  style={styles.picker}
                >
                  <Picker.Item label="— Choose Bus —" value={undefined} />
                  {buses.map(b => {
  const match = b.identifier.match(/^bus-?0*(\d+)$/i);
  const displayName = match ? `Bus ${match[1]}` : b.identifier;

  return (
    <Picker.Item
      key={b.id}
      label={displayName}
      value={b.id}
    />
  );
})}

                </Picker>
                <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
              </View>
            </View>
          </View>

          {/* Date picker */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Select Date</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDate(true)}>
              <Ionicons name="calendar" size={18} color="#2d5a2d" />
              <Text style={styles.dateText}>{dayjs(date).format('MMMM D, YYYY')}</Text>
              <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
            </TouchableOpacity>
          </View>

          {/* Trip selector */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Select Trip</Text>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerWrap}>
                {/* FIX: Changed "route" to "map-outline" */}
                <Ionicons name="map-outline" size={18} color="#8fbc8f" /> 
                <Picker
  selectedValue={tripId}
  enabled={trips.length > 0}
  onValueChange={setTripId}
  style={styles.picker}
  itemStyle={Platform.OS === 'ios' ? { height: 58, lineHeight: 22, fontSize: 16 } : undefined} // 👈 iOS tweak
>

                  <Picker.Item label="— Choose Trip —" value={undefined} />
                  {trips.map(t => (
                    <Picker.Item
                      key={t.id}
                      label={`${t.number} • ${t.start_time}–${t.end_time}`}
                      value={t.id}
                    />
                  ))}
                </Picker>
                <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
              </View>
            </View>
          </View>

          {/* Enhanced Filter button */}
          <TouchableOpacity
            style={[styles.actionBtn, { opacity: loading || !tripId ? 0.6 : 1 }]}
            disabled={loading || !tripId}
            onPress={fetchInsights}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="analytics" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.actionTxt}>Generate Insights</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Summary Statistics Cards */}
        {times.length > 0 && (
          <Animated.View style={[styles.statsContainer, { opacity: fadeAnim }]}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="people" size={24} color="#2d5a2d" />
                </View>
                <Text style={styles.statValue}>{totalPassengers}</Text>
                <Text style={styles.statLabel}>Total Passengers</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="ticket" size={24} color="#4caf50" />
                </View>
                <Text style={styles.statValue}>{totalTickets}</Text>
                <Text style={styles.statLabel}>Tickets Sold</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="cash" size={24} color="#66bb6a" />
                </View>
                <Text style={styles.statValue}>₱{totalRevenue.toLocaleString()}</Text>
                <Text style={styles.statLabel}>Total Revenue</Text>
              </View>

              <View style={styles.statCard}>
                <View style={styles.statIcon}>
                  <Ionicons name="speedometer" size={24} color="#81c784" />
                </View>
                <Text style={styles.statValue}>{occupancyRate.toFixed(1)}%</Text>
                <Text style={styles.statLabel}>Occupancy Rate</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Charts */}
        {times.length > 0 && (
          <>
         {/* Passenger & Ticket Trends */}
<Animated.View style={[styles.chartCard, { opacity: fadeAnim }]}>
  <View style={styles.chartHeader}>
    <Ionicons name="trending-up" size={20} color="#2d5a2d" />
    <Text style={styles.chartTitle}>Passenger & Ticket Trends</Text>
  </View>

  {/* 👇 horizontally scrollable */}
  <View style={{ width: '100%', overflow: 'visible' }}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ paddingRight: 16 }}
    >
      <LineChart
        data={{
          labels: thin,
          datasets: [
            { data: passengerSeries, strokeWidth: 3, color: (o=1)=>`rgba(45,90,45,${o})` },
            { data: ticketSeries,    strokeWidth: 3, color: (o=1)=>`rgba(76,175,80,${o})` },
          ],
          legend: ['Passengers', 'Tickets'],
        }}
        width={chartWidth}           // 👈 dynamic width
        height={240}
        chartConfig={chartConfig}
        style={styles.chartStyle}
        bezier
        yAxisLabel=""
        yAxisSuffix=""
        withHorizontalLines
        withVerticalLines={false}
        withDots
      />
    </ScrollView>
  </View>
</Animated.View>

{/* Revenue Analysis */}
<Animated.View style={[styles.chartCard, { opacity: fadeAnim }]}>
  <View style={styles.chartHeader}>
    <Ionicons name="bar-chart" size={20} color="#2d5a2d" />
    <Text style={styles.chartTitle}>Revenue Analysis</Text>
  </View>

  {/* 👇 horizontally scrollable */}
  <View style={{ width: '100%', overflow: 'visible' }}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      contentContainerStyle={{ paddingRight: 16 }}
    >
      <BarChart
        data={{ labels: thin, datasets: [{ data: revenueSeries }] }}
        width={chartWidth}           // 👈 dynamic width
        height={240}
        chartConfig={revenueChartConfig}
        style={styles.chartStyle}
        fromZero
        yAxisLabel=""
        yAxisSuffix=""
        withHorizontalLabels
        withVerticalLabels
        showValuesOnTopOfBars
      />
    </ScrollView>
  </View>
</Animated.View>


            {/* Occupancy Overview */}
            {selectedBus?.capacity && (
              <Animated.View style={[styles.chartCard, { opacity: fadeAnim }]}>
                <View style={styles.chartHeader}>
                  <Ionicons name="pie-chart" size={20} color="#2d5a2d" />
                  <Text style={styles.chartTitle}>Average Occupancy Overview</Text>
                </View>
                <PieChart
                  data={pieData}
                  width={width - 60}
                  height={220}
                  chartConfig={chartConfig}
                  accessor="population"
                  backgroundColor="transparent"
                  paddingLeft="15"
                  absolute
                />
                <View style={styles.legendRow}>
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: OCC_COLOR }]} />
    <Text style={styles.legendText}>Occupied seats (avg)</Text>
  </View>
  <View style={styles.legendItem}>
    <View style={[styles.legendDot, { backgroundColor: AVAIL_COLOR, borderColor: '#bdbdbd', borderWidth: 1 }]} />
    <Text style={styles.legendText}>Available seats</Text>
  </View>
</View>

                <View style={styles.occupancyStats}>
                  <View style={styles.occupancyStat}>
                    <Text style={styles.occupancyLabel}>Bus Capacity</Text>
                    <Text style={styles.occupancyValue}>{selectedBus.capacity} seats</Text>
                  </View>
                  <View style={styles.occupancyStat}>
                    <Text style={styles.occupancyLabel}>Average Load</Text>
                    <Text style={styles.occupancyValue}>{avgOccupancy.toFixed(1)} passengers</Text>
                  </View>
                  <View style={styles.occupancyStat}>
                    <Text style={styles.occupancyLabel}>Peak Load</Text>
                    <Text style={styles.occupancyValue}>{peakPassengers} passengers</Text>
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* Empty State */}
        {times.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color="#c8e6c9" />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>
              Select a bus, date, and trip to view insights and analytics.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Date picker modal */}
      {showDate && (
        <DateTimePicker
          value={date}
          mode="date"
          display="calendar"
          onChange={(_, d) => {
            setShowDate(false);
            if (d) setDate(d);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f8f0' 
  },

  // Enhanced Header Styles
  headerContainer: {
    backgroundColor: '#2d5a2d',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  headerGradient: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
  },
  headerAction: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Enhanced Card Styles
  filtersCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d5a2d',
    marginLeft: 10,
  },
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    color: '#2d5a2d',
    marginBottom: 8,
    fontWeight: '600',
  },
  pickerContainer: {
    marginTop: 4,
  },
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 15,
    paddingHorizontal: 16,
    backgroundColor: '#f8fdf8',
    minHeight: Platform.select({ ios: 58, android: 58 }),   // 👈 was 50
    paddingVertical: Platform.select({ ios: 10, android: 8 }) // 👈 add a bit of vertical padding
  },
  picker: {
    flex: 1,
    height: Platform.select({ ios: 58, android: 58 }),       // 👈 was 50
    color: '#2d5a2d',
    marginHorizontal: 8,
  },
  
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 15,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fdf8',
    minHeight: 50,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: '#2d5a2d',
    fontWeight: '600',
  },
  
  dateText: {
    flex: 1,
    fontSize: 16,
    color: '#2d5a2d',
    fontWeight: '500',
    marginLeft: 12,
  },
  actionBtn: {
    backgroundColor: '#2d5a2d',
    borderRadius: 15,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.5,
  },

  // Statistics Cards
  statsContainer: {
    marginHorizontal: 20,
    marginTop: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2d5a2d',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8fbc8f',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Enhanced Chart Styles
  chartCard: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2d5a2d',
    marginLeft: 8,
  },
  chartStyle: {
    borderRadius: 16,
    marginVertical: 8,
  },

  // Occupancy Stats
  occupancyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8f5e8',
  },
  occupancyStat: {
    alignItems: 'center',
  },
  occupancyLabel: {
    fontSize: 12,
    color: '#8fbc8f',
    fontWeight: '500',
    marginBottom: 4,
  },
  occupancyValue: {
    fontSize: 14,
    color: '#2d5a2d',
    fontWeight: '700',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2d5a2d',
    marginBottom: 8,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#8fbc8f',
    textAlign: 'center',
    lineHeight: 24,
  },
});