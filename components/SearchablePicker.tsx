// components/SearchablePicker.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import DropDownPicker, { ValueType } from 'react-native-dropdown-picker';

type Item = { id: number; name: string };

type ListMode = 'FLATLIST' | 'MODAL' | 'SCROLLVIEW';

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  items: Item[];
  value: number | undefined;
  onChange: (id: number) => void;
  onOpenChange?: (open: boolean) => void;
  zIndex?: number;
  maxHeight?: number;
  listMode?: ListMode;         // optional override
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

export default function SearchablePicker({
  icon,
  label,
  items,
  value,
  onChange,
  onOpenChange,
  zIndex = 1,
  maxHeight = 320,
  // Default to MODAL on Android (rock-solid scrolling), FLATLIST on iOS
  listMode = Platform.OS === 'android' ? 'MODAL' : 'FLATLIST',
  placeholder = '— Select —',
  searchPlaceholder = 'Type to search…',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  const formattedItems = useMemo(
    () => items.map(i => ({ label: i.name, value: i.id })),
    [items]
  );

  return (
    <View style={[styles.container, { zIndex, elevation: zIndex }]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={18} color="#2e7d32" />
        <Text style={styles.label}>{label}</Text>
      </View>

      <DropDownPicker
        open={open}
        value={value ?? null}
        items={formattedItems}
        setOpen={setOpen}
        // Drive parent state
        onChangeValue={(val: ValueType | null) => {
          if (typeof val === 'number') onChange(val);
        }}
        // Keep setValue for internal flows
        setValue={(cb: any) => {
          const next = typeof cb === 'function' ? cb(value ?? null) : cb;
          if (typeof next === 'number') onChange(next);
        }}
        disabled={disabled}
        searchable
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        listMode={listMode}
        dropDownDirection="AUTO"
        maxHeight={maxHeight}
        // Ensure inner list scrolls when not using MODAL
        flatListProps={
          listMode === 'FLATLIST'
            ? {
                nestedScrollEnabled: true,
                keyboardShouldPersistTaps: 'handled',
                showsVerticalScrollIndicator: true,
              }
            : undefined
        }
        // Nice modal UX on Android
        modalProps={
          listMode === 'MODAL'
            ? {
                animationType: 'slide',
                presentationStyle: 'pageSheet',
              }
            : undefined
        }
        modalTitle={listMode === 'MODAL' ? label : undefined}
        // Styling
        style={styles.pickerStyle}
        dropDownContainerStyle={styles.dropDownContainer}
        placeholderStyle={styles.placeholder}
        searchTextInputStyle={styles.searchText}
        listItemLabelStyle={styles.itemText}
        selectedItemLabelStyle={styles.selectedItemText}
        zIndex={zIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24 },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginLeft: 8 },

  pickerStyle: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    borderRadius: 12,
    minHeight: 50,
  },
  dropDownContainer: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    borderRadius: 12,
    overflow: 'hidden',
  },
  placeholder: { color: '#888', fontSize: 16 },
  searchText: { fontSize: 16, borderColor: '#e9ecef' },
  itemText: { fontSize: 16, color: '#333' },
  selectedItemText: { fontSize: 16, fontWeight: '700', color: '#2e7d32' },
});
