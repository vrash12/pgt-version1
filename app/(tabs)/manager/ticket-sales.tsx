// app/(tabs)/manager/ticket-sales.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

/* adjust to your LAN or prod URL */
const BACKEND = 'http://192.168.1.7:5000';

interface Segment  { id: number; label: string; price: string }
interface Ticket   { id: number; uuid: string; price: string; created_at: string; segment_label: string }

export default function TicketSales() {
  const router = useRouter();

  const [segments,      setSegments]      = useState<Segment[]>([]);
  const [selectedSeg,   setSelectedSeg]   = useState<number|undefined>(undefined);
  const [tickets,       setTickets]       = useState<Ticket[]>([]);
  const [loadingSeg,    setLoadingSeg]    = useState(true);
  const [loadingTickets,setLoadingTickets]= useState(true);
  const [purchasing,    setPurchasing]    = useState(false);

  /* fetch fare‐segments for purchase */
  const loadSegments = async () => {
    setLoadingSeg(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      const r   = await fetch(`${BACKEND}/manager/fare-segments`, {
        headers: { Authorization: `Bearer ${tok}` }
      });
      setSegments(await r.json());
    } catch(e){ console.error(e) }
    finally { setLoadingSeg(false) }
  };

  /* fetch commuter's tickets */
  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      const r   = await fetch(`${BACKEND}/ticket-sales`, {
        headers: { Authorization: `Bearer ${tok}` }
      });
      setTickets(await r.json());
    } catch(e){ console.error(e) }
    finally { setLoadingTickets(false) }
  };

  useEffect(() => {
    loadSegments();
    loadTickets();
  }, []);

  /* purchase flow */
  const handlePurchase = async () => {
    if (!selectedSeg) return;

    setPurchasing(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      const r   = await fetch(`${BACKEND}/ticket-sales`, {
        method:  'POST',
        headers: {
          Authorization: `Bearer ${tok}`,
          'Content-Type':'application/json'
        },
        body: JSON.stringify({ fare_segment_id: selectedSeg })
      });

      if (!r.ok) {
        const err = await r.json();
        Alert.alert('Error', err.error || 'Purchase failed');
      } else {
        Alert.alert('Success', 'Ticket purchased');
        setSelectedSeg(undefined);
        loadTickets();
      }
    } catch(e) {
      console.error(e);
      Alert.alert('Error', 'Purchase failed');
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <View style={st.container}>

      {/* ── Header ── */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#264d00" />
        </TouchableOpacity>
        <Text style={st.headerTxt}>Ticket Sales</Text>
      </View>

      {/* ── Purchase Card ── */}
      <View style={st.card}>
        {loadingSeg
          ? <ActivityIndicator size="small" color="#264d00" />
          : (
            <Picker
              selectedValue={selectedSeg}
              onValueChange={setSelectedSeg}
              style={st.picker}
            >
              <Picker.Item label="— choose fare segment —" value={undefined} />
              {segments.map(seg => (
                <Picker.Item
                  key={seg.id}
                  label={`${seg.label}   ₱${seg.price}`}
                  value={seg.id}
                />
              ))}
            </Picker>
          )
        }

        <TouchableOpacity
          style={[ st.btn, (!selectedSeg || purchasing) && st.btnDisabled ]}
          disabled={!selectedSeg || purchasing}
          onPress={handlePurchase}
        >
          <Text style={st.btnTxt}>
            {purchasing ? 'Purchasing…' : 'Purchase Ticket'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Ticket History ── */}
      <Text style={st.sectionTitle}>Your Tickets</Text>
      {loadingTickets
        ? <ActivityIndicator size="large" color="#264d00" style={{flex:1}} />
        : (
          <FlatList
            data={tickets}
            keyExtractor={t => t.id.toString()}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({item}) => (
              <View style={st.ticketItem}>
                <Text style={st.ticketLabel}>{item.segment_label}</Text>
                <Text style={st.ticketInfo}>₱{item.price}</Text>
                <Text style={st.ticketInfo}>
                  {new Date(item.created_at).toLocaleString()}
                </Text>
                <Text style={st.ticketUuid}>UUID: {item.uuid}</Text>
              </View>
            )}
          />
        )
      }

    </View>
  );
}

const st = StyleSheet.create({
  container:      { flex:1, backgroundColor:'#fff' },
  header:         { flexDirection:'row', alignItems:'center', padding:12 },
  headerTxt:      { flex:1, textAlign:'center', fontSize:18, fontWeight:'600' },

  card:           { margin:16, padding:16, borderRadius:12, backgroundColor:'#eef0ee' },
  picker:         { backgroundColor:'#fff', borderRadius:8, marginBottom:12 },
  btn:            { backgroundColor:'#264d00', borderRadius:8, padding:12, alignItems:'center' },
  btnDisabled:    { opacity:0.5 },
  btnTxt:         { color:'#fff', fontWeight:'600' },

  sectionTitle:   { fontSize:16,fontWeight:'600', paddingLeft:16, color:'#333', marginTop:8 },
  ticketItem:     { backgroundColor:'#f9f9f9', padding:12, marginBottom:8, marginHorizontal:16, borderRadius:8 },
  ticketLabel:    { fontSize:14, fontWeight:'600', marginBottom:4 },
  ticketInfo:     { fontSize:12, color:'#555' },
  ticketUuid:     { fontSize:10, color:'#999', marginTop:4 },
});
