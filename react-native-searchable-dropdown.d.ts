// react-native-searchable-dropdown.d.ts
import { Component } from 'react';
import { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';

export interface SearchableDropdownItem {
  id: number;
  name: string;
  [key: string]: any;
}

export interface SearchableDropdownProps {
  onItemSelect?: (item: SearchableDropdownItem) => void;
  items: SearchableDropdownItem[];
  defaultIndex?: number;
  resetValue?: boolean;
  textInputProps?: TextInputProps;
  itemStyle?: StyleProp<ViewStyle>;
  itemTextStyle?: StyleProp<TextStyle>;
  [key: string]: any;
}

declare class SearchableDropdown extends Component<SearchableDropdownProps> {}
export default SearchableDropdown;
