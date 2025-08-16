// app/(tabs)/commuter/my-receipts.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL } from "../../config";

// ───────────────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────────────
type Receipt = {
  id: number;
  referenceNo: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  passengerType: string; // "Regular" | "Discount"
  commuter: string;
  fare: string;
  qr?: string;
  qr_url?: string;
  paid: boolean;
};

type PagedResp = {
  items: Receipt[];
  page: number;
  page_size: number;
  total: number;
  has_more: boolean;
};

type Bus = { id: number; identifier: string };

// Card height for stable virtualization
const CARD_HEIGHT = 116;

// ───────────────────────────────────────────────────────────────────────────────
// Component
// ───────────────────────────────────────────────────────────────────────────────
export default function MyReceipts() {
  const router = useRouter();

  // list state
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  // pagination
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const pageSize = 5; // exactly 5 per page
  const [totalPages, setTotalPages] = useState<number>(1);

  // legacy fallback cache (if backend returns an array)
  const legacyAllRef = useRef<Receipt[] | null>(null);

  // filters (Announcements-style)
  const [buses, setBuses] = useState<Bus[]>([]);
  const [selectedBus, setSelectedBus] = useState<number | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // ── load buses for picker ──
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/commuter/buses`);
        if (res.ok) setBuses(await res.json());
      } catch {
        /* non-fatal */
      }
    })();
  }, []);

  const computeTotals = useCallback((total: number | null, itemsLen?: number) => {
    const t = typeof total === 'number' ? total : (itemsLen ?? 0);
    const tp = Math.max(1, Math.ceil(t / pageSize));
    setTotalPages(tp);
    setTotalCount(typeof total === 'number' ? total : (itemsLen ?? 0));
  }, []);

  // ── fetcher ──
  const fetchReceipts = useCallback(
    async (opts?: { gotoPage?: number; keepLegacy?: boolean }) => {
      const targetPage = Math.max(1, opts?.gotoPage ?? page);

      setLoading(true);
      setError(null);

      try {
        const tok = await AsyncStorage.getItem('@token');
        const headers: Record<string, string> = tok ? { Authorization: `Bearer ${tok}` } : {};

        const params = new URLSearchParams();
        params.append('light', '1');
        params.append('page', String(targetPage));
        params.append('page_size', String(pageSize));

        // These are extra client filters; backend can ignore safely
        if (selectedBus !== 'all') params.append('bus_id', String(selectedBus));
        if (selectedDate) {
          const y = selectedDate.getFullYear();
          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const d = String(selectedDate.getDate()).padStart(2, '0');
          params.append('date', `${y}-${m}-${d}`);
        }

        const resp = await fetch(`${API_BASE_URL}/commuter/tickets/mine?${params.toString()}`, { headers });
        if (!resp.ok) throw new Error(`Server ${resp.status}`);

        const json = (await resp.json()) as PagedResp | Receipt[];

        if (Array.isArray(json)) {
          // Legacy backend: cache once, slice client-side
          if (!opts?.keepLegacy) legacyAllRef.current = json;
          const all = legacyAllRef.current ?? json;
          const start = (targetPage - 1) * pageSize;
          const end = start + pageSize;
          setReceipts(all.slice(start, end));
          const more = end < all.length;
          setHasMore(more);
          setPage(targetPage);
          computeTotals(all.length);
        } else {
          const newItems = json.items ?? [];
          setReceipts(newItems);
          setHasMore(Boolean(json.has_more));
          setPage(targetPage);
          computeTotals(json.total ?? null, newItems.length);
        }

        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      } catch (e: any) {
        setError(e.message || 'Unable to load receipts');
      } finally {
        setLoading(false);
      }
    },
    [fadeAnim, page, selectedBus, selectedDate, computeTotals]
  );

  // initial + whenever filters change → reset to page 1
  useEffect(() => {
    legacyAllRef.current = null; // reset legacy cache on filter change
    fadeAnim.setValue(0);
    setPage(1);
    setHasMore(true);
    fetchReceipts({ gotoPage: 1 });
  }, [selectedBus, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReceipts({ gotoPage: page, keepLegacy: true });
    setRefreshing(false);
  }, [fetchReceipts, page]);

  // top pagination handlers
  const goPrev = useCallback(() => {
    if (page <= 1 || loading) return;
    if (legacyAllRef.current) {
      const newPage = page - 1;
      const all = legacyAllRef.current;
      const start = (newPage - 1) * pageSize;
      const end = start + pageSize;
      setReceipts(all.slice(start, end));
      setPage(newPage);
      setHasMore(end < all.length);
    } else {
      fetchReceipts({ gotoPage: page - 1 });
    }
  }, [page, loading, fetchReceipts]);

  const goNext = useCallback(() => {
    if (loading) return;
    if (!hasMore && totalPages && page >= totalPages) return;
    if (legacyAllRef.current) {
      const newPage = page + 1;
      const all = legacyAllRef.current;
      const start = (newPage - 1) * pageSize;
      const end = start + pageSize;
      setReceipts(all.slice(start, end));
      setPage(newPage);
      setHasMore(end < all.length);
    } else {
      fetchReceipts({ gotoPage: page + 1 });
    }
  }, [page, hasMore, totalPages, loading, fetchReceipts]);

  // row
  const ReceiptRow = React.memo(function ReceiptRow({ item, onPress }: { item: Receipt; onPress: () => void }) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          {/* Status indicator */}
          <View style={[styles.statusIndicator, item.paid ? styles.statusPaid : styles.statusUnpaid]} />

          {/* QR column */}
          <View style={styles.qrWrapper}>
            <View style={styles.qrContainer}>
              {!!item.qr_url && <Image source={{ uri: item.qr_url }} style={styles.qrImg} />}
            </View>
          </View>

          {/* details column */}
          <View style={styles.detailsWrapper}>
            <View style={styles.headerRow}>
              <View style={styles.refContainer}>
                <Text style={styles.refLabel}>Reference No.</Text>
                <Text style={styles.refValue}>{item.referenceNo}</Text>
              </View>
              {item.paid && (
                <View style={styles.badgePaid}>
                  <Ionicons name="checkmark-circle" size={12} color="#fff" />
                  <Text style={styles.badgePaidText}>Paid</Text>
                </View>
              )}
            </View>

            <View style={styles.infoRow}>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={14} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Date</Text>
                  <Text style={styles.infoValue}>{item.date}</Text>
                </View>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="time-outline" size={14} color="#666" />
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoLabel}>Time</Text>
                  <Text style={styles.infoValue}>{item.time}</Text>
                </View>
              </View>
            </View>

            <View style={styles.fareRow}>
              <View style={styles.fareContainer}>
                <Text style={styles.fareLabel}>Total Fare</Text>
                <Text style={styles.fareValue}>₱{item.fare}</Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </TouchableOpacity>
    );
  });

  const renderReceipt = useCallback(
    ({ item }: { item: Receipt }) => {
      const payload = encodeURIComponent(JSON.stringify(item));
      const onPress = () =>
        router.push({ pathname: '/commuter/receipt/[id]', params: { id: String(item.id), data: payload } });
      return <ReceiptRow item={item} onPress={onPress} />;
    },
    [router]
  );

  const headerCount = useMemo(() => totalCount ?? receipts.length, [totalCount, receipts.length]);

  // date picker helpers
  const toggleDatePicker = () => setShowPicker(true);
  const onDateChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) setSelectedDate(date);
  };
  const clearFilters = () => {
    setSelectedBus('all');
    setSelectedDate(null);
  };

  // paging label (1–5 of 23)
  const rangeLabel = useMemo(() => {
    if (!headerCount) return '0–0 of 0';
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, headerCount);
    return `${start}–${end} of ${headerCount}`;
  }, [page, headerCount]);

  const showEmptyBanner = !loading && receipts.length === 0;

  return (
    <View style={styles.container}>
   {/* Header */}
<View style={styles.headerContainer}>
  <View style={styles.headerContent}>
    <View style={styles.headerTextContainer}>
      <Text style={styles.headerTitle}>My Receipts</Text>
      <Text style={styles.headerSubtitle}>
        {headerCount} {headerCount === 1 ? 'receipt' : 'receipts'}
      </Text>
    </View>

    {/* ⬇️ Add this */}
    <TouchableOpacity
      onPress={() => router.push('/commuter/gcash')}
      style={styles.helpBtn}
      activeOpacity={0.9}
    >
      <Ionicons name="scan-outline" size={16} color="#1B5E20" />
      <Text style={styles.helpBtnText}>Pay via GCash</Text>
    </TouchableOpacity>
  </View>
  <View style={styles.headerDecoration} />
</View>


      {/* Filters (like Announcements) */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow2}>
          <View style={styles.pickerWrapper}>
            <Ionicons name="bus-outline" size={18} color="#2e7d32" style={styles.pickerIcon} />
            <Picker
              selectedValue={selectedBus}
              onValueChange={(v) => setSelectedBus(v)}
              style={styles.picker}
              dropdownIconColor="#2e7d32"
            >
              <Picker.Item label="All Buses" value="all" />
              {buses.map(b => (
                <Picker.Item
                  key={b.id}
                  label={(b.identifier || `bus-${b.id}`).replace(/^bus[-_]?/i, 'Bus ')}
                  value={b.id}
                />
              ))}
            </Picker>
          </View>

          <TouchableOpacity style={styles.dateButton} onPress={toggleDatePicker}>
            <Ionicons name="calendar-outline" size={18} color="#2e7d32" />
            <Text style={styles.dateButtonText}>
              {selectedDate
                ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                : 'Date'}
            </Text>
          </TouchableOpacity>
        </View>

        {(selectedBus !== 'all' || selectedDate) && (
          <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
            <Ionicons name="refresh-outline" size={16} color="#666" />
            <Text style={styles.clearFiltersText}>Clear Filters</Text>
          </TouchableOpacity>
        )}
      </View>

      {showPicker && (
        <DateTimePicker
          value={selectedDate || new Date()}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}

      {/* Top Pagination Controls */}
      <View style={styles.pagerBar}>
        <Text style={styles.pagerLabel}>
          {rangeLabel}{totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ''}
        </Text>
        <View style={styles.pagerBtns}>
          <TouchableOpacity
            onPress={goPrev}
            disabled={page <= 1 || loading}
            style={[styles.pagerBtn, (page <= 1 || loading) && styles.pagerBtnDisabled]}
          >
            <Ionicons name="chevron-back" size={18} color="#fff" />
            <Text style={styles.pagerBtnText}>Prev</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={goNext}
            disabled={(!hasMore && page >= totalPages) || loading}
            style={[styles.pagerBtn, ((!hasMore && page >= totalPages) || loading) && styles.pagerBtnDisabled]}
          >
            <Text style={styles.pagerBtnText}>Next</Text>
            <Ionicons name="chevron-forward" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status banner (loading / empty) */}
      {loading && (
        <View style={styles.statusBanner}>
          <ActivityIndicator size="small" color="#2e7d32" />
          <Text style={styles.statusBannerText}>Loading tickets…</Text>
        </View>
      )}
      {showEmptyBanner && (
        <View style={[styles.statusBanner, styles.statusBannerEmpty]}>
          <Ionicons name="information-circle-outline" size={18} color="#64748b" />
          <Text style={styles.statusBannerEmptyText}>
            No receipts found{(selectedBus !== 'all' || selectedDate) ? ' for the selected filters.' : '.'}
          </Text>
        </View>
      )}

      {/* Content */}
      {error ? (
        <View style={styles.centered}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#e53e3e" />
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => fetchReceipts({ gotoPage: page, keepLegacy: true })}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={receipts}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderReceipt}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#2e7d32']}
              tintColor="#2e7d32"
            />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyContent}>
                <Ionicons name="receipt-outline" size={64} color="#ccc" />
                <Text style={styles.emptyTitle}>No receipts found</Text>
                <Text style={styles.emptyText}>
                  Your transaction receipts will appear here once you make a payment.
                </Text>
              </View>
            </View>
          )}
          showsVerticalScrollIndicator={false}
          // Virtualization tuning
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={16}
          windowSize={7}
          removeClippedSubviews
          getItemLayout={(_, index) => ({ length: CARD_HEIGHT, offset: CARD_HEIGHT * index, index })}
        />
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },

  /* header */
  headerContainer: {
    backgroundColor: '#2e7d32',
    paddingTop: 50,
    paddingBottom: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, zIndex: 2 },
  headerDecoration: {
    position: 'absolute', bottom: -50, right: -50, width: 150, height: 150,
    borderRadius: 75, backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 4 },
  headerSubtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', fontWeight: '400' },

  /* filters (Announcements-like) */
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterRow2: { flexDirection: 'row', alignItems: 'center' },
  pickerWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12, borderWidth: 1, borderColor: '#E8F5E8',
    height: 48, marginRight: 12,
  },
  pickerIcon: { paddingLeft: 16 },
  picker: { flex: 1, height: 58, color: '#2E7D32' }, // use '#000' if you prefer black
  dateButton: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 12, height: 48, minWidth: 100, justifyContent: 'center',
  },
  dateButtonText: { color: '#2E7D32', fontWeight: '600', marginLeft: 6, fontSize: 14 },
  clearFiltersButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 16, backgroundColor: '#F5F5F5',
    borderRadius: 20, alignSelf: 'flex-start', marginTop: 12,
  },
  clearFiltersText: { color: '#666', fontSize: 12, fontWeight: '500', marginLeft: 4 },

  /* pager (top controls) */
  pagerBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pagerLabel: { color: '#475569', fontSize: 13, fontWeight: '600' },
  pagerBtns: { flexDirection: 'row', gap: 10 },
  pagerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#2e7d32',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
  },
  pagerBtnDisabled: { backgroundColor: '#9CA3AF' },
  pagerBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  /* status banner (loading/empty info) */
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  statusBannerText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  statusBannerEmpty: { backgroundColor: '#fafafa' },
  statusBannerEmptyText: { color: '#64748b', fontSize: 13, fontWeight: '600' },

  /* list */
  listContainer: {
    paddingTop: 16,
    paddingBottom: 160, // extra padding so TabBar won’t cover the last items
  },

  /* card */
  card: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    position: 'relative',
    overflow: 'hidden',
    minHeight: CARD_HEIGHT,
  },
  statusIndicator: { position: 'absolute', top: 0, left: 0, width: 4, height: '100%' },
  statusPaid: { backgroundColor: '#22c55e' },
  statusUnpaid: { backgroundColor: '#f59e0b' },

  qrWrapper: { marginRight: 20, alignItems: 'center' },
  qrContainer: {
    width: 80, height: 80, borderRadius: 16, backgroundColor: '#f8fafc',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0',
  },
  qrImg: { width: 64, height: 64, borderRadius: 8 },

  detailsWrapper: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  refContainer: { flex: 1 },
  refLabel: { fontSize: 12, color: '#64748b', fontWeight: '500', marginBottom: 4 },
  refValue: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  badgePaid: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#22c55e', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 8 },
  badgePaidText: { color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 },

  infoRow: { flexDirection: 'row', marginBottom: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 16 },
  infoTextContainer: { marginLeft: 8 },
  infoLabel: { fontSize: 11, color: '#64748b', fontWeight: '500' },
  infoValue: { fontSize: 13, color: '#1e293b', fontWeight: '600', marginTop: 2 },

  fareRow: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 16 },
  fareContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fareLabel: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  fareValue: { fontSize: 18, fontWeight: '800', color: '#2e7d32' },

  /* states (errors/empty) */
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  loadingContainer: { alignItems: 'center' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#64748b', fontWeight: '500' },
  errorContainer: { alignItems: 'center', maxWidth: 280 },
  errorTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b', marginTop: 16, marginBottom: 8, textAlign: 'center' },
  errorText: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#2e7d32', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 8 },

  // ✅ these were missing in your build – added here:
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyContent: { alignItems: 'center', maxWidth: 280 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1e293b', marginTop: 24, marginBottom: 12, textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20 },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    borderWidth: 1,
    borderColor: '#CDE9CD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 12,
  },
  helpBtnText: {
    marginLeft: 6,
    color: '#1B5E20',
    fontWeight: '800',
    fontSize: 12,
  },
  
});
