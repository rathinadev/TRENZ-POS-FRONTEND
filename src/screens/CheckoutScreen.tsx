import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList, BillingMode, PaymentMode } from '../types/business.types';
import { generateInvoiceNumber, getNextBillNumber } from '../utils/billNumbering';
import { calculateGST, calculateItemGSTBreakdowns } from '../utils/gstCalculator';
import { saveBill } from '../services/storage';
import { getVendorProfile, getAuthToken } from '../services/auth';

// Hardcoded API URL
const API_BASE_URL = 'http://13.233.163.98:8000';

type CheckoutScreenProps = NativeStackScreenProps<RootStackParamList, 'Checkout'>;

const CheckoutScreen: React.FC<CheckoutScreenProps> = ({ navigation, route }) => {
  const { cart } = route.params;
  
  // Billing mode state
  const [billingMode, setBillingMode] = useState<BillingMode>('gst');
  
  // Default to Intra-State (False) since buttons are removed
  const [isInterState, setIsInterState] = useState(false);
  
  // GST Type: Default to 'exclusive'
  const [gstType, setGstType] = useState<'inclusive' | 'exclusive'>('exclusive');
  
  // Discount state
  const [discountAmount, setDiscountAmount] = useState('');
  
  // Payment state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  
  // Customer info (optional)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Notes
  const [notes, setNotes] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);

  // Animation Refs
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const summaryOpacity = useRef(new Animated.Value(0)).current;
  const summaryScale = useRef(new Animated.Value(0.95)).current;
  const billingModeOpacity = useRef(new Animated.Value(0)).current;
  const billingModeTranslateY = useRef(new Animated.Value(20)).current;
  const discountOpacity = useRef(new Animated.Value(0)).current;
  const discountTranslateY = useRef(new Animated.Value(20)).current;
  const paymentOpacity = useRef(new Animated.Value(0)).current;
  const paymentTranslateY = useRef(new Animated.Value(20)).current;
  const billOpacity = useRef(new Animated.Value(0)).current;
  const billTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Start animations sequence
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(headerTranslateY, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(summaryOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(summaryScale, { toValue: 1, friction: 6, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(billingModeOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(billingModeTranslateY, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.timing(discountOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(discountTranslateY, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(700),
      Animated.parallel([
        Animated.timing(paymentOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(paymentTranslateY, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();

    Animated.sequence([
      Animated.delay(850),
      Animated.parallel([
        Animated.timing(billOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(billTranslateY, { toValue: 0, friction: 7, tension: 40, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  // Override cart items with selected GST type for this bill
  const cartWithGSTType = cart.map(item => ({
    ...item,
    price_type: gstType,
  }));

  // Calculate bill totals using GST calculator
  const gstCalculation = calculateGST(
    cartWithGSTType,
    billingMode,
    parseFloat(discountAmount) || 0,
    isInterState
  );

  const itemBreakdowns = calculateItemGSTBreakdowns(
    cartWithGSTType,
    billingMode,
    parseFloat(discountAmount) || 0
  );

  // Calculate amount paid and change
  const calculatedAmountPaid = parseFloat(amountPaid) || gstCalculation.total;
  const changeAmount = Math.max(0, calculatedAmountPaid - gstCalculation.total);

  const handleGenerateBill = async () => {
    if (isGenerating) return;

    // Validate payment reference for UPI/Card
    if ((paymentMode === 'upi' || paymentMode === 'card') && !paymentReference.trim()) {
      Alert.alert('Error', 'Please enter payment reference (Transaction ID) for UPI/Card payment');
      return;
    }

    // Validate amount paid for credit
    if (paymentMode === 'credit' && parseFloat(amountPaid) > 0) {
      Alert.alert('Error', 'Credit payment should have amount paid as 0');
      return;
    }

    try {
      setIsGenerating(true);

      // 1. Prepare Data
      const invoiceNumber = await generateInvoiceNumber(billingMode);
      const billNumber = await getNextBillNumber();
      const timestamp = new Date().toISOString();
      const billDate = new Date().toISOString().split('T')[0];

      // Transform cart items to bill items format
      const billItems = itemBreakdowns.map((breakdown, index) => {
        const cartItem = cart[index];
        return {
          id: `${cartItem.id}-${Date.now()}-${index}`,
          item_id: cartItem.id,
          name: cartItem.name,
          price: cartItem.price,
          mrp_price: breakdown.mrpPrice,
          price_type: breakdown.priceType,
          gst_percentage: breakdown.gstPercentage,
          quantity: breakdown.quantity,
          subtotal: breakdown.itemSubtotal,
          item_gst: breakdown.itemGST,
          additional_discount: breakdown.itemDiscount,
          discount_amount: breakdown.itemDiscount,
          veg_nonveg: cartItem.veg_nonveg,
        };
      });

      // 2. Save Locally (Offline First)
      const localBillId = await saveBill({
        invoice_number: invoiceNumber,
        bill_number: billNumber,
        billing_mode: billingMode,
        items: billItems,
        subtotal: gstCalculation.subtotal,
        discount_amount: gstCalculation.totalDiscount,
        discount_percentage: gstCalculation.totalDiscount > 0 
          ? (gstCalculation.totalDiscount / (gstCalculation.subtotal + gstCalculation.totalDiscount)) * 100 
          : 0,
        cgst_amount: gstCalculation.cgst,
        sgst_amount: gstCalculation.sgst,
        igst_amount: gstCalculation.igst,
        total_tax: gstCalculation.totalTax,
        total_amount: gstCalculation.total,
        payment_mode: paymentMode,
        payment_reference: paymentReference.trim() || undefined,
        amount_paid: paymentMode === 'credit' ? 0 : calculatedAmountPaid,
        change_amount: changeAmount,
        customer_name: customerName.trim() || undefined,
        customer_phone: customerPhone.trim() || undefined,
        notes: notes.trim() || undefined,
        bill_date: billDate,
      });

      console.log('✅ Bill saved locally:', invoiceNumber);

      // 3. Attempt Immediate API Sync (Online)
      try {
        const token = await getAuthToken();
        const vendorProfile = await getVendorProfile();
        
        if (token) {
          const billPayload = {
            bill_data: {
              invoice_number: invoiceNumber,
              bill_id: localBillId,
              billing_mode: billingMode,
              restaurant_name: vendorProfile?.business_name || "Store",
              address: vendorProfile?.address || "",
              gstin: vendorProfile?.gst_no || "",
              fssai_license: vendorProfile?.fssai_license,
              bill_number: billNumber,
              bill_date: billDate,
              items: billItems,
              subtotal: gstCalculation.subtotal,
              cgst: gstCalculation.cgst,
              sgst: gstCalculation.sgst,
              igst: gstCalculation.igst,
              total_tax: gstCalculation.totalTax,
              total: gstCalculation.total,
              payment_mode: paymentMode,
              amount_paid: paymentMode === 'credit' ? 0 : calculatedAmountPaid,
              timestamp: timestamp
            },
            device_id: "mobile-device-001"
          };

          console.log('📡 Attempting immediate sync for bill:', invoiceNumber);
          
          const response = await fetch(`${API_BASE_URL}/backup/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Token ${token}`,
            },
            body: JSON.stringify([billPayload])
          });

          if (response.ok) {
             console.log('✅ Immediate sync successful!');
          } else {
             const errText = await response.text();
             console.log('⚠️ Sync response error:', response.status, errText);
          }
        }
      } catch (syncError) {
        console.log('⚠️ Immediate sync failed (bill is safe locally):', syncError);
      }

      // 4. Navigate to Success
      navigation.navigate('BillSuccess', {
        cart,
        subtotal: gstCalculation.subtotal,
        discount: gstCalculation.totalDiscount,
        billing_mode: billingMode,
        cgst: gstCalculation.cgst,
        sgst: gstCalculation.sgst,
        igst: gstCalculation.igst,
        gst: gstCalculation.totalTax,
        total_tax: gstCalculation.totalTax,
        total: gstCalculation.total,
        paymentMethod: paymentMode,
        paymentReference: paymentReference.trim() || undefined,
        amountPaid: calculatedAmountPaid,
        changeAmount: changeAmount,
        billNumber,
        invoiceNumber,
        timestamp,
      });

    } catch (error) {
      console.error('Failed to generate bill:', error);
      Alert.alert('Error', 'Failed to generate bill. Please try again.', [{ text: 'OK' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          },
        ]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: summaryOpacity,
              transform: [{ scale: summaryScale }],
            },
          ]}>
          <Text style={styles.cardTitle}>Order Summary</Text>
          {cart.map((item, index) => {
            const breakdown = itemBreakdowns[index];
            return (
              <View key={item.id} style={styles.summaryItem}>
                <View style={styles.summaryItemLeft}>
                  <Text style={styles.itemName}>
                    {item.name}
                    {item.veg_nonveg && (
                      <Text style={styles.vegNonVeg}>
                        {' '}({item.veg_nonveg === 'veg' ? 'Veg' : 'Non-Veg'})
                      </Text>
                    )}
                  </Text>
                  <Text style={styles.itemPrice}>
                    ₹{Number(breakdown.mrpPrice).toFixed(2)} × {item.quantity}
                    {breakdown.itemDiscount > 0 && (
                      <Text style={styles.discountText}>
                        {' '}(-₹{Number(breakdown.itemDiscount).toFixed(2)})
                      </Text>
                    )}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>
                  ₹{Number(breakdown.itemTotal).toFixed(2)}
                </Text>
              </View>
            );
          })}
        </Animated.View>

        {/* Billing Mode Selection */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: billingModeOpacity,
              transform: [{ translateY: billingModeTranslateY }],
            },
          ]}>
          <Text style={styles.cardTitle}>Billing Mode</Text>
          <View style={styles.billingModeToggle}>
            <TouchableOpacity
              style={[
                styles.billingModeButton,
                billingMode === 'gst' && styles.billingModeButtonActive,
              ]}
              onPress={() => setBillingMode('gst')}
              disabled={isGenerating}>
              <Text
                style={[
                  styles.billingModeText,
                  billingMode === 'gst' && styles.billingModeTextActive,
                ]}>
                GST
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.billingModeButton,
                billingMode === 'non_gst' && styles.billingModeButtonActive,
              ]}
              onPress={() => setBillingMode('non_gst')}
              disabled={isGenerating}>
              <Text
                style={[
                  styles.billingModeText,
                  billingMode === 'non_gst' && styles.billingModeTextActive,
                ]}>
                Non-GST
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Discount */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: discountOpacity,
              transform: [{ translateY: discountTranslateY }],
            },
          ]}>
          <Text style={styles.cardTitle}>Bill-Level Discount</Text>
          <TextInput
            style={styles.discountInput}
            placeholder="0"
            placeholderTextColor="#999"
            value={discountAmount}
            onChangeText={setDiscountAmount}
            keyboardType="decimal-pad"
            editable={!isGenerating}
          />
        </Animated.View>

        {/* Payment Method */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: paymentOpacity,
              transform: [{ translateY: paymentTranslateY }],
            },
          ]}>
          <Text style={styles.cardTitle}>Payment Method</Text>
          <View style={styles.paymentGrid}>
            {(['cash', 'upi', 'card', 'credit', 'other'] as PaymentMode[]).map((mode) => (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.paymentButton,
                  paymentMode === mode && styles.paymentButtonActive,
                ]}
                onPress={() => {
                  setPaymentMode(mode);
                  if (mode === 'credit') {
                    setAmountPaid('0');
                  } else if (!amountPaid || amountPaid === '0') {
                    setAmountPaid(gstCalculation.total.toFixed(2));
                  }
                }}
                disabled={isGenerating}>
                <Text
                  style={[
                    styles.paymentText,
                    paymentMode === mode && styles.paymentTextActive,
                  ]}>
                  {mode.charAt(0).toUpperCase() + mode.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Payment Reference (for UPI/Card) */}
          {(paymentMode === 'upi' || paymentMode === 'card' || paymentMode === 'other') && (
            <View style={styles.paymentReferenceContainer}>
              <Text style={styles.paymentReferenceLabel}>
                {paymentMode === 'upi' ? 'UPI Transaction ID' : 
                 paymentMode === 'card' ? 'Card Transaction ID' : 
                 'Reference Number'}
              </Text>
              <TextInput
                style={styles.paymentReferenceInput}
                placeholder="Enter transaction ID"
                placeholderTextColor="#999"
                value={paymentReference}
                onChangeText={setPaymentReference}
                editable={!isGenerating}
              />
            </View>
          )}

          {/* Amount Paid (for Cash/Credit) */}
          {paymentMode !== 'credit' && (
            <View style={styles.amountPaidContainer}>
              <Text style={styles.amountPaidLabel}>Amount Paid</Text>
              <TextInput
                style={styles.amountPaidInput}
                placeholder={gstCalculation.total.toFixed(2)}
                placeholderTextColor="#999"
                value={amountPaid}
                onChangeText={setAmountPaid}
                keyboardType="decimal-pad"
                editable={!isGenerating}
              />
              {changeAmount > 0 && (
                <Text style={styles.changeAmountText}>
                  Change: ₹{changeAmount.toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {/* Credit Payment Info */}
          {paymentMode === 'credit' && (
            <View style={styles.creditInfoContainer}>
              <Text style={styles.creditInfoText}>
                Outstanding Amount: ₹{gstCalculation.total.toFixed(2)}
              </Text>
              <Text style={styles.creditInfoSubtext}>
                This bill will be marked as pending payment
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Customer Info (Optional) */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: billOpacity,
              transform: [{ translateY: billTranslateY }],
            },
          ]}>
          <Text style={styles.cardTitle}>Customer Info (Optional)</Text>
          <TextInput
            style={styles.customerInput}
            placeholder="Customer Name"
            placeholderTextColor="#999"
            value={customerName}
            onChangeText={setCustomerName}
            editable={!isGenerating}
          />
          <TextInput
            style={[styles.customerInput, styles.customerInputMargin]}
            placeholder="Customer Phone"
            placeholderTextColor="#999"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            editable={!isGenerating}
          />
        </Animated.View>

        {/* Bill Details */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: billOpacity,
              transform: [{ translateY: billTranslateY }],
            },
          ]}>
          <Text style={styles.cardTitle}>Bill Details</Text>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>Subtotal</Text>
            <Text style={styles.billValue}>₹{gstCalculation.subtotal.toFixed(2)}</Text>
          </View>
          
          {gstCalculation.totalDiscount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Discount</Text>
              <Text style={styles.billValue}>-₹{gstCalculation.totalDiscount.toFixed(2)}</Text>
            </View>
          )}
          
          {billingMode === 'gst' && gstCalculation.totalTax > 0 && (
            <>
              {!isInterState ? (
                <>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>CGST</Text>
                    <Text style={styles.billValue}>₹{gstCalculation.cgst.toFixed(2)}</Text>
                  </View>
                  <View style={styles.billRow}>
                    <Text style={styles.billLabel}>SGST</Text>
                    <Text style={styles.billValue}>₹{gstCalculation.sgst.toFixed(2)}</Text>
                  </View>
                </>
              ) : (
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>IGST</Text>
                  <Text style={styles.billValue}>₹{gstCalculation.igst.toFixed(2)}</Text>
                </View>
              )}
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Total Tax</Text>
                <Text style={styles.billValue}>₹{gstCalculation.totalTax.toFixed(2)}</Text>
              </View>
            </>
          )}
          
          <View style={[styles.billRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>₹{gstCalculation.total.toFixed(2)}</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Generate Bill Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={handleGenerateBill}
          disabled={isGenerating}>
          {isGenerating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.generateText}>Generate Bill</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  backText: {
    fontSize: 24,
    color: '#C62828',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  summaryItemLeft: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  vegNonVeg: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '400',
  },
  itemPrice: {
    fontSize: 14,
    color: '#666666',
  },
  discountText: {
    color: '#C62828',
    fontWeight: '600',
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  billingModeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  billingModeButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  billingModeButtonActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  billingModeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  billingModeTextActive: {
    color: '#FFFFFF',
  },
  discountInput: {
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  paymentButton: {
    flex: 1,
    minWidth: '30%',
    height: 56,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E0E0E0',
  },
  paymentButtonActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  paymentText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  paymentTextActive: {
    color: '#FFFFFF',
  },
  paymentReferenceContainer: {
    marginTop: 12,
  },
  paymentReferenceLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  paymentReferenceInput: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  amountPaidContainer: {
    marginTop: 12,
  },
  amountPaidLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  amountPaidInput: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  changeAmountText: {
    fontSize: 14,
    color: '#C62828',
    fontWeight: '600',
    marginTop: 8,
  },
  creditInfoContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },
  creditInfoText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    marginBottom: 4,
  },
  creditInfoSubtext: {
    fontSize: 14,
    color: '#666666',
  },
  customerInput: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  customerInputMargin: {
    marginTop: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billLabel: {
    fontSize: 16,
    color: '#666666',
  },
  billValue: {
    fontSize: 16,
    color: '#333333',
    fontWeight: '600',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  footer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  generateButton: {
    backgroundColor: '#C62828',
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default CheckoutScreen;