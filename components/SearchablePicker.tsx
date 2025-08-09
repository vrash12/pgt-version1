// components/SearchablePicker.tsx
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';

// The library expects items in {label: string, value: any} format.
// Our data is {name: string, id: number}. We'll adapt.
type Item = { id: number; name: string };

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  items: Item[];
  value: number | undefined;
  onChange: (id: number) => void;
  zIndex?: number; // ✨ Add zIndex prop for stacking context
}

export default function SearchablePicker({
  icon,
  label,
  items,
  value,
  onChange,
  zIndex = 1, // ✨ Default zIndex
}: Props) {
  const [open, setOpen] = useState(false);

  // Format our items to what the library expects
  const formattedItems = items.map(item => ({
    label: item.name,
    value: item.id,
  }));

  return (
    // The zIndex here is crucial. It creates a stacking context.
    <View style={[styles.container, { zIndex }]}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={18} color="#2e7d32" />
        <Text style={styles.label}>{label}</Text>
      </View>

      <DropDownPicker
        open={open}
        value={value ?? null} // Use the value passed in props
        items={formattedItems}
        setOpen={setOpen}
        setValue={(callback) => {
          // The callback returns the new value. We extract it and call onChange.
          const newValue = callback(value);
          if (newValue !== null) {
            onChange(newValue);
          }
        }}
        searchable={true}
        placeholder="— Choose a commuter —"
        searchPlaceholder="Type name to search..."
        listMode="FLATLIST" // This mode is performant
        style={styles.pickerStyle}
        dropDownContainerStyle={styles.dropDownContainer}
        placeholderStyle={styles.placeholder}
        searchTextInputStyle={styles.searchText}
        listItemLabelStyle={styles.itemText}
        // This ensures the dropdown doesn't get cut off by other components
        zIndex={zIndex}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  label: { fontSize: 16, fontWeight: '600', color: '#333', marginLeft: 8 },
  pickerStyle: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    borderRadius: 12,
  },
  dropDownContainer: {
    backgroundColor: '#f8f9fa',
    borderColor: '#e9ecef',
    borderRadius: 12,
  },
  placeholder: {
    color: '#888',
    fontSize: 16,
  },
  searchText: {
    fontSize: 16,
    borderColor: '#e9ecef',
  },
  itemText: {
      fontSize: 16,
      color: '#333'
  }
});