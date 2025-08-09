// app/(tabs)/manager/view-schedules.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  seq?: number; // 👈 add this
};

import { API_BASE_URL } from "../../config";

const termini = [
  { label: 'WalterMart Paniqui', value: 'Paniqui (Walter Mart)' },
  { label: 'SM Tarlac City',     value: 'SM Tarlac City (Siesta)' },
];

type TimelineItem = {
  id: number;
  number: string;
  start_time: string;
  end_time: string;
  from_stop?: string;
  to_stop?: string;
  // <-- change here:
  stops?: StopRec[];
};


/* ====================================================================== */
export default function ViewSchedules() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* ----------- remote data ----------- */
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loadingBuses, setLB] = useState(true);

  /* ----------- local UI state ----------- */
  const [tab, setTab] = useState<'route' | 'schedule'>('route');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
  
  const [showTripDetails, setShowTripDetails] = useState(false);
  const [detailsTrip, setDetailsTrip] = useState<TimelineItem | null>(null);
  const [selectedBusId, setSelectedBusId] = useState<number>();
  const [newTripId, setNewTripId] = useState<number>();
  const [fromStop, setFromStop] = useState<string>();
  const [toStop, setToStop] = useState<string>();
  const [depart, setDepart] = useState<Date>();
  const [arrive, setArrive] = useState<Date>();
  const [stopsList, setStopsList] = useState<StopRec[]>([]);
  const [showDepartPicker, setShowDepartPicker] = useState(false);
  const [showArrivePicker, setShowArrivePicker] = useState(false);
  const [showStopStartPicker, setShowStopStartPicker] = useState(false);
  const [showStopDepartPicker, setShowStopDepartPicker] = useState(false);
  const [stopLoc, setStopLoc] = useState('');
  const [stopStart, setStopStart] = useState<Date>();
  const [stopDepart, setStopDepart] = useState<Date>();

  /* schedule-tab state */
  const [schedBusId, setSchedBusId] = useState<number>();
  const [schedDate, setSchedDate] = useState<Date>(new Date());
  const [events, setEvents] = useState<TimelineItem[]>([]);
  const [schedLoading, setSchedLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [isModalVisible, setIsModalVisible] = useState(false);
const [currentTrip, setCurrentTrip] = useState<TimelineItem | null>(null);
const [updatedStartTime, setUpdatedStartTime] = useState('');
const [updatedEndTime, setUpdatedEndTime] = useState('');
// state to control expand/collapse per trip
const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});

const TERM_A = 'waltermart paniqui';
const TERM_B = 'sm tarlac city';



const normName = (s = '') =>
  s.trim().toLowerCase().replace(/\s+/g, ' ');

const getDirectionEndpoints = (stops?: StopRec[]) => {
  if (!stops || stops.length === 0) return { origin: '—', destination: '—' };

  const ordered = [...stops].sort((a, b) => (a.seq ?? 9999) - (b.seq ?? 9999));
  const names = ordered.map(s => normName(s.stop_name));

  const iA = names.findIndex(n => n.includes(TERM_A));
  const iB = names.findIndex(n => n.includes(TERM_B));

  if (iA !== -1 && iB !== -1 && iA !== iB) {
    const origin = iA < iB ? ordered[iA].stop_name : ordered[iB].stop_name;
    const destination = iA < iB ? ordered[iB].stop_name : ordered[iA].stop_name;
    return { origin, destination };
  }

  // Fallback: take last stop before returning to the very first stop
  const first = ordered[0].stop_name;
  const returnIdx = ordered.findIndex((s, i) => i > 0 && s.stop_name === first);
  const span = returnIdx === -1 ? ordered : ordered.slice(0, returnIdx);
  const lastDifferent = [...span].reverse().find(s => s.stop_name !== first);
  const destination = lastDifferent ? lastDifferent.stop_name : (span[span.length - 1]?.stop_name ?? first);
  return { origin: first, destination };
};

const toMinutes = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};
const durationStr = (start: string, end: string) => {
  let d = (toMinutes(end) - toMinutes(start) + 24 * 60) % (24 * 60);
  const h = Math.floor(d / 60);
  const m = d % 60;
  return [h ? `${h}h` : '', `${m}m`].filter(Boolean).join(' ');
};

const getForwardEndpoints = (stops?: StopRec[]) => {
  if (!stops || stops.length === 0) return { origin: '—', destination: '—' };

  const ordered = [...stops].sort((a, b) => (a.seq ?? 9999) - (b.seq ?? 9999));
  const origin = ordered[0].stop_name;

  // find the first index where we return to origin (after start)
  const returnIdx = ordered.findIndex((s, i) => i > 0 && s.stop_name === origin);
  const span = returnIdx === -1 ? ordered : ordered.slice(0, returnIdx);

  // destination = last stop before returning to origin that's different from origin
  const lastDifferent = [...span].reverse().find(s => s.stop_name !== origin);
  const destination = lastDifferent ? lastDifferent.stop_name : (span[span.length - 1]?.stop_name ?? origin);

  return { origin, destination };
};


const openModalForUpdate = (trip: TimelineItem) => {
  setCurrentTrip(trip);
  setUpdatedStartTime(trip.start_time);
  setUpdatedEndTime(trip.end_time);
  setIsModalVisible(true);
};

// Dedupe stops by normalized (name, arrive, depart)
const uniqStops = (stops: StopRec[]) => {
  const norm = (s = '') => s.trim().replace(/\s+/g, ' ').toLowerCase();
  const keyOf = (s: StopRec) =>
    `${norm(s.stop_name)}|${(s.arrive_time || '').slice(0,5)}|${(s.depart_time || '').slice(0,5)}`;

  const seen = new Set<string>();
  const out: StopRec[] = [];
  for (const s of stops) {
    const k = keyOf(s);
    if (!seen.has(k)) {
      seen.add(k);
      out.push({
        ...s,
        // ensure we only carry HH:MM to the UI too
        arrive_time: (s.arrive_time || '').slice(0,5),
        depart_time: (s.depart_time || '').slice(0,5),
      });
    }
  }
  return out;
};


// Friendly display: collapse identical arrive/depart
const fmtStopWindow = (arr: string, dep: string) => {
  if (!arr && !dep) return '';
  if (arr === dep || !dep) return formatTime12Hour(arr);
  if (!arr) return formatTime12Hour(dep);
  return `${formatTime12Hour(arr)} – ${formatTime12Hour(dep)}`;
};


  /* ----------- helpers ----------- */
  const fmtTime = (d?: Date) =>
    d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';

  const toHHMM = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

  const formatTime12Hour = (time24: string) => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  /* fetch list of buses */
  const loadBuses = async () => {
    setLB(true);
    try {
      const tok = await AsyncStorage.getItem('@token');
      const res = await fetch(`${API_BASE_URL}/manager/buses`, {
        headers: { Authorization: `Bearer ${tok}` },
      });
      const json = await res.json();
      if (Array.isArray(json)) setBuses(json);
    } catch (e) {
      console.error('❌ loadBuses Error:', e);
      Alert.alert('Failed to load buses');
    } finally {
      setLB(false);
    }
  };

  const handleUpdateTrip = async () => {
    if (!currentTrip) return;
    try {
      const token = await AsyncStorage.getItem('@token');
      const response = await fetch(`${API_BASE_URL}/manager/trips/${currentTrip.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          number: currentTrip.number,
          start_time: updatedStartTime,
          end_time: updatedEndTime,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert('Trip updated successfully');
        setIsModalVisible(false); // Close the modal
        fetchSchedule(); // Refresh the schedule
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };
  
  // Function to delete a trip
  const handleDeleteTrip = async () => {
    if (!currentTrip) return;
    try {
      const token = await AsyncStorage.getItem('@token');
      const response = await fetch(`${API_BASE_URL}/manager/trips/${currentTrip.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert('Trip deleted successfully');
        setIsModalVisible(false); // Close the modal
        fetchSchedule(); // Refresh the schedule
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };
  const fetchSchedule = async () => {
    if (!schedBusId) {
      Alert.alert('Pick a bus first');
      return;
    }
    setSchedLoading(true);
    try {
      const token = await AsyncStorage.getItem('@token');
      const y = schedDate.getFullYear();
      const m = String(schedDate.getMonth() + 1).padStart(2, '0');
      const d = String(schedDate.getDate()).padStart(2, '0');
  
      // 1) Load trips
      const res = await fetch(
        `${API_BASE_URL}/manager/bus-trips?bus_id=${schedBusId}&date=${y}-${m}-${d}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data: TimelineItem[] = await res.json();
      if (!res.ok) throw new Error((data as any).error || 'Unknown');
  
      const sortedTrips = data.sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      );
      
  
      const withStops: TimelineItem[] = await Promise.all(
        sortedTrips.map(async (trip: TimelineItem) => {
          const r2 = await fetch(`${API_BASE_URL}/manager/stop-times?trip_id=${trip.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const stops: StopRec[] = await r2.json();
      
          const cleaned = uniqStops(stops).sort((a, b) => {
            const sA = a.seq ?? 9999, sB = b.seq ?? 9999;
            if (sA !== sB) return sA - sB;
            return (a.arrive_time || '').localeCompare(b.arrive_time || '');
          });
      
          return { ...trip, stops: cleaned };
        })
      );
      

      setEvents(withStops);
  
      // 4) Commit to state & animate
      setEvents(withStops);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } catch (err: any) {
      console.error(err);
      Alert.alert('Could not load trips', err.message);
      setEvents([]);
    } finally {
      setSchedLoading(false);
    }
  };
  
  const TripModal = () => (
    <Modal visible={isModalVisible} animationType="slide" transparent={true}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Update Trip</Text>
          {currentTrip && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Start Time"
                value={updatedStartTime}
                onChangeText={setUpdatedStartTime}
              />
              <TextInput
                style={styles.input}
                placeholder="End Time"
                value={updatedEndTime}
                onChangeText={setUpdatedEndTime}
              />
              <View style={styles.modalButtons}>
                <TouchableOpacity onPress={handleUpdateTrip} style={styles.updateButton}>
                  <Text style={styles.buttonText}>Update</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDeleteTrip} style={styles.deleteButton}>
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsModalVisible(false)} style={styles.cancelButton}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
  const TripDetailsModal = () => (
    <Modal visible={showTripDetails} animationType="slide" transparent>
      <View style={styles.modalContainer}>
        <View style={[styles.modalContent, { width: '90%' }]}>
          {detailsTrip && (
            <>
              {/* Header */}
              <Text style={styles.modalTitle2}>{detailsTrip.number}</Text>
              <Text style={styles.modalTime}>
                {formatTime12Hour(detailsTrip.start_time)} – {formatTime12Hour(detailsTrip.end_time)}
                {'  •  '}{durationStr(detailsTrip.start_time, detailsTrip.end_time)}
              </Text>
              <Text style={styles.modalRouteLine}>
  {getDirectionEndpoints(detailsTrip.stops).origin} → {getDirectionEndpoints(detailsTrip.stops).destination}
</Text>
              {/* Stops */}
              {detailsTrip.stops && detailsTrip.stops.length > 0 ? (
                <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ paddingVertical: 8 }}>
                  {uniqStops(detailsTrip.stops).map((s, i, arr) => {
                    const last = i === arr.length - 1;
                    return (
                      <View key={`${s.stop_name}-${s.arrive_time}-${s.depart_time}`} style={styles.stopRow2}>
                        <View style={styles.stopRail}>
                          <View style={styles.stopDot} />
                          {!last && <View style={styles.stopLine} />}
                        </View>
                        <View style={styles.stopInfo}>
                          <Text style={styles.stopName2}>{s.stop_name}</Text>
                          <Text style={styles.stopTime2}>{fmtStopWindow(s.arrive_time, s.depart_time)}</Text>
                        </View>
                      </View>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.emptyStops}>
                  <Ionicons name="alert-circle-outline" size={16} color="#8fbc8f" />
                  <Text style={styles.emptyStopsText}>No stops recorded for this trip.</Text>
                </View>
              )}
  
              {/* Buttons */}
              <View style={[styles.modalButtons, { marginTop: 12 }]}>
            
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => { setShowTripDetails(false); setCurrentTrip(detailsTrip); handleDeleteTrip(); }}
                >
                  <Text style={styles.buttonText}>Delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setShowTripDetails(false)}>
                  <Text style={styles.buttonText}>Close</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
  
  useEffect(() => { loadBuses(); }, []);

  /* auto-populate stops list when origin changes */
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
      Alert.alert('Please fill in all fields.');
      return;
    }
    try {
      const tok = await AsyncStorage.getItem('@token');
      const payload = {
        service_date: scheduleDate.toISOString().slice(0, 10),
        bus_id: selectedBusId,
        number: `${fromStop}-${toStop}`,
        start_time: toHHMM(depart),
        end_time: toHHMM(arrive),
      };
      const res = await fetch(`${API_BASE_URL}/manager/trips`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown');
      setNewTripId(json.id);
      Alert.alert('Route added!', `Trip ID: ${json.id}`);
      // optionally refresh schedule if matching bus/date
      if (selectedBusId === schedBusId && scheduleDate.toDateString() === schedDate.toDateString()) {
        fetchSchedule();
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error adding route', err.message);
    }
  };

  /* ---------------- add stop ---------------- */
  const handleAddStop = async () => {
    if (!newTripId || !stopLoc || !stopStart || !stopDepart) {
      Alert.alert('Please complete stop form.');
      return;
    }
    try {
      const tok = await AsyncStorage.getItem('@token');
      const payload = {
        trip_id: newTripId,
        stop_name: stopLoc,
        arrive_time: toHHMM(stopStart),
        depart_time: toHHMM(stopDepart),
      };
      const res = await fetch(`${API_BASE_URL}/manager/stop-times`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tok}`
        },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown');
      Alert.alert('Stop added!', `ID: ${json.id}`);
      setStopLoc(''); setStopStart(undefined); setStopDepart(undefined);
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error adding stop', err.message);
    }
  };

  const renderTimelineTrip = (trip: TimelineItem, index: number) => {
    const isLast = index === events.length - 1;
    const stopCount = trip.stops?.length ?? 0;
    const { origin, destination } = getDirectionEndpoints(trip.stops);
    const dur = durationStr(trip.start_time, trip.end_time);
  
    const openDetails = () => { setDetailsTrip(trip); setShowTripDetails(true); };
  
    return (
      <Animated.View key={trip.id} style={[styles.tripCard, { opacity: fadeAnim }]}>
        {/* left spine */}
        <View style={styles.spineWrap}>
          <View style={styles.spineDot} />
          {!isLast && <View style={styles.spineLine} />}
        </View>
  
        {/* content card */}
        <TouchableOpacity activeOpacity={0.9} onPress={openDetails} style={styles.tripBody}>
          {/* header row */}
          <View style={styles.tripTopRow}>
            <View style={styles.tripBadge}>
              <Text style={styles.tripBadgeText}>TRIP NO. {index + 1}</Text>
            </View>
            <View style={styles.timeBlock}>
              <Ionicons name="time-outline" size={16} color="#2d5a2d" />
              <Text style={styles.tripTimeText}>
  {formatTime12Hour(trip.start_time)} – {formatTime12Hour(trip.end_time)}
</Text>
            </View>
          </View>
  
          {/* title + route line */}
          <Text style={styles.tripTitle}>{trip.number}</Text>
          <Text style={styles.routeLine} numberOfLines={1}>
            {origin} → {destination}
          </Text>
  
          {/* meta chips */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Ionicons name="hourglass-outline" size={14} color="#2d5a2d" />
              <Text style={styles.metaChipText}>{dur}</Text>
            </View>
            <View style={styles.metaChip}>
              <Ionicons name="list-outline" size={14} color="#2d5a2d" />
              <Text style={styles.metaChipText}>{stopCount} stops</Text>
            </View>
          </View>
  
          {/* subtle CTA */}
          <View style={styles.viewStopsRow}>
            <Ionicons name="chevron-forward" size={16} color="#2d5a2d" />
            <Text style={styles.viewStopsText}>View stops</Text>
          </View>
  
          {/* actions */}
          <View style={styles.actionRow}>
        
            <TouchableOpacity
              style={[styles.actionPill, { backgroundColor: '#FFEBEE' }]}
              onPress={() => { setCurrentTrip(trip); setIsModalVisible(true); }}
            >
              <Ionicons name="trash-outline" size={16} color="#C62828" />
              <Text style={[styles.actionPillText, { color: '#C62828' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };
  
  /* ============================ UI ============================ */
  return (
    <View style={styles.container}>
      {/* ─── Enhanced Header ─── */}
      <View style={styles.headerContainer}>
        <View style={styles.headerGradient}>
          <View style={styles.headerContent}>
         
            
            <View style={styles.headerTitleContainer}>
              <Text style={styles.headerTitle}>Schedule Manager</Text>
              <Text style={styles.headerSubtitle}>Manage routes and view schedules</Text>
            </View>
            
            <TouchableOpacity style={styles.headerAction}>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.dateSelector}
            onPress={() => {
              setShowScheduleDatePicker(true);
              setSchedDate(scheduleDate);
            }}
          >
            <View style={styles.dateContent}>
              <Ionicons name="calendar" size={20} color="#2d5a2d" />
              <View style={styles.dateTextContainer}>
                <Text style={styles.dateLabel}>Selected Date</Text>
                <Text style={styles.dateText}>
                  {scheduleDate.toLocaleDateString(undefined, {
                    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-down" size={18} color="#2d5a2d" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Enhanced Tabs ─── */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabsWrap}>
          {(['route', 'schedule'] as const).map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Ionicons
                name={t === 'route' ? 'map' : 'time'}
                size={18} color={tab === t ? '#2d5a2d' : '#8fbc8f'}
                style={{ marginRight: 6 }}
              />
              <Text style={tab === t ? styles.tabActiveTxt : styles.tabTxt}>
                {t === 'route' ? 'Set Route' : 'Schedule'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ─── content ─── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >
          {tab === 'route' ? (
            <>
              {/* • Assign Bus */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="bus" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>Assign Bus</Text>
                </View>
                {loadingBuses ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#8fbc8f" />
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
                        <Picker.Item label="— select a bus —" value={undefined} />
                        {buses.map(b => (
                          <Picker.Item
                            key={b.id}
                            label={b.identifier.replace(/^bus[-_]?/i, 'Bus ')}
                            value={b.id}
                          />
                        ))}
                      </Picker>
                      <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
                    </View>
                  </View>
                )}
              </View>

              {/* • Route Details (From/To + Times) */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="navigate" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>Route Details</Text>
                </View>
                {/* From */}
                <View style={styles.inputGroup}>
                  <Text style={styles.fieldLabel}>From</Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={fromStop}
                      onValueChange={v => {
                        setFromStop(v);
                        const other = termini.find(t => t.value !== v)?.value;
                        setToStop(other);
                        // auto-populate stopLoc
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
                      {termini.map(t => (
                        <Picker.Item key={t.value} label={t.label} value={t.value} />
                      ))}
                    </Picker>
                    <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
                  </View>
                </View>
                {/* Arrow */}
                <View style={styles.routeArrow}>
                  <Ionicons name="arrow-down" size={20} color="#8fbc8f" />
                </View>
                {/* To */}
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
                {/* Times */}
                <View style={styles.timeContainer}>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Departure</Text>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowDepartPicker(true)}>
                      <Ionicons name="time" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(depart)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Arrival</Text>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowArrivePicker(true)}>
                      <Ionicons name="time" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(arrive)}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.actionBtn} onPress={handleAddRoute}>
                  <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionTxt}>Add Route</Text>
                </TouchableOpacity>
              </View>

              {/* • Add Stop */}
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
                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowStopStartPicker(true)}>
                      <Ionicons name="enter" size={16} color="#2d5a2d" />
                      <Text style={styles.timeText}>{fmtTime(stopStart)}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.timeCard}>
                    <Text style={styles.timeLabel}>Departure</Text>
                    <TouchableOpacity style={styles.timeButton} onPress={() => setShowStopDepartPicker(true)}>
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
            <>
              {/* • Schedule Tab UI */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="bus" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>View Schedule</Text>
                </View>

                {/* Bus selector */}
                <View style={[styles.inputGroup, styles.pickerContainer]}>
                  <Text style={styles.fieldLabel}>Select Bus</Text>
                  <View style={styles.pickerWrap}>
                    <Picker
                      selectedValue={schedBusId}
                      onValueChange={setSchedBusId}
                      style={{ flex: 1, color: '#2d5a2d' }}
                    >
                      <Picker.Item label="— choose bus —" value={undefined} />
                      {buses.map(b => (
                        <Picker.Item
                          key={b.id}
                          label={b.identifier.replace(/^bus[-_]?/i, 'Bus ')}
                          value={b.id}
                        />
                      ))}
                    </Picker>
                    <Ionicons name="chevron-down" size={18} color="#8fbc8f" />
                  </View>
                </View>

                {/* Load button */}
                <TouchableOpacity
                  style={[styles.actionBtn, { marginTop: 20 }]}
                  onPress={fetchSchedule}
                >
                  <Ionicons name="download" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.actionTxt}>Load Trips</Text>
                </TouchableOpacity>
              </View>

           {/* Enhanced Timeline Results */}
{schedLoading ? (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#2d5a2d" />
    <Text style={styles.loadingText}>Loading trips…</Text>
  </View>
) : events.length === 0 ? (
  <View style={styles.emptyState}>
    <Ionicons name="time-outline" size={64} color="#c8e6c9" />
    <Text style={styles.emptyTitle}>No trips found</Text>
    <Text style={styles.emptyText}>
      Choose a bus & date, then tap "Load Trips".
    </Text>
  </View>
) : (
  <View style={styles.timelineWrapper}>
    <View style={styles.timelineHeader}>
      <Ionicons name="time" size={20} color="#2d5a2d" />
      <Text style={styles.timelineTitle}>Daily Schedule</Text>
      <View style={styles.tripCount}>
        <Text style={styles.tripCountText}>{events.length} trips</Text>
      </View>
    </View>

    {/* renderTimelineTrip already includes both the trip and its stops */}
    {events.map((trip, index) => renderTimelineTrip(trip, index))}

    {/* Trip Update/Delete Modal */}
    <TripModal />
    <TripDetailsModal />
  </View>
)}

            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── pickers ─── */}
      {showDepartPicker && (
        <DateTimePicker
          value={depart || new Date()}
          mode="time" display="spinner"
          onChange={(_, d) => { setShowDepartPicker(false); if (d) setDepart(d); }}
        />
      )}
      {showArrivePicker && (
        <DateTimePicker
          value={arrive || new Date()}
          mode="time" display="spinner"
          onChange={(_, d) => { setShowArrivePicker(false); if (d) setArrive(d); }}
        />
      )}
      {showStopStartPicker && (
        <DateTimePicker
          value={stopStart || new Date()}
          mode="time" display="spinner"
          onChange={(_, d) => { setShowStopStartPicker(false); if (d) setStopStart(d); }}
        />
      )}
      {showStopDepartPicker && (
        <DateTimePicker
          value={stopDepart || new Date()}
          mode="time" display="spinner"
          onChange={(_, d) => { setShowStopDepartPicker(false); if (d) setStopDepart(d); }}
        />
      )}
      {showScheduleDatePicker && (
        <DateTimePicker
          value={scheduleDate}
          mode="date" display="calendar"
          onChange={(_, d) => {
            setShowScheduleDatePicker(false);
            if (d) {
              setScheduleDate(d);
              setSchedDate(d);
            }
          }}
        />
      )}
    </View>
  );
}

/* ------------------------------ Enhanced Styles ------------------------------ */
const styles = StyleSheet.create({
  routeLine: {
    marginTop: 2,
    color: '#6b7280',
    fontWeight: '700',
  },
  
  viewStopsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  viewStopsText: { color: '#2d5a2d', fontWeight: '700' },
  
  modalTitle2: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2d5a2d',
    textAlign: 'center',
    marginBottom: 6,
  },
  modalTime: {
    textAlign: 'center',
    color: '#2d5a2d',
    fontWeight: '600',
    marginBottom: 4,
  },
  modalRouteLine: {
    textAlign: 'center',
    color: '#6b7280',
    fontWeight: '700',
    marginBottom: 12,
  },
  
  tripCard: {
    flexDirection: 'row',
    marginHorizontal: 12,   // was 20
    marginTop: 14,
  },
  
  spineWrap: {
    width: 12,              // was 24
    alignItems: 'center',
  },

  spineDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#2d5a2d', marginTop: 12,
  },
  spineLine: {
    width: 2, flex: 1, backgroundColor: '#E0F2F1', marginTop: 4,
  },
  
  tripBody: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8f5e8',
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  
tripTopRow: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',       // ✨ allow wrap
},
  tripBadge: {
    backgroundColor: '#E8F5E9',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tripBadgeText: { color: '#2d5a2d', fontWeight: '700', fontSize: 11, letterSpacing: 0.3 },
  
  timeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '75%',        // was 55%
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'flex-end',
    marginTop: 4,           // adds breathing room when wrapped
  },
  tripTimeText: {
    color: '#2d5a2d',
    fontWeight: '600',
    flexShrink: 1,     // 👈 shrink text
  },
  
  tripTitle: {
    marginTop: 6,
    fontSize: 17,
    fontWeight: '700',
    color: '#2d5a2d',
  },
  
  metaRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  metaChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3FBF4',
    borderColor: '#E1F1E2',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaChipText: { color: '#2d5a2d', fontSize: 12, fontWeight: '600' },
  
  stopList: { marginTop: 12 },
  stopRow2: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  stopRail: { width: 20, alignItems: 'center' },
  stopDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2d5a2d', marginTop: 6 },
  stopLine: { width: 2, flex: 1, backgroundColor: '#E0F2F1', marginTop: 2 },
  
  stopInfo: {
    flex: 1,
    backgroundColor: '#F8FDF8',
    borderWidth: 1,
    borderColor: '#E8F5E8',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  stopName2: { color: '#2d5a2d', fontWeight: '700' },
  stopTime2: { color: '#6b7280', marginTop: 2, fontSize: 12, fontWeight: '500' },
  
  showMoreRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' },
  showMoreText: { color: '#2d5a2d', fontWeight: '700' },
  
  emptyStops: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, borderRadius: 12, backgroundColor: '#F8FDF8',
    borderWidth: 1, borderColor: '#E8F5E8', marginTop: 10,
  },
  emptyStopsText: { color: '#6b7280', fontWeight: '600' },
  
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  actionPillText: { color: '#2d5a2d', fontWeight: '700' },
  

  stopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  stopName: {
    fontSize: 13,
    color: '#2d5a2d',
  },
  stopTime: {
    fontSize: 13,
    color: '#8fbc8f',
    fontStyle: 'italic',
  },
  
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 20,
    width: '80%',
    borderRadius: 10,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: '#ddd',
    borderWidth: 1,
    marginBottom: 15,
    paddingLeft: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  updateButton: {
    backgroundColor: '#2d5a2d',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#d32f2f',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#8fbc8f',
    padding: 10,
    borderRadius: 5,
    width: '48%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
  },
  container: { 
    flex: 1, 
    backgroundColor: '#f0f8f0' 
  },
  
  // Enhanced Header Styles
  headerContainer: {
    backgroundColor: '#2d5a2d',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  headerGradient: {
    paddingBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },

  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '400',
  },
  headerAction: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dateSelector: {
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dateContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  stopsList: {
    marginTop: 8,
    paddingLeft: 16,
    borderLeftWidth: 2,
    borderLeftColor: '#8fbc8f',
  },
  dateLabel: {
    fontSize: 12,
    color: '#8fbc8f',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 16,
    color: '#2d5a2d',
    fontWeight: '600',
    marginTop: 2,
  },
  
  // Original styles with enhancements
  dateTxt: { color: '#fff', fontSize: 16, marginHorizontal: 8 },
  tabsContainer: { paddingHorizontal: 20, paddingTop: 16 },
  tabsWrap: {
    flexDirection: 'row', 
    backgroundColor: '#e8f5e8',
    borderRadius: 25, 
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    alignItems: 'center', 
    flexDirection: 'row', 
    justifyContent: 'center', 
    borderRadius: 20 
  },
  tabActive: { 
    backgroundColor: '#fff',
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tabTxt: { 
    fontSize: 14, 
    color: '#8fbc8f', 
    fontWeight: '500' 
  },
  tabActiveTxt: { 
    fontSize: 14, 
    color: '#2d5a2d', 
    fontWeight: '700' 
  },
  
  // Enhanced Timeline Styles
  timelineWrapper: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: '#e8f5e8',
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8f5e8',
  },
  timelineTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2d5a2d',
    marginLeft: 10,
    flex: 1,
  },
  tripCount: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  tripCountText: {
    fontSize: 12,
    color: '#2d5a2d',
    fontWeight: '600',
  },
  timelineContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLine: {
    width: 40,
    alignItems: 'center',
    paddingTop: 4,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2d5a2d',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    backgroundColor: '#e8f5e8',
    marginTop: 8,
    minHeight: 40,
  },
  timelineContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginLeft: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    // Add subtle press indication
    borderWidth: 1,
    borderColor: 'transparent',
  },
  

editIcon: {
  padding: 4,
},

// Update the tripHeader style to include space-between alignment
tripHeader: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between', // Add this line
  marginBottom: 8,
},

timelineContentPressed: {
  borderColor: '#8fbc8f',
  backgroundColor: '#f8fff8',
},
  
  tripTimes: {
    alignItems: 'flex-end',
  },
  tripTime: {
    fontSize: 13,
    color: '#8fbc8f',
    fontWeight: '600',
  },
  tripRoute: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d5a2d',
    marginBottom: 8,
    lineHeight: 22,
  },
  stopsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  stopsText: {
    fontSize: 12,
    color: '#8fbc8f',
    marginLeft: 4,
    fontStyle: 'italic',
  },
  
  // Enhanced Card Styles
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e8f5e8'
  },
  cardHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e8f5e8', 
    paddingBottom: 12 
  },
  cardTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#2d5a2d', 
    marginLeft: 10 
  },
  inputGroup: { 
    marginBottom: 16 
  },
  fieldLabel: { 
    fontSize: 14, 
    color: '#2d5a2d', 
    marginBottom: 8, 
    fontWeight: '600' 
  },
  fieldInput: { 
    flex: 1, 
    fontSize: 16, 
    color: '#2d5a2d', 
    paddingVertical: 12, 
    fontWeight: '500' 
  },
  pickerContainer: { 
    marginTop: 8 
  },
  pickerWrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#e8f5e8', 
    borderRadius: 15, 
    paddingHorizontal: 12, 
    backgroundColor: '#f8fdf8', 
    minHeight: 50 
  },
  destinationInput: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    borderWidth: 2, 
    borderColor: '#e8f5e8', 
    borderRadius: 15, 
    paddingHorizontal: 16, 
    backgroundColor: '#f8fdf8', 
    minHeight: 50 
  },
  routeArrow: { 
    alignItems: 'center', 
    marginVertical: 8 
  },
  timeContainer: { 
    flexDirection: 'row', 
    marginTop: 16, 
    gap: 12 
  },
  timeCard: { 
    flex: 1, 
    backgroundColor: '#f8fdf8', 
    borderRadius: 15, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#e8f5e8' 
  },
  timeLabel: { 
    fontSize: 12, 
    color: '#2d5a2d', 
    marginBottom: 8, 
    fontWeight: '600', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  timeButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 4 
  },
  timeText: { 
    fontSize: 18, 
    color: '#2d5a2d', 
    fontWeight: '700', 
    marginLeft: 8 
  },
  actionBtn: { 
    backgroundColor: '#2d5a2d', 
    borderRadius: 15, 
    paddingVertical: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    marginTop: 20,
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionTxt: { 
    color: '#fff', 
    fontWeight: '700', 
    fontSize: 16, 
    letterSpacing: 0.5 
  },
  secondaryBtn: { 
    backgroundColor: '#e8f5e8', 
    borderRadius: 15, 
    paddingVertical: 16, 
    alignItems: 'center', 
    justifyContent: 'center', 
    flexDirection: 'row', 
    marginTop: 20, 
    borderWidth: 2, 
    borderColor: '#c8e6c9' 
  },
  secondaryTxt: { 
    color: '#2d5a2d', 
    fontWeight: '700', 
    fontSize: 16, 
    letterSpacing: 0.5 
  },
  loadingContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 40 
  },
  loadingText: { 
    color: '#8fbc8f', 
    marginLeft: 8, 
    fontSize: 16 
  },
  emptyState: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    paddingVertical: 80, 
    paddingHorizontal: 40 
  },
  emptyTitle: { 
    fontSize: 24, 
    fontWeight: '700', 
    color: '#2d5a2d', 
    marginBottom: 8 
  },
  emptyText: { 
    fontSize: 16, 
    color: '#8fbc8f', 
    textAlign: 'center', 
    lineHeight: 24 
  },
});