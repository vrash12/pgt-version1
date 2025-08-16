// app/lib/NotificationContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Notifications from 'expo-notifications'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { API_BASE_URL } from '../config'

export type Notice = {
  id: string
  title: string
  body: string
  at: Date
}

type Ctx = { notices: Notice[]; add: (t: string, b: string) => void }

const NotificationCtx = createContext<Ctx>({
  notices: [],
  add: () => {},
})

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notices, setNotices] = useState<Notice[]>([])

  const add = (title: string, body: string) =>
    setNotices(prev => [
      ...prev,
      { id: Date.now().toString(), title, body, at: new Date() },
    ])

  // 🛎️ Ask permission, get Expo token, post to backend, and log incoming pushes
  useEffect(() => {
    (async () => {
      // Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('commuter-updates', {
          name: 'Commuter Updates',
          importance: Notifications.AndroidImportance.HIGH,
          sound: 'default',
          enableVibrate: true,
        })
      }

      // Permissions
      const perms = await Notifications.getPermissionsAsync()
      if (perms.status !== 'granted') {
        const req = await Notifications.requestPermissionsAsync()
        if (req.status !== 'granted') return
      }

      // Expo push token
      const token = (await Notifications.getExpoPushTokenAsync()).data
      await AsyncStorage.setItem('@pushToken', token)

      // Send to backend
      try {
        const auth = await AsyncStorage.getItem('@token')
        await fetch(`${API_BASE_URL}/commuter/device-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
          },
          body: JSON.stringify({ token }),
        })
      } catch {
        // non-fatal
      }

      // Mirror foreground pushes into in-app feed
      const recv = Notifications.addNotificationReceivedListener(n => {
        const t = n.request.content.title || 'Notification'
        const b = n.request.content.body || ''
        add(t, b)
      })
      return () => recv.remove()
    })()
  }, [])

  return (
    <NotificationCtx.Provider value={{ notices, add }}>
      {children}
    </NotificationCtx.Provider>
  )
}

// ✅ Export the hook so `import { useNotifications } from '../../lib/NotificationContext'` works
export const useNotifications = () => useContext(NotificationCtx)
