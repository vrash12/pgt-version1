// app/AnnouncementNotifier.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import * as Notifications from 'expo-notifications';
import { useRouter, type Href } from 'expo-router';
import * as TaskManager from 'expo-task-manager';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { API_BASE_URL } from './config';

const TASK_NAME = 'ANNOUNCEMENTS_BG_FETCH';

type Announcement = {
  id: number;
  message: string;
  timestamp: string;
  bus_identifier: string;
};

const parseServerDate = (s: string) => {
  if (!s) return new Date();
  const cleaned = s.replace(' ', 'T');
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(cleaned);
  return new Date(hasTZ ? cleaned : `${cleaned}Z`);
};

async function fetchLatestAnnouncements(): Promise<Announcement[]> {
  const token = await AsyncStorage.getItem('@token');
  const ymd = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const res = await fetch(`${API_BASE_URL}/commuter/announcements?date=${ymd}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return [];
  return res.json();
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('announcements', {
    name: 'Announcements',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

async function notifyForAnnouncements(newOnes: Announcement[]) {
  if (!newOnes.length) return;

  const mostRecent = newOnes[0];
  const count = newOnes.length;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: count > 1 ? `🗞️ ${count} new announcements` : '🗞️ New announcement',
      body:
        count > 1
          ? `${mostRecent.bus_identifier}: "${mostRecent.message.slice(0, 80)}"…`
          : `${mostRecent.bus_identifier}: ${mostRecent.message}`,
      data: { deeplink: '/commuter/notifications' },
      ...(Platform.OS === 'android' ? { channelId: 'announcements' } : {}),
    },
    trigger: null,
  });
}

async function handleAnnCheck(): Promise<BackgroundFetch.BackgroundFetchResult> {
  try {
    await ensureAndroidChannel();

    const list = await fetchLatestAnnouncements();
    if (!Array.isArray(list) || list.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const sorted = [...list].sort(
      (a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime()
    );

    const lastSeenStr = await AsyncStorage.getItem('@lastSeenAnnouncementTs');
    const lastSeen = lastSeenStr ? parseInt(lastSeenStr, 10) : 0;

    const newer = sorted.filter(a => parseServerDate(a.timestamp).getTime() > lastSeen);

    if (newer.length) {
      await notifyForAnnouncements(newer);
      const newestTs = parseServerDate(newer[0].timestamp).getTime();
      await AsyncStorage.setItem('@lastSeenAnnouncementTs', String(newestTs));
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

// define at module scope
TaskManager.defineTask(TASK_NAME, async () => {
  return await handleAnnCheck();
});

export default function AnnouncementNotifier() {
  const router = useRouter();

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;

    (async () => {
      // perms
      const perms = await Notifications.getPermissionsAsync();
      if (perms.status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
      await ensureAndroidChannel();

      // foreground poller
      interval = setInterval(() => {
        handleAnnCheck();
      }, 30_000);

      // background fetch registration
      const status = await BackgroundFetch.getStatusAsync();
      const already = await TaskManager.isTaskRegisteredAsync(TASK_NAME);
      if (status === BackgroundFetch.BackgroundFetchStatus.Available && !already) {
        await BackgroundFetch.registerTaskAsync(TASK_NAME, {
          minimumInterval: 15 * 60, // seconds
          stopOnTerminate: false,
          startOnBoot: true,
        });
      }
    })();

    // deep link when tapping a notification
    const sub = Notifications.addNotificationResponseReceivedListener(resp => {
      const dl = resp.notification.request.content.data?.deeplink;
      if (typeof dl === 'string') {
        router.push(dl as Href);
      } else {
        router.push('/commuter/notifications');
      }
    });

    return () => {
      if (interval) clearInterval(interval);
      sub.remove();
    };
  }, [router]);

  return null;
}
