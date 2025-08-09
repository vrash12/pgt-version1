// types/react-native-searchable-dropdown.d.ts
declare module 'react-native-searchable-dropdown' {
    import { Component } from 'react';
    import { StyleProp, TextInputProps, TextStyle, ViewStyle } from 'react-native';
  
    export interface SearchableDropdownItem {
      id: number | string;
      name: string;
      [key: string]: any;
    }
  
    export interface SearchableDropdownProps {
      items: SearchableDropdownItem[];
      onItemSelect?: (item: SearchableDropdownItem) => void;
      defaultIndex?: number;
      resetValue?: boolean;
      textInputProps?: TextInputProps;
      itemStyle?: StyleProp<ViewStyle>;
      itemTextStyle?: StyleProp<TextStyle>;
      // allow any extra props
      [key: string]: any;
    }
  
    export default class SearchableDropdown extends Component<SearchableDropdownProps> {}
  }
  