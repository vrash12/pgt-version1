// app/(tabs)/pao/ticket-detail.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { API_BASE_URL } from "../../config";


type TicketDetail = {
  id: number;
  referenceNo: string;
  commuter: string;
  date: string; // "April 30, 2025"
  time: string; // "7:20 am"
  fare: string;
  passengerType: 'regular' | 'discount';
  paid: boolean;
  busId: number;
  ticketUuid: string;
};

export default function TicketDetailScreen() {
  const { id, edit } = useLocalSearchParams<{ id: string; edit?: string }>();
  const ticketId = Number(id);
  const isEditMode = edit === 'true';
  const router = useRouter();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // --- Editable Form State ---
  const [formCommuter, setFormCommuter] = useState('');
  const [formPassengerType, setFormPassengerType] = useState<'regular' | 'discount'>('regular');
  const [formPaid, setFormPaid] = useState(false);

  // Fetch ticket data on load
  useEffect(() => {
    (async () => {
      if (!ticketId) return;
      setLoading(true);
      try {
        const tok = await AsyncStorage.getItem('@token');
        const res = await fetch(`${API_BASE_URL}/pao/tickets/${ticketId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        if (!res.ok) throw new Error('Failed to fetch ticket details.');

        const data: TicketDetail = await res.json();
        setTicket(data);

        // Seed the form state with fetched data
        setFormCommuter(data.commuter);
        setFormPassengerType(data.passengerType);
        setFormPaid(data.paid);
      } catch (e) {
        console.error(e);
        Alert.alert("Error", "Could not load ticket details.");
      } finally {
        setLoading(false);
      }
    })();
  }, [ticketId]);

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      
      const res = await fetch(`${API_BASE_URL}/pao/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          // Only send fields that are allowed to be edited
          commuter_name: formCommuter.trim(),
          passenger_type: formPassengerType,
          paid: formPaid,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save changes.');
      }

      // Navigate back after a successful save
      router.back();
    } catch (e: any) {
      console.error('Failed to save ticket:', e);
      Alert.alert("Save Failed", e.message);
    } finally {
      setSaving(false);
    }
  };

  const headerTitle = useMemo(() => (isEditMode ? 'Edit Ticket' : 'Ticket Details'), [isEditMode]);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container}>
         <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Error</Text>
          </View>
        <View style={styles.loaderContainer}>
          <Text>Ticket not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Reference Number Card */}
        <View style={styles.card}>
          <Text style={styles.refLabel}>Reference Number</Text>
          <Text style={styles.refValue}>#{ticket.referenceNo}</Text>
        </View>

        {/* Passenger Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Passenger Details</Text>
          <FormField icon="person-outline" label="Passenger Name">
            {isEditMode ? (
              <TextInput style={styles.input} value={formCommuter} onChangeText={setFormCommuter} />
            ) : (
              <Text style={styles.valueText}>{ticket.commuter}</Text>
            )}
          </FormField>
          <FormField icon="pricetag-outline" label="Passenger Type">
            {isEditMode ? (
              <View style={styles.toggleRow}>
                {(['regular', 'discount'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.toggleBtn, formPassengerType === t && styles.toggleSelected]}
                    onPress={() => setFormPassengerType(t)}
                  >
                    <Text style={[styles.toggleText, formPassengerType === t && styles.toggleTextSelected]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.valueText}>{ticket.passengerType}</Text>
            )}
          </FormField>
        </View>

        {/* Trip Details Card (READ-ONLY) */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Trip Details</Text>
          <FormField icon="calendar-outline" label="Date">
            <Text style={styles.valueText}>{ticket.date}</Text>
          </FormField>
          <FormField icon="time-outline" label="Time">
            <Text style={styles.valueText}>{ticket.time}</Text>
          </FormField>
        </View>

        {/* Payment Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Payment Details</Text>
          <FormField icon="cash-outline" label="Fare Amount">
             {/* Fare is now always read-only */}
            <Text style={styles.valueText}>₱{ticket.fare}</Text>
          </FormField>
          <FormField icon="card-outline" label="Payment Status">
            {isEditMode ? (
              <TouchableOpacity
                style={[styles.toggleBtn, styles.paidToggle, formPaid && styles.toggleSelected]}
                onPress={() => setFormPaid(!formPaid)}
              >
                <Text style={[styles.toggleText, formPaid && styles.toggleTextSelected]}>{formPaid ? 'Paid' : 'Pending'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.statusBadge, ticket.paid ? styles.statusPaid : styles.statusPending]}>
                <Text style={styles.statusText}>{ticket.paid ? 'PAID' : 'PENDING'}</Text>
              </View>
            )}
          </FormField>
        </View>

        {isEditMode && (
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Helper component to avoid repetition
const FormField = ({ icon, label, children }: { icon: keyof typeof Ionicons.glyphMap; label: string; children: React.ReactNode }) => (
  <View style={styles.fieldContainer}>
    <View style={styles.labelContainer}>
      <Ionicons name={icon} size={16} color="#666" />
      <Text style={styles.labelText}>{label}</Text>
    </View>
    <View style={styles.valueContainer}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf9' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8faf9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    backgroundColor: '#fff',
  },
  backButton: { padding: 8 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginRight: 40, // Balance the back button space
  },
  scrollContent: { padding: 20, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2e7d32',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  refLabel: { fontSize: 14, color: '#666', textAlign: 'center' },
  refValue: { fontSize: 22, fontWeight: 'bold', color: '#333', textAlign: 'center', marginTop: 4 },
  fieldContainer: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  valueContainer: {
    marginLeft: 24,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8faf9',
  },
  toggleRow: { flexDirection: 'row', gap: 12 },
  toggleBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 20,
  },
  paidToggle: {
    alignSelf: 'flex-start',
  },
  toggleSelected: { backgroundColor: '#e8f5e8', borderColor: '#2e7d32' },
  toggleText: { color: '#666', textTransform: 'capitalize' },
  toggleTextSelected: { color: '#2e7d32', fontWeight: '700' },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  statusPaid: { backgroundColor: '#4caf50' },
  statusPending: { backgroundColor: '#ff9800' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  saveBtn: {
    backgroundColor: '#2e7d32',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
