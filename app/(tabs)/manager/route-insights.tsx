// app/(tabs)/manager/route-insights.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import dayjs from 'dayjs';
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
import { LineChart } from 'react-native-chart-kit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config';

const { width } = Dimensions.get('window');

/* ────── types ────── */
interface TimePoint { time: string; passengers?: number }
interface Bus { id: number; identifier: string; capacity?: number }
interface Trip { id: number; number: string; start_time: string; end_time: string; route_id?: number }
interface Meta { trip_id?: number|null; trip_number?: string|null; window_from?: string; window_to?: string; }
interface Metrics { avg_pax: number; peak_pax: number; boarded: number; alighted: number; start_pax: number; end_pax: number; net_change: number; }


/* helpers */
const toBuckets = (
  pairs: { time: string; value: number }[],
  step = 5,
  agg: 'sum' | 'max' = 'max'
) => {
  const map = new Map<string, number>();
  for (const { time, value } of pairs) {
    const [H, M] = time.split(':').map(Number);
    const mm = Math.floor(M / step) * step;
    const key = `${String(H).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    if (!map.has(key)) map.set(key, agg === 'max' ? value : 0);
    map.set(key, agg === 'max' ? Math.max(map.get(key)!, value) : map.get(key)! + value);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, value]) => ({ time, value }));
};

const thinLabels = (labels: string[], every = 2) =>
  labels.map((l, i) => (i % every === 0 ? l : ''));

export default function RouteInsights() {
  const insets = useSafeAreaInsets();
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const tabBarHeight = useBottomTabBarHeight();
  const authHeaders = (tok?: string | null): HeadersInit | undefined =>
    tok ? { Authorization: `Bearer ${tok}` } : undefined;
  
  const [date, setDate] = useState(new Date());
  const [buses, setBuses] = useState<Bus[]>([]);
  const [busId, setBusId] = useState<number>();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripId, setTripId] = useState<number>();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const [showDate, setShowDate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [occ, setOcc] = useState<TimePoint[]>([]);
  const [tripEnds, setTripEnds] = useState<Record<number, { origin: string; destination: string }>>({});
  const isNowWithin = (fromISO: string, toISO: string) => {
    const now = Date.now();
    const from = Date.parse(fromISO);
    const to   = Date.parse(toISO);
    return now >= from && now < to;
  };
  

  useEffect(() => {
    if (!tripId || !meta?.window_from || !meta?.window_to || !busId) return;
  
    // Freeze to local strings so nested closures don't see union types
    const fromISO: string = meta.window_from;
    const toISO: string   = meta.window_to;
  
    // React Native timers return numbers; use ReturnType<...>
    let poll: ReturnType<typeof setInterval> | null = null;
    let switchTimer: ReturnType<typeof setTimeout> | null = null;
  
    // While live, refresh every 15s
    const startPollingIfLive = () => {
      if (isNowWithin(fromISO, toISO)) {
        poll = setInterval(fetchInsights, 15000);
      }
    };
  
    // At trip end, jump to next trip
    const scheduleAutoAdvance = () => {
      const msUntilEnd = Date.parse(toISO) - Date.now();
      if (msUntilEnd <= 0) return;
  
      // small grace to include boundary readings
      switchTimer = setTimeout(async () => {
        try {
          const tok = await AsyncStorage.getItem('@token');
          const day = dayjs(date).format('YYYY-MM-DD');
          const res = await fetch(
            `${API_BASE_URL}/manager/bus-trips?bus_id=${busId}&date=${day}`,
            { headers: authHeaders(tok) }
          );
          const list: Trip[] = await res.json();
  
          const idx = list.findIndex(t => t.id === tripId);
          const next = idx >= 0 ? list[idx + 1] : undefined;
          if (next) setTripId(next.id);
        } catch {
          // ignore – user can pick manually
        }
      }, msUntilEnd + 1500);
    };
  
    startPollingIfLive();
    scheduleAutoAdvance();
  
    return () => {
      if (poll) clearInterval(poll);
      if (switchTimer) clearTimeout(switchTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, meta?.window_from, meta?.window_to, busId, date]);
  

  /* ─── 1. load buses once ─── */
  useEffect(() => {
    (async () => {
      try {
        const tok = await AsyncStorage.getItem('@token');
        const res = await fetch(`${API_BASE_URL}/manager/buses`, {
          headers: authHeaders(tok),
        });
        
        setBuses(await res.json());
      } catch (e) {
        console.error('[RouteInsights] bus list error', e);
      }
    })();
  }, []);

  /* ─── 2. load trips on bus/date change ─── */
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
        const list = await (await fetch(url, { headers: authHeaders(tok) })).json();
        setTrips(list);
        setTripId(list[0]?.id);
      } catch (e) {
        console.error('[RouteInsights] trip list error', e);
      }
    })();
  }, [busId, date]);

  const fetchInsights = async () => {
    if (!tripId) return;
    setLoading(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      if (!tok) return;
      const res = await fetch(`${API_BASE_URL}/manager/route-insights?trip_id=${tripId}`, {
        headers: authHeaders(tok),
      });
      if (!res.ok) throw new Error(await res.text());
      const j = await res.json();
      setOcc(j.occupancy || []);
      setMeta(j.meta || null);
      setMetrics(j.metrics || null);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    } catch (e) {
      console.error('[RouteInsights] insights error', e);
    } finally {
      setLoading(false);
    }
  };
  // Turn "SM Tarlac City" -> "SMTC", "Walter Mart Paniqui" / "Waltermart Paniqui" -> "WMP"
const stopCode = (name = '') => {
  if (!name) return '';
  // split "Waltermart" into "Walter Mart"
  name = name.replace(/waltermart/ig, 'Walter Mart');

  const SKIP = new Set(['of','the','and','at','de','del','la','le','a','an']);
  const tokens = name
    .replace(/[–→]/g, '-')        // normalize separators
    .replace(/[^A-Za-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);

  const parts: string[] = [];
  for (const raw of tokens) {
    const t = raw.trim();
    const low = t.toLowerCase();
    if (SKIP.has(low)) continue;

    // keep short all-caps tokens as-is (e.g. "SM")
    if (/^[A-Z]{2,4}$/.test(t)) { parts.push(t); }
    // brand aliases
    else if (low === 'walter') { parts.push('W'); }
    else if (low === 'mart')   { parts.push('M'); }
    else { parts.push(t[0].toUpperCase()); }

    if (parts.join('').length >= 6) break; // keep it compact
  }
  return parts.join('');
};

// Try to make "ORIGIN → DEST" codes from known data or from trip.number fallback
const tripCodes = (t: { number?: string }, origin?: string, destination?: string) => {
  if (origin || destination) {
    return `${stopCode(origin)} → ${stopCode(destination)}`.trim();
  }
  // Fallback: parse trip.number like "SM Tarlac City - Walter Mart Paniqui"
  const txt = (t.number || '').replace(/→|to|–/ig, '-');
  const [a, b] = txt.split('-').map(s => s?.trim()).filter(Boolean);
  if (a && b) return `${stopCode(a)} → ${stopCode(b)}`;
  return stopCode(txt); // worst case
};


/* ─── derive series ─── */
const paxBuckets = toBuckets(
  occ.map(o => ({ time: o.time, value: o.passengers ?? 0 })),
  1,          // 👈 per-minute buckets instead of 5-minute
  'max'
);

  const labels = paxBuckets.map(b => b.time);
  const passengerSeries = labels.map(t => paxBuckets.find(b => b.time === t)?.value ?? 0);
  const thin = thinLabels(labels, 2);

  // Chart width scales with data
  const PER_LABEL_PX = 38;
  const CHART_MIN_W = width - 60;
  const chartWidth = Math.max(CHART_MIN_W, labels.length * PER_LABEL_PX);

  const avgPassengers = metrics?.avg_pax ??
  (passengerSeries.length ? Math.round(passengerSeries.reduce((s, v) => s + v, 0) / passengerSeries.length) : 0);


  /* ─── chart config ─── */
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

  return (
    <View style={styles.container}>
      {/* Header */}
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
        contentContainerStyle={{ paddingBottom: insets.bottom + tabBarHeight + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* KPI: Average Passengers */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{avgPassengers || '—'}</Text>
          <Text style={styles.kpiLabel}>Average Passengers</Text>
        </View>

        {/* Filters & Selection */}
        <View style={styles.filtersCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="options" size={20} color="#2d5a2d" />
            <Text style={styles.cardTitle}>Filters & Selection</Text>
          </View>

          {/* Bus */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Select Bus</Text>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerWrap}>
                <Ionicons name="bus" size={18} color="#8fbc8f" />
                <Picker selectedValue={busId} onValueChange={setBusId} style={styles.picker}>
                  <Picker.Item label="— Choose Bus —" value={undefined} />
                  {buses.map(b => {
                    const match = b.identifier.match(/^bus-?0*(\d+)$/i);
                    const displayName = match ? `Bus ${match[1]}` : b.identifier;
                    return <Picker.Item key={b.id} label={displayName} value={b.id} />;
                  })}
                </Picker>
                <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
              </View>
            </View>
          </View>

          {/* Date */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Select Date</Text>
            <TouchableOpacity style={styles.dateSelector} onPress={() => setShowDate(true)}>
              <Ionicons name="calendar" size={18} color="#2d5a2d" />
              <Text style={styles.dateText}>{dayjs(date).format('MMMM D, YYYY')}</Text>
              <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
            </TouchableOpacity>
          </View>

          {/* Trip */}
          <View style={styles.inputGroup}>
            <Text style={styles.fieldLabel}>Select Trip</Text>
            <View style={styles.pickerContainer}>
              <View style={styles.pickerWrap}>
                <Ionicons name="map-outline" size={18} color="#8fbc8f" />
                <Picker
  selectedValue={tripId}
  enabled={trips.length > 0}
  onValueChange={setTripId}
  style={styles.picker}
  itemStyle={Platform.OS === 'ios' ? { height: 58, lineHeight: 22, fontSize: 16 } : undefined}
>
  <Picker.Item label="— Choose Trip —" value={undefined} />
  {trips.map(t => {
    const ends = tripEnds[t.id];
    const routeLabel = tripCodes(t, ends?.origin, ends?.destination);
    return (
      <Picker.Item
        key={t.id}
        label={`${routeLabel} (${t.start_time}–${t.end_time})`}
        value={t.id}
      />
    );
  })}
</Picker>

                <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
              </View>
            </View>
          </View>

          {/* Action */}
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
        {metrics && (
  <View style={{ marginHorizontal: 20, marginTop: 10, flexDirection:'row', flexWrap:'wrap', gap: 8 }}>
    {[
      { label: 'Peak', value: metrics.peak_pax },
      { label: 'Boarded', value: metrics.boarded },
      { label: 'Alighted', value: metrics.alighted },
      { label: 'Start', value: metrics.start_pax },
      { label: 'End', value: metrics.end_pax },
      { label: 'Net', value: metrics.net_change },
    ].map(k => (
      <View key={k.label} style={{
        backgroundColor:'#fff', borderRadius:12, paddingVertical:8, paddingHorizontal:12,
        borderWidth:1, borderColor:'#e8f5e8'
      }}>
        <Text style={{ color:'#2d5a2d', fontWeight:'800' }}>{k.value}</Text>
        <Text style={{ color:'#6b7280', fontWeight:'600', fontSize:12 }}>{k.label}</Text>
      </View>
    ))}
  </View>
)}
        {/* Passenger Trend (kept) */}
        {labels.length > 0 && (
          <Animated.View style={[styles.chartCard, { opacity: fadeAnim }]}>
            <View style={styles.chartHeader}>
              <Ionicons name="trending-up" size={20} color="#2d5a2d" />
              <Text style={styles.chartTitle}>Passenger Trend</Text>
            </View>

            <View style={{ width: '100%', overflow: 'visible' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingRight: 16 }}>
                <LineChart
                  data={{
                    labels: thin,
                    datasets: [{ data: passengerSeries, strokeWidth: 3, color: (o = 1) => `rgba(45,90,45,${o})` }],
                    legend: ['Passengers'],
                  }}
                  width={chartWidth}
                  height={240}
                  chartConfig={chartConfig}
                  style={styles.chartStyle}
                  bezier
                  withHorizontalLines
                  withVerticalLines={false}
                  withDots
                />
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* Timestamps of Passengers Occupancy */}
        {labels.length > 0 && (
          <View style={styles.tableCard}>
            <Text style={styles.tableTitle}>Timestamps of Passengers Occupancy</Text>

            {/* header */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colTime]}>Per Minute</Text>
              <Text style={[styles.th, styles.colPassengers]}>Passengers</Text>
            </View>

            {/* body */}
            <ScrollView style={styles.tableBody} nestedScrollEnabled>
              {paxBuckets.map((b, i) => (
                <View key={b.time} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                  <Text style={[styles.td, styles.colTime]}>{b.time}</Text>
                  <Text style={[styles.td, styles.colPassengers]}>{b.value}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Empty state */}
        {labels.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="analytics-outline" size={64} color="#c8e6c9" />
            <Text style={styles.emptyTitle}>No Data Available</Text>
            <Text style={styles.emptyText}>Select a bus, date, and trip to view insights and analytics.</Text>
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
  container: { flex: 1, backgroundColor: '#f0f8f0' },

  /* Header */
  headerContainer: { backgroundColor: '#2d5a2d', paddingTop: Platform.OS === 'ios' ? 50 : 30 },
  headerGradient: { paddingBottom: 20 },
  headerContent: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20,
  },
  headerTitleContainer: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '400' },
  headerAction: { padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },

  /* KPI */
  kpiCard: {
    marginHorizontal: 20, marginTop: 16, marginBottom: 8, backgroundColor: '#fff',
    borderRadius: 18, paddingVertical: 18, alignItems: 'center',
    shadowColor: '#2d5a2d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08,
    shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: '#e8f5e8',
  },
  kpiValue: { fontSize: 48, fontWeight: '800', color: '#2d5a2d', lineHeight: 52 },
  kpiLabel: { marginTop: 2, fontSize: 14, color: '#607d60', fontWeight: '600' },

  /* Filters card */
  filtersCard: {
    marginHorizontal: 20, marginTop: 12, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#2d5a2d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1,
    shadowRadius: 12, elevation: 6, borderWidth: 1, borderColor: '#e8f5e8',
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: '#e8f5e8',
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#2d5a2d', marginLeft: 10 },
  inputGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, color: '#2d5a2d', marginBottom: 8, fontWeight: '600' },
  pickerContainer: { marginTop: 4 },
  pickerWrap: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e8f5e8',
    borderRadius: 15, paddingHorizontal: 16, backgroundColor: '#f8fdf8',
    minHeight: Platform.select({ ios: 58, android: 58 }), paddingVertical: Platform.select({ ios: 10, android: 8 }),
  },
  picker: { flex: 1, height: Platform.select({ ios: 58, android: 58 }), color: '#2d5a2d', marginHorizontal: 8 },
  dateSelector: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#e8f5e8',
    borderRadius: 15, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#f8fdf8', minHeight: 50,
  },
  dateText: { flex: 1, fontSize: 16, color: '#2d5a2d', fontWeight: '500', marginLeft: 12 },
  actionBtn: {
    backgroundColor: '#2d5a2d', borderRadius: 15, paddingVertical: 16, alignItems: 'center',
    justifyContent: 'center', flexDirection: 'row', marginTop: 20, shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4,
  },
  actionTxt: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.5 },

  /* Chart card */
  chartCard: {
    marginHorizontal: 20, marginTop: 20, backgroundColor: '#fff', borderRadius: 20, padding: 20,
    shadowColor: '#2d5a2d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1,
    shadowRadius: 12, elevation: 6, alignItems: 'center', borderWidth: 1, borderColor: '#e8f5e8',
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginBottom: 16 },
  chartTitle: { fontSize: 16, fontWeight: '700', color: '#2d5a2d', marginLeft: 8 },
  chartStyle: { borderRadius: 16, marginVertical: 8 },

  /* Table */
  tableCard: {
    marginHorizontal: 20, marginTop: 20, marginBottom: 24, backgroundColor: '#fff', borderRadius: 20, padding: 16,
    shadowColor: '#2d5a2d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10,
    elevation: 4, borderWidth: 1, borderColor: '#e8f5e8',
  },
  tableTitle: { fontSize: 16, fontWeight: '800', color: '#2d5a2d', marginBottom: 12 },
  tableHeaderRow: {
    flexDirection: 'row', backgroundColor: '#f1f6f1', borderWidth: 1, borderColor: '#dfeadf',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
  },
  th: { paddingVertical: 10, paddingHorizontal: 12, fontWeight: '800', color: '#2d5a2d' },
  td: { paddingVertical: 10, paddingHorizontal: 12, color: '#1f2937', fontWeight: '600' },
  colTime: { flex: 1.3, borderRightWidth: 1, borderRightColor: '#e5e7eb' },
  colPassengers: { flex: 1 },
  tableBody: {
    maxHeight: 320, borderWidth: 1, borderTopWidth: 0, borderColor: '#dfeadf',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
  },
  tr: { flexDirection: 'row' },
  trAlt: { backgroundColor: '#fafdfb' },

  /* Empty state */
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 24, fontWeight: '700', color: '#2d5a2d', marginBottom: 8, marginTop: 16 },
  emptyText: { fontSize: 16, color: '#8fbc8f', textAlign: 'center', lineHeight: 24 },
});
