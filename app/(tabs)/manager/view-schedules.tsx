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
  type StopType = 'start' | 'middle' | 'end';
  const [stopType, setStopType] = useState<StopType>('end');           // default to Terminus layover (your current behavior)
  const [midArrive, setMidArrive] = useState<Date | undefined>();      // for mid-route
  const [showMidArrivePicker, setShowMidArrivePicker] = useState(false);
  /* ----------- local UI state ----------- */
  const [tab, setTab] = useState<'route' | 'schedule'>('route');
  const [scheduleDate, setScheduleDate] = useState(new Date());
  const [showScheduleDatePicker, setShowScheduleDatePicker] = useState(false);
  const [isLastTrip, setIsLastTrip] = useState(false);
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
  const [dwellMins, setDwellMins] = useState<string>('');
  const [stopLoc, setStopLoc] = useState('');


  const [addingTrip, setAddingTrip] = useState(false);
  const [addingStop, setAddingStop] = useState(false);
  const stopWindow = React.useMemo(() => {
    const m = parseInt(dwellMins || '0', 10);
    if (Number.isNaN(m) || m < 0) return { startHM: '', endHM: '' };
  
    if (stopType === 'start' && depart) {
      const depHM = toHHMM(depart);
      return { startHM: minusMinutesHM(depHM, m), endHM: depHM };
    }
    if (stopType === 'end' && arrive) {
      const arrHM = toHHMM(arrive);
      return { startHM: arrHM, endHM: plusMinutesHM(arrHM, m) };
    }
    if (stopType === 'middle' && midArrive) {
      const arrHM = toHHMM(midArrive);
      return { startHM: arrHM, endHM: plusMinutesHM(arrHM, m) };
    }
    return { startHM: '', endHM: '' };
  }, [stopType, depart, arrive, midArrive, dwellMins]);
  
  const previewNice = (hm: string) => (hm ? formatTime12Hour(hm) : '--:--');
  
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

function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

function minutesToHM(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440; // wrap 24h
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function minusMinutesHM(hm: string, mins: number): string {
  return minutesToHM(hmToMinutes(hm) - mins);
}
function plusMinutesHM(hm: string, mins: number): string {
  return minutesToHM(hmToMinutes(hm) + mins);
}
function toHHMM(d: Date): string {
  // ensure always "HH:MM" 24h, independent of device locale
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}
function formatTime12Hour(hm: string): string {
  if (!hm) return '--:--';
  const [H, M] = hm.split(':').map(Number);
  const period = H >= 12 ? 'PM' : 'AM';
  const h12 = H % 12 || 12;
  return `${h12}:${String(M).padStart(2, '0')} ${period}`;
}
function hmOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = hmToMinutes(aStart), ae = hmToMinutes(aEnd);
  const bs = hmToMinutes(bStart), be = hmToMinutes(bEnd);
  return Math.max(as, bs) < Math.min(ae, be); // touching endpoints allowed
}
// add near other state
const [expandedIds, setExpandedIds] = useState<Record<number, boolean>>({});
const [activeStopKey, setActiveStopKey] = useState<string | null>(null);

const toggleExpanded = (id: number) =>
  setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));

const confirmDeleteStop = (stopId: number, tripId: number) => {
  Alert.alert(
    'Delete stop?',
    'This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => handleDeleteStop(stopId, tripId) },
    ]
  );
};

const handleDeleteStop = async (stopId: number, tripId: number) => {
  try {
    const token = await AsyncStorage.getItem('@token');
    const res = await fetch(`${API_BASE_URL}/manager/stop-times/${stopId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Failed to delete stop.');
    setActiveStopKey(null);
    // refresh schedule (prefer the bus you’re working on)
    await fetchSchedule(selectedBusId ?? schedBusId, scheduleDate);
  } catch (e: any) {
    Alert.alert('Error', e.message);
  }
};

const confirmDeleteTrip = (trip: TimelineItem) => {
  Alert.alert(
    'Delete trip?',
    `This will remove “${trip.number}”.`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => { setCurrentTrip(trip); handleDeleteTrip(); }
      },
    ]
  );
};


const TERM_A = 'waltermart paniqui';
const TERM_B = 'sm tarlac city';
const isSM = (name = '') => /sm\s*tarlac\s*city/i.test(name);
const isSame = (a = '', b = '') =>
  a.trim().toLowerCase().replace(/\s+/g, ' ') === b.trim().toLowerCase().replace(/\s+/g, ' ');


const getDirectionEndpoints = (stops?: StopRec[]) => {
  if (!stops || stops.length === 0) return { origin: '—', destination: '—' };

  // you already clean elsewhere, but keeping this robust:
  const ordered = [...stops].sort((a, b) => (a.seq ?? 9999) - (b.seq ?? 9999));
  const first = ordered[0].stop_name;
  const last  = ordered[ordered.length - 1].stop_name;

  // If not a loop, just show first → last
  if (!isSame(first, last)) return { origin: first, destination: last };

  // Loop: find the last stop before returning to origin
  // and skip SM Tarlac City if present, so Petron is chosen.
  for (let i = ordered.length - 2; i >= 0; i--) {
    const name = ordered[i].stop_name;
    if (!isSame(name, first) && !isSM(name)) {
      return { origin: name, destination: first };
    }
  }

  // Fallback: last different (may be SM if nothing else)
  const lastDifferent = [...ordered]
    .reverse()
    .find(s => !isSame(s.stop_name, first));
  return { origin: lastDifferent?.stop_name ?? first, destination: first };
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


  const previewStopEndHM = React.useMemo(() => {
    const n = parseInt(dwellMins, 10);
    if (!arrive || Number.isNaN(n) || n < 0) return '';
    const startHM = toHHMM(arrive);            // Arrival
    return plusMinutesHM(startHM, n);          // Arrival + duration
  }, [arrive, dwellMins]);
  
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
  
    // Normalize to HH:MM (API might give HH:MM:SS)
    const newStart = (updatedStartTime || '').slice(0, 5);
    const newEnd   = (updatedEndTime   || '').slice(0, 5);
  
    const hhmm = /^\d{2}:\d{2}$/;
    if (!hhmm.test(newStart) || !hhmm.test(newEnd)) {
      Alert.alert('Invalid format', 'Use HH:MM (24-hour) for start and end.');
      return;
    }
    if (hmToMinutes(newStart) >= hmToMinutes(newEnd)) {
      Alert.alert('Invalid time', 'End time must be after start time.');
      return;
    }
    if (!schedBusId) {
      Alert.alert('Pick a bus', 'Select a bus in the Schedule tab first.');
      return;
    }
  
    // Conflicts against other trips/stops on the same bus/date
    const snapshot = await getTripsSnapshot(schedBusId, schedDate);
  
    const conflictTrip = snapshot.find(t =>
      t.id !== currentTrip.id && hmOverlap(newStart, newEnd, t.start_time, t.end_time)
    );
    if (conflictTrip) {
      Alert.alert(
        'Time conflict',
        `Overlaps with ${conflictTrip.number} (${formatTime12Hour(conflictTrip.start_time)}–${formatTime12Hour(conflictTrip.end_time)}).`
      );
      return;
    }
  
    // vs stops on other trips
    for (const t of snapshot) {
      if (t.id === currentTrip.id) continue;
      for (const s of (t.stops ?? [])) {
        if (!s.arrive_time || !s.depart_time) continue;
        if (hmOverlap(newStart, newEnd, s.arrive_time, s.depart_time)) {
          Alert.alert(
            'Stop conflict',
            `Clashes with stop ${s.stop_name} (${formatTime12Hour(s.arrive_time)}–${formatTime12Hour(s.depart_time)}).`
          );
          return;
        }
      }
    }
  
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
          start_time: newStart,
          end_time: newEnd,
        }),
      });
      const result = await response.json();
      if (response.ok) {
        Alert.alert('Trip updated successfully');
        setIsModalVisible(false);
        fetchSchedule();
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };
  
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

const fetchSchedule = async (busOverride?: number, dateOverride?: Date) => {
  const busId = busOverride ?? schedBusId;
  const date  = dateOverride ?? schedDate;

  if (!busId) {
    Alert.alert('Pick a bus first');
    return;
  }

  setSchedLoading(true);
  try {
    const token = await AsyncStorage.getItem('@token');
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');

    // keep these in sync so the UI reflects what was loaded
    setSchedBusId(busId);
    setSchedDate(date);

    const res = await fetch(
      `${API_BASE_URL}/manager/bus-trips?bus_id=${busId}&date=${y}-${m}-${d}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data: TimelineItem[] = await res.json();
    if (!res.ok) throw new Error((data as any).error || 'Unknown');

    const sortedTrips = data.sort((a, b) => a.start_time.localeCompare(b.start_time));

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
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
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

  useEffect(() => {
    if (toStop === 'SM Tarlac City (Siesta)') {
      // going to SM → default stop is Petron
      setStopsList([{ id: 1, stop_name: 'Petron Tarlac City', arrive_time: '', depart_time: '' }]);
      setStopLoc('Petron Tarlac City');
    } else if (toStop === 'Paniqui (Walter Mart)') {
      // going to Paniqui → default stop is WalterMart Paniqui
      setStopsList([{ id: 1, stop_name: 'WalterMart Paniqui', arrive_time: '', depart_time: '' }]);
      setStopLoc('WalterMart Paniqui');
    } else {
      setStopsList([]);
      setStopLoc('');
    }
  }, [toStop]);

  const handleAddRoute = async () => {
    if (!selectedBusId || !fromStop || !toStop || !depart || !arrive) {
      Alert.alert('Please fill in all fields.');
      return;
    }
    try {
  // time order
const depHM = toHHMM(depart);
const arrHM = toHHMM(arrive);
if (hmToMinutes(depHM) >= hmToMinutes(arrHM)) {
  Alert.alert('Invalid time', 'Arrival must be after the departure.');
  return;
}

// conflicts against existing trips (and implicitly their stops)
const snapshot = await getTripsSnapshot(selectedBusId, scheduleDate);
const hitTrip = snapshot.find(t => hmOverlap(depHM, arrHM, t.start_time, t.end_time));
if (hitTrip) {
  Alert.alert(
    'Time conflict',
    `Overlaps with ${hitTrip.number} (${formatTime12Hour(hitTrip.start_time)}–${formatTime12Hour(hitTrip.end_time)}).`
  );
  return;
}

// (optional, redundant but explicit) also check against stop windows
const hitStop = snapshot.flatMap(t => (t.stops ?? []).map(s => ({ t, s })))
  .find(({ s }) => s.arrive_time && s.depart_time && hmOverlap(depHM, arrHM, s.arrive_time, s.depart_time));
if (hitStop) {
  Alert.alert(
    'Stop conflict',
    `Trip window clashes with stop ${hitStop.s.stop_name} (${formatTime12Hour(hitStop.s.arrive_time)}–${formatTime12Hour(hitStop.s.depart_time)}).`
  );
  return;
}

setAddingTrip(true);

  
      const tok = await AsyncStorage.getItem('@token');
  
      // (optional: avoid UTC shift)
      const ymdLocal = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  
      const payload = {
        service_date: ymdLocal(scheduleDate),
        bus_id: selectedBusId,
        number: `${fromStop}-${toStop}`,
        start_time: toHHMM(depart),
        end_time: toHHMM(arrive),
      };
  
      const res = await fetch(`${API_BASE_URL}/manager/trips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown');
      setNewTripId(json.id);

      // Pretty labels for bus + date
      const busLabel =
        (buses.find(b => b.id === selectedBusId)?.identifier || `Bus ${selectedBusId}`)
          .replace(/^bus[-_]?/i, 'Bus ');
      
      const dateLabel = scheduleDate.toLocaleDateString(undefined, {
        weekday: 'short', month: 'long', day: 'numeric', year: 'numeric'
      });
      

      const dep12 = formatTime12Hour(payload.start_time);
      const arr12 = formatTime12Hour(payload.end_time);
      
      Alert.alert(
        'Route added!',
        `${busLabel} — ${dateLabel}\n${fromStop} → ${toStop}\n${dep12} – ${arr12}`
      );
      
      await fetchSchedule(selectedBusId, scheduleDate);
  
      if (selectedBusId === schedBusId && scheduleDate.toDateString() === schedDate.toDateString()) {
        await fetchSchedule();
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error adding route', err.message);
    } finally {
      setAddingTrip(false);
    }
  };

  
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  
  /** Reuse schedule if we're already viewing the same bus/date, otherwise fetch a fresh snapshot (with stops). */
  const getTripsSnapshot = async (busId: number, date: Date): Promise<TimelineItem[]> => {
    try {
      if (schedBusId === busId && sameDay(schedDate, date) && events.length) return events;
  
      const token = await AsyncStorage.getItem('@token');
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
  
      const res = await fetch(
        `${API_BASE_URL}/manager/bus-trips?bus_id=${busId}&date=${y}-${m}-${d}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const raw: TimelineItem[] = await res.json();
      const sorted = raw.sort((a, b) => a.start_time.localeCompare(b.start_time));
  
      const withStops: TimelineItem[] = await Promise.all(sorted.map(async (t) => {
        const r2 = await fetch(`${API_BASE_URL}/manager/stop-times?trip_id=${t.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const stops: StopRec[] = await r2.json();
        const cleaned = uniqStops(stops).sort((a, b) => {
          const sA = a.seq ?? 9999, sB = b.seq ?? 9999;
          if (sA !== sB) return sA - sB;
          return (a.arrive_time || '').localeCompare(b.arrive_time || '');
        });
        return { ...t, stops: cleaned };
      }));
  
      return withStops;
    } catch {
      return [];
    }
  };
  
  const handleAddStop = async () => {
    if (!newTripId || !stopLoc || !arrive || !dwellMins.trim()) {
      Alert.alert('Please complete stop form.');
      return;
    }
    const dwell = parseInt(dwellMins, 10);
    if (Number.isNaN(dwell) || dwell < 0) {
      Alert.alert('Invalid minutes', 'Enter a non-negative number.');
      return;
    }
    if (!selectedBusId) {
      Alert.alert('Select bus', 'Please pick the bus for this trip first.');
      return;
    }
  
    // Stop window = [trip arrival, trip arrival + duration]
    const stopArriveHM = toHHMM(arrive);                     // start of waiting
    const stopDepartHM = plusMinutesHM(stopArriveHM, dwell); // end of waiting
  
    // Conflicts (against trips and other stops for this bus on this date)
    const snapshot = await getTripsSnapshot(selectedBusId, scheduleDate);
  
    // vs trips
    const hitTrip = snapshot.find(t => hmOverlap(stopArriveHM, stopDepartHM, t.start_time, t.end_time));
    if (hitTrip) {
      Alert.alert(
        'Stop conflicts with a trip',
        `Clashes with ${hitTrip.number} (${formatTime12Hour(hitTrip.start_time)}–${formatTime12Hour(hitTrip.end_time)}).`
      );
      return;
    }
  
    // vs other stops
    for (const t of snapshot) {
      if (t.id === newTripId) continue; // ignore stops of the same trip (if any)
      for (const s of (t.stops ?? [])) {
        if (!s.arrive_time || !s.depart_time) continue;
        if (hmOverlap(stopArriveHM, stopDepartHM, s.arrive_time, s.depart_time)) {
          Alert.alert(
            'Stop conflict',
            `Clashes with ${s.stop_name} (${formatTime12Hour(s.arrive_time)}–${formatTime12Hour(s.depart_time)}).`
          );
          return;
        }
      }
    }
  
    try {
      setAddingStop(true);
      const tok = await AsyncStorage.getItem('@token');
  
      const payload = {
        trip_id: newTripId,
        stop_name: stopLoc,
        arrive_time: stopArriveHM,
        depart_time: stopDepartHM,
      };
  
      const res = await fetch(`${API_BASE_URL}/manager/stop-times`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Unknown');
  
      Alert.alert(
        'Stop added!',
        `${payload.stop_name}\n${formatTime12Hour(stopArriveHM)} – ${formatTime12Hour(stopDepartHM)}`
      );
      
      setStopLoc('');
      await fetchSchedule(selectedBusId, scheduleDate);
      if (selectedBusId === schedBusId && scheduleDate.toDateString() === schedDate.toDateString()) {
        await fetchSchedule();
      }
    } catch (err: any) {
      console.error(err);
      Alert.alert('Error adding stop', err.message);
    } finally {
      setAddingStop(false);
    }
  };
  const renderTimelineTrip = (trip: TimelineItem, index: number) => {
    const isLast = index === events.length - 1;
    const stopCount = trip.stops?.length ?? 0;
    const { origin, destination } = getDirectionEndpoints(trip.stops);
    const dur = durationStr(trip.start_time, trip.end_time);
    const expanded = !!expandedIds[trip.id];
  
    return (
      <Animated.View key={trip.id} style={[styles.tripCard, { opacity: fadeAnim }]}>
        {/* left spine */}
        <View style={styles.spineWrap}>
          <View style={styles.spineDot} />
          {!isLast && <View style={styles.spineLine} />}
        </View>
  
        {/* content card */}
        <View style={styles.tripBody}>
          {/* header row */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => toggleExpanded(trip.id)}
            style={styles.tripTopRow}
          >
            <View style={styles.tripBadge}>
              <Text style={styles.tripBadgeText}>TRIP NO. {index + 1}</Text>
            </View>
  
            <View style={styles.timeBlock}>
              <Ionicons name="time-outline" size={16} color="#2d5a2d" />
              <Text style={styles.tripTimeText}>
                {formatTime12Hour(trip.start_time)} – {formatTime12Hour(trip.end_time)}
              </Text>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#2d5a2d"
                style={{ marginLeft: 6 }}
              />
            </View>
          </TouchableOpacity>
  
      
  
          {/* expanded content */}
          {expanded && (
            <>
              {/* quick trip actions */}
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.actionPill, { backgroundColor: '#FFEBEE' }]}
                  onPress={() => confirmDeleteTrip(trip)}
                >
                  <Ionicons name="trash-outline" size={16} color="#C62828" />
                  <Text style={[styles.actionPillText, { color: '#C62828' }]}>Delete Trip</Text>
                </TouchableOpacity>
              </View>
  
              {/* stops grid */}
              <View style={styles.stopGrid}>
                {trip.stops?.map((s, i) => {
                  const key = `${trip.id}:${s.id}`;
                  const selected = activeStopKey === key;
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.9}
                      onPress={() => setActiveStopKey(selected ? null : key)}
                      style={[styles.stopBox, selected && styles.stopBoxSelected]}
                    >
                      <View style={styles.stopBoxHeader}>
                        <View style={styles.stopOrderBubble}>
                          <Text style={styles.stopOrderText}>{i + 1}</Text>
                        </View>
                        <Text style={styles.stopBoxName} numberOfLines={2}>{s.stop_name}</Text>
                      </View>
                      <Text style={styles.stopBoxTime}>
                        {fmtStopWindow(s.arrive_time, s.depart_time)}
                      </Text>
  
                      {selected && (
                        <View style={styles.stopActionsRow}>
                          <TouchableOpacity
                            style={styles.deleteStopBtn}
                            onPress={() => confirmDeleteStop(s.id, trip.id)}
                          >
                            <Ionicons name="trash-outline" size={16} color="#fff" />
                            <Text style={styles.deleteStopTxt}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
  
                {(!trip.stops || trip.stops.length === 0) && (
                  <View style={[styles.stopBox, { alignItems: 'center' }]}>
                    <Ionicons name="alert-circle-outline" size={16} color="#8fbc8f" />
                    <Text style={[styles.stopBoxTime, { marginTop: 6 }]}>No stops recorded</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </View>
      </Animated.View>
    );
  };
  
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
                <TouchableOpacity
                style={[styles.actionBtn, { marginTop: 20, opacity: (addingTrip || schedLoading) ? 0.7 : 1 }]}
                onPress={handleAddRoute}
                disabled={addingTrip || schedLoading}
              >
                {addingTrip ? (
                  <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="add-circle" size={20} color="#fff" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.actionTxt}>{addingTrip ? 'Adding…' : 'Add Route'}</Text>
              </TouchableOpacity>

              </View>

              {/* • Add Stop */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Ionicons name="location" size={20} color="#2d5a2d" />
                  <Text style={styles.cardTitle}>Add Stop</Text>
                </View>
           {/* Location (static) */}
<View style={styles.inputGroup}>
  <Text style={styles.fieldLabel}>Location</Text>
  <View style={styles.destinationInput}>
    <Text
      style={[
        styles.fieldInput,
        { color: stopLoc ? '#2d5a2d' : '#a8d5a8' }
      ]}
      // just text; not pressable or editable
    >
      {stopLoc || 'Select a route first'}
    </Text>
    <Ionicons name="pin" size={18} color="#8fbc8f" />
  </View>
</View>

                <View style={styles.timeContainer}>
  {/* Minutes before arrival */}
  <View style={styles.timeCard}>
  <Text style={styles.timeLabel}>Stop duration (minutes)</Text>
    <View style={[styles.timeButton, { justifyContent: 'space-between' }]}>
      <TextInput
        style={[styles.fieldInput, { paddingVertical: 0 }]}
        keyboardType="numeric"
        value={dwellMins}
        onChangeText={setDwellMins}
        placeholder="e.g., 10"
        placeholderTextColor="#a8d5a8"
      />
      <Text style={{ color: '#2d5a2d', fontWeight: '700' }}>min</Text>
    </View>
  </View>

  {/* Resulting stop time (read-only) */}
  <View style={styles.timeCard}>
  <Text style={styles.timeLabel}>Computed stop window</Text>

    <View style={styles.timeButton}>
      <Ionicons name="time" size={16} color="#2d5a2d" />
      <Text style={styles.timeText}>
  {arrive && previewStopEndHM
    ? `${formatTime12Hour(toHHMM(arrive))} – ${formatTime12Hour(previewStopEndHM)}`
    : '--:--'}
</Text>

    </View>
    <Text style={{ color: '#6b7280', marginTop: 6 }}>
      Based on trip arrival {fmtTime(arrive)}
    </Text>
  </View>
</View>


<TouchableOpacity
  style={[
    styles.secondaryBtn,
    { opacity: (addingStop || schedLoading || !newTripId || !arrive || !dwellMins.trim()) ? 0.7 : 1 }
  ]}
  onPress={handleAddStop}
  disabled={addingStop || schedLoading || !newTripId || !arrive || !dwellMins.trim()}
>
  {addingStop ? (
    <ActivityIndicator size="small" style={{ marginRight: 8 }} />
  ) : (
    <Ionicons name="add" size={20} color="#2d5a2d" style={{ marginRight: 8 }} />
  )}
  <Text style={styles.secondaryTxt}>{addingStop ? 'Adding…' : 'Add Stop'}</Text>
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

                <TouchableOpacity
  style={[styles.actionBtn, { marginTop: 20, opacity: (schedLoading || addingTrip || addingStop) ? 0.7 : 1 }]}
  onPress={() => fetchSchedule()}
  disabled={schedLoading || addingTrip || addingStop}
>
  {schedLoading ? (
    <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
  ) : (
    <Ionicons name="download" size={20} color="#fff" style={{ marginRight: 8 }} />
  )}
  <Text style={styles.actionTxt}>{schedLoading ? 'Loading…' : 'Load Trips'}</Text>
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

      {showDepartPicker && (
  <DateTimePicker
    value={depart || new Date()}
    mode="time" display="spinner"
    onChange={(_, d) => {
      setShowDepartPicker(false);
      if (!d) return;
      if (arrive && hmToMinutes(toHHMM(d)) >= hmToMinutes(toHHMM(arrive))) {
        Alert.alert('Invalid time', 'Departure must be before the arrival.');
        return;
      }
      setDepart(d);
    }}
  />
)}

{showArrivePicker && (
  <DateTimePicker
    value={arrive || new Date()}
    mode="time" display="spinner"
    onChange={(_, d) => {
      setShowArrivePicker(false);
      if (!d) return;
      if (depart && hmToMinutes(toHHMM(d)) <= hmToMinutes(toHHMM(depart))) {
        Alert.alert('Invalid time', 'Arrival must be after the departure.');
        return;
      }
      setArrive(d);
    }}
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
  stopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  
  stopBox: {
    width: '48%',
    backgroundColor: '#F8FDF8',
    borderWidth: 1,
    borderColor: '#E8F5E8',
    borderRadius: 12,
    padding: 12,
  },
  
  stopBoxSelected: {
    borderColor: '#2d5a2d',
    backgroundColor: '#F2FBF2',
    shadowColor: '#2d5a2d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  
  stopBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  
  stopOrderBubble: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#e8f5e8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  stopOrderText: {
    fontSize: 12,
    color: '#2d5a2d',
    fontWeight: '700',
  },
  
  stopBoxName: {
    flex: 1,
    color: '#2d5a2d',
    fontWeight: '700',
    fontSize: 13,
  },
  
  stopBoxTime: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '500',
  },
  
  stopActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  
  deleteStopBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#d32f2f',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  
  deleteStopTxt: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  
});