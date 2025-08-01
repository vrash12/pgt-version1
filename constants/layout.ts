// constants/layout.ts
import { Platform } from 'react-native';
import { initialWindowMetrics } from 'react-native-safe-area-context';

export const TAB_BAR_H =
  (Platform.OS === 'ios' ? 74 : 66) + (initialWindowMetrics?.insets.bottom ?? 0);
