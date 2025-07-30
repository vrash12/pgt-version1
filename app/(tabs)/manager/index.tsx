// app/(tabs)/manager/index.tsx
import { Redirect } from 'expo-router';

export default function ManagerRoot() {
  return <Redirect href="/manager/dashboard" />;
}
