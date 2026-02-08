import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Switch,
  Animated,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Platform,
  PermissionsAndroid,
  TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../types/business.types';
import { NativeModules } from 'react-native';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';
import { PrinterService, type BluetoothDevice } from '../services/printer';

const { XprinterModule } = NativeModules;

type PrinterSetupScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'PrinterSetup'>;
};

type PrinterModel = 'Epson TM-T82' | 'HP Receipt Printer' | 'Star Micronics TSP100' | 'Generic Bluetooth Printer';
type PaperSize = '58mm' | '80mm' | 'A4';
type ConnectionStatus = 'connected' | 'disconnected' | 'connecting' | 'disconnecting';

const PrinterSetupScreen: React.FC<PrinterSetupScreenProps> = ({ navigation }) => {
  const [bluetoothDevices, setBluetoothDevices] = useState<BluetoothDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<BluetoothDevice | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [selectedPaperSize, setSelectedPaperSize] = useState<PaperSize>('58mm');
  const [autoPrint, setAutoPrint] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSavingPrinter, setIsSavingPrinter] = useState(false);
  const [isSavingPaperSize, setIsSavingPaperSize] = useState(false);
  const [useNetworkPrint, setUseNetworkPrint] = useState(false);
  const [networkPrintUrl, setNetworkPrintUrl] = useState('http://10.0.2.2:9101');
  const [isSavingNetwork, setIsSavingNetwork] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadPrinterSettings();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (Platform.OS === 'android') loadBluetoothDevices();
    }, [])
  );

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

  const loadPrinterSettings = async () => {
    try {
      setIsLoading(true);
      const settings = await getBusinessSettings();
      
      if (settings) {
        if (settings.paper_size) {
          setSelectedPaperSize(settings.paper_size as PaperSize);
        }
        if (settings.auto_print !== undefined) {
          setAutoPrint(settings.auto_print === 1);
        }
        if (settings.printer_connection_type === 'network') {
          setUseNetworkPrint(true);
          if (settings.printer_network_url) setNetworkPrintUrl(settings.printer_network_url);
        }
        if (settings.printer_mac_address) {
          const savedDevice = bluetoothDevices.find(d => d.address === settings.printer_mac_address);
          if (savedDevice) setSelectedDevice(savedDevice);
        }
      }
      if (Platform.OS === 'android') {
        await loadBluetoothDevices();
      }
      
      // Check connection status
      const connected = await PrinterService.isConnected();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Failed to load printer settings:', error);
      Alert.alert('Error', 'Failed to load printer settings');
    } finally {
      setIsLoading(false);
    }
  };

  const requestBluetoothPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel = Platform.Version;
      if (apiLevel >= 31) {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        ]);
        const connectOk = granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED;
        const scanOk = granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED;
        return connectOk && scanOk;
      }
      return true;
    } catch (e) {
      console.warn('Bluetooth permission request failed:', e);
      return false;
    }
  };

  const loadBluetoothDevices = async () => {
    try {
      setIsLoadingDevices(true);
      const hasPermission = await requestBluetoothPermissions();
      if (!hasPermission) {
        Alert.alert(
          'Permission needed',
          'Bluetooth permission is required to see the printer. Please allow and open Printer Setup again.'
        );
        return;
      }
      const devices = await PrinterService.getPairedDevices();
      setBluetoothDevices(devices);
      const settings = await getBusinessSettings();
      if (settings?.printer_mac_address) {
        const savedDevice = devices.find(d => d.address === settings.printer_mac_address);
        if (savedDevice) setSelectedDevice(savedDevice);
      }
    } catch (error: any) {
      console.error('Failed to load Bluetooth devices:', error);
      const code = error?.code || '';
      const msg = error?.message || '';
      if (code === 'BLUETOOTH_DISABLED' || /not enabled|Bluetooth is not on/i.test(msg)) {
        setBluetoothDevices([]);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsLoadingDevices(false);
    }
  };


  const paperSizes: { value: PaperSize; label: string }[] = [
    { value: '58mm', label: '58 mm Receipt' },
    { value: '80mm', label: '80 mm Receipt' },
    { value: 'A4', label: 'A4 Sheet' },
  ];

  const handleSelectDevice = (device: BluetoothDevice) => {
    setSelectedDevice(device);
  };

  const handleConnect = async () => {
    if (!selectedDevice) {
      Alert.alert('Error', 'Please select a printer first');
      return;
    }

    try {
      setIsConnecting(true);
      setConnectionStatus('connecting');

      await PrinterService.connectBluetooth(selectedDevice.address);
      await saveBusinessSettings({
        printer_name: selectedDevice.name,
        printer_mac_address: selectedDevice.address,
        printer_connected: 1,
        printer_connection_type: 'bluetooth',
        printer_network_url: undefined,
      });

      setConnectionStatus('connected');
      Alert.alert('Done', `Connected to ${selectedDevice.name}. You can print from bills now.`);
    } catch (error: any) {
      console.error('Failed to connect:', error);
      setConnectionStatus('disconnected');
      Alert.alert('Connection Failed', error.message || 'Failed to connect to printer. Make sure the printer is turned on and paired in Bluetooth settings.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setConnectionStatus('disconnecting');
      await PrinterService.disconnect();
      await saveBusinessSettings({
        printer_connected: 0,
      });
      setConnectionStatus('disconnected');
      Alert.alert('Success', 'Disconnected from printer');
    } catch (error: any) {
      console.error('Failed to disconnect:', error);
      Alert.alert('Error', 'Failed to disconnect from printer');
    }
  };

  const handleTestPrint = () => {
    navigation.navigate('TestPrintPreview');
  };

  const handleApplyPaperSize = async () => {
    try {
      setIsSavingPaperSize(true);
      
      await saveBusinessSettings({
        paper_size: selectedPaperSize,
      });

      Alert.alert('Success', 'Paper size updated successfully!');
    } catch (error) {
      console.error('Failed to save paper size:', error);
      Alert.alert('Error', 'Failed to save paper size. Please try again.');
    } finally {
      setIsSavingPaperSize(false);
    }
  };

  const handleAutoPrintToggle = async (value: boolean) => {
    try {
      setAutoPrint(value);
      await saveBusinessSettings({ auto_print: value ? 1 : 0 });
    } catch (error) {
      console.error('Failed to save auto print setting:', error);
      setAutoPrint(!value);
      Alert.alert('Error', 'Failed to save auto print setting');
    }
  };

  const handleNetworkPrintToggle = async (value: boolean) => {
    try {
      setUseNetworkPrint(value);
      await saveBusinessSettings({
        printer_connection_type: value ? 'network' : 'bluetooth',
        printer_network_url: value ? networkPrintUrl : undefined,
      });
      const connected = await PrinterService.isConnected();
      setConnectionStatus(connected ? 'connected' : 'disconnected');
    } catch (error) {
      console.error('Failed to save network print setting:', error);
      setUseNetworkPrint(!value);
      Alert.alert('Error', 'Failed to save setting');
    }
  };

  const handleSaveNetworkUrl = async () => {
    const url = networkPrintUrl.trim();
    if (!url) {
      Alert.alert('Error', 'Enter the print server URL');
      return;
    }
    try {
      setIsSavingNetwork(true);
      await saveBusinessSettings({
        printer_connection_type: 'network',
        printer_network_url: url,
      });
      setUseNetworkPrint(true);
      Alert.alert('Success', 'Print server URL saved. You can now print from the emulator.');
    } catch (error) {
      Alert.alert('Error', 'Failed to save URL');
    } finally {
      setIsSavingNetwork(false);
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'disconnected':
        return 'Disconnected';
      case 'connecting':
        return 'Connecting.......';
      case 'disconnecting':
        return 'Disconnecting.....';
    }
  };

  const getConnectionColor = () => connectionStatus === 'connected' ? '#10B981' : '#999999';

  const isConnectionActive = () => {
    return connectionStatus === 'connected';
  };

  const isConnectionLoading = () => {
    return connectionStatus === 'connecting' || connectionStatus === 'disconnecting';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading printer settings...</Text>
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
          <Text style={styles.title}>Printer Setup</Text>
          <Text style={styles.subtitle}>Configure printing options</Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Bluetooth Devices Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.docTip}>
            Pair your Bluetooth printer in Android Settings first, then select it below and tap Connect (once).
          </Text>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Bluetooth Printers</Text>
            <TouchableOpacity
              onPress={loadBluetoothDevices}
              disabled={isLoadingDevices}
              style={styles.refreshButton}
            >
              {isLoadingDevices ? (
                <ActivityIndicator size="small" color="#C62828" />
              ) : (
                <Text style={styles.refreshButtonText}>Refresh</Text>
              )}
            </TouchableOpacity>
          </View>

          {isLoadingDevices ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#C62828" />
              <Text style={styles.loadingText}>Loading devices...</Text>
            </View>
          ) : bluetoothDevices.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Turn on Bluetooth and pair your printer</Text>
              <Text style={styles.emptySubtext}>
                Tap below to open Bluetooth settings. Turn Bluetooth on, pair the printer, then come back here — the list will refresh.
              </Text>
              {Platform.OS === 'android' && XprinterModule?.openBluetoothSettings && (
                <TouchableOpacity
                  style={styles.openSettingsButton}
                  onPress={() => XprinterModule.openBluetoothSettings().catch(() => {})}
                  activeOpacity={0.8}
                >
                  <Text style={styles.openSettingsButtonText}>Open Bluetooth settings</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.deviceList}>
              {bluetoothDevices.map((device) => (
                <TouchableOpacity
                  key={device.address}
                  style={[
                    styles.deviceItem,
                    selectedDevice?.address === device.address && styles.deviceItemSelected,
                  ]}
                  onPress={() => handleSelectDevice(device)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioButton}>
                    {selectedDevice?.address === device.address && (
                      <View style={styles.radioButtonSelected} />
                    )}
                  </View>
                  <View style={styles.deviceInfo}>
                    <Text style={styles.deviceName}>{device.name}</Text>
                    <Text style={styles.deviceAddress}>{device.address}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedDevice && (
            <TouchableOpacity
              style={[
                styles.connectButton,
                (isConnecting || connectionStatus === 'connected') && styles.buttonDisabled,
              ]}
              onPress={connectionStatus === 'connected' ? handleDisconnect : handleConnect}
              activeOpacity={0.9}
              disabled={isConnecting || connectionStatus === 'connected'}
            >
              {isConnecting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : connectionStatus === 'connected' ? (
                <Text style={styles.connectButtonText}>Disconnect</Text>
              ) : (
                <Text style={styles.connectButtonText}>Connect</Text>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>

        {/* Test Printer Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Test Printer</Text>
          <Text style={styles.cardDescription}>
            Print a sample bill to test the selected printer
          </Text>

          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestPrint}
            activeOpacity={0.9}
          >
            <Text style={styles.testButtonText}>Test Print</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Paper Size Selector Card */}
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.cardTitle}>Paper Size Selector</Text>

          <View style={styles.radioGroup}>
            {paperSizes.map((size) => (
              <TouchableOpacity
                key={size.value}
                style={styles.radioOption}
                onPress={() => setSelectedPaperSize(size.value)}
                activeOpacity={0.7}
                disabled={isSavingPaperSize}
              >
                <View style={styles.radioButton}>
                  {selectedPaperSize === size.value && (
                    <View style={styles.radioButtonSelected} />
                  )}
                </View>
                <Text style={styles.radioLabel}>{size.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.applyButton, isSavingPaperSize && styles.buttonDisabled]}
            onPress={handleApplyPaperSize}
            activeOpacity={0.9}
            disabled={isSavingPaperSize}
          >
            {isSavingPaperSize ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.applyButtonText}>Apply Paper Size</Text>
            )}
          </TouchableOpacity>
        </Animated.View>

        {/* Auto Print Card */}
        <Animated.View
          style={[
            styles.card,
            styles.autoPrintCard,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [60, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.autoPrintContent}>
            <View style={styles.autoPrintInfo}>
              <Text style={styles.cardTitle}>Auto Print</Text>
              <Text style={styles.cardDescription}>
                Automatically print bill after checkout
              </Text>
            </View>

            <Switch
              value={autoPrint}
              onValueChange={handleAutoPrintToggle}
              trackColor={{ false: '#E0E0E0', true: '#C62828' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
            />
          </View>
        </Animated.View>
      </ScrollView>
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
    paddingBottom: 24,
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
    paddingBottom: 40,
    gap: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    gap: 14,
  },
  connectionCard: {
    gap: 6,
  },
  autoPrintCard: {
    paddingVertical: 21,
  },
  docTip: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.44,
    lineHeight: 27,
  },
  cardDescription: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  radioGroup: {
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C62828',
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#555555',
    letterSpacing: -0.15,
    lineHeight: 21,
  },
  applyButton: {
    backgroundColor: '#C62828',
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  connectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  connectionLabel: {
    fontSize: 16,
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  urlInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusSpinner: {
    marginRight: 4,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: -0.15,
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: '#C62828',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  autoPrintContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  autoPrintInfo: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  emptyContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 12,
  },
  openSettingsButton: {
    backgroundColor: '#C62828',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  openSettingsButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  deviceList: {
    gap: 12,
    marginBottom: 14,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    gap: 12,
  },
  deviceItemSelected: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  deviceInfo: {
    flex: 1,
    gap: 4,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
  },
  deviceAddress: {
    fontSize: 12,
    color: '#999999',
  },
  connectButton: {
    backgroundColor: '#C62828',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  connectButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PrinterSetupScreen;