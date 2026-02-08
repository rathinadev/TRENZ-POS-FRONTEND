import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Svg, { Path } from 'react-native-svg';
import AnimatedButton from '../components/AnimatedButton';
import type { RootStackParamList } from '../types/business.types';
import API from '../services/api';
import { getVendorProfile } from '../services/auth';
import { GSTBillTemplate, NonGSTBillTemplate } from '../components/templates';
import type { GSTBillData, NonGSTBillData } from '../components/templates';
import { formatBill } from '../utils/billFormatter';
import { PrinterService } from '../services/printer';
import { getBusinessSettings } from '../services/storage';

type BillSuccessScreenProps = NativeStackScreenProps<RootStackParamList, 'BillSuccess'>;

const CheckIcon = () => (
  <Svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <Path
      d="M10 24L18 32L38 12"
      stroke="#FFFFFF"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const BillSuccessScreen: React.FC<BillSuccessScreenProps> = ({ navigation, route }) => {
  const billData = route.params;

  const [formattedBill, setFormattedBill] = useState<GSTBillData | NonGSTBillData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const [paperWidth] = useState<58 | 80>(58); // Can be made configurable

  const checkOpacity = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const billOpacity = useRef(new Animated.Value(0)).current;
  const billScale = useRef(new Animated.Value(0.95)).current;
  const buttonsOpacity = useRef(new Animated.Value(0)).current;
  const buttonsTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadBusinessInfo();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      startAnimations();
    }
  }, [isLoading]);

  const autoPrintDone = useRef(false);
  // Auto-print once when bill is ready and auto_print setting is on
  useEffect(() => {
    if (isLoading || !formattedBill || isPrinting || autoPrintDone.current) return;
    let cancelled = false;
    const run = async () => {
      const settings = await getBusinessSettings();
      if (settings?.auto_print !== 1 || cancelled) return;
      autoPrintDone.current = true;
      try {
        setIsPrinting(true);
        await PrinterService.printBill(formattedBill!, billData.billing_mode === 'gst');
        if (!cancelled) Alert.alert('Success', 'Bill printed successfully!');
      } catch (e: any) {
        if (!cancelled) Alert.alert('Print Error', e.message || 'Printer not ready. Set up in Printer Setup, then try again.');
        autoPrintDone.current = false;
      } finally {
        if (!cancelled) setIsPrinting(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [formattedBill, isLoading]);

  const loadBusinessInfo = async () => {
    try {
      // Try to get vendor profile from cache first
      let vendorProfile = await getVendorProfile();

      // If not in cache, try fetching from API
      if (!vendorProfile) {
        try {
          console.log('🔄 Fetching vendor profile from API...');
          vendorProfile = await API.auth.getProfile();
        } catch (err) {
          console.warn('⚠️ Failed to fetch vendor profile from API, falling back to bill snapshot');
        }
      }

      // Fallback to bill snapshot if no vendor profile found (Online-Only robust fallback)
      if (!vendorProfile) {
        vendorProfile = {
          id: billData.vendor_id || 'unknown_vendor',
          business_name: billData.restaurant_name || 'Business Name',
          address: billData.address || '',
          gst_no: billData.gstin || billData.gst_no || '',
          fssai_license: billData.fssai_license || '',
          phone: billData.customer_phone || '',
          footer_note: 'Thank You! Visit Again',
          logo_url: undefined,
          username: 'vendor', // dummy
          email: '', // dummy
          is_approved: true,
        };
      }

      // Format the bill data
      if (vendorProfile) {
        const formatted = formatBill(billData, vendorProfile);
        setFormattedBill(formatted);
      } else {
        // Should not happen due to fallback, but for strict TS
        console.warn('No vendor profile available even after fallback');
        const fallbackVendor = {
          id: 'unknown',
          business_name: 'Business',
          address: '',
          phone: '',
          gst_no: '',
          is_approved: true
        };
        const formatted = formatBill(billData, fallbackVendor as any);
        setFormattedBill(formatted);
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
      Alert.alert('Error', 'Failed to load bill details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const startAnimations = () => {
    // Check icon
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(checkOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(checkScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Title
    Animated.sequence([
      Animated.delay(500),
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Bill details
    Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(billOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(billScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Buttons
    Animated.sequence([
      Animated.delay(900),
      Animated.parallel([
        Animated.timing(buttonsOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(buttonsTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const handlePrintBill = async () => {
    if (!formattedBill) {
      Alert.alert('Error', 'Bill data not ready');
      return;
    }

    try {
      setIsPrinting(true);
      
      // Get paper width from settings
      const settings = await getBusinessSettings();
      const paperWidthSetting: 58 | 80 = (settings?.paper_size === '80mm' ? 80 : 58) as 58 | 80;
      
      // Print the bill
      await PrinterService.printBill(formattedBill, billData.billing_mode === 'gst');
      
      Alert.alert('Success', 'Bill printed successfully!');
    } catch (error: any) {
      console.error('Failed to print bill:', error);
      Alert.alert('Print Error', error.message || 'Printer not ready. Is it on? Try Printer Setup → Connect, then print again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleNewBill = () => {
    // Navigate back to billing screen
    navigation.navigate('Billing');
  };

  if (isLoading || !formattedBill) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Loading bill...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Success Icon */}
        <Animated.View
          style={[
            styles.iconContainer,
            {
              opacity: checkOpacity,
              transform: [{ scale: checkScale }],
            },
          ]}>
          <CheckIcon />
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}>
          <Text style={styles.title}>Bill Generated Successfully</Text>
          <Text style={styles.billNumber}>
            {billData.billing_mode === 'gst' ? 'GST Bill' : 'Non-GST Bill'} • {billData.billNumber}
          </Text>
        </Animated.View>

        {/* Bill Template */}
        <Animated.View
          style={[
            styles.billTemplateContainer,
            {
              opacity: billOpacity,
              transform: [{ scale: billScale }],
            },
          ]}>
          {billData.billing_mode === 'gst' ? (
            <GSTBillTemplate
              data={formattedBill as GSTBillData}
              paperWidth={paperWidth}
            />
          ) : (
            <NonGSTBillTemplate
              data={formattedBill as NonGSTBillData}
              paperWidth={paperWidth}
            />
          )}
        </Animated.View>
      </ScrollView>

      {/* Buttons */}
      <Animated.View
        style={[
          styles.buttonsContainer,
          {
            opacity: buttonsOpacity,
            transform: [{ translateY: buttonsTranslateY }],
          },
        ]}>
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <AnimatedButton
              title={isPrinting ? "Printing..." : "Print Bill"}
              onPress={handlePrintBill}
              variant="primary"
              disabled={isPrinting}
            />
          </View>
          <View style={styles.buttonHalf}>
            <AnimatedButton
              title="New Bill"
              onPress={handleNewBill}
              variant="secondary"
            />
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 8,
  },
  billNumber: {
    fontSize: 14,
    color: '#666666',
  },
  billTemplateContainer: {
    marginHorizontal: 16,
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  buttonHalf: {
    flex: 1,
  },
});

export default BillSuccessScreen;