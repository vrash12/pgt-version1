//app/(tabs)/manager/view-schedules.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

/* --------------------------- constants / types ------------------------ */
const BACKEND = 'http://192.168.1.7:5000';

type Bus = {
  id: number;
  identifier: string;
  capacity?: number;
  description?: string | null;
};

type StopRec = {
  id: number;
  stop_name: string;
  arrive_time: string;
  depart_time: string;
};

const termini = [
  { label: 'WalterMart Paniqui', value: 'Paniqui (Walter Mart)' },
  { label: 'SM Tarlac City',     value: 'SM Tarlac City (Siesta)' },
];

/* ====================================================================== */
export default function ViewSchedules() {
  const router = useRouter();

  /* ----------- remote data ----------- */
  const [buses, setBuses]     = useState<Bus[]>([]);
  const [loadingBuses, setLB] = useState(true);

  /* ----------- local UI state ----------- */
  const [tab, setTab] = useState<'route' | 'fixed'>('route');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);

  const [selectedBusId, setSelectedBusId] = useState<number>();
  const [newTripId, setNewTripId]         = useState<number>();

  const [fromStop, setFromStop] = useState<string>();
  const [toStop,   setToStop]   = useState<string>();

  const [depart, setDepart] = useState<Date>();
  const [arrive, setArrive] = useState<Date>();

  /* stops list */
  const [stopsList, setStopsList]           = useState<StopRec[]>([]);

  /* picker flags */
  const [showDepartPicker, setShowDepartPicker]       = useState(false);
  const [showArrivePicker, setShowArrivePicker]       = useState(false);
  const [showStopStartPicker, setShowStopStartPicker] = useState(false);
  const [showStopDepartPicker, setShowStopDepartPicker] = useState(false);

  /* stop entry fields */
  const [stopLoc, setStopLoc]       = useState('');
  const [stopStart, setStopStart]   = useState<Date>();
  const [stopDepart, setStopDepart] = useState<Date>();

  /* ----------- helpers ----------- */
  const fmtTime = (d?: Date) =>
    d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const toHHMM = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

  /* ---------------- load buses once ---------------- */
  useEffect(() => {
    (async () => {
      try {
        const tok = await AsyncStorage.getItem('@token');
        const res = await fetch(`${BACKEND}/manager/buses`, {
          headers: { Authorization: `Bearer ${tok}` },
        });
        const json = await res.json();
        if (Array.isArray(json)) setBuses(json);
      } catch (e) {
        console.error('Failed to load buses', e);
      } finally {
        setLB(false);
      }
    })();
  }, []);
  // inside your component, below the existing useState calls:
useEffect(() => {
  switch (fromStop) {
    case 'Paniqui (Walter Mart)':
      setStopsList([{ id: 1, stop_name: 'WalterMart Paniqui', arrive_time: '', depart_time: '' }]);
      break;
    case 'SM Tarlac City (Siesta)':
      setStopsList([{ id: 1, stop_name: 'Petron Tarlac City', arrive_time: '', depart_time: '' }]);
      break;
    default:
      setStopsList([]);
  }
}, [fromStop]);


  /* ---------------- add route ---------------- */
  const handleAddRoute = async () => {
    if (!selectedBusId || !fromStop || !toStop || !depart || !arrive) {
      Alert.alert('Please fill in bus, origin, destination, and both times.');
      return;
    }
    try {
      const tok = await AsyncStorage.getItem('@token');
      const payload = {
        service_date: scheduleDate.toISOString().slice(0, 10),  // YYYY-MM-DD
        bus_id:       selectedBusId,
        number:       `${fromStop}-${toStop}`,
        start_time:   toHHMM(depart),
        end_time:     toHHMM(arrive),
      };
      const res = await fetch(`${BACKEND}/manager/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:   `Bearer ${tok}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      setNewTripId(json.id);
      Alert.alert('Route added!', `Trip ID: ${json.id}`);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error adding route', err.message);
    }
  };

  /* ---------------- add stop ---------------- */
  const handleAddStop = async () => {
    if (!newTripId) {
      Alert.alert('Please create a route first.');
      return;
    }
    if (!stopLoc || !stopStart || !stopDepart) {
      Alert.alert('Please fill in stop name and both times.');
      return;
    }
    try {
      const tok = await AsyncStorage.getItem('@token');
      const payload = {
        trip_id:     newTripId,
        stop_name:   stopLoc,
        arrive_time: toHHMM(stopStart),
        depart_time: toHHMM(stopDepart),
      };
      const res = await fetch(`${BACKEND}/manager/stop-times`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization:   `Bearer ${tok}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown error');
      Alert.alert('Stop added!', `StopTime ID: ${json.id}`);
      setStopLoc('');
      setStopStart(undefined);
      setStopDepart(undefined);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error adding stop', err.message);
    }
  };

  /* ============================ UI ============================ */
  return (
    <View style={styles.container}>
      {/* ─── gradient header ─── */}
      <View style={styles.headerGradient}>
        <View style={styles.headerRow}>
        
          <Text style={styles.headerTitle}>Schedule Manager</Text>
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: './route-timeline',
                params: { tripId: newTripId },
              })
            }
            style={styles.headerAction}
          >
            <Ionicons name="list" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* ─── date selector ─── */}
        <TouchableOpacity
  style={styles.dateRow}
  onPress={() => setShowScheduleDatePicker(true)}
>
          <View style={styles.dateIcon}>
            <Ionicons name="calendar" size={20} color="#2d5a2d" />
          </View>
          <Text style={styles.dateTxt}>
            {scheduleDate.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
          <Ionicons name="chevron-down" size={18} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* ─── tabs ─── */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabsWrap}>
          {(['route', 'fixed'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Ionicons 
                name={t === 'route' ? 'map' : 'time'} 
                size={18} 
                color={tab === t ? '#2d5a2d' : '#8fbc8f'}
                style={{ marginRight: 6 }}
              />
              <Text style={tab === t ? styles.tabActiveTxt : styles.tabTxt}>
                {t === 'route' ? 'Set Route' : 'Fixed Schedule'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── form ─── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView 
          contentContainerStyle={{ paddingBottom: 32 }} 
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {tab === 'route' ? (
            <>
              {/* BUS PICKER */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="bus" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>Assign Bus</Text>
                </View>
                {loadingBuses ? (
                  <View style={styles.loadingContainer}>
                    <Ionicons name="refresh" size={20} color="#8fbc8f" />
                    <Text style={styles.loadingText}>Loading buses…</Text>
                  </View>
                ) : (
                  <View style={styles.pickerContainer}>
                    <View style={styles.pickerWrap}>
                      <Picker
                        selectedValue={selectedBusId}
                        onValueChange={setSelectedBusId}
                        style={{ flex: 1, color: '#2d5a2d' }}
                      >
                        <Picker.Item label="— Select a bus —" value={undefined} />
                        {buses.map((b) => (
                          <Picker.Item
                            key={b.id}
                           label={b.identifier} 
                            value={b.id}
                          />
                        ))}
                      </Picker>
                      <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
                    </View>
                  </View>
                )}
              </View>

              {/* ROUTE CARD */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="navigate" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>Route Details</Text>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>From</Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={fromStop}
                      onValueChange={(v: string) => {
                        setFromStop(v);
                        const other = termini.find((t) => t.value !== v)?.value;
                        setToStop(other);
                      
                        // auto-populate Stop Location:
                        if (v === 'Paniqui (Walter Mart)' && other === 'SM Tarlac City (Siesta)') {
                          setStopLoc('Petron Tarlac City');
                        } else if (v === 'SM Tarlac City (Siesta)' && other === 'Paniqui (Walter Mart)') {
                          setStopLoc('WalterMart Paniqui');
                        } else {
                          setStopLoc('');
                        }
                      }}
                      
                      style={{ flex: 1, color: '#2d5a2d' }}
                    >
                      <Picker.Item label="— choose origin —" value={undefined} />
                      {termini.map((t) => (
                        <Picker.Item key={t.value} label={t.label} value={t.value} />
                      ))}
                    </Picker>
                    <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
                  </View>
                </View>

                <View style={styles.routeArrow}>
                  <Ionicons name="arrow-down" size={20} color="#8fbc8f" />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>To</Text>
                  <View style={styles.destinationInput}>
                    <TextInput
                      style={styles.fieldInput}
                      value={toStop}
                      editable={false}
                      placeholder="Destination will auto-select"
                      placeholderTextColor="#a8d5a8"
                    />
                    <Ionicons name="location" size={18} color="#8fbc8f" />
                  </View>
                </View>

                <View style={styles.timeContainer}>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Departure</Text>
                    <TouchableOpacity 
                      style={styles.timeButton}
                      onPress={() => setShowDepartPicker(true)}
                    >
                      <Ionicons name="time" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(depart)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Arrival</Text>
                    <TouchableOpacity 
                      style={styles.timeButton}
                      onPress={() => setShowArrivePicker(true)}
                    >
                      <Ionicons name="time" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(arrive)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.actionBtn} onPress={handleAddRoute}>
                  <Ionicons name="add-circle" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionTxt}>Add Route</Text>
                </TouchableOpacity>
              </View>

              {/* STOP CARD */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="location" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>Add Stop</Text>
                </View>
                
                <View style={styles.inputGroup}>
  <Text style={styles.fieldLabel}>Location</Text>
  <View style={styles.pickerWrap}>
    <Picker
      selectedValue={stopLoc}
      onValueChange={setStopLoc}
      style={{ flex: 1, color: '#2d5a2d' }}
    >
      <Picker.Item label="— select stop —" value={undefined} />
      {stopsList.map(s => (
        <Picker.Item key={s.id} label={s.stop_name} value={s.stop_name} />
      ))}
    </Picker>
    <Ionicons name="pin" size={18} color="#8fbc8f" />
  </View>
</View>

                <View style={styles.timeContainer}>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Arrival</Text>
                    <TouchableOpacity 
                      style={styles.timeButton}
                      onPress={() => setShowStopStartPicker(true)}
                    >
                      <Ionicons name="enter" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(stopStart)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Departure</Text>
                    <TouchableOpacity 
                      style={styles.timeButton}
                      onPress={() => setShowStopDepartPicker(true)}
                    >
                      <Ionicons name="exit" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(stopDepart)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleAddStop}>
                  <Ionicons name="add" size={20} color="#2d5a2d" style={{ marginRight: 8 }} />
                  <Text style={styles.secondaryTxt}>Add Stop</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color="#c8e6c9" />
              <Text style={styles.emptyTitle}>Fixed Schedules</Text>
              <Text style={styles.emptyText}>Schedule management will appear here</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── pickers ─── */}
      {showDepartPicker && (
        <DateTimePicker
          value={depart || new Date()}
          mode="time"
          display="spinner"
          onChange={(_, d) => {
            setShowDepartPicker(false);
            if (d) setDepart(d);
          }}
        />
      )}
      {showArrivePicker && (
        <DateTimePicker
          value={arrive || new Date()}
          mode="time"
          display="spinner"
          onChange={(_, d) => {
            setShowArrivePicker(false);
            if (d) setArrive(d);
          }}
        />
      )}
      {showStopStartPicker && (
        <DateTimePicker
          value={stopStart || new Date()}
          mode="time"
          display="spinner"
          onChange={(_, d) => {
            setShowStopStartPicker(false);
            if (d) setStopStart(d);
          }}
        />
      )}
      {showStopDepartPicker && (
        <DateTimePicker
          value={stopDepart || new Date()}
          mode="time"
          display="spinner"
          onChange={(_, d) => {
            setShowStopDepartPicker(false);
            if (d) setStopDepart(d);
          }}
        />
      )}
      {showScheduleDatePicker && (
        <DateTimePicker
          value={scheduleDate}
          mode="date"
          display="calendar"
          onChange={(_, d) => {
            setShowScheduleDatePicker(false);
            if (d) setScheduleDate(d);
          }}
        />
      )}
    </View>
  );
}

/* ------------------------------ styles ------------------------------ */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#f0f8f0' 
  },

  // Header styles
  headerGradient: {
    backgroundColor: '#2d5a2d',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  headerAction: { 
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // Date selector
  dateRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
  },
  dateIcon: {
    backgroundColor: '#ffffff',
    padding: 6,
    borderRadius: 12,
    marginRight: 12,
  },
  dateTxt: { 
    flex: 1,
    color: '#ffffff', 
    fontSize: 16, 
    fontWeight: '600',
    textAlign: 'center',
  },

  // Tabs
  tabsContainer: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  tabsWrap: {
    flexDirection: 'row',
    backgroundColor: '#e8f5e8',
    borderRadius: 25,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    borderRadius: 20,
  },
  tabActive: { 
    backgroundColor: '#ffffff',
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabTxt: { 
    fontSize: 14, 
    color: '#8fbc8f',
    fontWeight: '500',
  },
  tabActiveTxt: { 
    fontSize: 14, 
    color: '#2d5a2d', 
    fontWeight: '700',
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d5a2d',
    marginLeft: 10,
  },

  // Loading state
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    color: '#8fbc8f',
    marginLeft: 8,
    fontSize: 16,
  },

  // Input groups
  inputGroup: {
    marginBottom: 16,
  },
  fieldLabel: { 
    fontSize: 14, 
    color: '#2d5a2d', 
    marginBottom: 8,
    fontWeight: '600',
  },
  fieldInput: {
    flex: 1,
    fontSize: 16,
    color: '#2d5a2d',
    paddingVertical: 12,
    fontWeight: '500',
  },
  
  // Picker styles
  pickerContainer: {
    marginTop: 8,
  },
  pickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 15,
    paddingHorizontal: 12,
    backgroundColor: '#f8fdf8',
    minHeight: 50,
  },
  
  // Destination input
  destinationInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 15,
    paddingHorizontal: 16,
    backgroundColor: '#f8fdf8',
    minHeight: 50,
  },

  // Route arrow
  routeArrow: {
    alignItems: 'center',
    marginVertical: 8,
  },

  // Stop input
  stopInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e8f5e8',
    borderRadius: 15,
    paddingHorizontal: 16,
    backgroundColor: '#f8fdf8',
    minHeight: 50,
  },

  // Time styles
  timeContainer: { 
    flexDirection: 'row', 
    marginTop: 16,
    gap: 12,
  },
  timeCard: {
    flex: 1,
    backgroundColor: '#f8fdf8',
    borderRadius: 15,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  timeLabel: { 
    fontSize: 12, 
    color: '#2d5a2d', 
    marginBottom: 8,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  timeText: {
    fontSize: 18,
    color: '#2d5a2d',
    fontWeight: '700',
    marginLeft: 8,
  },

  // Action buttons
  actionBtn: {
    backgroundColor: '#2d5a2d',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  actionTxt: { 
    color: '#ffffff', 
    fontWeight: '700', 
    fontSize: 16,
    letterSpacing: 0.5,
  },
  
  secondaryBtn: {
    backgroundColor: '#e8f5e8',
    borderRadius: 15,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
    borderWidth: 2,
    borderColor: '#c8e6c9',
  },
  secondaryTxt: { 
    color: '#2d5a2d', 
    fontWeight: '700', 
    fontSize: 16,
    letterSpacing: 0.5,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2d5a2d',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#8fbc8f',
    textAlign: 'center',
    lineHeight: 24,
  },

  /* modal styles remain the same but with green theme */
  modalWrap: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(45,90,45,0.4)',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '70%',
  },

  tripHeader: {
    paddingVertical: 12,
    marginBottom: 16,
    backgroundColor: '#e8f5e8',
    borderRadius: 15,
    alignItems: 'center',
  },
  tripHeaderTxt: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#2d5a2d' 
  },

  stopRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-start', 
    marginLeft: 8,
    paddingVertical: 8,
  },
  stopIdx: { 
    width: 24, 
    textAlign: 'right', 
    marginRight: 12, 
    fontWeight: '700',
    color: '#2d5a2d',
  },
  stopName: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#2d5a2d' 
  },
  stopTimes: { 
    fontSize: 14, 
    color: '#8fbc8f',
    marginTop: 2,
  },
});