// app/(tabs)/pao/ticket-registration.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SearchablePicker from '../../../components/SearchablePicker';
import { API_BASE_URL } from '../../config';

const { width } = Dimensions.get('window');

const regularImgs: ImageSourcePropType[] = [
  require('../../../assets/tickets/regular_10.jpg'),
  require('../../../assets/tickets/regular_12.jpg'),
  require('../../../assets/tickets/regular_14.jpg'),
  require('../../../assets/tickets/regular_16.jpg'),
  require('../../../assets/tickets/regular_18.jpg'),
  require('../../../assets/tickets/regular_20.jpg'),
  require('../../../assets/tickets/regular_22.jpg'),
  require('../../../assets/tickets/regular_24.jpg'),
  require('../../../assets/tickets/regular_26.jpg'),
  require('../../../assets/tickets/regular_28.jpg'),
  require('../../../assets/tickets/regular_30.jpg'),
  require('../../../assets/tickets/regular_32.jpg'),
  require('../../../assets/tickets/regular_34.jpg'),
  require('../../../assets/tickets/regular_36.jpg'),
  require('../../../assets/tickets/regular_38.jpg'),
  require('../../../assets/tickets/regular_40.jpg'),
  require('../../../assets/tickets/regular_42.jpg'),
  require('../../../assets/tickets/regular_44.jpg'),
];
const discountImgs: ImageSourcePropType[] = [
  require('../../../assets/tickets/discount_8.jpg'),
  require('../../../assets/tickets/discount_10.jpg'),
  require('../../../assets/tickets/discount_13.jpg'),
  require('../../../assets/tickets/discount_14.jpg'),
  require('../../../assets/tickets/discount_16.jpg'),
  require('../../../assets/tickets/discount_18.jpg'),
  require('../../../assets/tickets/discount_19.jpg'),
  require('../../../assets/tickets/discount_21.jpg'),
  require('../../../assets/tickets/discount_22.jpg'),
  require('../../../assets/tickets/discount_24.jpg'),
  require('../../../assets/tickets/discount_26.jpg'),
  require('../../../assets/tickets/discount_27.jpg'),
  require('../../../assets/tickets/discount_29.jpg'),
  require('../../../assets/tickets/discount_30.jpg'),
  require('../../../assets/tickets/discount_32.jpg'),
  require('../../../assets/tickets/discount_34.jpg'),
  require('../../../assets/tickets/discount_35.jpg'),
];

type Stop = { id: number; name: string };
type Commuter = { id: number; name: string };
type TicketResp = {
  id: number;
  referenceNo: string;
  qr: string;                // stringified JSON payload
  qr_link: string;           // direct QR image URL
  qr_bg_url: string;         // optional background image
  origin: string;
  destination: string;
  passengerType: 'regular' | 'discount';
  fare: string;
  paid: boolean;
};

export default function TicketRegistration() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarHeight = (Platform.OS === 'ios' ? 74 : 66) + insets.bottom;

  const [stops, setStops] = useState<Stop[]>([]);
  const [commuters, setCommuters] = useState<Commuter[]>([]);
  const [busCode, setBusCode] = useState<string | null>(null);
  const [busId, setBusId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(false);

  const [originId, setOriginId] = useState<number>();
  const [destId, setDestId] = useState<number>();
  const [passengerType, setPassengerType] = useState<'regular' | 'discount'>('regular');
  const [commuterId, setCommuterId] = useState<number>();

  const [loadingLists, setLoadingLists] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  // 🔁 trigger re-fetch of all lists/data
  const [reloadKey, setReloadKey] = useState(0);

  const listRef = useRef<FlatList<any>>(null);

  const getOrigin = (u: string | undefined) => {
    if (!u) return '';
    try { const x = new URL(u); return `${x.protocol}//${x.host}`; } catch { return ''; }
  };
  const templateName = (fareStr: string, kind: 'regular' | 'discount') => {
    const n = Math.round(parseFloat(fareStr)); // "30.00" → 30
    return `${kind}_${n}.jpg`;
  };
  const [ticket, setTicket] = useState<TicketResp | null>(null);
  const getQrImageUrl = (t: TicketResp) => {
    if (t.qr_link) return t.qr_link;
    try {
      const parsed = JSON.parse(t.qr);
      return parsed?.link;
    } catch { return undefined; }
  };
  const isMounted = useRef(true);
  const stopNameById = useCallback(
    (id?: number) => (id ? stops.find(s => s.id === id)?.name : undefined),
    [stops]
  );
  const [qrUri, setQrUri] = useState<string | undefined>(undefined);

  const bust = (u?: string) => (u ? `${u}${u.includes('?') ? '&' : '?'}_=${Date.now()}` : undefined);
  const primaryQr = (t: TicketResp | null) =>
    (t ? (t.qr_link || (() => { try { return JSON.parse(t.qr)?.link; } catch { return undefined; } })()) : undefined);

  const authHeader = useCallback(
    (extra: Record<string, string> = {}) =>
      ({
        ...extra,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      } as Record<string, string>),
    [token]
  );

  // ⤵️ load lists + bus/token; re-runs when reloadKey changes
  useEffect(() => {
    isMounted.current = true;
    const controller = new AbortController();

    (async () => {
      setLoadingLists(true);
      try {
        const pairs = await AsyncStorage.multiGet(['@assignedBusId', '@assignedBusCode', '@token']);
        const map = Object.fromEntries(pairs);
        if (!isMounted.current) return;
        setBusId(map['@assignedBusId']);
        setBusCode(map['@assignedBusCode']);
        setToken(map['@token'] ?? null);

        const headers: Record<string, string> = {};
        if (map['@token']) headers.Authorization = `Bearer ${map['@token']}`;

        const [sRes, cRes] = await Promise.all([
          fetch(`${API_BASE_URL}/pao/stops`, { headers, signal: controller.signal }),
          fetch(`${API_BASE_URL}/pao/commuters`, { headers, signal: controller.signal }),
        ]);
        if (!sRes.ok || !cRes.ok) throw new Error('fetch failed');

        const [sJson, cJson] = await Promise.all([sRes.json(), cRes.json()]);
        if (!isMounted.current) return;
        setStops(sJson);
        setCommuters(cJson);
      } catch (e) {
        if ((e as any)?.name !== 'AbortError') console.error(e);
      } finally {
        if (isMounted.current) setLoadingLists(false);
      }
    })();

    return () => {
      isMounted.current = false;
      controller.abort();
    };
  }, [reloadKey]);

  const pickerItems = useMemo(
    () => stops.map(s => ({ label: s.name, value: s.id })),
    [stops]
  );

  const progress = useMemo(
    () =>
      [busId ? 0.2 : 0, commuterId !== undefined ? 0.25 : 0, originId ? 0.25 : 0, destId ? 0.25 : 0, passengerType ? 0.25 : 0].reduce(
        (a, b) => a + b,
        0
      ),
    [busId, commuterId, originId, destId, passengerType]
  );

  const handleCalculate = useCallback(async () => {
    if (calculating) return;
    if (!originId || !destId || commuterId === undefined) return;

    const now = dayjs().format('YYYY-MM-DDTHH:mm:ss');
    const body = {
      bus_id: Number(busId),
      origin_stop_time_id: originId,
      destination_stop_time_id: destId,
      passenger_type: passengerType,
      commuter_id: commuterId,
      created_at: now,
    };

    console.log('[PAO] POST /pao/tickets body →', body, {
      originName: stopNameById(originId),
      destinationName: stopNameById(destId),
    });

    setCalculating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pao/tickets`, {
        method: 'POST',
        headers: authHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      const json: TicketResp = await res.json();
      console.log('[PAO] /pao/tickets response ←', json);
      if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(json)}`);
      if (isMounted.current) setTicket(json);
    } catch (e) {
      console.error('[PAO] create ticket error:', e);
    } finally {
      if (isMounted.current) setCalculating(false);
    }
  }, [authHeader, busId, calculating, commuterId, destId, originId, passengerType, stopNameById]);

  const prefetch = async (url?: string) => {
    if (!url) return false;
    try {
      const ok = await Image.prefetch(url);
      console.log('[QR] prefetch', url, '→', ok);
      return !!ok;
    } catch (e) {
      console.log('[QR] prefetch error', url, e);
      return false;
    }
  };

  useEffect(() => {
    if (!ticket) return;
    (async () => {
      setQrLoading(true);
      setQrError(false);

      const first = bust(primaryQr(ticket));
      const origin = getOrigin(ticket.qr_link);
      const fallbackPath = `/static/qr/${templateName(ticket.fare, ticket.passengerType)}`;
      const fallback = bust(`${origin}${fallbackPath}`);

      if (await prefetch(first)) { setQrUri(first!); setQrLoading(false); return; }
      if (await prefetch(fallback)) { setQrUri(fallback); setQrLoading(false); return; }
      setQrError(true);
      setQrLoading(false);
    })();
  }, [ticket?.id]);

  const markAsPaid = useCallback(async () => {
    if (!ticket || markingPaid) return;

    setMarkingPaid(true);
    try {
      const res = await fetch(`${API_BASE_URL}/pao/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: authHeader({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ paid: true }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      if (isMounted.current) setTicket({ ...ticket, paid: true });
    } catch (e) {
      console.error(e);
    } finally {
      if (isMounted.current) setMarkingPaid(false);
    }
  }, [authHeader, ticket, markingPaid]);

  // 🔁 Refresh all fetched data (stops/commuters/bus/token)
  const refreshAll = useCallback(() => {
    setReloadKey(k => k + 1);
  }, []);

  // 👤 Start flow again for the next passenger
  const resetForNextPassenger = useCallback(() => {
    setTicket(null);
    setCommuterId(undefined);
    setOriginId(undefined);
    setDestId(undefined);
    setPassengerType('regular');
    setQrUri(undefined);
    setQrError(false);
    setQrLoading(false);
    // scroll to top of the list to the form
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  // 2) replace the outer <ScrollView> with a FlatList
  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={[]}
        renderItem={() => null}
        keyExtractor={() => 'header'}
        nestedScrollEnabled
        scrollEnabled={!pickerOpen}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + 20 }]}
        ListHeaderComponent={
          <>
            {busCode && (
              <View style={styles.busBanner}>
                <Ionicons name="bus" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.busBannerText}>{busCode}</Text>
              </View>
            )}

            {/* HEADER */}
            <View style={styles.headerContainer}>
              <View style={styles.header}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>Electronic Ticketing</Text>
                  <Text style={styles.headerSubtitle}>Quick & Easy Booking</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/pao/ticket-records')} style={styles.recordsBtn}>
                  <Ionicons name="receipt-outline" size={18} color="#fff" />
                  <Text style={styles.recordsBtnText}>Records</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>Complete all fields to proceed</Text>
              </View>
            </View>

            {/* FORM */}
            <View style={styles.formContainer}>
              {loadingLists ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2e7d32" />
                  <Text style={styles.loadingText}>Loading data…</Text>
                </View>
              ) : (
                <>
                  <SearchablePicker
                    icon="person-outline"
                    label="Select Commuter"
                    items={commuters}
                    value={commuterId}
                    onChange={setCommuterId}
                    onOpenChange={setPickerOpen}
                    zIndex={3000}
                  />

                  <SearchablePicker
                    icon="location-outline"
                    label="Origin Stop"
                    items={stops}
                    value={originId}
                    onChange={(id) => {
                      console.log('[PAO] Origin picked:', id, stopNameById(id));
                      setOriginId(id);
                      if (destId === id) setDestId(undefined);
                    }}
                    onOpenChange={setPickerOpen}
                    zIndex={2500}
                    listMode={Platform.OS === 'android' ? 'MODAL' : 'FLATLIST'}
                  />

                  <SearchablePicker
                    icon="flag-outline"
                    label="Destination Stop"
                    items={stops}
                    value={destId}
                    onChange={(id) => {
                      console.log('[PAO] Destination picked:', id, stopNameById(id));
                      setDestId(id);
                    }}
                    onOpenChange={setPickerOpen}
                    zIndex={2000}
                    listMode={Platform.OS === 'android' ? 'MODAL' : 'FLATLIST'}
                  />

                  <View style={styles.inputGroup}>
                    <View style={styles.labelContainer}>
                      <Ionicons name="pricetag-outline" size={18} color="#2e7d32" />
                      <Text style={styles.label}>Passenger Type</Text>
                    </View>

                    {(['regular', 'discount'] as const).map(t => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.radioOption, passengerType === t && styles.radioOptionSelected]}
                        onPress={() => setPassengerType(t)}
                      >
                        <Image
                          source={t === 'regular' ? regularImgs[0] : discountImgs[0]}
                          style={styles.radioThumb}
                          resizeMode="cover"
                        />
                        <View style={styles.radioContent}>
                          <Text style={[styles.radioLabel, passengerType === t && styles.radioLabelSelected]}>
                            {t === 'regular' ? 'Regular Fare' : 'Discount Fare'}
                          </Text>
                          <Text style={styles.radioDescription}>
                            {t === 'regular' ? 'Standard pricing' : 'Student / Senior / PWD'}
                          </Text>
                        </View>
                        <Ionicons
                          name={passengerType === t ? 'radio-button-on' : 'radio-button-off'}
                          size={20}
                          color={passengerType === t ? '#2e7d32' : '#ccc'}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>

                  <ActionButton
                    disabled={calculating || markingPaid || !busId || !originId || !destId || commuterId === undefined}
                    onPress={handleCalculate}
                    loading={calculating}
                    icon="calculator-outline"
                    text={calculating ? 'Calculating…' : 'Calculate Fare'}
                  />
                </>
              )}
            </View>

            {/* TICKET */}
            {ticket && (
              <View style={styles.ticketSection}>
                <Text style={styles.ticketSectionTitle}>Your Ticket</Text>
                <View style={styles.ticketCard}>
                  <View style={styles.qrSection}>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={async () => {
                        // manual retry
                        if (!ticket) return;
                        setQrLoading(true);
                        setQrError(false);
                        const first    = bust(primaryQr(ticket));
                        const fallback = bust(ticket.qr_bg_url);
                        if (await prefetch(first)) { setQrUri(first); setQrLoading(false); return; }
                        if (await prefetch(fallback)) { setQrUri(fallback); setQrLoading(false); return; }
                        setQrError(true);
                        setQrLoading(false);
                      }}
                      style={styles.qrContainer}
                    >
                      {qrLoading && !qrError && (
                        <ActivityIndicator style={StyleSheet.absoluteFillObject} color="#2e7d32" />
                      )}

                      {qrError && (
                        <Ionicons
                          name="alert-circle-outline"
                          size={48}
                          color="#f44336"
                          style={[StyleSheet.absoluteFillObject, { alignSelf: 'center', top: '45%' }]}
                        />
                      )}

                      {!!qrUri && !qrError && (
                        <Image
                          key={qrUri}
                          source={{ uri: qrUri }}
                          resizeMode="contain"
                          style={{ width: '100%', height: '100%', borderRadius: 12 }}
                          onError={() => { setQrError(true); setQrLoading(false); }}
                        />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.qrLabel}>Scan QR Code</Text>
                  </View>

                  <View style={styles.ticketDetails}>
                    <View style={styles.ticketHeader}>
                      <Text style={styles.referenceNo}>#{ticket.referenceNo}</Text>
                      <View style={[styles.statusBadge, ticket.paid ? styles.statusPaid : styles.statusPending]}>
                        <Text style={[styles.statusText, ticket.paid ? styles.statusTextPaid : styles.statusTextPending]}>
                          {ticket.paid ? 'PAID' : 'PENDING'}
                        </Text>
                      </View>
                    </View>

                    <RouteInfo labelL="From" valueL={ticket.origin} labelR="To" valueR={ticket.destination} />

                    <View style={styles.fareSection}>
                      <View style={styles.fareInfo}>
                        <Text style={styles.fareLabel}>
                          {ticket.passengerType === 'regular' ? 'Regular Fare' : 'Discount Fare'}
                        </Text>
                        <Text style={styles.fareAmount}>₱{ticket.fare}</Text>
                      </View>
                    </View>

                    <ActionButton
                      styleOverride={[styles.paymentBtn, ticket.paid && styles.paymentBtnPaid]}
                      disabled={ticket.paid || markingPaid}
                      onPress={markAsPaid}
                      loading={markingPaid}
                      icon={ticket.paid ? 'checkmark-circle' : 'card-outline'}
                      text={ticket.paid ? 'Payment Confirmed' : 'Mark as Paid'}
                    />

                    {/* ✅ Post-payment actions */}
                    {ticket.paid && (
                      <View style={styles.postPayRow}>
                        <ActionButton
                          styleOverride={styles.refreshBtn}
                          icon="refresh"
                          text="Refresh Data"
                          onPress={refreshAll}
                        />
                        <ActionButton
                          styleOverride={styles.nextBtn}
                          icon="person-add-outline"
                          text="Next Passenger"
                          onPress={resetForNextPassenger}
                        />
                      </View>
                    )}
                  </View>
                </View>
              </View>
            )}
          </>
        }
      />
    </View>
  );
}

const RouteInfo = React.memo(function RouteInfo({
  labelL,
  valueL,
  labelR,
  valueR,
}: {
  labelL: string;
  valueL: string;
  labelR: string;
  valueR: string;
}) {
  return (
    <View style={styles.routeInfo}>
      <View style={styles.routeItem}>
        <Ionicons name="location" size={16} color="#2e7d32" />
        <View style={styles.routeText}>
          <Text style={styles.routeLabel}>{labelL}</Text>
          <Text style={styles.routeValue}>{valueL}</Text>
        </View>
      </View>
      <View style={styles.routeDivider}>
        <View style={styles.routeLine} />
        <Ionicons name="arrow-forward" size={16} color="#666" />
        <View style={styles.routeLine} />
      </View>
      <View style={styles.routeItem}>
        <Ionicons name="flag" size={16} color="#2e7d32" />
        <View style={styles.routeText}>
          <Text style={styles.routeLabel}>{labelR}</Text>
          <Text style={styles.routeValue}>{valueR}</Text>
        </View>
      </View>
    </View>
  );
});

const ActionButton = React.memo(function ActionButton(props: {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  styleOverride?: StyleProp<ViewStyle>;
}) {
  return (
    <TouchableOpacity
      style={[styles.calculateBtn, props.disabled && styles.calculateBtnDisabled, props.styleOverride]}
      disabled={props.disabled || props.loading}
      onPress={props.onPress}
    >
      {props.loading ? (
        <View style={styles.buttonContent}>
          <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.calculateBtnText}>{props.text}</Text>
        </View>
      ) : (
        <View style={styles.buttonContent}>
          <Ionicons name={props.icon} size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.calculateBtnText}>{props.text}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8faf9',
  },

  radioThumb: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },

  ticketSection: { margin: 20, marginTop: 0 },
  ticketBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: width * 0.9,
    opacity: 0.15,
    borderRadius: 20,
    zIndex: -1,
  },
  scrollContent: {
    paddingBottom: 30,
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

  pickerContainer: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  picker: {
    height: 50,
    color: '#333',
  },
  pickerItem: {
    fontSize: 16,
    color: '#222',
  },
  pickerIcon: {
    position: 'absolute',
    right: 15,
    top: 15,
    pointerEvents: 'none',
  },

  routeArrow: {
    alignItems: 'center',
    marginVertical: -12,
    zIndex: 1,
  },

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
    zIndex: 1,
  },

  qrSection: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8faf9',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  qrContainer: {
    width: 300,
    height: 500,
    padding: 4,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  qrLabel: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

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

  // ⤵️ post-payment actions row
  postPayRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  refreshBtn: {
    flex: 1,
    backgroundColor: '#1976d2',
  },
  nextBtn: {
    flex: 1,
    backgroundColor: '#2e7d32',
  },
});
