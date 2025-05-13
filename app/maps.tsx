import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Button, Platform, StyleSheet, Text, View } from 'react-native';
import type MapViewType from 'react-native-maps';

// Only import MapView and Marker on native platforms
const isWeb = Platform.OS === 'web';
let MapView: typeof import('react-native-maps').default;
let Marker: typeof import('react-native-maps').Marker;
if (!isWeb) {
  const mapMod = require('react-native-maps') as typeof import('react-native-maps');
  MapView = mapMod.default;
  Marker = mapMod.Marker;
}

export default function MapAPITestScreen() {
  const [location, setLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // Typing the ref to the MapView instance
  const mapRef = useRef<MapViewType | null>(null);

  useEffect(() => {
    (async () => {
      if (isWeb) return;
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  if (isWeb) {
    return (
      <View style={styles.center}>
        <Text style={styles.webNotice}>Maps are not supported in web mode.</Text>
        <Text>Please run this screen on a physical device or emulator (iOS/Android).</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text>{errorMsg}</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Fetching your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        onMapReady={() => setMapLoaded(true)}
      >
        <Marker
          coordinate={{ latitude: location.latitude, longitude: location.longitude }}
          title="You are here"
        />
      </MapView>
      <View style={styles.footer}>
        <Text style={styles.status}>{mapLoaded ? '✅ Map Loaded Successfully!' : 'Loading map...'}</Text>
        <Button
          title="Recenter"
          onPress={() => {
            if (location && mapRef.current) {
              mapRef.current.animateToRegion({
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              });
            } else {
              Alert.alert('Location not available');
            }
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  webNotice: { fontWeight: 'bold', marginBottom: 10 },
  footer: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 8, padding: 10,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  status: { fontWeight: 'bold' },
});
