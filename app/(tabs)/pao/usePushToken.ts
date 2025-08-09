// app/(pao)/usePushToken.ts --------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { API_BASE_URL } from "../../config";


export default function usePushToken() {
  useEffect(() => {
    (async () => {
      // already saved? → skip
      const cached = await AsyncStorage.getItem('@pushToken');
      if (cached) return;

      // ask the user once
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      // get the Expo token
      const res = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      const token = res.data;

      // persist locally
      await AsyncStorage.setItem('@pushToken', token);

      // tell the backend
      await fetch(`${API_BASE_URL}/pao/device-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json',
                   Authorization: `Bearer ${await AsyncStorage.getItem('@token')}` },
        body: JSON.stringify({
          token,
          platform: Constants.platform?.ios ? 'ios' : 'android',
        }),
      }).catch(console.warn);
    })();
  }, []);
}
