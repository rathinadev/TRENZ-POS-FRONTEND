import React, {useEffect, useRef, useState} from 'react';
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
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Svg, {Path} from 'react-native-svg';
import AnimatedButton from '../components/AnimatedButton';
import type {RootStackParamList} from '../types/business.types';
import { getBusinessSettings } from '../services/storage';
import { getVendorProfile } from '../services/auth';
import { GSTBillTemplate, NonGSTBillTemplate } from '../components/templates';
import type { GSTBillData, NonGSTBillData } from '../components/templates';
import { formatBill } from '../utils/billFormatter';

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

const BillSuccessScreen: React.FC<BillSuccessScreenProps> = ({navigation, route}) => {
  const billData = route.params;

  const [formattedBill, setFormattedBill] = useState<GSTBillData | NonGSTBillData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  const loadBusinessInfo = async () => {
    try {
      // Try to get vendor profile first
      let vendorProfile = await getVendorProfile();
      
      // Fallback to business settings if no vendor profile
      if (!vendorProfile) {
        const settings = await getBusinessSettings();
        vendorProfile = {
          business_name: settings?.business_name || 'Business Name',
          address: settings?.business_address || 'Address not set',
          gst_no: settings?.business_gst || '',
          fssai_license: settings?.business_fssai || '',
          phone: settings?.business_phone || '',
          footer_note: settings?.bill_footer_note || 'Thank You! Visit Again',
          logo_url: settings?.business_logo_path || settings?.logo_path,
        };
      }

      // Format the bill data
      const formatted = formatBill(billData, vendorProfile);
      setFormattedBill(formatted);
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

  const handlePrintBill = () => {
    console.log('Print bill:', billData.billNumber);
    // TODO: Integrate with Bluetooth printer
    // The formattedBill data is ready to be sent to thermal printer
    // Example: await printBill(formattedBill);
    Alert.alert('Print', 'Printing functionality will be available soon.');
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
              transform: [{scale: checkScale}],
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
              transform: [{translateY: titleTranslateY}],
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
              transform: [{scale: billScale}],
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
            transform: [{translateY: buttonsTranslateY}],
          },
        ]}>
        <View style={styles.buttonRow}>
          <View style={styles.buttonHalf}>
            <AnimatedButton
              title="Print Bill"
              onPress={handlePrintBill}
              variant="secondary"
            />
          </View>
          <View style={styles.buttonHalf}>
            <AnimatedButton
              title="New Bill"
              onPress={handleNewBill}
              variant="primary"
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