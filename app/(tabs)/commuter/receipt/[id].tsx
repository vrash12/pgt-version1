// app/(tabs)/commuter/receipt/[id].tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { API_BASE_URL } from '../../../config';

type Receipt = {
  id: number;
  referenceNo: string;
  date: string;
  time: string;
  origin: string;
  destination: string;
  passengerType?: 'Regular' | 'Discount';
  commuter?: string;
  fare: string;
  qr?: string;
  qr_url?: string;
  qr_link?: string; // in case your API returns this
  paid: boolean;
};

export default function ReceiptDetail() {
  const { id, data } = useLocalSearchParams<{ id?: string; data?: string }>();
  const [receipt, setReceipt] = React.useState<Receipt | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);

  // Parse once (if present via deeplink)
  const parsed = React.useMemo<Partial<Receipt> | null>(() => {
    try {
      return data ? JSON.parse(decodeURIComponent(data)) : null;
    } catch {
      return null;
    }
  }, [data]);

  React.useEffect(() => {
    // If parsed has enough info, show immediately
    if (parsed?.origin && parsed?.destination) {
      setReceipt(parsed as Receipt);
      setLoading(false);
      return;
    }

    // Otherwise fetch by ID
    (async () => {
      try {
        if (!id) {
          if (parsed) setReceipt(parsed as Receipt);
          setLoading(false);
          return;
        }
        const tok = await AsyncStorage.getItem('@token');
        const headers: Record<string, string> = {};
        if (tok) headers.Authorization = `Bearer ${tok}`;

        const resp = await fetch(`${API_BASE_URL}/commuter/tickets/${id}`, { headers });
        if (!resp.ok) throw new Error(`Server ${resp.status}`);
        const json = (await resp.json()) as Receipt;
        setReceipt(json);
      } catch {
        if (parsed) setReceipt(parsed as Receipt);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, parsed]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#5a7c65" barStyle="light-content" />
        <View style={[styles.background, styles.center]}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={{ color: '#fff', marginTop: 12 }}>Loading receipt…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!receipt) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar backgroundColor="#5a7c65" barStyle="light-content" />
        <View style={[styles.background, styles.center]}>
          <Text style={{ color: '#fff' }}>Receipt not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar backgroundColor="#5a7c65" barStyle="light-content" />
      <View style={styles.background}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator
          bounces
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.receiptCard}>
            <View style={styles.header}>
              <Text style={styles.headerLabel}>Reference No.</Text>
              <Text style={styles.headerValue}>{receipt.referenceNo}</Text>
            </View>

            <View style={styles.perforatedDivider}>
              <View style={styles.perforationLeft} />
              <View style={styles.dottedLine} />
              <View style={styles.perforationRight} />
            </View>

            <View style={styles.content}>
              <View style={styles.detailRow}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Date</Text>
                  <Text style={styles.detailValue}>{receipt.date || '—'}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>{receipt.time || '—'}</Text>
                </View>
              </View>

              <View style={styles.detailRow}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Origin</Text>
                  <Text style={styles.detailValue}>{receipt.origin || '—'}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>Destination</Text>
                  <Text style={styles.detailValue}>{receipt.destination || '—'}</Text>
                </View>
              </View>

              <View style={styles.detailBlock}>
                <Text style={styles.detailLabel}>Type of Commuter</Text>
                <Text style={styles.detailValue}>{receipt.passengerType ?? '—'}</Text>
              </View>

              <View style={[styles.detailBlock, styles.commuterRow]}>
                <View style={styles.commuterInfo}>
                  <Text style={styles.detailLabel}>Commuter</Text>
                  <Text style={styles.detailValue}>{receipt.commuter ?? '—'}</Text>
                </View>
                <View style={styles.iconContainer}>
                  <Ionicons name="person-circle" size={36} color="#5a7c65" />
                </View>
              </View>

              <View style={styles.thinDivider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Amount Sent</Text>
                <Text style={styles.totalValue}>PHP {receipt.fare}</Text>
              </View>

              <View style={styles.qrSection}>
                <View style={styles.qrContainer}>
                  {(() => {
                    const qrValue = (receipt as any).qr_link ?? receipt.qr ?? '';
                    if (qrValue) {
                      return (
                        <QRCode
                          value={qrValue}
                          size={120}
                          backgroundColor="white"
                          color="#2d5016"
                        />
                      );
                    }
                    if (receipt.qr_url) {
                      return (
                        <Image
                          source={{ uri: receipt.qr_url }}
                          style={styles.qrImage}
                          resizeMode="contain"
                        />
                      );
                    }
                    return (
                      <View style={styles.qrPlaceholder}>
                        <Ionicons name="qr-code" size={60} color="#a8b5a1" />
                      </View>
                    );
                  })()}
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

/* ── styles ───────────────────────────────────────────── */
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#5a7c65' },
  background: { flex: 1, backgroundColor: '#5a7c65' },
  center: { alignItems: 'center', justifyContent: 'center' },

  // Moved padding here so scrolling always works
  scrollContainer: {
    paddingHorizontal: 20,
    paddingVertical: 30,
    paddingBottom: 40, // extra space at bottom
  },

  receiptCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    overflow: 'hidden',
  },

  /* header */
  header: {
    backgroundColor: '#f8faf9',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerLabel: {
    fontSize: 11,
    color: '#6b7c6b',
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  headerValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2d5016',
    letterSpacing: -0.5,
  },

  /* perforated divider */
  perforatedDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    height: 20,
  },
  perforationLeft: {
    width: 20,
    height: 20,
    backgroundColor: '#5a7c65',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    marginLeft: -10,
  },
  dottedLine: {
    flex: 1,
    borderTopWidth: 1.5,
    borderStyle: 'dotted',
    borderColor: '#c4d1c4',
    marginHorizontal: 8,
  },
  perforationRight: {
    width: 20,
    height: 20,
    backgroundColor: '#5a7c65',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    marginRight: -10,
  },

  /* content */
  content: { paddingHorizontal: 24, paddingVertical: 24 },
  detailRow: { flexDirection: 'row', marginBottom: 20, gap: 16 },
  detailCol: { flex: 1 },
  detailBlock: { marginBottom: 20 },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7c6b',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  detailValue: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', lineHeight: 20 },

  commuterRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  commuterInfo: { flex: 1 },
  iconContainer: { backgroundColor: '#f0f4f0', borderRadius: 20, padding: 8, marginLeft: 12 },

  thinDivider: { borderTopWidth: 1, borderColor: '#e8ede8', marginVertical: 16 },

  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  totalLabel: { fontSize: 14, fontWeight: '600', color: '#6b7c6b' },
  totalValue: { fontSize: 22, fontWeight: '900', color: '#2d5016', letterSpacing: -0.5 },

  /* QR code */
  qrSection: { alignItems: 'center', marginTop: 24 },
  qrContainer: {
    backgroundColor: '#f8faf9',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#5a7c65',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrImage: { width: 120, height: 120, borderRadius: 8 },
  qrPlaceholder: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f0',
    borderRadius: 8,
  },
});
