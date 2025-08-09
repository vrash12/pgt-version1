// app/_layout.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { jwtDecode } from 'jwt-decode';
import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/* Keep the native splash visible while we bootstrap */
SplashScreen.preventAutoHideAsync().catch(() => {});

/* ─── types ───────────────────────────────────────────────────────── */
type AppRole = 'commuter' | 'pao' | 'manager';
interface JwtPayload { role: AppRole; exp: number }

/* helper for TS */
const seg = (segments: readonly string[] | readonly unknown[]) => segments as string[];

export default function RootLayout() {
  const router   = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const token = await AsyncStorage.getItem('@token');

        // No token → allow auth routes, otherwise send to /signin
        if (!token) {
          if (seg(segments).includes('signin') || seg(segments).includes('signup')) {
            if (!cancelled) setIsReady(true);
          } else {
            router.replace('/signin');
            if (!cancelled) setIsReady(true);
          }
          return;
        }

        // Has token → decode and route to role root if needed
        let payload: JwtPayload | null = null;
        try {
          payload = jwtDecode<JwtPayload>(token);
        } catch {
          await AsyncStorage.clear();
          router.replace('/signin');
          if (!cancelled) setIsReady(true);
          return;
        }

        const role = payload.role;
        if (seg(segments).includes(role)) {
          if (!cancelled) setIsReady(true);
        } else {
          router.replace({ pathname: `/${role}` });
          if (!cancelled) setIsReady(true);
        }
      } catch {
        // On any unexpected error, fail safe to signin
        router.replace('/signin');
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, [segments, router]);

  // Hide the native splash as soon as we are ready to render
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady]);

  // While not ready, render nothing — the native splash stays visible
  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" translucent={false} backgroundColor="transparent" />
      <Slot />
    </SafeAreaProvider>
  );
}
