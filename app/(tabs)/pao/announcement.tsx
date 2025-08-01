import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Ann = {
  id: number;
  message: string;
  timestamp: string;
  created_by: number;
  author_name: string;
  bus:          string; 
};

const API = 'http://192.168.1.7:5000';

export default function AnnouncementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const TAB_BAR_H = (Platform.OS === 'ios' ? 74 : 66) + insets.bottom;

  const flatRef = useRef<FlatList>(null);
  

  const COMPOSER_HEIGHT = 80;

  const [loading, setLoading] = useState(true);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('@token');
        const res = await fetch(`${API}/pao/broadcast`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const json: Ann[] = await res.json();
          // The backend now sends the list pre-sorted, newest first
          setAnns(json);
        }
      } catch (e) {
        console.error("Failed to load announcements:", e);
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
    const res = await fetch(`${API}/pao/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: trimmed }),
    });
    if (!res.ok) return;
    const newAnn: Ann = await res.json();
    // Add the new message to the top of the list
    setAnns(prev => [newAnn, ...prev]);
    setTimeout(() => flatRef.current?.scrollToOffset({ offset: 0, animated: true }), 100);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#2E7D32" />
        <Text style={styles.loadingText}>Loading announcements...</Text>
      </SafeAreaView>
    );
  }

  const dataWithHeaders = anns.map((a, i) => {
    const prev = anns[i - 1];
    return {
      ...a,
      _showDate: !prev || formatDate(prev.timestamp) !== formatDate(a.timestamp),
    };
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#2E7D32" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.title}>Announcements</Text>
          <Text style={styles.subtitle}>{anns.length} messages</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="megaphone" size={24} color="#2E7D32" />
        </View>
      </View>

      <FlatList
        ref={flatRef}
        data={dataWithHeaders}
        keyExtractor={item => item.id.toString()}
        inverted // Optimally displays chat messages
        style={{ flex: 1 }}
        contentContainerStyle={{
                   /* 16 px side-padding like before */
                   paddingHorizontal: 16,
          
                   /*  space = tab-bar + composer + a small margin          *
                    *  (on an inverted list paddingTop pushes _up_ = down)  */
                   paddingTop: TAB_BAR_H + COMPOSER_HEIGHT + 16,
          
                   /* keep a little room for the very first day-separator */
                   paddingBottom: 16,
                 }}
        renderItem={({ item }) => (
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

<KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={TAB_BAR_H}
        style={[styles.composerContainer, { bottom: TAB_BAR_H }]}
      >
        <View style={styles.composerShadow}>
          <View style={styles.composer}>
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
  busLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    marginRight: 8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
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
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#2E7D32', alignItems: 'center', justifyContent: 'center' },
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
  authorName: { fontSize: 14, fontWeight: '700', color: '#2E7D32' },
  messageTime: { fontSize: 12, color: '#666', fontWeight: '500' },
  messageText: { fontSize: 15, color: '#333', lineHeight: 22 },
  composerShadow: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    composerContainer: {
        position: 'absolute',
        left:     0,
        right:    0,
      },
  textInput: { flex: 1, fontSize: 16, color: '#333', maxHeight: 100, paddingVertical: Platform.OS === 'ios' ? 8 : 0 },
  sendButton: { backgroundColor: '#2E7D32', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginLeft: 8, marginBottom: Platform.OS === 'ios' ? 0 : 4 },
});