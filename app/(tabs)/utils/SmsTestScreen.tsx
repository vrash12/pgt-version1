// app/(tabs)/utils/SmsTestScreen.tsx
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import SmsListener from 'react-native-android-sms-listener';

export default function SmsTestScreen() {
  const [messages, setMessages] = useState<string[]>([]);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android') {
      console.warn('SMS listener only works on Android');
      return;
    }

    // 1️⃣ Request RECEIVE_SMS permission
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
      {
        title: 'SMS Permission',
        message: 'App needs access to receive SMS for testing.',
        buttonPositive: 'OK',
      }
    ).then(result => {
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setPermissionGranted(true);

        // 2️⃣ Subscribe to incoming SMS
        const sub = SmsListener.addListener(message => {
          console.log('New SMS:', message.body);
          setMessages(prev => [message.body, ...prev]);
        });

        // 3️⃣ Cleanup on unmount
        return () => sub.remove();
      } else {
        console.warn('RECEIVE_SMS permission denied');
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📬 SMS Listener Test</Text>
      {Platform.OS !== 'android' && (
        <Text style={styles.info}>Not supported on iOS</Text>
      )}
      {Platform.OS === 'android' && !permissionGranted && (
        <Text style={styles.info}>Waiting for SMS permission…</Text>
      )}
      {Platform.OS === 'android' && permissionGranted && (
        <>
          <Text style={styles.info}>
            Send an SMS to this device now; incoming texts will show here.
          </Text>
          <FlatList
            data={messages}
            keyExtractor={(_, idx) => idx.toString()}
            ListEmptyComponent={
              <Text style={styles.empty}>No messages received yet.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.msgCard}>
                <Text style={styles.msgText}>{item}</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:20, backgroundColor:'#fff' },
  title: { fontSize:22, fontWeight:'700', marginBottom:12 },
  info: { fontSize:14, color:'#666', marginBottom:8 },
  empty: { fontSize:16, color:'#999', textAlign:'center', marginTop:40 },
  msgCard: {
    backgroundColor:'#f1f1f1',
    padding:12,
    borderRadius:8,
    marginVertical:6,
  },
  msgText: { fontSize:16, color:'#333' },
});
