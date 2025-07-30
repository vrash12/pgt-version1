// lib/geofencing.ts
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';

export const GEOFENCE_TASK = 'GEOFENCE_TASK';

// Define only the fields you need
interface GeofencingRegion {
  identifier: string;
  latitude:   number;
  longitude:  number;
  radius:     number;
}

interface RegionPayload {
  eventType: Location.GeofencingEventType;
  region:    GeofencingRegion;
}

TaskManager.defineTask(GEOFENCE_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Geofence task error:', error);
    return;
  }

  const { eventType, region } = data as RegionPayload;

  const verb =
    eventType === Location.GeofencingEventType.Enter ? 'entered'
      : eventType === Location.GeofencingEventType.Exit  ? 'exited'
      : 'moved in/out of';

  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Geofence Trigger',
      body: `Bus ${verb} ${region.identifier}`,
    },
    trigger: null,
  });
});
