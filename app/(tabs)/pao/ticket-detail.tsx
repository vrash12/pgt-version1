// ticket-detail.tsx (updated)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const BACKEND = 'http://192.168.1.7:5000';

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
  const isEdit = edit === 'true';
  const router = useRouter();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editable local states
  const [commuterName, setCommuterName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [fare, setFare] = useState('');
  const [passengerType, setPassengerType] = useState<'regular' | 'discount'>('regular');
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const tok = await AsyncStorage.getItem('@token');
        const res = await fetch(`${BACKEND}/pao/tickets/${ticketId}`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const data: TicketDetail = await res.json();
        setTicket(data);

        // seed form
        setCommuterName(data.commuter);
        setDate(data.date);
        setTime(data.time);
        setFare(data.fare);
        setPassengerType(data.passengerType);
        setPaid(data.paid);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    if (!ticket) return;
    setSaving(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      await fetch(`${BACKEND}/pao/tickets/${ticketId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
        },
        body: JSON.stringify({
          commuter_name: commuterName.trim(),
          created_at: `${date} ${time}`.trim(), // backend should parse
          fare: parseFloat(fare) || 0,
          passenger_type: passengerType,
          paid,
        }),
      });
      router.back();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !ticket) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#2e7d32" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Reference</Text>
      <Text style={styles.value}>#{ticket.referenceNo}</Text>

      <Text style={styles.section}>Passenger</Text>
      {isEdit ? (
        <TextInput style={styles.input} value={commuterName} onChangeText={setCommuterName} />
      ) : (
        <Text style={styles.value}>{ticket.commuter}</Text>
      )}

      <Text style={styles.section}>Date</Text>
      {isEdit ? (
        <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="April 30, 2025" />
      ) : (
        <Text style={styles.value}>{ticket.date}</Text>
      )}

      <Text style={styles.section}>Time</Text>
      {isEdit ? (
        <TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="7:20 am" />
      ) : (
        <Text style={styles.value}>{ticket.time}</Text>
      )}

      <Text style={styles.section}>Fare (₱)</Text>
      {isEdit ? (
        <TextInput style={styles.input} keyboardType="numeric" value={fare} onChangeText={setFare} />
      ) : (
        <Text style={styles.value}>₱{ticket.fare}</Text>
      )}

      <Text style={styles.section}>Passenger Type</Text>
      {isEdit ? (
        <View style={styles.toggleRow}>
          {(['regular', 'discount'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.toggleBtn, passengerType === t && styles.toggleSelected]}
              onPress={() => setPassengerType(t)}
            >
              <Text style={[styles.toggleText, passengerType === t && styles.toggleTextSelected]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text style={styles.value}>{ticket.passengerType}</Text>
      )}

      <Text style={styles.section}>Paid?</Text>
      {isEdit ? (
        <TouchableOpacity
          style={[styles.payToggle, paid ? styles.payYes : styles.payNo]}
          onPress={() => setPaid(!paid)}
        >
          <Text style={styles.payText}>{paid ? 'Yes' : 'No'}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.value}>{ticket.paid ? 'Yes' : 'No'}</Text>
      )}

      {isEdit && (
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save Changes</Text>}
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const baseText = { fontSize: 16, color: '#333' };
const styles = StyleSheet.create({
  container: { padding: 20 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 12, color: '#666' },
  section: { fontSize: 12, color: '#666', marginTop: 18 },
  value: { ...baseText, fontWeight: '600' },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    ...baseText,
  },
  toggleRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  toggleBtn: { padding: 8, borderWidth: 1, borderColor: '#ccc', borderRadius: 6 },
  toggleSelected: { backgroundColor: '#e8f5e8', borderColor: '#2e7d32' },
  toggleText: { color: '#666' },
  toggleTextSelected: { color: '#2e7d32', fontWeight: '600' },
  payToggle: { marginTop: 8, padding: 10, borderRadius: 6, alignItems: 'center' },
  payYes: { backgroundColor: '#4caf50' },
  payNo: { backgroundColor: '#ff9800' },
  payText: { color: '#fff', fontWeight: '600' },
  saveBtn: { marginTop: 30, backgroundColor: '#2e7d32', padding: 14, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
