// app/_push.ts  (create once and reuse)
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';

const BACKEND = '${API_BASE_URL}';

export async function registerForPush() {
  let token: string | undefined;

  if (Device.isDevice) {
    const { status } = await Notifications.getPermissionsAsync();
    let finalStatus = status;
    if (status !== 'granted') {
      const res = await Notifications.requestPermissionsAsync();
      finalStatus = res.status;
    }
    if (finalStatus !== 'granted') return;

    const expoToken = (await Notifications.getExpoPushTokenAsync()).data;
    token = expoToken;
    await AsyncStorage.setItem('@pushToken', token);
  }

  /** tell the API “this PAO device = this token” */
  if (token) {
    const tok = await AsyncStorage.getItem('@token');           // Firebase/JWT you already store
    await fetch(`${BACKEND}/pao/device-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
      body: JSON.stringify({ token, platform: Device.osName }),
    }).catch(console.warn);
  }
}
