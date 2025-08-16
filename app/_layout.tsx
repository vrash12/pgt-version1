import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { jwtDecode } from 'jwt-decode';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AnnouncementNotifier from './AnnouncementNotifier';

SplashScreen.preventAutoHideAsync().catch(() => {});

type AppRole = 'commuter' | 'pao' | 'manager';
type JwtPayload = { role: AppRole; exp: number };

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isReady, setIsReady] = useState(false);
  const [role, setRole] = useState<AppRole | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@token');

        // No token: allow being on auth routes, otherwise send to /signin
        if (!token) {
          const s = (segments as string[]) || [];
          if (!s.includes('signin') && !s.includes('signup')) router.replace('/signin');
          if (!cancelled) {
            setRole(null);
            setIsReady(true);
          }
          return;
        }

        // Decode/validate
        let payload: JwtPayload | null = null;
        try {
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

        // Valid → go to role root if not already there
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
    if (isReady) SplashScreen.hideAsync().catch(() => {});
  }, [isReady]);

  if (!isReady) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* Wrap Slot in a View for background styling (Fragments themselves can't take style) */}
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        {role === 'commuter' && <AnnouncementNotifier />}
        <Slot />
      </View>
    </SafeAreaProvider>
  );
}
