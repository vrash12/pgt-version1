/* ------------------------------------------------------------------ */
/*  app/_layout.tsx                                                   */
/* ------------------------------------------------------------------ */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, useRouter, useSegments } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import React, { useEffect, useState } from 'react';

/* ─── types ───────────────────────────────────────────────────────── */
type AppRole = 'commuter' | 'pao' | 'manager';
interface JwtPayload { role: AppRole; exp: number; }

/* ─── helper: cast the segments tuple → string[] for TS’ sake ─────── */
const seg = (segments: readonly string[] | readonly unknown[]) =>
  segments as string[];

/* ─── layout component ────────────────────────────────────────────── */
export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem('@token');

      if (!token) {
        if (seg(segments).includes('signin') || seg(segments).includes('signup')) {
          setReady(true);
          return;
        }
        router.replace('/signin');
        return;
      }

      let payload: JwtPayload;
      try {
        payload = jwtDecode<JwtPayload>(token);
      } catch (err) {
        await AsyncStorage.clear();
        router.replace('/signin');
        return;
      }

      const role: AppRole = payload.role;

      if (seg(segments).includes(role)) {
        setReady(true);
        return;
      }

      router.replace({ pathname: `/${role}` });
    })();
  }, [segments, router]);

  if (!ready) return null;

  return <Slot />;
}
