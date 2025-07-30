// lib/geofencing.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import type { TaskManagerTaskBody } from 'expo-task-manager'; // <-- import the generic type
import * as TaskManager from 'expo-task-manager';

// must match the string you used in startGeofencingAsync(...)
export const GEOFENCE_TASK  = 'GEOFENCE_TASK';
const BACKEND              = 'http://192.168.1.7:5000';
const CACHE_KEY_STATUS     = 'lastBusStatus';

// describe the shape of data we actually get
interface GeofenceRegion {
  identifier: string;
  latitude:   number;
  longitude:  number;
  radius:     number;
}
interface GeofencingEventData {
  eventType: Location.GeofencingEventType;
  region:    GeofenceRegion;
}

TaskManager.defineTask(
  GEOFENCE_TASK,
  async (
    { data, error }: TaskManagerTaskBody<GeofencingEventData>
  ) => {
    if (error) {
      console.error('Geofence error', error);
      return;
    }

    const { eventType, region } = data;
    const countingKey = '@countingActive';

    // ◼️ Entering a terminal region → stop counting and POST a summary
    if (eventType === Location.GeofencingEventType.Enter) {
      await AsyncStorage.setItem(countingKey, '0');

      const startRaw  = await AsyncStorage.getItem('@tripStart');
      const totalsRaw = await AsyncStorage.getItem('@sensorTotals');
      const statusRaw = await AsyncStorage.getItem(CACHE_KEY_STATUS);

      if (startRaw && totalsRaw && statusRaw) {
        const startedAt = Number(startRaw);
        const totals    = JSON.parse(totalsRaw) as { in: number; out: number; total: number };
        const paid      = JSON.parse(statusRaw).paid as number;

        try {
          await fetch(`${BACKEND}/manager/trip-summary`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization:  `Bearer ${await AsyncStorage.getItem('@token')}`,
            },
            body: JSON.stringify({
              route_id:   region.identifier, // or look up your real routeId
              started_at: startedAt,
              ended_at:   Date.now(),
              in:         totals.in,
              out:        totals.out,
              net:        totals.total,
              paid,
            }),
          });
        } catch (e) {
          console.error('Failed to POST trip-summary', e);
        }
      }
    }

    // ▶️ Exiting depot/terminal → begin a new trip
    if (eventType === Location.GeofencingEventType.Exit) {
      await AsyncStorage.multiSet([
        ['@countingActive',  '1'],
        ['@tripStart',       String(Date.now())],
        ['@sensorTotals',    JSON.stringify({ in: 0, out: 0, total: 0 })],
      ]);
    }
  }
);
