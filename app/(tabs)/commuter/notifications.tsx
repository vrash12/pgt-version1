//app/(tabs)/commuter/notifications.tsx
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { API_BASE_URL } from "../../config";
const { width } = Dimensions.get('window');

type Announcement = {
  id: number;
  message: string;
  timestamp: string;
  bus_identifier: string;
};

type Bus = {
  id: number;
  identifier: string;
};

const formatDateTime = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
  
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffHours < 48) {
    return 'Yesterday';
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
};

const formatFullDateTime = (isoString: string) => {
  const date = new Date(isoString);
  return `${date.toLocaleDateString('en-US', { 
    weekday: 'short',
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  })} at ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
};

export default function NotificationsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterExpanded, setFilterExpanded] = useState(false);

  // Filter state
  const [selectedBus, setSelectedBus] = useState<number | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Animation values
  const filterHeight = useState(new Animated.Value(0))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Fetch the list of buses for the filter picker
  useEffect(() => {
    const fetchBuses = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/commuter/buses`);
        if (res.ok) {
          setBuses(await res.json());
        } else {
          console.error(`Failed to fetch buses. Status: ${res.status}`);
        }
      } catch (e) {
        console.error("An error occurred while fetching buses:", e);
      }
    };
    fetchBuses();
  }, []);

  // Fetch announcements whenever a filter changes
  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedBus !== 'all') {
        params.append('bus_id', String(selectedBus));
      }
      if (selectedDate) {
        const year = selectedDate.getFullYear();
        const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = selectedDate.getDate().toString().padStart(2, '0');
        const dateForAPI = `${year}-${month}-${day}`;
        params.append('date', dateForAPI);
      }
      
      try {
        const token = await AsyncStorage.getItem('@token');
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`${API_BASE_URL}/commuter/announcements?${params.toString()}`, { headers });

        if (res.ok) {
          const data: Announcement[] = await res.json();
          setAnnouncements(data);
          // Animate in the content
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();
        }
      } catch (error) {
        console.error('Error fetching announcements:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

    fetchAnnouncements();
  }, [selectedBus, selectedDate]);

  const onRefresh = () => {
    setRefreshing(true);
    // Trigger re-fetch by updating a dependency
    setSelectedBus(prev => prev);
  };

  const toggleFilters = () => {
    const toValue = filterExpanded ? 0 : 1;
    setFilterExpanded(!filterExpanded);
    
    Animated.spring(filterHeight, {
      toValue: toValue * 120,
      useNativeDriver: false,
      tension: 100,
      friction: 8,
    }).start();
  };

  const onDateChange = (event: any, date?: Date) => {
    setShowPicker(Platform.OS === 'ios');
    if (date) {
      setSelectedDate(date);
    }
  };

  const clearFilters = () => {
    setSelectedBus('all');
    setSelectedDate(null);
  };

  const hasActiveFilters = selectedBus !== 'all' || selectedDate !== null;
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B5E20" />
      
      {/* Enhanced Header with Gradient */}
      <LinearGradient
        colors={['#2E7D32', '#1B5E20', '#0D3F12']}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="notifications" size={28} color="#fff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Announcements</Text>
              <Text style={styles.headerSubtitle}>
                {loading ? 'Loading...' : `${announcements.length} ${announcements.length === 1 ? 'announcement' : 'announcements'}`}
              </Text>
            </View>
          </View>
          
          {/* Filter Toggle Button */}
          <TouchableOpacity 
            style={[styles.filterToggle, hasActiveFilters && styles.filterToggleActive]} 
            onPress={toggleFilters}
          >
            <Ionicons 
              name={filterExpanded ? "chevron-up" : "options"} 
              size={20} 
              color={hasActiveFilters ? "#2E7D32" : "#fff"} 
            />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Animated Filter Container */}
      <Animated.View style={[styles.filterContainer, { height: filterHeight }]}>
        <View style={styles.filterContent}>
          <View style={styles.filterRow}>
            <View style={styles.pickerWrapper}>
              <Ionicons name="bus-outline" size={18} color="#2E7D32" style={styles.pickerIcon} />
              <Picker
                selectedValue={selectedBus}
                onValueChange={(itemValue) => setSelectedBus(itemValue)}
                style={styles.picker}
                dropdownIconColor="#2E7D32"
              >
                <Picker.Item label="All Buses" value="all" />
                {buses.map(bus => (
                  <Picker.Item
                    key={bus.id}
                    label={(bus.identifier || `bus-${bus.id}`).replace(/^bus[-_]?/i, 'Bus ')}
                    value={bus.id}
                  />
                ))}
              </Picker>
            </View>

            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPicker(true)}>
              <Ionicons name="calendar-outline" size={18} color="#2E7D32" />
              <Text style={styles.dateButtonText}>
                {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Date'}
              </Text>
            </TouchableOpacity>
          </View>

          {hasActiveFilters && (
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Ionicons name="refresh-outline" size={16} color="#666" />
              <Text style={styles.clearFiltersText}>Clear Filters</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {showPicker && (
        <DateTimePicker 
          value={selectedDate || new Date()} 
          mode="date" 
          display="default" 
          onChange={onDateChange} 
        />
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Loading announcements...</Text>
          </View>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="notifications-off-outline" size={64} color="#E0E0E0" />
            </View>
            <Text style={styles.emptyTitle}>No Announcements Found</Text>
            <Text style={styles.emptySubtitle}>
              {hasActiveFilters 
                ? 'Try adjusting your filters to see more results.'
                : 'Check back later for new announcements.'
              }
            </Text>
            {hasActiveFilters && (
              <TouchableOpacity style={styles.clearFiltersButtonEmpty} onPress={clearFilters}>
                <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <Animated.View style={[styles.listWrapper, { opacity: fadeAnim }]}>
          <FlatList
            data={announcements}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#2E7D32']}
                tintColor="#2E7D32"
              />
            }
            renderItem={({ item, index }) => (
              <Animated.View 
                style={[
                  styles.card,
                  {
                    opacity: fadeAnim,
                    transform: [{
                      translateY: fadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [50, 0],
                      }),
                    }],
                  }
                ]}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Ionicons name="megaphone" size={20} color="#2E7D32" />
                  </View>
                  <View style={styles.busTagContainer}>
                    <View style={styles.busTag}>
                      <Ionicons name="bus" size={10} color="#fff" />
                      <Text style={styles.busTagText}>
                        {item.bus_identifier.replace(/^bus[-_]?/i, '').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <Text style={styles.messageText}>{item.message}</Text>
                
                <View style={styles.cardFooter}>
                  <View style={styles.timestampContainer}>
                    <Ionicons name="time-outline" size={12} color="#999" />
                    <Text style={styles.timestampText}>{formatDateTime(item.timestamp)}</Text>
                  </View>
                  <Text style={styles.fullTimestamp}>{formatFullDateTime(item.timestamp)}</Text>
                </View>
              </Animated.View>
            )}
            showsVerticalScrollIndicator={false}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F8F9FA' 
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTitle: { 
    fontSize: 28, 
    fontWeight: 'bold', 
    color: '#fff',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  filterToggle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterToggleActive: {
    backgroundColor: '#fff',
  },
  filterDot: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF5722',
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    overflow: 'hidden',
  },
  filterContent: {
    padding: 16,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8F5E8',
    height: 48,
    marginRight: 12,
  },
  pickerIcon: {
    paddingLeft: 16,
  },
  picker: {
    flex: 1,
    height: 48,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    minWidth: 100,
    justifyContent: 'center',
  },
  dateButtonText: { 
    color: '#2E7D32', 
    fontWeight: '600', 
    marginLeft: 6,
    fontSize: 14,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    alignSelf: 'center',
  },
  clearFiltersText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  centerContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    maxWidth: 280,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: { 
    fontSize: 24, 
    fontWeight: 'bold', 
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: { 
    fontSize: 16, 
    color: '#666', 
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  clearFiltersButtonEmpty: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  clearFiltersButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  listWrapper: {
    flex: 1,
  },
  listContainer: { 
    padding: 20, 
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E8F5E8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  busTagContainer: {
    alignItems: 'flex-end',
  },
  busTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 2,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  busTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  messageText: { 
    fontSize: 16, 
    lineHeight: 24, 
    color: '#333',
    marginBottom: 16,
    fontWeight: '400',
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F5F5F5',
    paddingTop: 12,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  timestampText: { 
    fontSize: 12, 
    color: '#666',
    fontWeight: '600',
    marginLeft: 4,
  },
  fullTimestamp: {
    fontSize: 11,
    color: '#999',
    fontStyle: 'italic',
  },
});