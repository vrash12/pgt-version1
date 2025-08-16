//app(tabs)/pao/announcement.tsx

import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config';

type Ann = {
  id: number;
  message: string;
  timestamp: string;
  created_by: number;
  author_name: string;
  bus: string;
  _showDate?: boolean;
};

export default function AnnouncementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarH = useBottomTabBarHeight();


  const TAB_BAR_H = Math.max(0, tabBarH - 6); 

  const flatRef = useRef<FlatList<Ann & { _showDate?: boolean }>>(null);
  const [composerH, setComposerH] = useState(0);
  const [loading, setLoading] = useState(true);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [draft, setDraft] = useState('');
    const [kbVisible, setKbVisible] = useState(false);
    const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const sh = Keyboard.addListener(showEvt, (e) => {
          setKbVisible(true);
          setKbHeight(e?.endCoordinates?.height ?? 0);
        });
        const hd = Keyboard.addListener(hideEvt, () => {
          setKbVisible(false);
          setKbHeight(0);
        });
    return () => {
      sh.remove();
      hd.remove();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@token');
        const res = await fetch(`${API_BASE_URL}/pao/broadcast?scope=all`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.ok) {
          const json: Ann[] = await res.json();
          setAnns(json);
        }
      } catch (e) {
        console.error('Failed to load announcements:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  

  const handleSend = async () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setDraft('');
    const token = await AsyncStorage.getItem('@token');
    const res = await fetch(`${API_BASE_URL}/pao/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ message: trimmed }),
    });
    if (!res.ok) return;
    const newAnn: Ann = await res.json();
    setAnns(prev => [newAnn, ...prev]);
    setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  const dataWithHeaders = useMemo(
    () =>
      anns.map((a, i) => {
        const prev = anns[i - 1];
        const sameDay =
          prev && new Date(prev.timestamp).toDateString() === new Date(a.timestamp).toDateString();
        return { ...a, _showDate: !sameDay };
      }),
    [anns]
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.header}>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.subtitle}>{anns.length} messages</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="megaphone" size={24} color="#2E7D32" />
        </View>
      </View>

      <KeyboardAvoidingView
  style={{ flex: 1 }}
  behavior={Platform.OS === 'ios' ? 'padding' : undefined}
  keyboardVerticalOffset={0}
>
        <FlatList
          ref={flatRef}
          data={dataWithHeaders as any}
          keyExtractor={item => String(item.id)}
          inverted
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 16,
            // reserve space for the composer exactly
            paddingTop: composerH + 96,
            paddingBottom: 16,
            backgroundColor: '#fff',
          }}
          renderItem={({ item }: any) => (
            <View style={styles.messageContainer}>
              <View style={styles.messageWrapper}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={16} color="#fff" />
                  </View>
                </View>
                <View style={styles.messageBubble}>
                  <View style={styles.bubbleHeader}>
                    <Text style={styles.busLabel}>{item.bus}</Text>
                    <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.messageText}>{item.message}</Text>
                </View>
              </View>
              {item._showDate && (
                <View style={styles.dateSeparator}>
                  <View style={styles.dateLine} />
                  <Text style={styles.dateText}>{formatDate(item.timestamp)}</Text>
                  <View style={styles.dateLine} />
                </View>
              )}
            </View>
          )}
        />

<View
  pointerEvents="box-none"
  style={[
    styles.composerWrap,
    {
      // Pin above tab bar or keyboard
      bottom: kbVisible ? kbHeight : TAB_BAR_H,
    },
  ]}
>
          <View style={styles.composerShadow}>
            <View style={styles.composer}
            onLayout={e => setComposerH(e.nativeEvent.layout.height)}>
              <TextInput
                style={styles.textInput}
                placeholder="Share an announcement..."
                placeholderTextColor="#9E9E9E"
                value={draft}
                onChangeText={setDraft}
                multiline
              />
              <TouchableOpacity
                onPress={handleSend}
                style={[styles.sendButton, { opacity: draft.trim() ? 1 : 0.5 }]}
                disabled={!draft.trim()}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E8F5E8',
  },
  headerTextContainer: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: '#2E7D32' },
  subtitle: { fontSize: 14, color: '#666', fontWeight: '500' },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageContainer: { marginBottom: 16 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dateLine: { flex: 1, height: 1, backgroundColor: '#E0E0E0' },
  dateText: { paddingHorizontal: 16, fontSize: 12, color: '#666', fontWeight: '600' },
  messageWrapper: { flexDirection: 'row', alignItems: 'flex-start' },
  avatarContainer: { marginRight: 12, marginTop: 4 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageBubble: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8F5E8',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  bubbleHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  busLabel: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  messageTime: { fontSize: 12, color: '#666', fontWeight: '500' },
  messageText: { fontSize: 15, color: '#333', lineHeight: 22 },

  composerWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        zIndex: 100,      // ensure it sits above the list
        elevation: 6,     // Android visual stacking
      },
  composerShadow: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#E8F5E8',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f5f5f5',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    maxHeight: 100,
    paddingVertical: 0,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#2E7D32',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
});
