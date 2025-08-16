// app/signup.tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
} from 'react-native';
import LegalModal from '../components/LegalModal';
import { API_BASE_URL } from './config';

const APP_LOGO = require('../assets/images/logos.png');
export default function SignUpScreen() {
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [username,        setUsername]        = useState('');
  const [phoneNumber,     setPhoneNumber]     = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed,          setAgreed]          = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);
  const [showConfPass,    setShowConfPass]    = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalType, setLegalType] = useState<'tos' | 'privacy'>('tos');
  const router = useRouter();

  // header animations
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const bubble1   = useRef(new Animated.Value(0)).current;
  const bubble2   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    const float = (val: Animated.Value, delay = 0) =>
      Animated.loop(Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 8000, delay, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0, duration: 8000, useNativeDriver: true }),
      ])).start();
    float(bubble1);
    float(bubble2, 4000);
  }, []);

  const handleSignUp = async () => {
    if (!agreed) return;
    if (password.trim() === '' || confirmPassword.trim() === '') {
      alert('Please enter and confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }
  
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, username, phoneNumber, password }),
      });
      const json = await res.json();
      if (res.ok) {
        alert('Account created! Please sign in.');
        router.replace('/signin');
      } else {
        alert(json.error || 'Signup failed');
      }
    } catch (e) {
      console.error(e);
      alert('Network error');
    }
  };

  // small helper type
  type FI = {
    label: string;
    icon:  TextInputProps['keyboardType']; // actually unused, but TS-safe
    placeholder: string;
    value: string;
    setter: (s: string) => void;
    keyboardType?: TextInputProps['keyboardType'];
    autoCapitalize?: TextInputProps['autoCapitalize'];
  };

  const otherFields: FI[] = [
    {
      label: 'Username',
      icon:  'default',
      placeholder: 'johndoe123',
      value: username,
      setter: setUsername,
      autoCapitalize: 'none',
    },
    {
      label: 'Phone Number',
      icon:  'phone-pad',
      placeholder: '+63 912 345 6789',
      value: phoneNumber,
      setter: setPhoneNumber,
      keyboardType: 'phone-pad',
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={['#4A7C59', '#2D5016']} style={styles.header}>
        <Animated.View style={[styles.headerContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
            <Image
     source={APP_LOGO}
     style={styles.logoImg}
     resizeMode="contain"
     accessibilityLabel="PGT TRANSECO logo"
   />
            </View>
       
          </View>
          <Text style={styles.subtitle}>Join the community!</Text>
          <Text style={styles.title}>Create Account</Text>
        </Animated.View>

        {/* Floating bubbles */}
        <Animated.View
          style={[
            styles.bubble, styles.bubble1Pos,
            {
              transform: [
                { translateY: bubble1.interpolate({ inputRange: [0,1], outputRange: [0,-20] }) },
                { translateX: bubble1.interpolate({ inputRange: [0,1], outputRange: [0,15] }) },
                { scale:      bubble1.interpolate({ inputRange: [0,0.5,1], outputRange: [1,1.08,1] }) },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.bubble, styles.bubble2Pos,
            {
              transform: [
                { translateY: bubble2.interpolate({ inputRange: [0,1], outputRange: [0,20] }) },
                { translateX: bubble2.interpolate({ inputRange: [0,1], outputRange: [0,-15] }) },
                { scale:      bubble2.interpolate({ inputRange: [0,0.5,1], outputRange: [1,1.05,1] }) },
              ],
            },
          ]}
        />

        {/* curve */}
        <View style={styles.headerCurve} />
      </LinearGradient>

      {/* FORM */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Names row */}
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { marginRight: 8 }]}>
              <Text style={styles.label}>First Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="John"
                  placeholderTextColor="#999"
                  value={firstName}
                  onChangeText={setFirstName}
                />
              </View>
            </View>
            <View style={[styles.inputWrapper, { marginLeft: 8 }]}>
              <Text style={styles.label}>Last Name</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="Doe"
                  placeholderTextColor="#999"
                  value={lastName}
                  onChangeText={setLastName}
                />
              </View>
            </View>
          </View>

          {/* Other fields */}
          {otherFields.map((f, i) => (
            <View key={i} style={styles.field}>
              <Text style={styles.label}>{f.label}</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="at-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder={f.placeholder}
                  placeholderTextColor="#999"
                  value={f.value}
                  onChangeText={f.setter}
                  keyboardType={f.keyboardType}
                  autoCapitalize={f.autoCapitalize}
                />
              </View>
            </View>
          ))}

          {/* Password fields */}
          {[
            { label: 'Password',        val: password,        set: setPassword,        show: showPassword,   toggle: setShowPassword },
            { label: 'Confirm Password', val: confirmPassword, set: setConfirmPassword, show: showConfPass, toggle: setShowConfPass },
          ].map((p, i) => (
            <View key={i} style={styles.field}>
              <Text style={styles.label}>{p.label}</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="#999"
                  secureTextEntry={!p.show}
                  value={p.val}
                  onChangeText={p.set}
                />
                <TouchableOpacity style={styles.eye} onPress={() => p.toggle(!p.show)}>
                  <Ionicons name={p.show ? 'eye-outline' : 'eye-off-outline'} size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </View>
          ))}

<Pressable style={styles.checkWrap} onPress={() => setAgreed(!agreed)}>
  <View style={[styles.checkbox, agreed && styles.checkboxOn]}>
    {agreed && <Ionicons name="checkmark" size={14} color="#fff" />}
  </View>
  <Text style={styles.checkLabel}>
    I agree to the{' '}
    <Text
      style={styles.link}
      onPress={(e) => {
        e.stopPropagation();
        setLegalType('tos');
        setLegalOpen(true);
      }}
    >
      Terms of Service
    </Text>{' '}
    and{' '}
    <Text
      style={styles.link}
      onPress={(e) => {
        e.stopPropagation();
        setLegalType('privacy');
        setLegalOpen(true);
      }}
    >
      Privacy Policy
    </Text>
  </Text>
</Pressable>

<LegalModal visible={legalOpen} type={legalType} onClose={() => setLegalOpen(false)} />



          {/* Create Account */}
          <TouchableOpacity
            style={[styles.btn, !agreed && styles.btnDisabled]}
            disabled={!agreed}
            onPress={handleSignUp}
          >
            <LinearGradient
              colors={agreed ? ['#4A7C59','#2D5016'] : ['#D1D5DB','#9CA3AF']}
              style={styles.btnGrad}
            >
              <Text style={[styles.btnTxt, !agreed && styles.btnTxtDis]}>
                Create Account
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signInRow}>
            <Text style={styles.signInTxt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push('/signin')}>
              <Text style={styles.signInLink}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:       { flex:1, backgroundColor:'#f8f9fa' },
  header:          { paddingTop:20, paddingHorizontal:20, position:'relative' },
  headerContent:   { paddingBottom:40 },
  logoContainer:   { alignItems:'center', marginBottom:20 },
  logoCircle:      { width:60,height:60,borderRadius:30,backgroundColor:'#fff',alignItems:'center',justifyContent:'center',marginBottom:8, elevation:3 },
  appName:         { color:'#fff', fontSize:18, fontWeight:'600' },
  subtitle:        { color:'rgba(255,255,255,0.9)', fontSize:16, textAlign:'center', marginBottom:4 },
  title:           { color:'#fff', fontSize:28, fontWeight:'bold', textAlign:'center' },
  headerCurve:     { position:'absolute', bottom:-1,left:0,right:0,height:30, backgroundColor:'#f8f9fa', borderTopLeftRadius:30, borderTopRightRadius:30 },
  bubble:          { position:'absolute', width:90,height:90, borderRadius:45, backgroundColor:'rgba(255,255,255,0.1)' },
  bubble1Pos:      { top:-30,right:-40 },
  bubble2Pos:      { bottom:-20,left:-30 },
  formContainer:   { flex:1 },
  scrollContainer: { padding:20, paddingTop:10 },
  row:             { flexDirection:'row' },
  inputWrapper:    { flex:1 },
  field:           { marginTop:20 },
  label:           { fontSize:14, color:'#374151', marginBottom:8, fontWeight:'500' },
  inputContainer:  { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#E5E7EB', paddingHorizontal:16, height:50, elevation:1 },
  icon:            { marginRight:12 },
  input:           { flex:1, fontSize:16, color:'#374151' },
  eye:             { padding:4 },
  checkWrap:       { flexDirection:'row', alignItems:'flex-start', marginTop:24, marginBottom:8 },
  checkbox:        { width:20,height:20,borderWidth:2,borderColor:'#D1D5DB',borderRadius:4,marginRight:12,marginTop:2,alignItems:'center',justifyContent:'center',backgroundColor:'#fff' },
    checkboxOn: {
    backgroundColor: '#4A7C59',
    borderColor:    '#4A7C59',
  },
  checkLabel: {
    flex:       1,
    fontSize:   14,
    color:      '#6B7280',
    lineHeight: 20,
  },
  link: {
    color:      '#4A7C59',
    fontWeight: '500',
  },

  /* BUTTON */
  btn: {
    marginTop:    32,
    borderRadius: 12,
    overflow:     'hidden',
    elevation:    3,
  },
  btnDisabled: {
    elevation:     0,
    shadowOpacity: 0,
  },
  btnGrad: {
    paddingVertical: 16,
    alignItems:      'center',
  },
  btnTxt: {
    color:      '#fff',
    fontSize:   16,
    fontWeight: '600',
  },
  btnTxtDis: {
    color: '#9CA3AF',
  },

  /* FOOTER LINK */
  signInRow: {
    flexDirection:   'row',
    justifyContent:  'center',
    alignItems:      'center',
    marginTop:       24,
    marginBottom:    20,
  },
  signInTxt: {
    fontSize: 14,
    color:    '#6B7280',
  },
  signInLink: {
    fontSize:   14,
    color:      '#4A7C59',
    fontWeight: '600',
  },
  logoImg: {
       width: 44,
       height: 44,
     },
});
