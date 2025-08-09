// app/(tabs)/manager/ticket-sales.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { API_BASE_URL } from "../../config";

const { width } = Dimensions.get('window');

interface TicketRow {
  id: number;
  bus: string;
  commuter: string;
  origin: string;
  destination: string;
  fare: string;
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

  // Calculate statistics
  const stats: TicketStats = {
    totalFare: tickets.reduce((sum, t) => sum + parseFloat(t.fare), 0),
    totalTickets: tickets.length,
    averageFare: tickets.length > 0 ? tickets.reduce((sum, t) => sum + parseFloat(t.fare), 0) / tickets.length : 0,
  };

  const load = useCallback(
    async (isRefresh = false) => {
      isRefresh ? setRefreshing(true) : setLoading(true);
      setError(null);
      
      try {
        const token = await AsyncStorage.getItem('@token');
        if (!token) {
          throw new Error('Authentication token not found');
        }

        const d = dayjs(selectedDate).format('YYYY-MM-DD');
        const url = `${API_BASE_URL}/manager/tickets?date=${d}`;
        
        const res = await fetch(url, {
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        const text = await res.text();
        
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        
        const data = JSON.parse(text);
        const list: TicketRow[] = Array.isArray(data) ? data : data.tickets;
        setTickets(list || []);
        
      } catch (e: any) {
        console.error('[TicketSales] load error →', e.message || e);
        setError(e.message || 'Failed to load ticket data');
        setTickets([]);
        
        if (!isRefresh) {
          Alert.alert('Error', 'Failed to load ticket sales data. Please try again.');
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [selectedDate]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Date picker handlers
  const showPicker = () => setPickerVisible(true);
  const hidePicker = () => setPickerVisible(false);
  const onConfirm = (d: Date) => {
    setSelectedDate(d);
    hidePicker();
  };

  // Quick date selection
  const selectToday = () => setSelectedDate(new Date());

  const renderTicketRow = ({ item, index }: { item: TicketRow; index: number }) => {
    const numMatch = item.bus.match(/\d+/);
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
      <TouchableOpacity style={styles.emptyStateButton} onPress={() => load()}>
        <Text style={styles.emptyStateButtonText}>Refresh</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Enhanced Header */}
      <View style={styles.header}>
   
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Ticket Sales</Text>
          <Text style={styles.headerSubtitle}>Daily Revenue Overview</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.refreshButton} 
          onPress={() => load(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Date Selection & Summary */}
      <View style={styles.dateSection}>
        <TouchableOpacity style={styles.dateSelector} onPress={showPicker}>
          <View style={styles.dateSelectorContent}>
            <Ionicons name="calendar" size={20} color="#2e7d32" />
            <Text style={styles.dateSelectorText}>
              {dayjs(selectedDate).format('MMMM D, YYYY')}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#666" />
          </View>
        </TouchableOpacity>
        
        {/* Compact Summary */}
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

      {/* Content Area */}
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
            <TouchableOpacity style={styles.retryButton} onPress={() => load()}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderTicketRow}
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={() => load(true)}
                colors={['#2e7d32']}
                tintColor="#2e7d32"
              />
            }
            ListEmptyComponent={renderEmptyState}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={tickets.length === 0 ? styles.emptyListContainer : styles.listContainer}
          />
        )}
      </View>

      <DateTimePickerModal
        isVisible={isPickerVisible}
        mode="date"
        onConfirm={onConfirm}
        onCancel={hidePicker}
        date={selectedDate}
        maximumDate={new Date()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  
  // Header Styles
  header: {
    backgroundColor: '#2e7d32',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    position: 'relative',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  refreshButton: {
    position: 'absolute',
    right: 16,
    top: 60,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Date Section & Compact Summary
  dateSection: {
    backgroundColor: '#fff',
    margin: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  dateSelector: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  dateSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateSelectorText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  compactSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#e0e0e0',
  },

  // Content Container
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  listContainer: {
    paddingBottom: 20,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  // Ticket Card Styles
  ticketCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  busTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2e7d32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  busTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  fareAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2e7d32',
  },
  ticketCardBody: {
    gap: 8,
  },
  commuterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commuterName: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeText: {
    fontSize: 14,
    color: '#666',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#2e7d32',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});