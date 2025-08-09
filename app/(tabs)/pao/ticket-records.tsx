// app/(tabs)/pao/ticket-records.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { API_BASE_URL } from "../../config";


type Ticket = {
  id: number;
  referenceNo: string;
  commuter: string;
  date: string; // e.g. "April 30, 2025"
  time: string; // e.g. "7:20 am"
  fare: string; // already "15.00"
  paid: boolean;
  voided?: boolean;
};

export default function TicketRecords() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<number | null>(null);

  // Date picker state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  /** Fetch tickets */
  const loadTickets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const tok = await AsyncStorage.getItem('@token');
      const dateToFetch = dayjs(selectedDate).format('YYYY-MM-DD');
      const res = await fetch(`${API_BASE_URL}/pao/tickets?date=${dateToFetch}`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tickets.');
      const data = await res.json();
      setTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Ticket list error:', e);
      setTickets([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => { loadTickets(); }, [loadTickets]);
  const onRefresh = () => loadTickets(true);

  /** Mark as Paid */
  const markPaid = async (t: Ticket) => {
    setUpdating(t.id);
    try {
      const tok = await AsyncStorage.getItem('@token');
      await fetch(`${API_BASE_URL}/pao/tickets/${t.id}/void`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paid: true }),
      });
      setTickets(prev =>
        prev.map(x => x.id === t.id ? { ...x, paid: true } : x)
      );
    } catch (e) {
      console.error('Mark-paid error', e);
    } finally {
      setUpdating(null);
    }
  };

  /** Void ticket */
  const voidTicket = (t: Ticket) => {
    Alert.alert(
      'Void ticket',
      'Are you sure you want to void this ticket? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Void',
          style: 'destructive',
          onPress: async () => {
            setUpdating(t.id);
            try {
              const tok = await AsyncStorage.getItem('@token');
              await fetch(`${API_BASE_URL}/pao/tickets/${t.id}/void`, {
                method: 'PATCH',
                headers: {
                  Authorization: `Bearer ${tok}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ voided: true }),
              });
              setTickets(prev =>
                prev.map(x => x.id === t.id ? { ...x, voided: true } : x)
              );
            } catch (e) {
              console.error('Void-ticket error', e);
            } finally {
              setUpdating(null);
            }
          },
        },
      ]
    );
  };

  // Date picker handlers
  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);
  const handleConfirmDate = (date: Date) => {
    setSelectedDate(date);
    hideDatePicker();
  };

    const totalTickets = tickets.length;
    const paidTickets = tickets.filter(t => t.paid && !t.voided).length;
    const totalRevenue = tickets
      .filter(t => t.paid && !t.voided)
      .reduce((sum, t) => sum + parseFloat(t.fare), 0);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Ticket Records</Text>
            <Text style={styles.headerSubtitle}>
              {dayjs(selectedDate).isSame(dayjs(), 'day')
                ? "Today's transactions"
                : `Transactions for ${dayjs(selectedDate).format('MMM D')}`}
            </Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton} disabled={refreshing}>
            <Ionicons
              name="refresh"
              size={20}
              color="#fff"
              style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
            />
          </TouchableOpacity>
        </View>
        <View style={styles.dateContainer}>
          <TouchableOpacity style={styles.dateCard} onPress={showDatePicker}>
            <Ionicons name="calendar-outline" size={16} color="#2e7d32" />
            <Text style={styles.dateText}>{dayjs(selectedDate).format('MMMM D, YYYY')}</Text>
            <Ionicons name="chevron-down" size={16} color="#2e7d32" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
      </View>

      <DateTimePickerModal
        isVisible={isDatePickerVisible}
        mode="date"
        onConfirm={handleConfirmDate}
        onCancel={hideDatePicker}
        date={selectedDate}
        maximumDate={new Date()}
      />

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
            <Text style={styles.emptyTitle}>No Tickets Found</Text>
            <Text style={styles.emptySubtitle}>No transactions were recorded on this date.</Text>
          </View>
        ) : (
          tickets.map(ticket => (
            <View key={ticket.id} style={styles.ticketCard}>
              {/* Status Badge */}
              <View
                style={[
                  styles.statusBadge,
                  ticket.voided
                    ? styles.statusVoided
                    : ticket.paid
                    ? styles.statusPaid
                    : styles.statusPending,
                ]}
              >
                <Ionicons
                  name={ticket.voided ? 'close-circle' : ticket.paid ? 'checkmark-circle' : 'time-outline'}
                  size={12}
                  color="#fff"
                />
                <Text style={styles.statusText}>
                  {ticket.voided ? 'VOIDED' : ticket.paid ? 'PAID' : 'PENDING'}
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
                {!ticket.paid && !ticket.voided && (
                  <TouchableOpacity
                    style={[styles.payButton, updating === ticket.id && styles.payButtonLoading]}
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

              {/* View / Void actions */}
              <View style={styles.recordActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() =>
                    router.push({ pathname: '/pao/ticket-detail', params: { id: String(ticket.id) } })
                  }
                >
                  <Text style={styles.actionText}>View</Text>
                </TouchableOpacity>
                {!ticket.voided && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => voidTicket(ticket)}
                  >
                    <Text style={styles.actionText}>Void</Text>
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
  statusVoided: {
    backgroundColor: '#f44336',
  },
  recordActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  actionBtn: {
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  actionText: {
    color: '#2e7d32',
    fontSize: 12,
    fontWeight: '600',
  },
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
  dateContainer: {
    paddingHorizontal: 20,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff', // Changed for better contrast
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  dateText: {
    color: '#333', // Changed for better contrast
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
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
  commuterDetails: {
    marginLeft: 12,
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
  ticketDetails: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 16,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
