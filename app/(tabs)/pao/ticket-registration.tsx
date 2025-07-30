//app/(tabs)/pao/ticket-registration.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const { width } = Dimensions.get('window');

/* ─── constants ─── */
const BACKEND = 'http://192.168.1.7:5000';

/* ─── types ─── */
type Stop = { id: number; name: string };
type Commuter = { id: number; name: string };

type TicketResp = {
  id: number;
  referenceNo: string;
  qr_url: string;
  origin: string;
  destination: string;
  passengerType: 'regular' | 'discount';
  fare: string;
  paid: boolean;
};

export default function TicketRegistration() {
  const router = useRouter();

  /* ── form state ── */
  const [stops, setStops] = useState<Stop[]>([]);
  const [commuters, setCommuters] = useState<Commuter[]>([]);
const [busCode, setBusCode] = useState<string|null>(null);
const [busId,   setBusId]   = useState<string|null>(null);
  const [loadingStops, setLoadingStops] = useState(true);

  const [originId, setOriginId] = useState<number>();
  const [destId, setDestId] = useState<number>();
  const [passengerType, setPassengerType] = useState<'regular'|'discount'>('regular');
  const [commuterId, setCommuterId] = useState<number>();

  /* ── ticket result ── */
  const [ticket, setTicket] = useState<TicketResp|null>(null);
  const [calculating, setCalculating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);

  /* ─── load stops & commuters ─── */
  useEffect(() => {
    (async () => {
          const savedBusId   = await AsyncStorage.getItem('@assignedBusId');
    const savedBusCode = await AsyncStorage.getItem('@assignedBusCode');
    setBusId(savedBusId);
    setBusCode(savedBusCode);
      try {
        const tok = await AsyncStorage.getItem('@token');
        const headers: Record<string,string> = {};
        if (tok) headers.Authorization = `Bearer ${tok}`;

        const [sRes, cRes] = await Promise.all([
          fetch(`${BACKEND}/pao/stops`, { headers }),
          fetch(`${BACKEND}/pao/commuters`, { headers }),
          
        ]);
        if (!sRes.ok) throw new Error(`Stops fetch failed ${sRes.status}`);
        if (!cRes.ok) throw new Error(`Commuters fetch failed ${cRes.status}`);

        const sJson = await sRes.json();
        setStops(Array.isArray(sJson) ? sJson : []);

        const cJson = await cRes.json();
        setCommuters(Array.isArray(cJson) ? cJson : []);

      } catch (e) {
        console.error('Error loading lists:', e);
      } finally {
        setLoadingStops(false);
      }
    })();
  }, []);

  /* ─── calculate fare / issue ticket ─── */
  const handleCalculate = async () => {
    if (!originId||!destId||commuterId===undefined) return;
    setCalculating(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      const headers: Record<string,string> = { 'Content-Type':'application/json' };
      if (tok) headers.Authorization = `Bearer ${tok}`;
      const nowLocal = dayjs().format('YYYY-MM-DDTHH:mm:ss');
      const resp = await fetch(`${BACKEND}/pao/tickets`, {
        method : 'POST',
  headers: { 'Content-Type':'application/json', ...(tok?{Authorization:`Bearer ${tok}`}:{}) },
  body   : JSON.stringify({
    bus_id: Number(busId),

    origin_stop_time_id     : originId,
    destination_stop_time_id: destId,
    passenger_type          : passengerType,
    commuter_id             : commuterId,

    /* NEW — let the server know the exact minute the PAO sold the ticket */
    created_at: nowLocal
  })
});
 if (!resp.ok) {
   const text = await resp.text();
   console.error('Server error body:', text);
   throw new Error(`Ticket create failed ${resp.status}`);
 }
      const json: TicketResp = await resp.json();
      setTicket(json);
    } catch (e) {
      console.error('Calculate error:', e);
    } finally {
      setCalculating(false);
    }
  };

  /* ─── mark paid ─── */
  const markAsPaid = async () => {
    if (!ticket) return;
    setMarkingPaid(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      const headers: Record<string,string> = {
        'Content-Type':'application/json',
        ...(tok ? { Authorization:`Bearer ${tok}` } : {})
      };
      await fetch(`${BACKEND}/pao/tickets/${ticket.id}`, {
        method:'PATCH',
        headers,
        body: JSON.stringify({ paid:true }),
      });
      setTicket({ ...ticket, paid:true });
      
    } catch (e) {
      console.error('Mark paid error:', e);
    } finally {
      setMarkingPaid(false);
    }
  };

  const disabled = loadingStops
                || calculating
                || markingPaid
                || !busId
                || !originId
                || !destId
                || commuterId===undefined;

  const getProgressBarWidth = () => {
    let progress = 0;
    if (busId)               progress += 20;
    if (commuterId !== undefined) progress += 25;
    if (originId) progress += 25;
    if (destId) progress += 25;
    if (passengerType) progress += 25;
    return `${progress}%`;
  };

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {busCode && (
  <View style={styles.busBanner}>
    <Ionicons name="bus" size={18} color="#fff" style={{ marginRight: 6 }} />
    <Text style={styles.busBannerText}>{busCode}</Text>
  </View>
)}

        {/* ── Enhanced Header ── */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
          
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Electronic Ticketing</Text>
              <Text style={styles.headerSubtitle}>Quick & Easy Booking</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/pao/ticket-records')}
              style={styles.recordsBtn}
            >
              <Ionicons name='receipt-outline' size={18} color='#fff'/>
              <Text style={styles.recordsBtnText}>Records</Text>
            </TouchableOpacity>
          </View>
          
          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: getProgressBarWidth() }]} />
            </View>
            <Text style={styles.progressText}>Complete all fields to proceed</Text>
          </View>
        </View>

        {/* ── Enhanced Form ── */}
        <View style={styles.formContainer}>
          {loadingStops ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color='#2e7d32'/>
              <Text style={styles.loadingText}>Loading data...</Text>
            </View>
          ) : (
            <>
              {/* Commuter Selection */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name='person-outline' size={18} color='#2e7d32'/>
                  <Text style={styles.label}>Select Commuter</Text>
                </View>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={commuterId}
                    onValueChange={setCommuterId}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label='— Choose a commuter —' value={undefined} color='#999'/>
                    {commuters.map(c=>(
                      <Picker.Item key={c.id} label={c.name} value={c.id} color='#333'/>
                    ))}
                  </Picker>
                  <Ionicons name='chevron-down' size={20} color='#666' style={styles.pickerIcon}/>
                </View>
              </View>

              {/* Origin Selection */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name='location-outline' size={18} color='#2e7d32'/>
                  <Text style={styles.label}>Origin Stop</Text>
                </View>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={originId}
                    onValueChange={setOriginId}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label='— Select departure stop —' value={undefined} color='#999'/>
                    {stops.map(s=>(
                      <Picker.Item key={s.id} label={s.name} value={s.id} color='#333'/>
                    ))}
                  </Picker>
                  <Ionicons name='chevron-down' size={20} color='#666' style={styles.pickerIcon}/>
                </View>
              </View>

              {/* Route Arrow */}
              {originId && (
                <View style={styles.routeArrow}>
                  <Ionicons name='arrow-down' size={24} color='#2e7d32'/>
                </View>
              )}

              {/* Destination Selection */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name='flag-outline' size={18} color='#2e7d32'/>
                  <Text style={styles.label}>Destination Stop</Text>
                </View>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={destId}
                    onValueChange={setDestId}
                    style={styles.picker}
                    itemStyle={styles.pickerItem}
                  >
                    <Picker.Item label='— Select arrival stop —' value={undefined} color='#999'/>
                    {stops.map(s=>(
                      <Picker.Item key={s.id} label={s.name} value={s.id} color='#333'/>
                    ))}
                  </Picker>
                  <Ionicons name='chevron-down' size={20} color='#666' style={styles.pickerIcon}/>
                </View>
              </View>

              {/* Passenger Type */}
              <View style={styles.inputGroup}>
                <View style={styles.labelContainer}>
                  <Ionicons name='pricetag-outline' size={18} color='#2e7d32'/>
                  <Text style={styles.label}>Passenger Type</Text>
                </View>
                <View style={styles.radioContainer}>
                  {(['regular','discount'] as const).map(t=>(
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.radioOption,
                        passengerType === t && styles.radioOptionSelected
                      ]}
                      onPress={() => setPassengerType(t)}
                    >
                      <View style={styles.radioButton}>
                        <Ionicons
                          name={passengerType === t ? 'radio-button-on' : 'radio-button-off'}
                          size={20} 
                          color={passengerType === t ? '#2e7d32' : '#ccc'}
                        />
                      </View>
                      <View style={styles.radioContent}>
                        <Text style={[
                          styles.radioLabel,
                          passengerType === t && styles.radioLabelSelected
                        ]}>
                          {t === 'regular' ? 'Regular Fare' : 'Discount Fare'}
                        </Text>
                        <Text style={styles.radioDescription}>
                          {t === 'regular' ? 'Standard pricing' : 'Student/PWD/Senior citizen'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Calculate Button */}
              <TouchableOpacity
                style={[styles.calculateBtn, disabled && styles.calculateBtnDisabled]}
                onPress={handleCalculate}
                disabled={disabled}
              >
                {calculating ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator size="small" color='#fff' style={{ marginRight: 8 }}/>
                    <Text style={styles.calculateBtnText}>Calculating Fare...</Text>
                  </View>
                ) : (
                  <View style={styles.buttonContent}>
                    <Ionicons name='calculator-outline' size={20} color='#fff' style={{ marginRight: 8 }}/>
                    <Text style={styles.calculateBtnText}>Calculate Fare</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ── Enhanced Ticket Display ── */}
        {ticket && (
          <View style={styles.ticketSection}>
            <Text style={styles.ticketSectionTitle}>Your Ticket</Text>
            <View style={styles.ticketCard}>
              {/* QR Code Section */}
              <View style={styles.qrSection}>
                <View style={styles.qrContainer}>
                  <Image
                    source={{ uri: ticket.qr_url }}
                    style={styles.qrCode}
                    resizeMode='contain'
                  />
                </View>
                <Text style={styles.qrLabel}>Scan QR Code</Text>
              </View>

              {/* Ticket Details */}
              <View style={styles.ticketDetails}>
                <View style={styles.ticketHeader}>
            <Text style={styles.referenceNo}>
  #{ticket.referenceNo /* already BUS1-0001 from backend */}
</Text>
                  <View style={[
                    styles.statusBadge,
                    ticket.paid ? styles.statusPaid : styles.statusPending
                  ]}>
                    <Text style={[
                      styles.statusText,
                      ticket.paid ? styles.statusTextPaid : styles.statusTextPending
                    ]}>
                      {ticket.paid ? 'PAID' : 'PENDING'}
                    </Text>
                  </View>
                </View>

                <View style={styles.routeInfo}>
                  <View style={styles.routeItem}>
                    <Ionicons name='location' size={16} color='#2e7d32'/>
                    <View style={styles.routeText}>
                      <Text style={styles.routeLabel}>From</Text>
                      <Text style={styles.routeValue}>{ticket.origin}</Text>
                    </View>
                  </View>

                  <View style={styles.routeDivider}>
                    <View style={styles.routeLine}/>
                    <Ionicons name='arrow-forward' size={16} color='#666'/>
                    <View style={styles.routeLine}/>
                  </View>

                  <View style={styles.routeItem}>
                    <Ionicons name='flag' size={16} color='#2e7d32'/>
                    <View style={styles.routeText}>
                      <Text style={styles.routeLabel}>To</Text>
                      <Text style={styles.routeValue}>{ticket.destination}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.fareSection}>
                  <View style={styles.fareInfo}>
                    <Text style={styles.fareLabel}>
                      {ticket.passengerType === 'regular' ? 'Regular Fare' : 'Discount Fare'}
                    </Text>
                    <Text style={styles.fareAmount}>₱{ticket.fare}</Text>
                  </View>
                </View>

                {/* Payment Button */}
                <TouchableOpacity
                  style={[
                    styles.paymentBtn,
                    ticket.paid && styles.paymentBtnPaid
                  ]}
                  onPress={markAsPaid}
                  disabled={ticket.paid || markingPaid}
                >
                  {markingPaid ? (
                    <View style={styles.buttonContent}>
                      <ActivityIndicator size="small" color='#fff' style={{ marginRight: 8 }}/>
                      <Text style={styles.paymentBtnText}>Processing...</Text>
                    </View>
                  ) : ticket.paid ? (
                    <View style={styles.buttonContent}>
                      <Ionicons name='checkmark-circle' size={20} color='#fff' style={{ marginRight: 8 }}/>
                      <Text style={styles.paymentBtnText}>Payment Confirmed</Text>
                    </View>
                  ) : (
                    <View style={styles.buttonContent}>
                      <Ionicons name='card-outline' size={20} color='#fff' style={{ marginRight: 8 }}/>
                      <Text style={styles.paymentBtnText}>Mark as Paid</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
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
  scrollContent: {
    paddingBottom: 30,
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
  recordsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  busBanner: {
  flexDirection: 'row',
  alignSelf: 'center',
  marginTop: 12,
  paddingHorizontal: 16,
  paddingVertical: 6,
  backgroundColor: '#1a3d00',
  borderRadius: 20,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
  elevation: 4,
},
busBannerText: {
  color: '#fff',
  fontWeight: '700',
  letterSpacing: 0.5,
},

  recordsBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Progress Bar
  progressContainer: {
    paddingHorizontal: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
  },

  // Form Styles
  formContainer: {
    margin: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  inputGroup: {
    marginBottom: 24,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },

  // Picker Styles
  pickerContainer: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  picker: {
    height: 50,
  },
  pickerItem: {
    fontSize: 16,
  },
  pickerIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
    pointerEvents: 'none',
  },

  // Route Arrow
  routeArrow: {
    alignItems: 'center',
    marginVertical: -12,
    zIndex: 1,
  },

  // Radio Button Styles
  radioContainer: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  radioOptionSelected: {
    backgroundColor: '#e8f5e8',
    borderColor: '#2e7d32',
  },
  radioButton: {
    marginRight: 12,
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  radioLabelSelected: {
    color: '#2e7d32',
  },
  radioDescription: {
    fontSize: 13,
    color: '#666',
  },

  // Button Styles
  calculateBtn: {
    backgroundColor: '#2e7d32',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#2e7d32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  calculateBtnDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  calculateBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Ticket Styles
  ticketSection: {
    margin: 20,
    marginTop: 0,
  },
  ticketSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  ticketCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },

  // QR Section
  qrSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8faf9',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrCode: {
    width: 120,
    height: 120,
  },
  qrLabel: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  // Ticket Details
  ticketDetails: {
    padding: 24,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  referenceNo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusPaid: {
    backgroundColor: '#d4edda',
  },
  statusPending: {
    backgroundColor: '#fff3cd',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextPaid: {
    color: '#155724',
  },
  statusTextPending: {
    color: '#856404',
  },

  // Route Info
  routeInfo: {
    marginBottom: 20,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  routeText: {
    marginLeft: 12,
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  routeDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingLeft: 24,
  },
  routeLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },

  // Fare Section
  fareSection: {
    backgroundColor: '#f8faf9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  fareInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fareLabel: {
    fontSize: 14,
    color: '#666',
  },
  fareAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2e7d32',
  },

  // Payment Button
  paymentBtn: {
    backgroundColor: '#ff9800',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#ff9800',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  paymentBtnPaid: {
    backgroundColor: '#4caf50',
    shadowColor: '#4caf50',
  },
  paymentBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});