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

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────
type Announcement = {
  id: number;
  message: string;
  timestamp: string;
  bus_identifier: string;
};

type Receipt = {
  id: number;
  referenceNo?: string;
  fare?: string;
  paid: boolean;
};

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────
const parseServerDate = (s: string) => {
  if (!s) return new Date();
  const cleaned = s.replace(' ', 'T');
  const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(cleaned);
  return new Date(hasTZ ? cleaned : `${cleaned}Z`);
};

// Announcements API
async function fetchLatestAnnouncements(): Promise<Announcement[]> {
  const token = await AsyncStorage.getItem('@token');
  const ymd = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  const res = await fetch(`${API_BASE_URL}/commuter/announcements?date=${ymd}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return [];
  return res.json();
}

// Receipts API (first page is plenty to detect recent changes)
async function fetchRecentReceipts(): Promise<Receipt[]> {
  const token = await AsyncStorage.getItem('@token');
  const params = new URLSearchParams();
  params.append('light', '1');
  params.append('page', '1');
  params.append('page_size', '10');

  const res = await fetch(`${API_BASE_URL}/commuter/tickets/mine?${params}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!res.ok) return [];

  const json = await res.json();
  // Normalize both shapes: PagedResp and array
  const items: Receipt[] = Array.isArray(json) ? json : json?.items ?? [];
  // Ensure fields exist
  return items.map((r: any) => ({
    id: Number(r.id),
    referenceNo: r.referenceNo ?? r.reference_no ?? undefined,
    fare: (r.fare ?? r.amount ?? '') as string,
    paid: !!r.paid,
  }));
}

// Android channels
async function ensureAndroidChannels() {
  if (Platform.OS !== 'android') return;
  // Announcements
  await Notifications.setNotificationChannelAsync('announcements', {
    name: 'Announcements',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 250, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
  // Payments
  await Notifications.setNotificationChannelAsync('payments', {
    name: 'Payments',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    enableVibrate: true,
    vibrationPattern: [0, 150, 150, 250],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

// ─────────────────────────────────────────────────────────
// Announcement check (existing)
// ─────────────────────────────────────────────────────────
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
    const list = await fetchLatestAnnouncements();
    if (!Array.isArray(list) || list.length === 0) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const sorted = [...list].sort(
      (a, b) => parseServerDate(b.timestamp).getTime() - parseServerDate(a.timestamp).getTime()
    );

    const lastSeenStr = await AsyncStorage.getItem('@lastSeenAnnouncementTs');
    // store milliseconds in this key (see _layout fix)
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

// ─────────────────────────────────────────────────────────
// NEW: Payment confirmation check
// ─────────────────────────────────────────────────────────
const SEEN_PAID_KEY = '@seenPaidReceiptIds';

async function loadSeenPaid(): Promise<Set<number>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_PAID_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

async function saveSeenPaid(set: Set<number>) {
  const arr = Array.from(set).slice(-50); // keep it small
  await AsyncStorage.setItem(SEEN_PAID_KEY, JSON.stringify(arr));
}

async function notifyPaidTickets(newlyPaid: Receipt[]) {
  if (!newlyPaid.length) return;

  // Most recent first (or any order you prefer)
  const one = newlyPaid[0];
  const title = newlyPaid.length > 1 ? `✅ ${newlyPaid.length} payments confirmed` : '✅ Payment confirmed';
  const body =
    newlyPaid.length > 1
      ? `Latest: #${one.referenceNo ?? one.id} • ₱${one.fare ?? ''}`
      : `Ticket #${one.referenceNo ?? one.id} is now PAID • ₱${one.fare ?? ''}`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // Deep-link straight to the receipt if single, else to the list
      data: {
        deeplink:
          newlyPaid.length === 1
            ? `/commuter/receipt/${one.id}`
            : '/commuter/my-receipts',
      },
      ...(Platform.OS === 'android' ? { channelId: 'payments' } : {}),
    },
    trigger: null,
  });
}

async function handlePaidCheck(): Promise<BackgroundFetch.BackgroundFetchResult> {
  try {
    const receipts = await fetchRecentReceipts();
    if (!receipts.length) return BackgroundFetch.BackgroundFetchResult.NoData;

    const seen = await loadSeenPaid();
    const paidNow = receipts.filter(r => r.paid);

    // Anything paid that we haven't seen before?
    const newlyPaid = paidNow.filter(r => !seen.has(r.id));
    if (newlyPaid.length) {
      await notifyPaidTickets(newlyPaid);
      // mark all paid we saw (not only the new ones) to avoid noisy repeats
      paidNow.forEach(r => seen.add(r.id));
      await saveSeenPaid(seen);
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
}

// ─────────────────────────────────────────────────────────
// Background task (run both checks)
// ─────────────────────────────────────────────────────────
TaskManager.defineTask(TASK_NAME, async () => {
  await ensureAndroidChannels();
  const [a, p] = await Promise.all([handleAnnCheck(), handlePaidCheck()]);

  if (a === BackgroundFetch.BackgroundFetchResult.NewData || p === BackgroundFetch.BackgroundFetchResult.NewData) {
    return BackgroundFetch.BackgroundFetchResult.NewData;
  }
  if (a === BackgroundFetch.BackgroundFetchResult.Failed || p === BackgroundFetch.BackgroundFetchResult.Failed) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
  return BackgroundFetch.BackgroundFetchResult.NoData;
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
      await ensureAndroidChannels();

      // foreground poller (both checks)
      interval = setInterval(() => {
        handleAnnCheck();
        handlePaidCheck();
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
