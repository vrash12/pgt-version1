// app/(tabs)/index.tsx

import Constants from 'expo-constants'
import { Link } from 'expo-router'
import mqtt from 'mqtt'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'

// react-native-maps (only on native)
let MapView: typeof import('react-native-maps').default
let Marker: typeof import('react-native-maps').Marker
if (Platform.OS !== 'web') {
  const mapMod = require('react-native-maps') as typeof import('react-native-maps')
  MapView = mapMod.default
  Marker = mapMod.Marker
}

// Only start geofencing in a dev‐client / standalone build
if (Constants.appOwnership !== 'expo') {
  require('../../lib/geofencing')   // moved outside of `app/`
}

interface BusLocation { latitude: number; longitude: number }

export default function LiveLocationScreen() {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string|null>(null)
  const [connectionStatus, setConnectionStatus] =
    useState<'connecting'|'connected'|'disconnected'>('connecting')
  const [busLocation, setBusLocation] = useState<BusLocation>({ latitude:0, longitude:0 })
  const [busAddress, setBusAddress]     = useState<string|null>(null)
  const mapRef = useRef<any>(null)

  // 1) Setup MQTT
  useEffect(() => {
    const client = mqtt.connect(
      'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt',
      { username:'vanrodolf', password:'Vanrodolf123.', keepalive:30, reconnectPeriod:2000 }
    )
    client.on('connect', () => {
      setConnectionStatus('connected')
      client.subscribe('device/telemetry', err => {
        if (err) {
          setErrorMsg('Failed to subscribe to MQTT')
          setConnectionStatus('disconnected')
        } else {
          setLoading(false)
        }
      })
    })
    client.on('message', (_t,p) => {
      try {
        const msg = JSON.parse(p.toString())
        if (msg.lat != null && msg.lng != null) {
          setBusLocation({ latitude: msg.lat, longitude: msg.lng })
        }
      } catch { console.warn('Invalid MQTT payload') }
    })
    client.on('error', () => {
      setErrorMsg('MQTT connection error')
      setConnectionStatus('disconnected')
      setLoading(false)
    })
    client.on('disconnect', () => setConnectionStatus('disconnected'))
    return () => { client.end(true) }
  }, [])

  // 2) Reverse geocode
  useEffect(() => {
    if (busLocation.latitude === 0 && busLocation.longitude === 0) return
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${
            busLocation.latitude
          },${busLocation.longitude}&key=AIzaSyCsqxf39pjTDNN4r205Kw4cfUsklevfTKI`
        )
        const json = await resp.json()
        if (!cancelled && json.status==='OK' && json.results.length) {
          setBusAddress(json.results[0].formatted_address)
        }
      } catch {
        console.warn('Reverse geocode failed')
      }
    })()
    return () => { cancelled = true }
  }, [busLocation])

  // 3) Render fallbacks
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#2E7D32"/>
        <View style={styles.webNotSupportedContainer}>
          <View style={styles.webNotSupportedCard}>
            <Text style={styles.webNotSupportedTitle}>📱 Mobile Only</Text>
            <Text style={styles.webNotSupportedText}>
              GPS tracking works best on a mobile device.
            </Text>
          </View>
        </View>
      </View>
    )
  }
  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1976D32"/>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1976D32"/>
          <Text style={styles.loadingTitle}>Connecting to GPS…</Text>
        </View>
      </View>
    )
  }
  if (errorMsg) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1976D32"/>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      </View>
    )
  }

  // 4) Main UI
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1976D32"/>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚍 Live GPS Tracker</Text>
        <View style={styles.connIndicator}>
          <View
            style={[
              styles.connDot,
              { backgroundColor:
                  connectionStatus==='connected' ? '#4CAF50' : '#FF5722'
              }
            ]}/>
          <Text style={styles.connText}>
            {connectionStatus==='connected' ? 'Live' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={{
            latitude: busLocation.latitude,
            longitude: busLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}>
          <Marker
            coordinate={busLocation}
            title="Bus Location"
            description="Current position"/>
        </MapView>

        <View style={styles.locationCard}>
          <Text style={styles.locationLabel}>📍 Current Location</Text>
          <Text style={styles.locationText}>
            {busAddress ??
              `Lat: ${busLocation.latitude.toFixed(6)}  Lng: ${
                busLocation.longitude.toFixed(6)
              }`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.centerBtn}
          onPress={() =>
            mapRef.current?.animateToRegion({
              latitude: busLocation.latitude,
              longitude: busLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            })
          }>
          <Text style={styles.centerBtnText}>🎯</Text>
        </TouchableOpacity>
      </View>

      <Link href="/signin" asChild>
        <TouchableOpacity style={styles.signInBtn}>
          <Text style={styles.signInTxt}>Sign In</Text>
        </TouchableOpacity>
      </Link>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F5F5F5' },
  header: {
    flexDirection:'row',
    justifyContent:'space-between',
    alignItems:'center',
    padding:16,
    backgroundColor:'#1976D32',
  },
  headerTitle:{ fontSize:20, color:'#fff', fontWeight:'bold' },
  connIndicator:{ flexDirection:'row', alignItems:'center' },
  connDot: { width:8, height:8, borderRadius:4, marginRight:6 },
  connText:{ color:'#fff', fontSize:12 },

  mapContainer:{ flex:1, margin:16, borderRadius:16, overflow:'hidden' },
  map:{ flex:1 },

  locationCard:{
    position:'absolute', top:16, left:16, right:16,
    backgroundColor:'#fff', padding:12, borderRadius:8,
    elevation:4,
  },
  locationLabel:{ fontWeight:'600', marginBottom:4 },
  locationText:{ color:'#333' },

  centerBtn:{
    position:'absolute', bottom:16, right:16,
    backgroundColor:'#1976D32', width:48, height:48,
    borderRadius:24, justifyContent:'center',
    alignItems:'center', elevation:4,
  },
  centerBtnText:{ fontSize:20, color:'#fff' },

  signInBtn:{
    backgroundColor:'#1976D32', margin:16,
    padding:16, borderRadius:8, alignItems:'center',
  },
  signInTxt:{ color:'#fff', fontWeight:'600' },

  loadingContainer:{ flex:1, justifyContent:'center', alignItems:'center' },
  loadingTitle:{ marginTop:12, fontSize:16 },

  errorContainer:{ flex:1, justifyContent:'center', alignItems:'center', padding:16 },
  errorTitle:{ fontSize:18, fontWeight:'bold', marginBottom:8 },
  errorText:{ textAlign:'center' },

  webNotSupportedContainer:{ flex:1, justifyContent:'center', alignItems:'center' },
  webNotSupportedCard:{ padding:24, backgroundColor:'#fff', borderRadius:12 },
  webNotSupportedTitle:{ fontSize:20, fontWeight:'bold', marginBottom:8 },
  webNotSupportedText:{ textAlign:'center' },
})
