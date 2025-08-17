// app/_layout.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';

import AnnouncementNotifier from './AnnouncementNotifier';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AppRole = 'commuter' | 'pao' | 'manager';
type JwtPayload = { role: AppRole; exp: number };

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();

  // Load Ionicons font (required for icons)
  const [fontsLoaded, fontsError] = useFonts(Ionicons.font);

  const [isReady, setIsReady] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@token');

        if (!token) {
          const s = (segments as string[]) || [];
          if (!s.includes('signin') && !s.includes('signup')) router.replace('/signin');
          if (!cancelled) {
            setRole(null);
            setIsReady(true);
          }
          return;
        }

        let payload: JwtPayload | null = null;
        try {
          const { jwtDecode } = await import('jwt-decode');
          payload = jwtDecode<JwtPayload>(token);
        } catch {
          await AsyncStorage.clear();
          router.replace('/signin');
          if (!cancelled) {
            setRole(null);
            setIsReady(true);
          }
          return;
        }

        const now = Math.floor(Date.now() / 1000);
        if (!payload.exp || payload.exp <= now) {
          await AsyncStorage.clear();
          router.replace('/signin');
          if (!cancelled) {
            setRole(null);
            setIsReady(true);
          }
          return;
        }

        setRole(payload.role);
        const s = (segments as string[]) || [];
        if (!s.includes(payload.role)) router.replace(`/${payload.role}`);
        if (!cancelled) setIsReady(true);
      } catch {
        router.replace('/signin');
        if (!cancelled) {
          setRole(null);
          setIsReady(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [segments, router]);

  useEffect(() => {
    if (fontsError) {
      console.warn('[RootLayout] Ionicons font failed to load:', fontsError);
    }
    if (isReady && (fontsLoaded || fontsError)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [isReady, fontsLoaded, fontsError]);

  // Gate UI until ready (prevents blank/hidden icons)
  if (!isReady || (!fontsLoaded && !fontsError)) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {role === 'commuter' && <AnnouncementNotifier />}
        <Slot />
      </View>
    </SafeAreaProvider>
  );
}
