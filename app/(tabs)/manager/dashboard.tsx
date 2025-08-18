/* ------------------------------------------------------------------
 * MANAGER ▸ DASHBOARD  (analytics-first version)
 * Header styled to match the Commuter dashboard (with floating blobs)
 * -----------------------------------------------------------------*/
import {
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import dayjs from "dayjs";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { API_BASE_URL } from "../../config";

/* ─────────────────────────── TYPES ─────────────────────────────── */
type TicketRow = { id: number; paid: boolean; fare: string };
type DailyRow  = { date: string; tickets: number; revenue: number };

/* ─────────────────────────  COMPONENT  ─────────────────────────── */
export default function ManagerDashboard() {
  const router = useRouter();

  /* greeting & live clock */
  const [greeting, setGreeting] = useState("Hello");
  const [name, setName]         = useState("Manager");
  const [clock, setClock]       = useState(dayjs().format("h:mm A"));

  useEffect(() => {
    (async () => {
      const [fn, ln] = await Promise.all([
        AsyncStorage.getItem("@firstName"),
        AsyncStorage.getItem("@lastName"),
      ]);
      setName([fn, ln].filter(Boolean).join(" ") || "Manager");

      const h = new Date().getHours();
      setGreeting(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening");
    })();

    const t = setInterval(() => setClock(dayjs().format("h:mm A")), 30_000);
    return () => clearInterval(t);
  }, []);

  /* KPI state */
  const [activeBuses,  setActiveBuses]  = useState<number | null>(null);
  const [ticketsToday, setTicketsToday] = useState<number | null>(null);
  const [paidToday,    setPaidToday]    = useState<number | null>(null);

  const [revenueToday, setRevenueToday] = useState<number | null>(null);
  const [last7,        setLast7]        = useState<DailyRow[] | null>(null);
  const [loading,      setLoading]      = useState(true);

  /* fetch metrics every 20 s */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function fetchMetrics() {
      try {
        const tok = await AsyncStorage.getItem("@token");
        const hdr: HeadersInit = tok ? { Authorization: `Bearer ${tok}` } : {};

        /* TODAY’S TICKETS */
        const todayIso = dayjs().format("YYYY-MM-DD");
        const tRes = await fetch(`${API_BASE_URL}/manager/tickets?date=${todayIso}`, { headers: hdr });
        if (tRes.ok) {
          const body = await tRes.json();
          const list: TicketRow[] = Array.isArray(body) ? body : body.tickets;
          const paid  = list.filter((t) => t.paid).length;
          const revenue = list.filter((t) => t.paid).reduce((s, t) => s + parseFloat(t.fare), 0);
          setTicketsToday(list.length);
          setPaidToday(paid);
      
          setRevenueToday(revenue);
        }

        /* LAST 7-DAY TREND */
        const fromIso = dayjs().subtract(6, "day").format("YYYY-MM-DD");
        const mRes = await fetch(
          `${API_BASE_URL}/manager/metrics/tickets?from=${fromIso}&to=${todayIso}`,
          { headers: hdr }
        );
        if (mRes.ok) {
          const { daily } = await mRes.json();
          setLast7(daily);
        }

        /* ACTIVE BUSES (from cache) — adjust to your persistence */
        const DEVICES = ["bus-01", "bus-02", "bus-03"];
        let online = 0;
        for (const id of DEVICES)
          if (await AsyncStorage.getItem(`lastBusStatus:${id}`)) online++;
        setActiveBuses(online);
      } catch (err) {
        console.warn("Dashboard metrics error", err);
      } finally {
        setLoading(false);
        timer = setTimeout(fetchMetrics, 20_000);
      }
    }

    fetchMetrics();

    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };
  }, []);

  /* logout helper */
  const logout = () =>
    Alert.alert("Logout", "Confirm?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove(["@token", "@role"]);
          router.replace("/signin");
        },
      },
    ]);

  /* ✨ Animated header bubbles (match Commuter/PAO) */
  const bubble1 = useRef(new Animated.Value(0)).current;
  const bubble2 = useRef(new Animated.Value(0)).current;
  const bubble3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const float = (v: Animated.Value, delay = 0, duration = 7000) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration,       useNativeDriver: true }),
        ])
      ).start();

    float(bubble1, 0,    6500);
    float(bubble2, 2200, 7600);
    float(bubble3, 4000, 8200);
  }, [bubble1, bubble2, bubble3]);

  /* ────────────────────────── UI ─────────────────────────────── */
  return (
    <SafeAreaView style={st.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER (imitates Commuter header) */}
        <LinearGradient colors={["#2E7D32", "#1B5E20", "#0D4F12"]} style={st.header}>
          {/* Animated blobs behind content */}
          <Animated.View
            pointerEvents="none"
            style={[
              st.blob1,
              {
                transform: [
                  { translateY: bubble1.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) },
                  { translateX: bubble1.interpolate({ inputRange: [0, 1], outputRange: [0,  14] }) },
                  { scale:      bubble1.interpolate({ inputRange: [0, .5, 1], outputRange: [1, 1.06, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              st.blob2,
              {
                transform: [
                  { translateY: bubble2.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                  { translateX: bubble2.interpolate({ inputRange: [0, 1], outputRange: [0, -18] }) },
                  { scale:      bubble2.interpolate({ inputRange: [0, .5, 1], outputRange: [1, 1.05, 1] }) },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              st.blob3,
              {
                transform: [
                  { translateY: bubble3.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                  { translateX: bubble3.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }) },
                  { scale:      bubble3.interpolate({ inputRange: [0, .5, 1], outputRange: [1, 1.04, 1] }) },
                ],
              },
            ]}
          />

          <View style={st.topRow}>
            {/* profile bubble + greeting */}
            <View style={st.profileRow}>
              <LinearGradient colors={["#4CAF50", "#66BB6A"]} style={st.avatar}>
                <Ionicons name="person" size={26} color="#fff" />
              </LinearGradient>
              <View style={st.welcome}>
                <Text style={st.greet}>{greeting},</Text>
                <Text style={st.user}>{name}</Text>
              </View>
            </View>

            {/* logout pill */}
            <TouchableOpacity onPress={logout} style={st.logoutBtn} activeOpacity={0.9}>
              <LinearGradient
                colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]}
                style={st.logoutInner}
              >
                <MaterialCommunityIcons name="logout" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* CURVED SHEET */}
        <View style={st.sheet}>
          {/* KPI STRIP */}
          <View style={st.kpiRow}>
            <KpiCard icon="bus"                label="Active"  value={activeBuses} />
            <KpiCard icon="ticket-confirmation" lib="Material" label="Tickets" value={ticketsToday} />
            <KpiCard icon="cash"               label="Paid ₱"  value={revenueToday?.toFixed(2)} />
     
          </View>

          {/* TREND TABLE */}
          <Text style={st.trendTitle}>Last 7 Days</Text>
          {loading && !last7 ? (
            <ActivityIndicator style={{ marginVertical: 30 }} color="#2E7D32" />
          ) : (
            last7 && (
              <View style={st.table}>
                <View style={st.tableRow}>
                  <Text style={[st.th, { flex: 2 }]}>Date</Text>
                  <Text style={st.th}>Tickets</Text>
                  <Text style={st.th}>Revenue</Text>
                </View>
                {last7.map((d) => (
                  <View style={st.tableRow} key={d.date}>
                    <Text style={[st.tdDate, { flex: 2 }]}>{dayjs(d.date).format("MMM D")}</Text>
                    <Text style={st.td}>{d.tickets}</Text>
                    <Text style={st.td}>₱{d.revenue.toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ───────────────────────── SUB-COMPONENTS ───────────────────────── */
function KpiCard({
  icon,
  value,
  label,
  color = "#2E7D32",
  lib,
}: {
  icon: string;
  value: number | string | null | undefined;
  label: string;
  color?: string;
  lib?: "FA5" | "Material";
}) {
  const IconCmp =
    lib === "FA5"
      ? FontAwesome5
      : lib === "Material"
      ? MaterialCommunityIcons
      : Ionicons;
  return (
    <View style={st.kpiCard}>
      <IconCmp name={icon as any} size={22} color={color} />
      <Text style={[st.kpiVal, { color }]}>{value ?? "—"}</Text>
      <Text style={[st.kpiLbl, { color }]}>{label}</Text>
    </View>
  );
}

/* ─────────────────────────── STYLES ─────────────────────────────── */
const st = StyleSheet.create<{
  container:   ViewStyle;
  header:      ViewStyle;
  blob1:       ViewStyle;
  blob2:       ViewStyle;
  blob3:       ViewStyle;
  topRow:      ViewStyle;
  profileRow:  ViewStyle;
  avatar:      ViewStyle;
  welcome:     ViewStyle;
  greet:       TextStyle;
  user:        TextStyle;
  onlineRow:   ViewStyle;
  dot:         ViewStyle;
  onlineTxt:   TextStyle;
  logoutBtn:   ViewStyle;
  logoutInner: ViewStyle;
  sheet:       ViewStyle;
  kpiRow:      ViewStyle;
  kpiCard:     ViewStyle;
  kpiVal:      TextStyle;
  kpiLbl:      TextStyle;
  trendTitle:  TextStyle;
  table:       ViewStyle;
  tableRow:    ViewStyle;
  th:          TextStyle;
  tdDate:      TextStyle;
  td:          TextStyle;
}>({
  container: { flex: 1, backgroundColor: "#f8f9fa" },

  /* header — mirrors Commuter header; allow bubbles to flow inside */
  header: {
    paddingTop: 40,
    paddingBottom: 26,
    paddingHorizontal: 20,
    position: "relative",
    overflow: "hidden",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  // animated blobs (same palette/opacities as other screens)
  blob1: { position: "absolute", width: 120, height: 120, borderRadius: 60, top: -40, right: -30, backgroundColor: "rgba(255,255,255,0.15)" },
  blob2: { position: "absolute", width:  80, height:  80, borderRadius: 40, top:  40, left:  -20, backgroundColor: "rgba(255,255,255,0.10)" },
  blob3: { position: "absolute", width:  50, height:  50, borderRadius: 25, bottom: -10, right:  60, backgroundColor: "rgba(255,255,255,0.08)" },

  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
  },
  welcome: { marginLeft: 16 },
  greet: { color: "#E8F5E8", fontSize: 15, opacity: 0.9 },
  user:  { color: "#fff",   fontSize: 22, fontWeight: "700", marginTop: 2 },

  // (Optional clock row placeholders if you want to add like PAO’s online row later)
  onlineRow: { flexDirection: "row", alignItems: "center", marginTop: 4, display: "none" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF50", marginRight: 6 },
  onlineTxt: { color: "#A5D6A7", fontSize: 12, fontWeight: "500" },

  logoutBtn: { padding: 6 },
  logoutInner: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },

  /* sheet */
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: 12,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 6,
  },

  /* KPI strip */
  kpiRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  kpiCard: {
    flex: 1,
    marginHorizontal: 4,
    backgroundColor: "#E8F5E9",
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
  },
  kpiVal: { fontSize: 18, fontWeight: "700", marginTop: 6 },
  kpiLbl: { fontSize: 12, marginTop: 2 },

  /* trend */
  trendTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2E7D32",
    marginVertical: 14,
  },
  table: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E0E0E0",
    borderRadius: 12,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E0E0E0",
  },
  th: { flex: 1, fontWeight: "700", color: "#2E7D32", fontSize: 13 },
  tdDate: { fontSize: 14, color: "#333" },
  td: { flex: 1, fontSize: 14, color: "#333" },
});
