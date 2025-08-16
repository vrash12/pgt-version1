// app/(tabs)/commuter/scanqr.tsx
import { Ionicons } from '@expo/vector-icons';
import {
    CameraView,
    useCameraPermissions,
    type BarcodeScanningResult,
} from 'expo-camera';
import * as Haptics from 'expo-haptics';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Dimensions,
    Easing,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const COLORS = {
  bg: '#0b0b0c',
  backdrop: 'rgba(0,0,0,0.55)',
  primary: '#8B0000',
  accent: '#FF6B35',
  success: '#2E7D32',
  text: '#F6F7F9',
  sub: '#A8ADB7',
  line: '#28a745',
  frame: '#ffffff',
};

type TicketPayload = {
  ticketId?: number | string;
  id?: number | string;
  gcash_url?: string;
  gcash?: string;
  payment_url?: string;
  deeplink?: string;
  payment?: { deeplink?: string; url?: string };
  qr_link?: string;
};

export default function ScanQRScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // ---- camera permission (expo-camera) ----
  const [permission, requestPermission] = useCameraPermissions();

  // ---- scanning state ----
  const [scanned, setScanned] = useState(false);
  const [hint, setHint] = useState('Align the QR within the frame');

  // ---- animated scan line ----
  const scanAnim = useRef(new Animated.Value(0)).current;
  const startScanAnimation = useCallback(() => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.timing(scanAnim, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    ).start();
  }, [scanAnim]);

  useEffect(() => {
    if (permission?.granted) startScanAnimation();
  }, [permission?.granted, startScanAnimation]);

  // ---- helpers ----
  const resetScan = useCallback(() => {
    setScanned(false);
    setHint('Align the QR within the frame');
  }, []);

  const vibrate = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  };

  const openURL = async (url: string) => {
    try {
      if (url.startsWith('gcash://')) {
        const can = await Linking.canOpenURL(url);
        if (can) return Linking.openURL(url);
        setHint('GCash not installed. Opening web checkout…');
        // fall through to try opening anyway (may route to browser)
      }
      return Linking.openURL(url);
    } catch {
      Alert.alert('Open Link Failed', 'Unable to open the link from this QR.');
    }
  };

  const routeToTicket = (idLike?: number | string) => {
    if (idLike == null) return false;
    const id = String(idLike).replace(/[^\d]/g, '');
    if (!id) return false;
    router.push(`/commuter/receipt/${id}`);
    return true;
  };

  const handlePayload = async (raw: string) => {
    // B1) app deeplink to GCash
    if (raw.startsWith('gcash://')) {
      await vibrate();
      await openURL(raw);
      return;
    }
    // B2) web checkout/fallback
    if (/^https?:\/\//i.test(raw)) {
      await vibrate();
      await openURL(raw);
      return;
    }
    // B3) JSON payload (ticket QR)
    if (raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
      try {
        const p: TicketPayload = JSON.parse(raw);
        const deeplink =
          p.gcash_url ||
          p.gcash ||
          p.deeplink ||
          p.payment?.deeplink ||
          p.payment_url ||
          p.payment?.url ||
          p.qr_link;

        if (deeplink && (deeplink.startsWith('gcash://') || /^https?:\/\//i.test(deeplink))) {
          await vibrate();
          await openURL(deeplink);
          return;
        }

        if (routeToTicket(p.ticketId ?? p.id)) {
          await vibrate();
          return;
        }

        Alert.alert('Ticket Scanned', 'QR recognized but missing payment link or ticket id.');
      } catch {
        Alert.alert('Invalid QR', 'This QR payload is not recognized.');
      }
      return;
    }

    // B4) last resort: try an ID suffix like ".../123"
    const idMatch = raw.match(/(\d{1,10})$/);
    if (idMatch && routeToTicket(idMatch[1])) {
      await vibrate();
      return;
    }

    Alert.alert('Unrecognized QR', 'This code is neither a payment link nor a ticket payload.');
  };

  const onScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);
      setHint('Processing…');
      try {
        await handlePayload(result.data);
      } finally {
        setHint('Done. You can scan another code.');
      }
    },
    [scanned]
  );

  // ---- scanning frame positions ----
  const frameSize = useMemo(() => Math.min(width * 0.78, 320), []);
  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-frameSize / 2 + 8, frameSize / 2 - 8],
  });

  // ---- UI ----
  if (!permission) {
    // permission object not loaded yet
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: COLORS.bg }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={styles.bootText}>Preparing camera…</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center, { backgroundColor: COLORS.bg, padding: 24 }]}>
        <Ionicons name="camera" size={52} color={COLORS.sub} />
        <Text style={[styles.title, { marginTop: 12 }]}>Camera permission needed</Text>
        <Text style={styles.sub}>Allow camera access to scan tickets or payment QR codes.</Text>
        <TouchableOpacity
          style={[styles.btn, { marginTop: 18 }]}
          onPress={async () => {
            const res = await requestPermission();
            if (res.granted) startScanAnimation();
          }}
        >
          <Ionicons name="key-outline" size={18} color="#fff" />
          <Text style={styles.btnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.btnGhost]} onPress={() => Linking.openSettings()}>
          <Ionicons name="settings-outline" size={18} color={COLORS.sub} />
          <Text style={[styles.btnText, { color: COLORS.sub }]}>Open Settings</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: COLORS.bg }]}>
      <StatusBar barStyle="light-content" />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="scan" size={18} color="#fff" />
          <Text style={styles.headerTitle}>Scan QR</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Camera / Scanner */}
      <View style={styles.cameraWrap}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : onScanned}
        />

        {/* Dimmed overlay with cutout */}
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.overlayRow}>
            <View style={styles.overlayBlock} />
            <View style={[styles.cutout, { width: frameSize, height: frameSize }]} />
            <View style={styles.overlayBlock} />
          </View>
          <View style={styles.overlayRow}>
            <View style={styles.overlayBlock} />
            <View style={[styles.overlayBlock, { flex: 0 }]} />
            <View style={styles.overlayBlock} />
          </View>

          {/* frame corners */}
          <View
            style={[
              styles.corner,
              { top: '50%', left: '50%', transform: [{ translateX: -frameSize / 2 }, { translateY: -frameSize / 2 }] },
            ]}
          >
            <View style={[styles.cornerLine, styles.cornerTL]} />
            <View style={[styles.cornerLine, styles.cornerTR]} />
            <View style={[styles.cornerLine, styles.cornerBL]} />
            <View style={[styles.cornerLine, styles.cornerBR]} />

            {/* animated scan line */}
            {!scanned && (
              <Animated.View
                style={[
                  styles.scanLine,
                  {
                    width: frameSize - 24,
                    transform: [{ translateY: scanLineTranslateY }],
                  },
                ]}
              />
            )}
          </View>
        </View>
      </View>

      {/* Bottom sheet */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={styles.hintText}>{hint}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, scanned ? {} : { opacity: 0.6 }]} disabled={!scanned} onPress={resetScan}>
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.btnText}>Scan Again</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnGhost} onPress={() => router.push('/commuter/my-receipts')}>
            <Ionicons name="reader-outline" size={18} color={COLORS.sub} />
            <Text style={[styles.btnText, { color: COLORS.sub }]}>My Receipts</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/* ---------------- styles ---------------- */
const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },

  header: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.2,
  },

  cameraWrap: {
    flex: 1,
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    marginTop: 12,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayRow: { flexDirection: 'row', width: '100%', flex: 1 },
  overlayBlock: { flex: 1, backgroundColor: COLORS.backdrop },
  cutout: {
    backgroundColor: 'transparent',
  },

  corner: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  cornerLine: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: COLORS.frame,
    borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 10 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 10 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 10 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 10 },

  scanLine: {
    position: 'absolute',
    left: 12,
    right: 12,
    height: 2,
    backgroundColor: COLORS.line,
    borderRadius: 2,
    shadowColor: COLORS.line,
    shadowOpacity: 0.6,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },

  bottom: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#0d0e10',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  hintText: {
    textAlign: 'center',
    color: COLORS.text,
    opacity: 0.92,
    fontSize: 14,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  title: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  sub: { color: COLORS.sub, fontSize: 14, textAlign: 'center', marginTop: 8 },
  bootText: { color: COLORS.sub, marginTop: 12 },
});
