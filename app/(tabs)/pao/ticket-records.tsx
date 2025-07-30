// app/(tabs)/pao/ticket-records.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');
const BACKEND = 'http://192.168.1.7:5000';

type Ticket = {
  id: number;
  referenceNo: string;
  commuter: string;
  date: string;   // e.g. "April 30, 2025"
  time: string;   // e.g. "7:20 am"
  fare: string;   // already "15.00"
  paid: boolean;
};

export default function TicketRecords() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<number|null>(null);

  /** Load tickets */
  const loadTickets = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const tok = await AsyncStorage.getItem('@token');
      const today = dayjs().format('YYYY-MM-DD');
      const res = await fetch(`${BACKEND}/pao/tickets?date=${today}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Ticket list error:', e);
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /** Initial load */
  useEffect(() => {
    loadTickets();
  }, []);

  /** Pull to refresh */
  const onRefresh = () => {
    loadTickets(true);
  };

  /** Mark paid handler */
  const markPaid = async (t: Ticket) => {
    setUpdating(t.id);
    try {
      const tok = await AsyncStorage.getItem('@token');
      await fetch(`${BACKEND}/pao/tickets/${t.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paid: true }),
      });
      setTickets(prev =>
        prev.map(x => (x.id === t.id ? { ...x, paid: true } : x)),
      );
    } catch (e) {
      console.error('Mark-paid error', e);
    } finally {
      setUpdating(null);
    }
  };

  // Stats
  const totalTickets = tickets.length;
  const paidTickets  = tickets.filter(t => t.paid).length;
  const totalRevenue = tickets
    .filter(t => t.paid)
    .reduce((sum, t) => sum + parseFloat(t.fare), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Ticket Records</Text>
            <Text style={styles.headerSubtitle}>Today's transactions</Text>
          </View>
          <TouchableOpacity 
            onPress={onRefresh}
            style={styles.refreshButton}
            disabled={refreshing}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color="#fff" 
              style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.dateContainer}>
          <View style={styles.dateCard}>
            <Ionicons name="calendar-outline" size={16} color="#2e7d32" />
            <Text style={styles.dateText}>
              {dayjs().format('MMMM D, YYYY')}
            </Text>
          </View>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Ionicons name="ticket-outline" size={20} color="#2e7d32" />
          <Text style={styles.statNumber}>{totalTickets}</Text>
          <Text style={styles.statLabel}>Total Tickets</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle-outline" size={20} color="#4caf50" />
          <Text style={styles.statNumber}>{paidTickets}</Text>
          <Text style={styles.statLabel}>Paid</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons name="cash-outline" size={20} color="#ff9800" />
          <Text style={styles.statNumber}>₱{totalRevenue.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Revenue</Text>
        </View>
      </View>

      {/* Ticket List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2e7d32']}
            tintColor="#2e7d32"
          />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2e7d32" />
            <Text style={styles.loadingText}>Loading tickets...</Text>
          </View>
        ) : tickets.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={60} color="#ccc" />
            <Text style={styles.emptyTitle}>No Tickets Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tickets issued today will appear here
            </Text>
          </View>
        ) : (
          tickets.map((ticket, index) => (
            <View
              key={ticket.id}            // ← unique key on each mapped child
              style={[
                styles.ticketCard,
                { marginTop: index === 0 ? 0 : 12 },
              ]}
            >
              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  ticket.paid ? styles.statusPaid : styles.statusPending
                ]}
              >
                <Ionicons 
                  name={ticket.paid ? "checkmark-circle" : "time-outline"} 
                  size={12} 
                  color="#fff" 
                />
                <Text style={styles.statusText}>
                  {ticket.paid ? 'PAID' : 'PENDING'}
                </Text>
              </View>

              {/* Header */}
              <View style={styles.ticketHeader}>
                <View style={styles.commuterInfo}>
                  <Ionicons name="person" size={20} color="#2e7d32" />
                  <View style={styles.commuterDetails}>
                    <Text style={styles.commuterLabel}>Passenger</Text>
                    <Text style={styles.commuterName}>{ticket.commuter}</Text>
                  </View>
                </View>
                <Text style={styles.referenceNumber}>#{ticket.referenceNo}</Text>
              </View>

              {/* Details */}
              <View style={styles.ticketDetails}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar" size={14} color="#666" />
                  <View>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>{ticket.date}</Text>
                  </View>
                </View>

                <View style={styles.detailItem}>
                  <Ionicons name="time" size={14} color="#666" />
                  <View>
                    <Text style={styles.detailLabel}>Time</Text>
                    <Text style={styles.detailValue}>{ticket.time}</Text>
                  </View>
                </View>
              </View>

              {/* Fare & Action */}
              <View style={styles.fareSection}>
                <View style={styles.fareInfo}>
                  <Text style={styles.fareLabel}>Total Fare</Text>
                  <Text style={styles.fareAmount}>₱{ticket.fare}</Text>
                </View>

                {!ticket.paid && (
                  <TouchableOpacity
                    style={[
                      styles.payButton,
                      updating === ticket.id && styles.payButtonLoading
                    ]}
                    onPress={() => markPaid(ticket)}
                    disabled={updating === ticket.id}
                  >
                    {updating === ticket.id ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="card-outline" size={16} color="#fff" />
                    )}
                    <Text style={styles.payButtonText}>
                      {updating === ticket.id ? 'Processing...' : 'Mark as Paid'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf9',
  },

  // Header Styles
  headerContainer: {
    backgroundColor: '#2e7d32',
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Date Display
  dateContainer: {
    paddingHorizontal: 20,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'center',
  },
  dateText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },

  // Stats Overview
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Scroll View
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100, // Space for tab bar
  },

  // Loading State
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },

  // Ticket Card Styles
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    position: 'relative',
  },

  // Status Badge
  statusBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusPaid: {
    backgroundColor: '#4caf50',
  },
  statusPending: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Ticket Header
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    marginRight: 80, // Space for status badge
  },
  commuterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e8f5e8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  commuterDetails: {
    flex: 1,
  },
  commuterLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  commuterName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  referenceNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
  },

  // Ticket Details
  ticketDetails: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  detailLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },

  // Fare Section
  fareSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  fareInfo: {
    flex: 1,
  },
  fareLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  fareAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2e7d32',
  },

  // Pay Button
  payButton: {
    backgroundColor: '#ff9800',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    shadowColor: '#ff9800',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  payButtonLoading: {
    opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});