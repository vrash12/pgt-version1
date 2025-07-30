// app/(tabs)/commuter/dashboard.tsx

import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { LinearGradient } from 'expo-linear-gradient'
import { Link, useRouter } from 'expo-router'
import React, { useEffect, useState } from 'react'
import { Alert, Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
interface Announcement { id: number; message: string; timestamp: string }

const API = 'http://192.168.1.7:5000'
const { width } = Dimensions.get('window')

export default function CommuterDashboard() {
  const insets = useSafeAreaInsets();  
  const router = useRouter()
  const [greetingText, setGreetingText] = useState<string>('Hello');
  const [userName, setUserName] = useState<string>('');
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const currentTime = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  useEffect(() => {
    const checkAuth = async () => {
      const token = await AsyncStorage.getItem('@token')
      console.log('🔑 cached token?', !!token)
      if (!token) {
        router.replace('/signin')
        return
      }

      try {
        const res = await fetch(`${API}/auth/verify-token`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        if (res.status === 401 || res.status === 403) {
          throw new Error('invalid')
        }
        console.log('✅ token verified with server')
      } catch (err) {
        if ((err as Error).message === 'invalid') {
          await AsyncStorage.multiRemove(['@token', '@role'])
          router.replace('/signin')
        } else {
          console.warn('⚠️ verify-token request failed; working offline')
        }
      }
    }
    checkAuth();

    (async () => {
      try {
        const token = await AsyncStorage.getItem('@token')
        const res = await fetch(`${API}/commuter/announcements`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const list = await res.json() as Announcement[]
          setAnnouncements(list)
        }
      } catch (e) {
        console.warn('Failed to load announcements', e)
      }
    })();

    (async () => {
      const [first, last] = await Promise.all([
        AsyncStorage.getItem('@firstName'),
        AsyncStorage.getItem('@lastName'),
      ]);
      const name = [first, last].filter(Boolean).join(' ');
      setUserName(name || 'Commuter');

      const hour = new Date().getHours();
      if (hour < 12) setGreetingText('Good morning');
      else if (hour < 18) setGreetingText('Good afternoon');
      else setGreetingText('Good evening');
    })();

  }, [])

  const handleLogout = () => {
 Alert.alert('Logout', 'Are you sure?', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Log Out',
      style: 'destructive',
   onPress: async () => {
  // 1) wipe every key
  await AsyncStorage.clear();

  // 2) dump what’s left
  const allKeys = await AsyncStorage.getAllKeys();
  console.log('[Logout] all keys after clear →', allKeys);
  const token   = await AsyncStorage.getItem('@token');
  console.log('[Logout] @token after clear →', token);

  // 3) finally nav to Signin
  router.replace('/signin');
},

    },
  ])
  }

  const menuItems = [
    {
      title: 'Route Schedules',
      icon: 'bus-clock',
      iconType: 'MaterialCommunityIcons',
      color: '#FF6B6B',
      bgColor: '#FFE5E5',
      href: './route-schedules'
    },
    {
      title: 'Live Locations',
      icon: 'location',
      iconType: 'Ionicons',
      color: '#4ECDC4',
      bgColor: '#E0F7F4',
      href: './live-locations'
    },
    {
      title: 'Notifications',
      icon: 'megaphone',
      iconType: 'Ionicons',
      color: '#45B7D1',
      bgColor: '#E3F2FD',
      href: './notifications'
    },
    {
      title: 'Payment',
      icon: 'dollar-sign',
      iconType: 'FontAwesome5',
      color: '#F39C12',
      bgColor: '#FFF3E0',
      href: './my-receipts'
    }
  ]

  return (
    <SafeAreaView style={styles.container}>

     <ScrollView
       showsVerticalScrollIndicator={false}
       contentContainerStyle={{
         paddingBottom: 80 + insets.bottom   // 56-px bar + a bit of air
       }}
     >
        {/* ENHANCED HEADER */}
        <LinearGradient colors={['#2E7D32', '#1B5E20', '#0D4F12']} style={styles.header}>
          {/* Decorative Background Elements */}
          <View style={styles.backgroundCircle1} />
          <View style={styles.backgroundCircle2} />
          <View style={styles.backgroundCircle3} />
          
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
                <View style={styles.statusDot}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.statusText}>Online</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <LinearGradient
                colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                style={styles.logoutButtonInner}
              >
                <MaterialCommunityIcons name="logout-variant" size={24} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* CURVED WHITE SECTION */}
        <View style={styles.curvedSection}>
          {/* Enhanced Logo */}
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#4CAF50', '#66BB6A']}
              style={styles.logoIconContainer}
            >
              <MaterialCommunityIcons name="bus" size={32} color="#fff" />
              <View style={styles.locationPinBadge}>
                <Ionicons name="location" size={16} color="#fff" />
              </View>
            </LinearGradient>
            <Text style={styles.logoText}>PGT Onboard</Text>
            <Text style={styles.logoSubtext}>Your Smart Transit Companion</Text>
          </View>

          {/* Enhanced Announcement Box */}
          <LinearGradient
            colors={['#2E7D32', '#388E3C']}
            style={styles.announcementBox}
          >
            <View style={styles.announcementHeader}>
              <View style={styles.announcementIconContainer}>
                <FontAwesome5 name="bullhorn" size={18} color="#4CAF50" />
              </View>
              <Text style={styles.announcementTitle}>Latest Update</Text>
            </View>
            
            <View style={styles.announcementContent}>
              {announcements.length > 0 ? (
                <Text style={styles.announcementText}>
                  {announcements[0].message}
                </Text>
              ) : (
                <Text style={styles.announcementText}>
                  No announcements at this time. Have a safe journey!
                </Text>
              )}
              <View style={styles.timeContainer}>
                <Ionicons name="time-outline" size={14} color="#A5D6A7" />
                <Text style={styles.timeText}>{currentTime}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ENHANCED MENU */}
        <View style={styles.menuContainer}>
          <Text style={styles.menuTitle}>Quick Actions</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <Link key={index} href={item.href} asChild>
                <TouchableOpacity style={styles.menuItem}>
                  <LinearGradient
                    colors={['#ffffff', '#f8f9fa']}
                    style={styles.menuItemInner}
                  >
                    <View style={[styles.menuIconContainer, { backgroundColor: item.bgColor }]}>
                      {item.iconType === 'MaterialCommunityIcons' && (
                        <MaterialCommunityIcons name={item.icon as any} size={24} color={item.color} />
                      )}
                      {item.iconType === 'Ionicons' && (
                        <Ionicons name={item.icon as any} size={24} color={item.color} />
                      )}
                      {item.iconType === 'FontAwesome5' && (
                        <FontAwesome5 name={item.icon as any} size={20} color={item.color} />
                      )}
                    </View>
                    <Text style={styles.menuText}>{item.title}</Text>
                    <Ionicons name="chevron-forward" size={18} color="#C8E6C9" />
                  </LinearGradient>
                </TouchableOpacity>
              </Link>
            ))}
          </View>

        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 40,
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundCircle1: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -50,
    right: -50,
  },
  backgroundCircle2: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.03)',
    bottom: -30,
    left: -30,
  },
  backgroundCircle3: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: 100,
    left: width * 0.7,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 10,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  welcomeText: {
    marginLeft: 16,
  },
  greeting: {
    color: '#E8F5E8',
    fontSize: 15,
    fontWeight: '400',
    opacity: 0.9,
  },
  userType: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 2,
  },
  statusDot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 6,
  },
  statusText: {
    color: '#A5D6A7',
    fontSize: 12,
    fontWeight: '500',
  },
  logoutButton: {
    borderRadius: 22,
    overflow: 'hidden',
    elevation: 2,
  },
  logoutButtonInner: {
    padding: 12,
    borderRadius: 22,
  },
  curvedSection: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 32,
    paddingHorizontal: 20,
    paddingBottom: 20,
    marginTop: -20,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    elevation: 4,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  locationPinBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF5722',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  logoText: {
    color: '#2E7D32',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },
  logoSubtext: {
    color: '#81C784',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  announcementBox: {
    borderRadius: 20,
    padding: 20,
    elevation: 4,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  announcementIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  announcementTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  announcementContent: {
    paddingLeft: 4,
  },
  announcementText: {
    color: '#E8F5E8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
    fontWeight: '400',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: '#A5D6A7',
    fontSize: 12,
    marginLeft: 6,
    fontWeight: '500',
  },
  menuContainer: {
    padding: 20,
  },
  menuTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 16,
  },
  menuGrid: {
    gap: 12,
  },
  menuItem: {
    borderRadius: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  menuItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },
  menuIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  menuText: {
    flex: 1,
    color: '#2E7D32',
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    marginTop: 24,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
    marginBottom: 16,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    marginHorizontal: 4,
  },
  statBox: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#C8E6C9',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E7D32',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#66BB6A',
    fontWeight: '500',
    marginTop: 4,
  },
})