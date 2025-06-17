// app/signup.tsx
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useRouter } from 'expo-router';

export default function SignUpScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const router = useRouter();

const handleSignUp = async () => {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName,
        lastName,
        username,
        phoneNumber,
        password,
      }),
    });

    const json = await response.json();
    if (response.ok) {
      console.log('User registered successfully:', json.message);
      router.push('/');
    } else {
      console.error('Error:', json.error);
    }
  } catch (error) {
    console.error('Network error:', error);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>Create Your Account!</Text>
        <Text style={styles.title}>Sign Up</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { marginRight: 10 }]}>  
              <Text style={styles.label}>First Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter First Name"
                placeholderTextColor="#555"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter Last Name"
                placeholderTextColor="#555"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Username</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Username"
              placeholderTextColor="#555"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Phone Number"
              placeholderTextColor="#555"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

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

          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Confirm Password"
              placeholderTextColor="#555"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          <Pressable style={styles.checkboxContainer} onPress={() => setAgreed(!agreed)}>
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]} />
            <Text style={styles.checkboxLabel}>
              By checking this box, you are agreeing to our Terms of Service.
            </Text>
          </Pressable>

          <TouchableOpacity
            style={[styles.button, !agreed && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={!agreed}
          >
            <Text style={styles.buttonText}>Sign Up</Text>
          </TouchableOpacity>
        </ScrollView>
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
  formContainer: { flex: 1 },
  scrollContainer: { padding: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputWrapper: { flex: 1 },
  field: { marginTop: 20 },
  label: { fontSize: 12, color: '#333', marginBottom: 6 },
  input: {
    backgroundColor: '#aabfa8',
    borderRadius: 20,
    height: 48,
    paddingHorizontal: 16,
    color: '#000',
  },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#333',
    marginRight: 8,
  },
  checkboxChecked: { backgroundColor: '#333' },
  checkboxLabel: { flex: 1, fontSize: 12, color: '#333' },
  button: {
    backgroundColor: '#264d00',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 30,
  },
  buttonDisabled: { backgroundColor: '#99a399' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
