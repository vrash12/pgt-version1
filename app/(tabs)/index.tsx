import { Link } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const isWeb = Platform.OS === 'web';
let MapView: typeof import('react-native-maps').default;
let Marker: typeof import('react-native-maps').Marker;
let Polyline: typeof import('react-native-maps').Polyline;
if (!isWeb) {
  const mapMod = require('react-native-maps') as typeof import('react-native-maps');
  MapView = mapMod.default;
  Marker = mapMod.Marker;
  Polyline = mapMod.Polyline;
}

const STARTING_POINT = {
  latitude: 15.667864375592497,
  longitude: 120.58664559633965,
  title: "Starting Point"
};

const DESTINATION_POINT = {
  latitude: 15.477409019290219,
  longitude: 120.59469859814952,
  title: "SM City Tarlac"
};

interface RouteInfo {
  distance: number;
  duration: number;
  coordinates: Array<{
    latitude: number;
    longitude: number;
  }>;
}

export default function LiveLocationScreen() {
  const [startLocation] = useState(STARTING_POINT);
  const [destination] = useState(DESTINATION_POINT);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mapRef = useRef<any>(null);


  const GOOGLE_MAPS_API_KEY = "AIzaSyCsqxf39pjTDNN4r205Kw4cfUsklevfTKI";

  useEffect(() => {
    fetchRouteInfo();
  }, []);

  const decodePolyline = (encoded: string): Array<{ latitude: number; longitude: number }> => {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let shift = 0;
      let result = 0;

      do {
        let b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (result & 0x20);

      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        let b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (result & 0x20);

      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push({
        latitude: lat * 1e-5,
        longitude: lng * 1e-5
      });
    }

    return points;
  };

  const fetchRouteInfo = async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${startLocation.latitude},${startLocation.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0].legs[0];
        const encodedPolyline = data.routes[0].overview_polyline.points;
        const coordinates = decodePolyline(encodedPolyline);

        setRouteInfo({
          distance: route.distance.value / 1000, 
          duration: route.duration.value / 60, 
          coordinates: coordinates
        });

      
        if (mapRef.current && coordinates.length > 0) {
          mapRef.current.fitToCoordinates(coordinates, {
            edgePadding: { top: 70, right: 70, bottom: 70, left: 70 },
            animated: true
          });
        }
      } else {
        throw new Error('No route found');
      }
    } catch (error) {
      setErrorMsg('Error calculating route');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const calculateETA = (durationInMinutes: number) => {
    const currentDate = new Date();
    const etaDate = new Date(currentDate.getTime() + (durationInMinutes * 60 * 1000));
    return etaDate.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  if (isWeb) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Maps are not supported in web mode.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text>Calculating route...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Route Estimation</Text>
      </View>

      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            latitude: (startLocation.latitude + destination.latitude) / 2,
            longitude: (startLocation.longitude + destination.longitude) / 2,
            latitudeDelta: 0.1,
            longitudeDelta: 0.1,
          }}
          mapType="standard"
        >
          {routeInfo && routeInfo.coordinates && (
            <>
              {/* Shadow/border line */}
              <Polyline
                coordinates={routeInfo.coordinates}
                strokeWidth={8}
                strokeColor="rgba(0, 0, 0, 0.5)"
                zIndex={1}
              />
              {/* Main route line */}
              <Polyline
                coordinates={routeInfo.coordinates}
                strokeWidth={6}
                strokeColor="#FF4444"
                zIndex={2}
                lineDashPattern={[1]}
              />
            </>
          )}
          
          {/* Markers on top of the lines */}
          <Marker
            coordinate={startLocation}
            title={startLocation.title}
            pinColor="blue"
            zIndex={3}
          />
          <Marker
            coordinate={destination}
            title={destination.title}
            zIndex={3}
          >
            <Image
              source={require('./images/bus.png')} 
              style={{ width: 32, height: 32 }} 
            />
          </Marker>
        </MapView>

        <View style={styles.locationInfoContainer}>
          <Text style={styles.locationText}>From: {startLocation.title}</Text>
          <Text style={styles.locationText}>To: {destination.title}</Text>
        </View>

        {routeInfo && (
          <View style={styles.estimatedTimeContainer}>
            <Text style={styles.estimatedTimeText}>Estimated Time of Arrival:</Text>
            <Text style={styles.timeText}>
              {calculateETA(routeInfo.duration)} ({Math.round(routeInfo.duration)} mins)
            </Text>
            <Text style={styles.distanceText}>
              Distance: {routeInfo.distance.toFixed(1)} km
            </Text>
          </View>
        )}
      </View>

      <Link href="/signin" asChild>
        <TouchableOpacity style={styles.signInButton}>
          <Text style={styles.signInButtonText}>Sign In</Text>
        </TouchableOpacity>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 16,
    backgroundColor: '#4CAF50',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
    margin: 16,
    borderRadius: 15,
    overflow: 'hidden',
    position: 'relative',
    elevation: 3, 
    shadowColor: '#000', 
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  map: {
    flex: 1,
  },
  locationInfoContainer: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 10,
  },
  locationText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#333',
  },
  estimatedTimeContainer: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.9)',
    padding: 12,
    borderRadius: 20,
    minWidth: 200,
  },
  estimatedTimeText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  timeText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  distanceText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  signInButton: {
    backgroundColor: '#4CAF50',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  signInButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: 'red',
    fontSize: 16,
  },
});