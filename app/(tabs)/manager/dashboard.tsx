/* ------------------------------------------------------------------
 * MANAGER ▸ DASHBOARD  (analytics-first version)
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
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { API_BASE_URL } from "../../config";
const { width } = Dimensions.get("window");

/* ─────────────────────────── HELPERS ───────────────────────────── */
const blob = (
  w: number,
  op: number,
  top?: number,
  left?: number,
  bottom?: number,
  right?: number
): ViewStyle => ({
  position: "absolute",
  width: w,
  height: w,
  borderRadius: w / 2,
  backgroundColor: `rgba(255,255,255,${op})`,
  top,
  left,
  bottom,
  right,
});

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
  const [unpaidToday,  setUnpaidToday]  = useState<number | null>(null);
  const [revenueToday, setRevenueToday] = useState<number | null>(null);
  const [last7,        setLast7]        = useState<DailyRow[] | null>(null);
  const [loading,      setLoading]      = useState(true);

  /* fetch metrics every 20 s */
  useEffect(() => {
    let timer: NodeJS.Timeout;

    async function fetchMetrics() {
      try {
        const tok = await AsyncStorage.getItem("@token");
        const hdr = { Authorization: `Bearer ${tok}` };

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
          setUnpaidToday(list.length - paid);
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

        /* ACTIVE BUSES (from cache) */
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
    return () => clearTimeout(timer);
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

  /* ────────────────────────── UI ─────────────────────────────── */
  return (
    <SafeAreaView style={st.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <LinearGradient colors={["#2E7D32", "#1B5E20", "#0D4F12"]} style={st.header}>
          <View style={blob(200, 0.04, -50, -50)} />
          <View style={blob(150, 0.05, undefined, undefined, -40, -40)} />
          <View style={blob(100, 0.07, 80, width * 0.7)} />

          <View style={st.topRow}>
            {/* user bubble */}
            <View style={st.profileRow}>
              <LinearGradient colors={["#4CAF50", "#66BB6A"]} style={st.avatar}>
                <Ionicons name="person" size={26} color="#fff" />
              </LinearGradient>
              <View style={st.welcome}>
                <Text style={st.greet}>{greeting},</Text>
                <Text style={st.user}>{name}</Text>
                <View style={st.onlineRow}>
                  <View style={st.dot} />
                  <Text style={st.onlineTxt}>{clock}</Text>
                </View>
              </View>
            </View>

            {/* logout */}
            <TouchableOpacity onPress={logout} style={st.logoutBtn}>
              <LinearGradient
                colors={["rgba(255,255,255,0.2)", "rgba(255,255,255,0.1)"]}
                style={st.logoutInner}
              >
                <MaterialCommunityIcons name="logout-variant" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* CURVED SHEET */}
        <View style={st.sheet}>
          {/* KPI STRIP */}
          <View style={st.kpiRow}>
            <KpiCard icon="bus"                label="Active" value={activeBuses} />
            <KpiCard icon="ticket-confirmation" lib="Material" label="Tickets" value={ticketsToday} />
            <KpiCard icon="cash"               label="Paid ₱" value={revenueToday?.toFixed(2)} />
            <KpiCard
              icon="exclamation-circle"
              lib="FA5"
              color="#C62828"
              label="Unpaid"
              value={unpaidToday}
            />
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
                    <Text style={[st.tdDate, { flex: 2 }]}>
                      {dayjs(d.date).format("MMM D")}
                    </Text>
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

  /* header */
  header: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    overflow: "hidden",
  },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  profileRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  welcome: { marginLeft: 16 },
  greet: { color: "#E8F5E8", fontSize: 15, opacity: 0.9 },
  user: { color: "#fff", fontSize: 22, fontWeight: "700" },
  onlineRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4CAF50", marginRight: 6 },
  onlineTxt: { color: "#A5D6A7", fontSize: 12, fontWeight: "500" },
  logoutBtn: { borderRadius: 22, overflow: "hidden" },
  logoutInner: { padding: 12, borderRadius: 22 },

  /* sheet */
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -20,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 30,
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
