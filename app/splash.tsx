// app/splash.tsx
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { Image, StyleSheet, View } from 'react-native';

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require('../assets/images/logos.png')} // match exact file name
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  logo: {
    width: 200,
    height: 200,
  },
});
