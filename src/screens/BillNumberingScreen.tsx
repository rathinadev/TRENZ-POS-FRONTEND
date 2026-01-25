import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Modal,
  Animated,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import AsyncStorage from '@react-native-async-storage/async-storage';

type BillNumberingScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BillNumbering'>;
};

interface BillNumberingSettings {
  prefix: string;
  startingNumber: string;
  includeDate: boolean;
  currentNumber?: number; // Track the last used number
}

const BillNumberingScreen: React.FC<BillNumberingScreenProps> = ({ navigation }) => {
  const [prefix, setPrefix] = useState('INV-');
  const [startingNumber, setStartingNumber] = useState('1001');
  // Date is now MANDATORY as per requirements
  const includeDate = true;
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadSettings();
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

  const loadSettings = async () => {
    try {
      const settingsJson = await AsyncStorage.getItem('bill_numbering');
      
      if (settingsJson) {
        const settings: BillNumberingSettings = JSON.parse(settingsJson);
        setPrefix(settings.prefix || 'INV-');
        setStartingNumber(settings.startingNumber || '1001');
        setIncludeDate(settings.includeDate !== undefined ? settings.includeDate : true);
      }
    } catch (error) {
      console.error('Failed to load bill numbering settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePreview = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateString = `${year}${month}${day}`;

    if (includeDate) {
      return `${prefix}${dateString}-${startingNumber}`;
    } else {
      return `${prefix}${startingNumber}`;
    }
  };

  const handleApplyNumbering = () => {
    // Validate inputs
    if (!prefix.trim()) {
      Alert.alert('Invalid Prefix', 'Please enter a valid prefix.');
      return;
    }

    if (!startingNumber.trim() || isNaN(Number(startingNumber))) {
      Alert.alert('Invalid Number', 'Please enter a valid starting number.');
      return;
    }

    setConfirmModalVisible(true);
  };

  const handleConfirmApply = async () => {
    setConfirmModalVisible(false);
    setIsSaving(true);

    try {
      const settings: BillNumberingSettings = {
        prefix: prefix.trim(),
        startingNumber: startingNumber.trim(),
        includeDate,
        currentNumber: parseInt(startingNumber, 10), // Initialize current number
      };

      await AsyncStorage.setItem('bill_numbering', JSON.stringify(settings));

      // Show success message
      Alert.alert(
        'Settings Saved',
        'Bill numbering settings have been applied successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save bill numbering settings:', error);
      Alert.alert('Error', 'Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelConfirm = () => {
    setConfirmModalVisible(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
            <Text style={styles.title}>Bill Numbering</Text>
            <Text style={styles.subtitle}>Configure invoice number format</Text>
          </View>
        </Animated.View>

        {/* Inputs Section */}
        <Animated.View
          style={[
            styles.inputsSection,
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
          {/* Prefix Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Prefix</Text>
            <TextInput
              style={styles.textInput}
              placeholder="INV-"
              placeholderTextColor="rgba(51, 51, 51, 0.5)"
              value={prefix}
              onChangeText={setPrefix}
              maxLength={10}
            />
            <Text style={styles.helperText}>
              Text that appears before the bill number
            </Text>
          </View>

          {/* Starting Number Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Starting Number</Text>
            <TextInput
              style={styles.textInput}
              placeholder="1001"
              placeholderTextColor="rgba(51, 51, 51, 0.5)"
              value={startingNumber}
              onChangeText={setStartingNumber}
              keyboardType="numeric"
              maxLength={6}
            />
            <Text style={styles.helperText}>
              First bill number to be generated
            </Text>
          </View>

          {/* Date Info Card (Mandatory) */}
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Date Format</Text>
            <Text style={styles.infoDescription}>
              Date (YYYYMMDD) is automatically included in all bill numbers as per GST compliance requirements.
            </Text>
          </View>
        </Animated.View>

        {/* Preview Section */}
        <Animated.View
          style={[
            styles.previewSection,
            {
              opacity: fadeAnim,
              transform: [
                {
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.previewLabel}>Preview:</Text>

          <View style={styles.previewCard}>
            <Text style={styles.previewNumber}>{generatePreview()}</Text>
          </View>

          <Text style={styles.previewHelper}>Example bill number format</Text>
        </Animated.View>

        {/* Apply Button */}
        <Animated.View
          style={[
            styles.buttonContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.applyButton, isSaving && styles.applyButtonDisabled]}
            onPress={handleApplyNumbering}
            activeOpacity={0.9}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.applyButtonText}>Apply Numbering</Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>

      {/* Confirmation Modal */}
      <Modal
        visible={confirmModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelConfirm}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Confirm Bill Numbering</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to apply these bill numbering settings?
            </Text>

            <View style={styles.modalPreview}>
              <Text style={styles.modalPreviewLabel}>New format:</Text>
              <Text style={styles.modalPreviewNumber}>{generatePreview()}</Text>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmApply}
                activeOpacity={0.9}
              >
                <Text style={styles.confirmButtonText}>YES, APPLY</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleCancelConfirm}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
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
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    gap: 24,
  },
  header: {
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
  inputsSection: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333333',
    letterSpacing: -0.15,
    lineHeight: 21,
  },
  textInput: {
    height: 48,
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
  },
  helperText: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  infoCard: {
    backgroundColor: '#FFF3E0',
    borderWidth: 0.6,
    borderColor: '#FFB74D',
    borderRadius: 16,
    padding: 17,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
    letterSpacing: -0.44,
    lineHeight: 27,
  },
  infoDescription: {
    fontSize: 16,
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  previewSection: {
    backgroundColor: '#F5F5F5',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 21,
    gap: 8,
  },
  previewLabel: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    padding: 17,
    minHeight: 57,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewNumber: {
    fontSize: 16,
    color: '#C62828',
    letterSpacing: -0.31,
    lineHeight: 24,
    textAlign: 'center',
    fontWeight: '400',
  },
  previewHelper: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
    textAlign: 'center',
  },
  buttonContainer: {
    marginTop: 8,
  },
  applyButton: {
    backgroundColor: '#C62828',
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonDisabled: {
    opacity: 0.5,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 353,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    letterSpacing: -0.26,
    lineHeight: 33,
  },
  modalMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  modalPreview: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  modalPreviewLabel: {
    fontSize: 14,
    color: '#999999',
    letterSpacing: -0.15,
  },
  modalPreviewNumber: {
    fontSize: 18,
    fontWeight: '600',
    color: '#C62828',
    letterSpacing: -0.44,
  },
  modalButtons: {
    gap: 12,
  },
  confirmButton: {
    backgroundColor: '#C62828',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  cancelButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
});

export default BillNumberingScreen;