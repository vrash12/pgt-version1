import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

/* ─── constants ─── */
const BACKEND = 'http://192.168.1.7:5000';

/* ─── types ─── */
type Receipt = {
  id: number;
  referenceNo: string;
  date: string;   // e.g. "May 2, 2025"
  time: string;   // e.g. "7:21 am"
  fare: string;   // formatted already "15.00"
  qr?: string;    // payload string for QRCode component
  qr_url?: string;// optional static image
  paid: boolean;
};

type FilterValue = 'all' | '7' | '30';

export default function MyReceipts() {
  const router = useRouter();

  /* ── state ── */
  const [filter, setFilter] = useState<FilterValue>('all');
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));

  /* ── helpers ── */
  const fetchReceipts = useCallback(async (f: FilterValue, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const tok = await AsyncStorage.getItem('@token');
      const headers: Record<string, string> = {};
      if (tok) headers.Authorization = `Bearer ${tok}`;

      let url = `${BACKEND}/commuter/tickets/mine`;
      if (f === '7' || f === '30') {
        url += `?days=${f}`;
      }
      const resp = await fetch(url, { headers });
      if (!resp.ok) throw new Error(`Server ${resp.status}`);
      const json = (await resp.json()) as Receipt[];
      setReceipts(Array.isArray(json) ? json : []);
      
      // Animate content in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (e: any) {
      console.error('Receipts fetch error', e);
      setError(e.message || 'Unable to load receipts');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fadeAnim]);

  const onRefresh = useCallback(() => {
    fetchReceipts(filter, true);
  }, [filter, fetchReceipts]);

  /* ── initial + filter change ── */
  useEffect(() => {
    fadeAnim.setValue(0);
    fetchReceipts(filter);
  }, [filter, fetchReceipts]);

  /* ── render helpers ── */
  const renderReceipt = ({ item, index }: { item: Receipt; index: number }) => (
    <Animated.View 
      style={[
        styles.card,
        {
          opacity: fadeAnim,
          transform: [{
            translateY: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [20, 0],
            }),
          }],
        }
      ]}
    >
      {/* Status indicator */}
      <View style={[styles.statusIndicator, item.paid ? styles.statusPaid : styles.statusUnpaid]} />
      
      {/* QR column */}
      <View style={styles.qrWrapper}>
        <View style={styles.qrContainer}>
          {item.qr ? (
            <QRCode value={item.qr} size={64} backgroundColor="transparent" />
          ) : (
            <Image source={{ uri: item.qr_url }} style={styles.qrImg} />
          )}
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
  );

  const FilterButton = ({ label, value, count }: { label: string; value: FilterValue; count?: number }) => (
    <Pressable
      onPress={() => setFilter(value)}
      style={[styles.filterBtn, filter === value && styles.filterBtnActive]}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.filterBadge, filter === value && styles.filterBadgeActive]}>
          <Text style={[styles.filterBadgeText, filter === value && styles.filterBadgeTextActive]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );

  const getFilteredCount = (filterValue: FilterValue) => {
    if (filterValue === 'all') return receipts.length;
    // This would normally be calculated based on the actual filter logic
    return receipts.length;
  };

  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerContent}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>My Receipts</Text>
            <Text style={styles.headerSubtitle}>
              {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'} found
            </Text>
          </View>
        </View>
        <View style={styles.headerDecoration} />
      </View>

      {/* ── Filter Row ── */}
      <View style={styles.filterContainer}>
        <View style={styles.filterRow}>
          <FilterButton label="All" value="all" count={getFilteredCount('all')} />
          <FilterButton label="7 Days" value="7" />
          <FilterButton label="30 Days" value="30" />
        </View>
      </View>

      {/* ── Content ── */}
      {loading && !refreshing ? (
        <View style={styles.centered}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2e7d32" />
            <Text style={styles.loadingText}>Loading receipts...</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#e53e3e" />
            <Text style={styles.errorTitle}>Oops! Something went wrong</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity 
              style={styles.retryBtn} 
              onPress={() => fetchReceipts(filter)}
            >
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
        />
      )}
    </View>
  );
}

/* ─── styles ─── */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  
  /* header */
  headerContainer: {
    backgroundColor: '#2e7d32',
    paddingTop: 50,
    paddingBottom: 30,
    position: 'relative',
    overflow: 'hidden',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 2,
  },
  headerDecoration: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '400',
  },

  /* filters */
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    marginRight: 12,
    backgroundColor: '#fff',
  },
  filterBtnActive: {
    backgroundColor: '#2e7d32',
    borderColor: '#2e7d32',
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  filterText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#fff',
  },
  filterBadge: {
    marginLeft: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterBadgeText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  filterBadgeTextActive: {
    color: '#fff',
  },

  /* list */
  listContainer: {
    paddingTop: 16,
    paddingBottom: 24,
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
  },
  statusIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  statusPaid: {
    backgroundColor: '#22c55e',
  },
  statusUnpaid: {
    backgroundColor: '#f59e0b',
  },
  qrWrapper: {
    marginRight: 20,
    alignItems: 'center',
  },
  qrContainer: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrImg: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  detailsWrapper: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  refContainer: {
    flex: 1,
  },
  refLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
    marginBottom: 4,
  },
  refValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
  },
  badgePaid: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  badgePaidText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  infoTextContainer: {
    marginLeft: 8,
  },
  infoLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    marginTop: 2,
  },
  fareRow: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 16,
  },
  fareContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  fareValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2e7d32',
  },

  /* states */
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    maxWidth: 280,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyContent: {
    alignItems: 'center',
    maxWidth: 280,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
});