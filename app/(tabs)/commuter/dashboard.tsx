// app/commuter/dashboard.tsx

import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useFocusEffect } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const API = 'http://192.168.1.7:5000'
const { width } = Dimensions.get('window')

// Small reusable “dashlet” tile
const Dashlet = ({
  label,
  value,
  icon,
  onPress,
}: {
  label: string
  value: number | string
  icon: React.ReactNode
  onPress: () => void
}) => (
  <TouchableOpacity style={styles.dashlet} activeOpacity={0.8} onPress={onPress}>
    <LinearGradient colors={['#4CAF50', '#2E7D32']} style={styles.dashletBg}>
      {icon}
      <Text style={styles.dashVal}>{value}</Text>
      <Text style={styles.dashLbl}>{label}</Text>
    </LinearGradient>
  </TouchableOpacity>
)

interface DashPayload {
  greeting: string
  user_name: string
  recent_tickets: number
  unread_messages: number
  next_trip: null | { bus: string; start: string; end: string }
}

export default function CommuterDashboard() {
  const insets = useSafeAreaInsets()
  const router = useRouter()

  const [data, setData] = useState<DashPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [greetingText, setGreetingText] = useState('Hello')
  const [userName, setUserName] = useState('Commuter')

  // ────────────────────────────────────────────────────────────────
  // Fetch dashboard payload
  // ────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const token = await AsyncStorage.getItem('@token')
      const res = await fetch(`${API}/commuter/dashboard`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        setData(await res.json())
      }
    } catch (err) {
      console.warn('Failed to load dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // ────────────────────────────────────────────────────────────────
  // Compute greeting & read cached name
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      const [first, last] = await Promise.all([
        AsyncStorage.getItem('@firstName'),
        AsyncStorage.getItem('@lastName'),
      ])
      setUserName([first, last].filter(Boolean).join(' ') || 'Commuter')

      const hr = new Date().getHours()
      setGreetingText(hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening')
    })()
  }, [])

  // ────────────────────────────────────────────────────────────────
  // Initial load
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    load()
  }, [load])

  // ────────────────────────────────────────────────────────────────
  // Reload whenever this screen gains focus
  // ────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load])
  )

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* ── HEADER ───────────────────────────────────────────────── */}
        <LinearGradient
          colors={['#2E7D32', '#1B5E20', '#0D4F12']}
          style={[styles.header, { paddingTop: insets.top + 20 }]}
        >
          <View style={styles.topRow}>
            <View style={styles.profileSection}>
              <LinearGradient
                colors={['#4CAF50', '#66BB6A']}
                style={styles.profileIcon}
              >
                <Ionicons name="person" size={26} color="#fff" />
              </LinearGradient>
              <View style={styles.welcomeText}>
                <Text style={styles.greeting}>{greetingText},</Text>
                <Text style={styles.userType}>{userName}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={async () => {
                await AsyncStorage.clear()
                router.replace('/signin')
              }}
              style={styles.logoutButton}
            >
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.logoutIconBg}
              >
                <MaterialCommunityIcons name="logout" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* ── DASHLETS ──────────────────────────────────────────────── */}
        {loading || !data ? (
          <ActivityIndicator size="large" color="#2E7D32" style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.dashStrip}>
              <Dashlet
                label="Messages"
                value={data.unread_messages}
                onPress={() => router.push('./notifications')}
                icon={<Ionicons name="mail-unread" size={22} color="#fff" />}
              />
              <Dashlet
                label="Tickets"
                value={data.recent_tickets}
                onPress={() => router.push('./my-receipts')}
                icon={<Ionicons name="card" size={22} color="#fff" />}
              />
              <Dashlet
                label="Next Trip"
                value={data.next_trip ? data.next_trip.start : '--:--'}
                onPress={() => router.push('./route-schedules')}
                icon={<MaterialCommunityIcons name="bus-clock" size={22} color="#fff" />}
              />
            </View>

            {/* ── NEXT-TRIP CARD ────────────────────────────────────── */}
            {data.next_trip && (
              <LinearGradient
                colors={['#4CAF50', '#388E3C']}
                style={styles.nextTripBox}
              >
                <Text style={styles.tripBus}>{data.next_trip.bus}</Text>
                <Text style={styles.tripTime}>
                  {data.next_trip.start} – {data.next_trip.end}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push('./route-schedules')}
                  style={styles.seeAllBtn}
                >
                  <Text style={styles.seeAllTxt}>See timetable →</Text>
                </TouchableOpacity>
              </LinearGradient>
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#f8f9fa' },
  header:         { paddingHorizontal: 20, paddingBottom: 40 },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileSection: { flexDirection: 'row', alignItems: 'center' },
  profileIcon:    {
    width: 56, height: 56, borderRadius: 28,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)'
  },
  welcomeText:    { marginLeft: 16 },
  greeting:       { color: '#E8F5E8', fontSize: 15, opacity: 0.9 },
  userType:       { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  logoutButton:   { padding: 6 },
  logoutIconBg:   { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  dashStrip:      { flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, paddingHorizontal: 20 },
  dashlet:        { flex: 1, marginHorizontal: 4 },
  dashletBg:      { borderRadius: 16, padding: 16, alignItems: 'center' },
  dashVal:        { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 8 },
  dashLbl:        { color: '#C8E6C9', fontSize: 12, marginTop: 2 },

  nextTripBox:    { margin: 20, borderRadius: 20, padding: 20 },
  tripBus:        { color: '#fff', fontSize: 18, fontWeight: '700' },
  tripTime:       { color: '#fff', fontSize: 16, marginTop: 4 },
  seeAllBtn:      { marginTop: 12, alignSelf: 'flex-end' },
  seeAllTxt:      { color: '#fff', fontSize: 14, fontWeight: '600' },
})
