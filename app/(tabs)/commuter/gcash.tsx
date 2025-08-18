import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const { width } = Dimensions.get('window');

const ANDROID_MARKET = 'market://details?id=com.globe.gcash.android';
const ANDROID_PLAY   = 'https://play.google.com/store/apps/details?id=com.globe.gcash.android';
const IOS_STORE      = 'itms-apps://itunes.apple.com/ph/app/gcash/id520020791';
const IOS_HTTP       = 'https://apps.apple.com/ph/app/gcash/id520020791';

export default function GCashGuide() {
  const router = useRouter();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const scaleAnims = useMemo(() => 
    Array(5).fill(0).map(() => new Animated.Value(1)), 
    []
  );

  const steps = useMemo(
    () => [
      {
        num: 1,
        title: 'Open GCash App',
        subtitle: 'Launch from your phone',
        body: 'Open the GCash app on your phone. Make sure you have enough balance for your fare payment.',
        icon: 'phone-portrait-outline' as const,
        color: '#007DFE',
        bgColor: '#E3F2FD',
        tip: 'Need GCash? Download it from the App Store or Play Store.',
        action: {
          label: 'Open GCash',
          icon: 'open-outline' as const,
          onPress: () => openGCash(),
        },
      },
      {
        num: 2,
        title: 'Tap "Send"',
        subtitle: 'Find the blue icon',
        body: 'Look for the blue paper plane "Send" icon on your GCash dashboard. It\'s one of the main buttons.',
        icon: 'send' as const,
        color: '#2196F3',
        bgColor: '#E8F5FF',
        tip: 'The Send button is usually at the bottom of your screen.',
      },
      {
        num: 3,
        title: 'Choose Express Send',
        subtitle: 'Quick payment option',
        body: 'Select "Express Send" for the fastest way to send money. Perfect for quick fare payments!',
        icon: 'flash' as const,
        color: '#FF6B6B',
        bgColor: '#FFEBEE',
        tip: 'Express Send skips extra steps for faster transactions.',
      },
      {
        num: 4,
        title: 'Scan QR Code',
        subtitle: 'Point at PAO\'s QR',
        body: 'Tap "Scan QR Code" and point your camera at the PAO\'s official GCash QR code.',
        icon: 'qr-code' as const,
        color: '#4CAF50',
        bgColor: '#E8F5E9',
        tip: 'Hold your phone steady until the QR code is recognized.',
      },
      {
        num: 5,
        title: 'Confirm Payment',
        subtitle: 'Review and complete',
        body: 'Check the amount and recipient details, then confirm. Your receipt will appear in the app!',
        icon: 'checkmark-circle' as const,
        color: '#00C853',
        bgColor: '#E0F7E0',
        tip: 'Always verify the recipient name before confirming.',
        action: {
          label: 'View Receipts',
          icon: 'receipt-outline' as const,
          onPress: () => router.push('/commuter/my-receipts'),
        },
      },
    ],
    [router]
  );

  const openGCash = useCallback(async () => {
    const scheme = 'gcash://';
    try {
      const can = await Linking.canOpenURL(scheme);
      if (can) return Linking.openURL(scheme);

      if (Platform.OS === 'android') {
        const ok = await Linking.canOpenURL(ANDROID_MARKET);
        return Linking.openURL(ok ? ANDROID_MARKET : ANDROID_PLAY);
      } else {
        const ok = await Linking.canOpenURL(IOS_STORE);
        return Linking.openURL(ok ? IOS_STORE : IOS_HTTP);
      }
    } catch (e) {
      Alert.alert('Unable to open GCash', 'Please open the GCash app manually and follow the steps.');
    }
  }, []);

  const handleStepPress = useCallback((index: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnims[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    setExpandedStep(expandedStep === index ? null : index);
  }, [expandedStep, scaleAnims]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
    
        
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.headerTextBlock}>
              <Text style={styles.h1}>GCash Payment Guide</Text>
              <Text style={styles.h2}>5 simple steps to pay your fare</Text>
            </View>
            <View style={styles.headerIconWrapper}>
              <View style={styles.headerIcon}>
                <Image
                  source={require('../../../assets/images/gcash.png')}
                  style={styles.headerIconImg}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
          
       
        </View>
      </View>

      <ScrollView 
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Roadmap */}
        <View style={styles.roadmap}>
          {steps.map((step, index) => (
            <View key={step.num}>
              <Animated.View
                style={[
                  styles.stepCard,
                  { transform: [{ scale: scaleAnims[index] }] }
                ]}
              >
                <TouchableOpacity
                  onPress={() => handleStepPress(index)}
                  activeOpacity={0.9}
                  style={styles.stepTouchable}
                >
                  {/* Step Header */}
                  <View style={styles.stepHeader}>
                    <View style={styles.stepLeft}>
                      <View style={[styles.stepNumber, { backgroundColor: step.bgColor }]}>
                        <Text style={[styles.stepNumberText, { color: step.color }]}>
                          {step.num}
                        </Text>
                      </View>
                      <View style={styles.stepTitleBlock}>
                        <Text style={styles.stepTitle}>{step.title}</Text>
                        <Text style={styles.stepSubtitle}>{step.subtitle}</Text>
                      </View>
                    </View>
                    
                    <View style={[styles.stepIconCircle, { backgroundColor: step.bgColor }]}>
                      <Ionicons name={step.icon} size={24} color={step.color} />
                    </View>
                  </View>

                  {/* Expanded Content */}
                  {expandedStep === index && (
                    <Animated.View style={styles.expandedContent}>
                      <Text style={styles.stepBody}>{step.body}</Text>
                      
                      {step.tip && (
                        <View style={[styles.tipBox, { backgroundColor: step.bgColor }]}>
                          <Ionicons name="bulb" size={16} color={step.color} />
                          <Text style={[styles.tipText, { color: step.color }]}>
                            {step.tip}
                          </Text>
                        </View>
                      )}

                      {step.action && (
                        <TouchableOpacity 
                          style={[styles.actionButton, { backgroundColor: step.color }]}
                          onPress={step.action.onPress}
                          activeOpacity={0.8}
                        >
                          <Ionicons name={step.action.icon} size={18} color="#fff" />
                          <Text style={styles.actionButtonText}>{step.action.label}</Text>
                        </TouchableOpacity>
                      )}
                    </Animated.View>
                  )}
                </TouchableOpacity>
              </Animated.View>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <View style={styles.connector}>
                  <View style={styles.connectorLine} />
                  <Ionicons 
                    name="chevron-down" 
                    size={16} 
                    color="#CBD5E1" 
                    style={styles.connectorIcon}
                  />
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={openGCash}
            activeOpacity={0.8}
          >
            <View style={styles.primaryButtonIcon}>
              <Image
                source={require('../../../assets/images/gcash.png')}
                style={styles.gcashButtonIcon}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.primaryButtonText}>Open GCash Now</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>

       
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { 
    flex: 1, 
    backgroundColor: '#F8FAF9' 
  },

  header: {
    backgroundColor: '#2E7D32',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    left: 20,
    zIndex: 1,
    padding: 8,
  },

  headerContent: {
    paddingHorizontal: 20,
    marginTop: 20,
  },

  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  headerTextBlock: { 
    flex: 1, 
    paddingRight: 16 
  },
  
  h1: { 
    color: '#fff', 
    fontSize: 26, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  
  h2: { 
    color: 'rgba(255,255,255,0.85)', 
    fontSize: 14, 
    marginTop: 4, 
    fontWeight: '500' 
  },
  
  headerIconWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },

  headerIcon: {
    backgroundColor: '#fff',
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },

  headerIconImg: {
    width: 40,
    height: 40,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },

  statItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },

  statText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },

  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  scroll: { 
    padding: 20, 
    paddingBottom: 40 
  },

  roadmap: {
    marginBottom: 24,
  },

  stepCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },

  stepTouchable: {
    padding: 20,
  },

  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  stepLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  stepNumberText: {
    fontSize: 18,
    fontWeight: '800',
  },

  stepTitleBlock: {
    flex: 1,
  },

  stepTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1B5E20',
    marginBottom: 2,
  },

  stepSubtitle: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  stepIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  expandedContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },

  stepBody: {
    fontSize: 15,
    color: '#475569',
    lineHeight: 22,
    marginBottom: 12,
  },

  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },

  tipText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },

  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    marginTop: 4,
  },

  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  connector: {
    alignItems: 'center',
    height: 32,
    marginVertical: -4,
  },

  connectorLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E2E8F0',
    marginTop: -4,
  },

  connectorIcon: {
    position: 'absolute',
    top: '50%',
    marginTop: -8,
    backgroundColor: '#F8FAF9',
    paddingHorizontal: 4,
  },

  bottomActions: {
    gap: 16,
  },

  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D32',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 5,
  },

  primaryButtonIcon: {
    width: 28,
    height: 28,
    backgroundColor: '#fff',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },

  gcashButtonIcon: {
    width: 20,
    height: 20,
  },

  primaryButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  secondaryActions: {
    flexDirection: 'row',
    gap: 12,
  },

  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: '#E8F5E8',
  },

  secondaryButtonText: {
    color: '#2E7D32',
    fontSize: 14,
    fontWeight: '600',
  },
});