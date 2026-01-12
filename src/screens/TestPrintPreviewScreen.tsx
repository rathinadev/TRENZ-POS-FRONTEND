import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';

type TestPrintPreviewScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TestPrintPreview'>;
};

type PrintStatus = 'idle' | 'printing' | 'success' | 'failure';

interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  gst: string;
}

interface PrinterInfo {
  name: string;
  paperSize: string;
  connected: boolean;
}

const TestPrintPreviewScreen: React.FC<TestPrintPreviewScreenProps> = ({ navigation }) => {
  const [printStatus, setPrintStatus] = useState<PrintStatus>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>({
    name: 'Sample Restaurant',
    address: '123 Main Street, City',
    phone: '+91 98765 43210',
    gst: '29ABCDE1234F1Z5',
  });
  const [printerInfo, setPrinterInfo] = useState<PrinterInfo>({
    name: 'Epson TM-T82',
    paperSize: '80mm',
    connected: false,
  });
  const [printTime, setPrintTime] = useState<string>('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const settings = await getBusinessSettings();

      if (settings) {
        // Load business info
        setBusinessInfo({
          name: settings.business_name || 'Sample Restaurant',
          address: settings.business_address || '123 Main Street, City',
          phone: settings.business_phone || '+91 98765 43210',
          gst: settings.business_gst || '29ABCDE1234F1Z5',
        });

        // Load printer info
        setPrinterInfo({
          name: settings.printer_name || 'Epson TM-T82',
          paperSize: settings.paper_size || '80mm',
          connected: settings.printer_connected === 1,
        });
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      // Continue with defaults
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (date: Date): string => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const handlePrint = async () => {
    setPrintStatus('printing');
    const currentTime = formatTime(new Date());
    setPrintTime(currentTime);

    try {
      // Simulate printing process
      await new Promise<void>(resolve => setTimeout(() => resolve(), 2000));

      // Check printer connection from database
      const settings = await getBusinessSettings();
      const isConnected = settings?.printer_connected === 1;

      if (isConnected) {
        // Success - save test print info
        const timestamp = new Date().toISOString();
        const testPrintCount = (settings?.test_print_count || 0) + 1;

        await saveBusinessSettings({
          last_test_print_date: timestamp,
          test_print_count: testPrintCount,
        });

        setPrintStatus('success');
      } else {
        // Failure - printer not connected
        setPrintStatus('failure');
      }
    } catch (error) {
      console.error('Print error:', error);
      setPrintStatus('failure');
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  const handleDismissResult = () => {
    setPrintStatus('idle');
    navigation.goBack();
  };

  const formatDate = (): string => {
    const now = new Date();
    const day = now.getDate();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const year = now.getFullYear();
    const time = formatTime(now);
    return `${day} ${month} ${year}, ${time}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading preview...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>Test Print Preview</Text>
          <Text style={styles.subtitle}>Sample bill for printer testing</Text>
        </View>
      </Animated.View>

      {/* Bill Preview */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View
          style={[
            styles.billContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Business Header */}
          <View style={styles.businessHeader}>
            <Text style={styles.businessName}>{businessInfo.name}</Text>
            <Text style={styles.businessAddress}>{businessInfo.address}</Text>
            <Text style={styles.businessPhone}>Phone: {businessInfo.phone}</Text>
            <Text style={styles.businessGST}>GST: {businessInfo.gst}</Text>
          </View>

          {/* Bill Details */}
          <View style={styles.billDetails}>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Bill No:</Text>
              <Text style={styles.billValue}>#TEST-001</Text>
            </View>
            <View style={styles.billRow}>
              <Text style={styles.billLabel}>Date:</Text>
              <Text style={styles.billValue}>{formatDate()}</Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.itemsSection}>
            <View style={styles.itemContainer}>
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>Masala Dosa</Text>
                <Text style={styles.itemPrice}>₹120</Text>
              </View>
              <Text style={styles.itemQty}>Qty: 2 × ₹60</Text>
            </View>

            <View style={styles.itemContainer}>
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>Filter Coffee</Text>
                <Text style={styles.itemPrice}>₹40</Text>
              </View>
              <Text style={styles.itemQty}>Qty: 1 × ₹40</Text>
            </View>

            <View style={styles.itemContainer}>
              <View style={styles.itemRow}>
                <Text style={styles.itemName}>Vada (2 pcs)</Text>
                <Text style={styles.itemPrice}>₹30</Text>
              </View>
              <Text style={styles.itemQty}>Qty: 1 × ₹30</Text>
            </View>
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>₹190</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>GST (5%)</Text>
              <Text style={styles.totalValue}>₹9.50</Text>
            </View>
          </View>

          {/* Grand Total */}
          <View style={styles.grandTotalSection}>
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>Total</Text>
              <Text style={styles.grandTotalValue}>₹199.50</Text>
            </View>
          </View>

          {/* Footer Message */}
          <View style={styles.footerSection}>
            <Text style={styles.footerText}>Thank you for dining with us!</Text>
            <Text style={styles.footerText}>Visit again soon</Text>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          activeOpacity={0.9}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.printButton}
          onPress={handlePrint}
          activeOpacity={0.9}
        >
          <Text style={styles.printButtonText}>Print</Text>
        </TouchableOpacity>
      </View>

      {/* Printing Modal */}
      <Modal
        visible={printStatus === 'printing'}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.printingCard}>
            <View style={styles.spinnerContainer}>
              <ActivityIndicator size="large" color="#C62828" />
            </View>
            <Text style={styles.printingTitle}>Testing Printer…</Text>
            <Text style={styles.printingText}>
              Checking printer connection and sending test print
            </Text>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={printStatus === 'success'}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleDismissResult}
        >
          <View style={styles.resultContainer}>
            <View style={styles.iconContainer}>
              <View style={styles.printerIcon}>
                <Text style={styles.printerIconText}>🖨</Text>
              </View>
              <View style={styles.successBadge}>
                <Text style={styles.successCheckmark}>✓</Text>
              </View>
            </View>

            <Text style={styles.resultTitle}>Print Successful</Text>
            <Text style={styles.resultSubtitle}>
              Test print sent successfully. Check your printer for output.
            </Text>

            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Printer:</Text>
                <Text style={styles.detailValue}>{printerInfo.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Connection:</Text>
                <View style={styles.statusContainer}>
                  <View style={styles.greenDot} />
                  <Text style={styles.connectedText}>Connected</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Paper Size:</Text>
                <Text style={styles.detailValue}>{printerInfo.paperSize} Receipt</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Print Time:</Text>
                <Text style={styles.detailValue}>{printTime}</Text>
              </View>
            </View>

            <View style={styles.successBanner}>
              <View style={styles.successIconCircle}>
                <Text style={styles.successIconCheck}>✓</Text>
              </View>
              <View style={styles.successTextContainer}>
                <Text style={styles.successBannerTitle}>Printer Ready</Text>
                <Text style={styles.successBannerSubtitle}>All systems operational</Text>
              </View>
            </View>

            <Text style={styles.dismissText}>Tap anywhere to continue</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Failure Modal */}
      <Modal
        visible={printStatus === 'failure'}
        transparent={true}
        animationType="fade"
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleDismissResult}
        >
          <View style={styles.resultContainer}>
            <View style={styles.iconContainer}>
              <View style={styles.printerIcon}>
                <Text style={styles.printerIconText}>🖨</Text>
              </View>
              <View style={styles.errorBadge}>
                <Text style={styles.errorX}>✕</Text>
              </View>
            </View>

            <Text style={styles.resultTitle}>Printer Disconnected</Text>
            <Text style={styles.resultSubtitle}>
              Unable to connect to the printer. Please check connection.
            </Text>

            <View style={styles.errorCard}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Printer:</Text>
                <Text style={styles.detailValue}>{printerInfo.name}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Connection:</Text>
                <View style={styles.statusContainer}>
                  <View style={styles.redDot} />
                  <Text style={styles.disconnectedText}>Disconnected</Text>
                </View>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Error Code:</Text>
                <Text style={styles.detailValue}>PRINTER_OFFLINE</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Attempt Time:</Text>
                <Text style={styles.detailValue}>{printTime}</Text>
              </View>
            </View>

            <View style={styles.troubleshootingBanner}>
              <Text style={styles.warningIcon}>⚠</Text>
              <View style={styles.troubleshootingContent}>
                <Text style={styles.troubleshootingTitle}>Troubleshooting Steps:</Text>
                <Text style={styles.troubleshootingItem}>• Check printer power and cables</Text>
                <Text style={styles.troubleshootingItem}>• Verify printer is turned on</Text>
                <Text style={styles.troubleshootingItem}>• Ensure printer is connected to device</Text>
                <Text style={styles.troubleshootingItem}>• Try reconnecting in settings</Text>
              </View>
            </View>

            <Text style={styles.dismissText}>Tap anywhere to return</Text>
          </View>
        </TouchableOpacity>
      </Modal>
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#C62828',
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
  },
  headerText: {},
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
    letterSpacing: 0.38,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  billContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 34,
    gap: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  businessHeader: {
    borderBottomWidth: 1.81,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
    gap: 4,
  },
  businessName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    letterSpacing: -0.26,
    lineHeight: 33,
  },
  businessAddress: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  businessPhone: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  businessGST: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  billDetails: {
    gap: 8,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontSize: 16,
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  billValue: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  itemsSection: {
    borderBottomWidth: 1.81,
    borderBottomColor: '#E0E0E0',
    paddingBottom: 8,
    gap: 20,
  },
  itemContainer: {
    gap: 8,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  itemPrice: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  itemQty: {
    fontSize: 14,
    color: '#999999',
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  totalsSection: {
    gap: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  totalValue: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  grandTotalSection: {
    borderTopWidth: 1.81,
    borderTopColor: '#333333',
    paddingTop: 22,
  },
  grandTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  grandTotalLabel: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  grandTotalValue: {
    fontSize: 24,
    color: '#C62828',
    fontWeight: '400',
    letterSpacing: 0.07,
    lineHeight: 32,
  },
  footerSection: {
    borderTopWidth: 1.81,
    borderTopColor: '#E0E0E0',
    paddingTop: 26,
    gap: 4,
  },
  footerText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1.81,
    borderTopColor: '#E0E0E0',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -25 },
    shadowOpacity: 0.25,
    shadowRadius: 50,
    elevation: 10,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: -0.31,
  },
  printButton: {
    flex: 1,
    height: 56,
    backgroundColor: '#C62828',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  printButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  printingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 16,
    width: '100%',
    maxWidth: 320,
  },
  spinnerContainer: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  printingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.44,
  },
  printingText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    letterSpacing: -0.31,
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 20,
    width: '100%',
    maxWidth: 360,
  },
  iconContainer: {
    width: 128,
    height: 128,
    position: 'relative',
    marginBottom: 16,
  },
  printerIcon: {
    width: 112,
    height: 112,
    backgroundColor: '#F2F2F2',
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 8,
    top: 8,
  },
  printerIconText: {
    fontSize: 48,
  },
  successBadge: {
    width: 48,
    height: 48,
    backgroundColor: '#4CAF50',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    top: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  successCheckmark: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  errorBadge: {
    width: 48,
    height: 48,
    backgroundColor: '#C62828',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    top: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  errorX: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: -0.26,
  },
  resultSubtitle: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: -0.31,
  },
  detailsCard: {
    width: '100%',
    backgroundColor: '#F2F2F2',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 21,
    gap: 12,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#FEF2F2',
    borderWidth: 0.6,
    borderColor: '#FECACA',
    borderRadius: 16,
    padding: 21,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#999999',
    letterSpacing: -0.15,
  },
  detailValue: {
    fontSize: 14,
    color: '#333333',
    letterSpacing: -0.15,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  greenDot: {
    width: 8,
    height: 8,
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  connectedText: {
    fontSize: 14,
    color: '#4CAF50',
    letterSpacing: -0.15,
  },
  redDot: {
    width: 8,
    height: 8,
    backgroundColor: '#C62828',
    borderRadius: 4,
  },
  disconnectedText: {
    fontSize: 14,
    color: '#C62828',
    letterSpacing: -0.15,
  },
  successBanner: {
    width: '100%',
    backgroundColor: '#E8F5E9',
    borderWidth: 0.6,
    borderColor: '#81C784',
    borderRadius: 16,
    padding: 17,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  successIconCircle: {
    width: 40,
    height: 40,
    backgroundColor: '#4CAF50',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  successIconCheck: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  successTextContainer: {
    flex: 1,
  },
  successBannerTitle: {
    fontSize: 16,
    color: '#2E7D32',
    letterSpacing: -0.31,
  },
  successBannerSubtitle: {
    fontSize: 16,
    color: '#66BB6A',
    letterSpacing: -0.31,
  },
  troubleshootingBanner: {
    width: '100%',
    backgroundColor: '#FFF8E1',
    borderWidth: 0.6,
    borderColor: '#FFE082',
    borderRadius: 16,
    padding: 17,
    flexDirection: 'row',
    gap: 12,
  },
  warningIcon: {
    fontSize: 20,
  },
  troubleshootingContent: {
    flex: 1,
  },
  troubleshootingTitle: {
    fontSize: 16,
    color: '#E65100',
    letterSpacing: -0.31,
    marginBottom: 8,
  },
  troubleshootingItem: {
    fontSize: 12,
    color: '#F57C00',
    lineHeight: 16,
    marginBottom: 6,
  },
  dismissText: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
    letterSpacing: -0.31,
    marginTop: 8,
  },
});

export default TestPrintPreviewScreen;