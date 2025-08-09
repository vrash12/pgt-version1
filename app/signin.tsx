// app/signin.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack, useRouter } from 'expo-router';
import { jwtDecode } from 'jwt-decode';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from './config';

const { width } = Dimensions.get('window');

export default function SignInScreenWrapper() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#1a3d00" translucent={false} />
      <Stack.Screen options={{ headerShown: false }} />
      <SignInScreen />
    </>
  );
}

function SignInScreen() {
  const router = useRouter();

  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  const fadeAnim    = useRef(new Animated.Value(0)).current;
  const slideAnim   = useRef(new Animated.Value(50)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const bubble1     = useRef(new Animated.Value(0)).current;
  const bubble2     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    const float = (v: Animated.Value, delay = 0) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 7000, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 7000, useNativeDriver: true }),
        ])
      ).start();

    float(bubble1);
    float(bubble2, 3500);
  }, []);

  const handleSignIn = async () => {
    await AsyncStorage.multiRemove([
      '@token','@role','@userId','@firstName','@lastName','@assignedBusId',
    ]);

    if (!username.trim() || !password.trim()) {
      alert('Please fill in all fields');
      return;
    }
    setIsLoading(true);

    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(buttonScale, { toValue: 1,    duration: 100, useNativeDriver: true }),
    ]).start();

    try {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const raw = await res.text();
      const json = JSON.parse(raw);

      if (res.ok && json.token) {
        const decoded = jwtDecode<{ user_id: number; role: string }>(json.token);
        const pairs: [string, string][] = [
          ['@token', json.token],
          ['@role', decoded.role],
          ['@userId', String(decoded.user_id)],
        ];
        if (json.user?.firstName) pairs.push(['@firstName', json.user.firstName]);
        if (json.user?.lastName)  pairs.push(['@lastName',  json.user.lastName]);
        if (json.busId != null)   pairs.push(['@assignedBusId', String(json.busId)]);
        await AsyncStorage.multiSet(pairs);

        router.replace(`/${decoded.role.toLowerCase()}`);
      } else {
        alert(json.error || 'Invalid credentials');
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerOverlay} />

        <Animated.View
          style={[
            styles.headerContent,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.welcomeContainer}>
            <Text style={styles.subtitle}>Welcome Back!</Text>
            <Text style={styles.title}>Sign In</Text>
            <View style={styles.titleUnderline} />
          </View>
        </Animated.View>

        <Animated.View
          style={[
            styles.bubble, styles.bubble1Pos,
            {
              transform: [
                { translateY: bubble1.interpolate({ inputRange: [0,1], outputRange: [0,-12] }) },
                { translateX: bubble1.interpolate({ inputRange: [0,1], outputRange: [0,14] }) },
                { scale: bubble1.interpolate({ inputRange: [0,0.5,1], outputRange: [1,1.08,1] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bubble, styles.bubble2Pos,
            {
              transform: [
                { translateY: bubble2.interpolate({ inputRange: [0,1], outputRange: [0,10] }) },
                { translateX: bubble2.interpolate({ inputRange: [0,1], outputRange: [0,-16] }) },
                { scale: bubble2.interpolate({ inputRange: [0,0.5,1], outputRange: [1,1.05,1] }) },
              ],
            },
          ]}
        />
      </View>

      {/* FORM */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <Animated.View style={[styles.formInner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* USERNAME */}
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.inputContainer, focusedInput === 'username' && styles.inputContainerFocused]}>
              <View style={styles.inputIcon}>
                <View style={styles.userIcon} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your username"
                placeholderTextColor="#6b7c6b"
                value={username}
                onChangeText={setUsername}
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* PASSWORD */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.inputContainer, focusedInput === 'password' && styles.inputContainerFocused]}>
              <View style={styles.inputIcon}>
                <View style={styles.lockIcon} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#6b7c6b"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedInput('password')}
                onBlur={() => setFocusedInput(null)}
                secureTextEntry
              />
            </View>
          </View>

          {/* SIGN-IN BUTTON */}
          <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              <View style={styles.buttonContent}>
                {isLoading ? (
                  <View style={styles.loadingContainer}>
                    <View style={styles.loadingDot} />
                    <View style={[styles.loadingDot, styles.loadingDot2]} />
                    <View style={[styles.loadingDot, styles.loadingDot3]} />
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Sign In</Text>
                )}
              </View>
              <View style={styles.buttonGlow} />
            </TouchableOpacity>
          </Animated.View>

          {/* FOOTER LINK */}
          <Pressable onPress={() => router.push('/signup')} style={styles.footerLink}>
            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.linkText}>Sign Up</Text>
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8faf8' },

  /* header */
  header: {
    backgroundColor: '#264d00',
    paddingBottom: 50,
    paddingHorizontal: 20,
    paddingTop: 30,
    borderBottomRightRadius: 90,
    borderBottomLeftRadius: 20,
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,61,0,0.1)',
  },
  headerContent: { zIndex: 2 },
  welcomeContainer: { marginTop: 20 },
  subtitle: { color: '#b8d4b8', fontSize: 18, fontWeight: '300', letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 38, fontWeight: 'bold', marginTop: 8, letterSpacing: 1 },
  titleUnderline: { width: 60, height: 4, backgroundColor: '#4a7c4a', marginTop: 12, borderRadius: 2 },

  /* floating bubbles */
  bubble: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  bubble1Pos: { top: -20, right: -30 },
  bubble2Pos: { bottom: -10, right: 30 },

  /* form */
  formContainer: { flex: 1, justifyContent: 'center' },
  formInner: { paddingHorizontal: 24, marginTop: -20 },
  field: { marginBottom: 24 },
  label: { fontSize: 14, color: '#2c4a2c', marginBottom: 8, fontWeight: '600', letterSpacing: 0.3 },
  inputContainer: {
    backgroundColor: '#e8f5e8',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    elevation: 2,
    shadowColor: '#264d00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputContainerFocused: {
    borderColor: '#4a7c4a',
    backgroundColor: '#fff',
    elevation: 4,
    shadowOpacity: 0.15,
  },
  inputIcon: { width: 24, height: 24, marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  userIcon: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#6b7c6b', borderWidth: 2, borderColor: '#6b7c6b' },
  lockIcon: {
    width: 12,
    height: 14,
    borderWidth: 2,
    borderColor: '#6b7c6b',
    borderRadius: 2,
    borderBottomWidth: 8,
  },
  input: { flex: 1, height: 52, color: '#2c4a2c', fontSize: 16, fontWeight: '500' },

  /* button */
  button: {
    backgroundColor: '#264d00',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#264d00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonDisabled: { backgroundColor: '#4a7c4a' },
  buttonContent: { zIndex: 2 },
  buttonGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 0.5 },
  loadingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  loadingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', marginHorizontal: 2 },
  loadingDot2: { opacity: 0.7 },
  loadingDot3: { opacity: 0.4 },

  /* footer */
  footerLink: { marginTop: 30, alignItems: 'center', paddingVertical: 8 },
  footerText: { fontSize: 15, color: '#5a6b5a', fontWeight: '400' },
  linkText: { color: '#264d00', fontWeight: 'bold', textDecorationLine: 'underline' },
});
