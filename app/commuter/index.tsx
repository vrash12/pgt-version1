import { FontAwesome5, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CommuterScreen() {
  const currentTime = new Date().toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Gradient */}
      <LinearGradient colors={['#2C5E1A', '#1E3D12']} style={styles.header}>
        <View style={styles.profileSection}>
          <Ionicons name="person-circle-outline" size={50} color="#fff" />
          <View style={styles.welcomeText}>
            <Text style={styles.greeting}>good morning!</Text>
            <Text style={styles.userType}>Commuter!</Text>
          </View>
        </View>

        {/* PGT Onboard Logo */}
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="bus" size={60} color="#4CAF50" />
          <Text style={styles.logoText}>PGT Onboard</Text>
        </View>

        {/* Announcement Box */}
        <View style={styles.announcementBox}>
          <FontAwesome5 name="bullhorn" size={24} color="#fff" style={styles.iconMargin} />
          <Text style={styles.announcementText}>
            Hindi na po kami dadaong ng Bayan ng Paniqui, diretso Moncada na po kami
          </Text>
          <Text style={styles.timeText}>{currentTime}</Text>
        </View>
      </LinearGradient>

      {/* Menu Options */}
      <View style={styles.menuContainer}>
        <Link href="./route-schedules" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="calendar-outline" size={24} color="#fff" style={styles.iconMargin} />
            <Text style={styles.menuText}>Route Schedules</Text>
          </TouchableOpacity>
        </Link>

        <Link href="./live-locations" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="location-sharp" size={24} color="#fff" style={styles.iconMargin} />
            <Text style={styles.menuText}>Live Locations</Text>
          </TouchableOpacity>
        </Link>

        <Link href="./notifications" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="notifications-outline" size={24} color="#fff" style={styles.iconMargin} />
            <Text style={styles.menuText}>Notifications</Text>
          </TouchableOpacity>
        </Link>

        <Link href="./payment" asChild>
          <TouchableOpacity style={styles.menuItem}>
            <Ionicons name="card-outline" size={24} color="#fff" style={styles.iconMargin} />
            <Text style={styles.menuText}>Payment</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcomeText: {
    marginLeft: 15,
  },
  greeting: {
    color: '#fff',
    fontSize: 16,
  },
  userType: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '500',
    marginTop: 5,
  },
  announcementBox: {
    backgroundColor: '#1E3D12',
    borderRadius: 15,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconMargin: {
    marginRight: 10,
  },
  announcementText: {
    color: '#fff',
    flex: 1,
    fontSize: 14,
  },
  timeText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 10,
  },
  menuContainer: {
    flex: 1,
    padding: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C5E1A',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  menuText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
});
