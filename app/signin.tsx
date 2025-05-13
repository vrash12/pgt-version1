//app/signin.tsx
import { Stack, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function SignInScreen() {
  // this bit hides the header/back button
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <SignInContent />
    </>
  );
}

function SignInContent() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSignIn = () => {
    // TODO: your auth logic
    router.replace('/');  // e.g. go to home tabs on success
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Welcome!</Text>
        <Text style={styles.title}>Sign In</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <View style={styles.formInner}>
          {/* Username */}
          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Username"
              placeholderTextColor="#555"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Password"
              placeholderTextColor="#555"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity style={styles.button} onPress={handleSignIn}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>

          {/* Link to Sign Up */}
          <Pressable onPress={() => router.push('/signup')} style={styles.footerLink}>
            <Text style={styles.footerText}>
              Don't have an account? <Text style={styles.linkText}>Sign Up</Text>
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}




const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#264d00',
    paddingBottom: 40,
    paddingHorizontal: 20,
    paddingTop: 20,
    borderBottomRightRadius: 80,
  },
  subtitle: { color: '#fff', fontSize: 16 },
  title: { color: '#fff', fontSize: 32, fontWeight: 'bold', marginTop: 8 },
  formContainer: { flex: 1, justifyContent: 'center' },
  formInner: { paddingHorizontal: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: 12, color: '#333', marginBottom: 6 },
  input: {
    backgroundColor: '#aabfa8',
    borderRadius: 20,
    height: 48,
    paddingHorizontal: 16,
    color: '#000',
  },
  button: {
    backgroundColor: '#264d00',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  footerLink: { marginTop: 20, alignItems: 'center' },
  footerText: { fontSize: 14, color: '#333' },
  linkText: { color: '#264d00', fontWeight: 'bold' },
});
