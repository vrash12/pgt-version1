// app/(tabs)/commuter/index.tsx
import { Redirect } from 'expo-router';

export default function CommuterRoot() {
  return <Redirect href="/commuter/dashboard" />;
}
