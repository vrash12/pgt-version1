// app/(tabs)/manager/ticket-sales.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { API_BASE_URL } from "../../config";

interface TicketRow {
  id: number;
  bus: string;
  commuter: string;
  origin: string;
  destination: string;
  fare: string;
  passenger_type?: 'regular' | 'discount';
  passengerType?: 'regular' | 'discount';
}

interface TicketStats {
  totalFare: number;
  totalTickets: number;
  averageFare: number;
}

export default function TicketSales() {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Footer (composition)
  const [showComposition, setShowComposition] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const [stats, setStats] = useState<TicketStats>({
    totalFare: 0,
    totalTickets: 0,
    averageFare: 0,
  });

  const [regularCount, setRegularCount] = useState(0);
  const [discountCount, setDiscountCount] = useState(0);

  const getToken = async () => {
    const t = await AsyncStorage.getItem('@token');
    if (!t) throw new Error('Authentication token not found');
    return t;
  };

  const fetchComposition = useCallback(async (token: string, dateISO: string, list?: TicketRow[]) => {
    try {
      const res = await fetch(`${API_BASE_URL}/manager/tickets/composition?date=${dateISO}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const j = await res.json();
        setRegularCount(j.regular || 0);
        setDiscountCount(j.discount || 0);
        return;
      }
      // fall through to client count
    } catch {
      // fall through to client count
    }

    // Fallback: derive from list (if provided)
    if (Array.isArray(list)) {
      const typeOf = (t: TicketRow) =>
        ((t.passenger_type ?? t.passengerType) || '').toLowerCase();
      const reg = list.filter(t => typeOf(t) === 'regular').length;
      const dis = list.filter(t => typeOf(t) === 'discount').length;
      setRegularCount(reg);
      setDiscountCount(dis);
    }
  }, []);

  const fetchTickets = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      const dISO = dayjs(selectedDate).format('YYYY-MM-DD');
      const url  = `${API_BASE_URL}/manager/tickets?date=${dISO}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });

      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

      const data = JSON.parse(text);
      const list: TicketRow[] = Array.isArray(data) ? data : data.tickets;
      setTickets(list || []);

      // Totals
      const total = (list || []).reduce((sum, t) => sum + parseFloat(t.fare), 0);
      setStats({
        totalFare: total,
        totalTickets: list.length,
        averageFare: list.length > 0 ? total / list.length : 0,
      });

      // Composition: server first, fallback to list
      await fetchComposition(token, dISO, list);
    } catch (e: any) {
      console.error('[TicketSales] load error →', e.message || e);
      setError(e.message || 'Failed to load ticket data');
      setTickets([]);
      setStats({ totalFare: 0, totalTickets: 0, averageFare: 0 });
      setRegularCount(0);
      setDiscountCount(0);

      if (!isRefresh) {
        Alert.alert('Error', 'Failed to load ticket sales data. Please try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, fetchComposition]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    fadeAnim.setValue(0);
    if (showComposition) {
      Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    }
  }, [showComposition, fadeAnim]);

  const showPicker = () => setPickerVisible(true);
  const hidePicker = () => setPickerVisible(false);
  const onConfirm = (d: Date) => { setSelectedDate(d); hidePicker(); };

  const renderTicketRow = ({ item, index }: { item: TicketRow; index: number }) => {
    const numMatch = item.bus?.match(/\d+/);
    const busLabel = numMatch ? `Bus ${parseInt(numMatch[0], 10)}` : item.bus;

    return (
      <View style={[styles.ticketCard, { backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8f9fa' }]}>
        <View style={styles.ticketCardHeader}>
          <View style={styles.busTag}>
            <Ionicons name="bus" size={14} color="#fff" />
            <Text style={styles.busTagText}>{busLabel}</Text>
          </View>
          <Text style={styles.fareAmount}>₱{parseFloat(item.fare).toFixed(2)}</Text>
        </View>

        <View style={styles.ticketCardBody}>
          <View style={styles.commuterInfo}>
            <Ionicons name="person" size={16} color="#666" />
            <Text style={styles.commuterName}>{item.commuter}</Text>
          </View>

          <View style={styles.routeInfo}>
            <Ionicons name="location" size={16} color="#666" />
            <Text style={styles.routeText}>{item.origin}</Text>
            <Ionicons name="arrow-forward" size={14} color="#999" style={{ marginHorizontal: 8 }} />
            <Text style={styles.routeText}>{item.destination}</Text>
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="ticket-outline" size={64} color="#ccc" />
      <Text style={styles.emptyStateTitle}>No Tickets Found</Text>
      <Text style={styles.emptyStateSubtitle}>
        No tickets were sold on {dayjs(selectedDate).format('MMMM D, YYYY')}
      </Text>
      <TouchableOpacity style={styles.emptyStateButton} onPress={() => fetchTickets()}>
        <Text style={styles.emptyStateButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

  const renderCompositionFooter = () => {
    const total = stats.totalTickets || 0;
    const regPct = pct(regularCount, total);
    const disPct = pct(discountCount, total);

    return (
      <View style={{ paddingTop: 12, paddingBottom: 24 }}>
        <TouchableOpacity
          style={styles.footerToggle}
          onPress={() => setShowComposition(s => !s)}
          activeOpacity={0.8}
        >
          <Ionicons name="stats-chart" size={18} color="#2d5a2d" />
          <Text style={styles.footerToggleText}>Ticket Composition</Text>
          <Ionicons name={showComposition ? 'chevron-up' : 'chevron-down'} size={18} color="#2d5a2d" />
        </TouchableOpacity>

        {showComposition && (
          <Animated.View
            style={[
              styles.compCard,
              { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange:[0,1], outputRange:[12,0] }) }] }
            ]}
          >
            <View style={styles.compHeaderRow}>
              <Ionicons name="pricetag" size={18} color="#2d5a2d" />
              <Text style={styles.compTitle}>Fare Type</Text>
            </View>

            <View style={styles.barOuter}>
              <View style={[styles.barSegment, { width: `${regPct}%`, backgroundColor: '#2e7d32' }]} />
              <View style={[styles.barSegment, { width: `${disPct}%`, backgroundColor: '#81C784' }]} />
            </View>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#2e7d32' }]} />
                <Text style={styles.legendText}>Regular: {regularCount} ({regPct}%)</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#81C784' }]} />
                <Text style={styles.legendText}>Discount: {discountCount} ({disPct}%)</Text>
              </View>
            </View>
          </Animated.View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Ticket Sales</Text>
          <Text style={styles.headerSubtitle}>Daily Overview</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => fetchTickets(true)} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date & Summary */}
      <View style={styles.dateSection}>
        <TouchableOpacity style={styles.dateSelector} onPress={() => setPickerVisible(true)}>
          <View style={styles.dateSelectorContent}>
            <Ionicons name="calendar" size={20} color="#2e7d32" />
            <Text style={styles.dateSelectorText}>{dayjs(selectedDate).format('MMMM D, YYYY')}</Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </View>
        </TouchableOpacity>

        <View style={styles.compactSummary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>₱{stats.totalFare.toFixed(2)}</Text>
            <Text style={styles.summaryLabel}>Total Revenue</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{stats.totalTickets}</Text>
            <Text style={styles.summaryLabel}>Total Trips</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2e7d32" />
            <Text style={styles.loadingText}>Loading ticket data...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={48} color="#f44336" />
            <Text style={styles.errorTitle}>Error Loading Data</Text>
            <Text style={styles.errorMessage}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchTickets()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderTicketRow}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => fetchTickets(true)} colors={['#2e7d32']} tintColor="#2e7d32" />
            }
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={tickets.length > 0 ? renderCompositionFooter() : null}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={tickets.length === 0 ? styles.emptyListContainer : styles.listContainer}
          />
        )}
      </View>

      <DateTimePickerModal
        isVisible={isPickerVisible}
        mode="date"
        onConfirm={(d) => { setSelectedDate(d); hidePicker(); }}
        onCancel={hidePicker}
        date={selectedDate}
        maximumDate={new Date()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },

  header: {
    backgroundColor: '#2e7d32', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 20, elevation: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, position: 'relative',
  },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: 'bold' },
  headerSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  refreshButton: { position: 'absolute', right: 16, top: 60, padding: 8, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },

  dateSection: {
    backgroundColor: '#fff', margin: 16, borderRadius: 12, padding: 16, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2,
  },
  dateSelector: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 8, padding: 12, marginBottom: 16 },
  dateSelectorContent: { flexDirection: 'row', alignItems: 'center' },
  dateSelectorText: { flex: 1, marginLeft: 8, fontSize: 16, fontWeight: '500', color: '#333' },
  compactSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: 8 },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32' },
  summaryLabel: { fontSize: 12, color: '#666', textAlign: 'center', fontWeight: '500' },
  summaryDivider: { width: 1, height: 30, backgroundColor: '#e0e0e0' },

  contentContainer: { flex: 1, paddingHorizontal: 16 },
  listContainer: { paddingBottom: 20 },
  emptyListContainer: { flex: 1, justifyContent: 'center' },

  ticketCard: { borderRadius: 12, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#e0e0e0' },
  ticketCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  busTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2e7d32', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  busTagText: { color: '#fff', fontSize: 12, fontWeight: '600', marginLeft: 4 },
  fareAmount: { fontSize: 18, fontWeight: 'bold', color: '#2e7d32' },
  ticketCardBody: { gap: 8 },
  commuterInfo: { flexDirection: 'row', alignItems: 'center' },
  commuterName: { marginLeft: 8, fontSize: 16, fontWeight: '500', color: '#333' },
  routeInfo: { flexDirection: 'row', alignItems: 'center' },
  routeText: { fontSize: 14, color: '#666' },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  errorTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
  errorMessage: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  retryButton: { backgroundColor: '#2e7d32', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  retryButtonText: { color: '#fff', fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyStateTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginTop: 16, marginBottom: 8 },
  emptyStateSubtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 24 },
  emptyStateButton: { backgroundColor: '#2e7d32', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  emptyStateButtonText: { color: '#fff', fontWeight: '600' },

  footerToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8f5e8',
    paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2,
    elevation: 1, marginHorizontal: 16, marginBottom: 10,
  },
  footerToggleText: { flex: 1, marginLeft: 8, fontSize: 15, fontWeight: '600', color: '#2d5a2d' },

  compCard: {
    marginHorizontal: 20, marginTop: 10, backgroundColor: '#fff', borderRadius: 20, padding: 16,
    shadowColor: '#2d5a2d', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10,
    elevation: 4, borderWidth: 1, borderColor: '#e8f5e8',
  },
  compHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  compTitle: { fontSize: 15, fontWeight: '700', color: '#2d5a2d' },
  barOuter: { height: 14, backgroundColor: '#EEF5EE', borderRadius: 8, overflow: 'hidden', flexDirection: 'row' },
  barSegment: { height: '100%' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { color: '#374151', fontSize: 13, fontWeight: '600' },
});
