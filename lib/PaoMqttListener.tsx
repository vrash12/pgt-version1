// lib/PaoMqttListener.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import mqtt, { MqttClient } from 'mqtt';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

const MQTT_URL  = 'wss://35010b9ea10d41c0be8ac5e9a700a957.s1.eu.hivemq.cloud:8884/mqtt';
const MQTT_USER = 'vanrodolf';
const MQTT_PASS = 'Vanrodolf123.';

const tPaoUp = (b?: string) => (b ? `pao/${b}/passenger/updates` : 'pao/passenger/updates');
const toTopicId = (raw: string) => {
  if (!raw) return 'bus-01';
  if (raw.startsWith('bus-')) return raw;
  const n = parseInt(raw, 10);
  return isFinite(n) ? `bus-${n.toString().padStart(2, '0')}` : raw;
};

export default function PaoMqttListener() {
  const mqttRef = useRef<MqttClient | null>(null);

  // One-time notification channel / handler
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });

    (async () => {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('pao-alerts', {
          name: 'PAO Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          enableVibrate: true,
          vibrationPattern: [0, 250, 250, 500],
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });
      }

      // Ask permissions up front (optional but recommended)
      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    })();
  }, []);

  // Global MQTT subscription that lives for the whole app session
  useEffect(() => {
    let isMounted = true;
    const client = mqtt.connect(MQTT_URL, {
      username: MQTT_USER,
      password: MQTT_PASS,
      keepalive: 30,
      reconnectPeriod: 2000,
    });
    mqttRef.current = client;

    let scopedTopic = tPaoUp(); // generic
    let busScopedTopic: string | null = null;

    const subscribeFor = (busId: string) => {
      busScopedTopic = tPaoUp(busId);
      client.subscribe([scopedTopic, busScopedTopic], { qos: 1 });
    };

    client.on('connect', async () => {
      if (!isMounted) return;
      const stored = await AsyncStorage.getItem('@assignedBusId');
      const busId = toTopicId(stored || 'bus-01');
      subscribeFor(busId);
    });

    client.on('message', async (topic, raw) => {
      if (!isMounted) return;
      let msg: any;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      // Commuter “request” → show local notification globally
      if (topic === scopedTopic || topic === busScopedTopic) {
        if (msg?.type === 'request') {
          const idTxt = String(msg.id ?? '').padStart(2, '0');
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '🚏 Pickup Request',
              body: `Commuter #${idTxt} is waiting${msg.minutes ? ` (${msg.minutes} min)` : ''}.`,
              sound: 'default',
              ...(Platform.OS === 'android' ? { channelId: 'pao-alerts' } : {}),
            },
            trigger: null,
          });
        }
      }
    });

    return () => {
      isMounted = false;
      client.end(true);
      mqttRef.current = null;
    };
  }, []);

  return null; // no UI
}
