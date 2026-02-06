import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import API from '../services/api';

type GSTSettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GSTSettings'>;
};

type TaxMode = 'cgst_sgst' | 'igst';

// GST Rate options based on the relationship table
const GST_RATES = [
  { total: 0, cgst: 0, sgst: 0, igst: 0 },
  { total: 0.25, cgst: 0.125, sgst: 0.125, igst: 0.25 },
  { total: 3, cgst: 1.5, sgst: 1.5, igst: 3 },
  { total: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
  { total: 12, cgst: 6, sgst: 6, igst: 12 },
  { total: 18, cgst: 9, sgst: 9, igst: 18 },
  { total: 28, cgst: 14, sgst: 14, igst: 28 },
];

const GSTSettingsScreen: React.FC<GSTSettingsScreenProps> = ({ navigation }) => {
  const [taxMode, setTaxMode] = useState<TaxMode>('cgst_sgst');
  const [selectedRate, setSelectedRate] = useState(5); // Default 5% total GST
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadGSTSettings();
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

  const loadGSTSettings = async () => {
    try {
      setIsLoading(true);
      const profile = await API.auth.getProfile();

      if (profile) {
        // 1. Try to load from new field: default_gst_percentage
        if (profile.default_gst_percentage !== undefined && profile.default_gst_percentage !== null) {
          setSelectedRate(profile.default_gst_percentage);
        }
        // 2. Fallback: Calculate from backend fields (cgst + sgst)
        else if (profile.cgst_percentage || profile.sgst_percentage) {
          const totalFromBackend = (parseFloat(profile.cgst_percentage?.toString() || '0') || 0) +
            (parseFloat(profile.sgst_percentage?.toString() || '0') || 0);
          if (totalFromBackend > 0) {
            setSelectedRate(totalFromBackend);
          }
        }

        // Load tax mode
        if (profile.tax_mode) {
          setTaxMode(profile.tax_mode);
        }
      }
    } catch (error) {
      console.error('Failed to load GST settings:', error);
      Alert.alert('Error', 'Failed to load GST settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);

      // Calculate half rate for backend storage (e.g., 28% -> 14% CGST + 14% SGST)
      const halfRate = selectedRate / 2;

      await API.auth.updateProfile({
        // Frontend fields (for our logic)
        default_gst_percentage: selectedRate,
        tax_mode: taxMode,

        // Backend fields (for persistence and legacy support)
        cgst_percentage: halfRate,
        sgst_percentage: halfRate,
      });

      Alert.alert(
        'Success',
        'GST settings updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to save GST settings:', error);
      Alert.alert('Error', 'Failed to save GST settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getSelectedRateDetails = () => {
    return GST_RATES.find(rate => rate.total === selectedRate) || GST_RATES[3]; // Default to 5%
  };

  const rateDetails = getSelectedRateDetails();

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading GST settings...</Text>
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
          <Text style={styles.title}>GST Settings</Text>
          <Text style={styles.subtitle}>Configure tax rates</Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Tax Mode Selection */}
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
          <Text style={styles.cardTitle}>Tax Type</Text>
          <Text style={styles.cardDescription}>
            Select CGST/SGST for intra-state or IGST for inter-state transactions
          </Text>

          <View style={styles.taxModeButtons}>
            <TouchableOpacity
              style={[
                styles.taxModeButton,
                taxMode === 'cgst_sgst' && styles.taxModeButtonSelected,
              ]}
              onPress={() => !isSaving && setTaxMode('cgst_sgst')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.taxModeButtonText,
                  taxMode === 'cgst_sgst' && styles.taxModeButtonTextSelected,
                ]}
              >
                CGST + SGST
              </Text>
              <Text
                style={[
                  styles.taxModeButtonSubtext,
                  taxMode === 'cgst_sgst' && styles.taxModeButtonSubtextSelected,
                ]}
              >
                Intra-State
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.taxModeButton,
                taxMode === 'igst' && styles.taxModeButtonSelected,
              ]}
              onPress={() => !isSaving && setTaxMode('igst')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.taxModeButtonText,
                  taxMode === 'igst' && styles.taxModeButtonTextSelected,
                ]}
              >
                IGST
              </Text>
              <Text
                style={[
                  styles.taxModeButtonSubtext,
                  taxMode === 'igst' && styles.taxModeButtonSubtextSelected,
                ]}
              >
                Inter-State
              </Text>
            </TouchableOpacity>
          </View>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>💡</Text>
            <Text style={styles.infoText}>
              {taxMode === 'cgst_sgst'
                ? 'CGST + SGST applies when buyer and seller are in the same state'
                : 'IGST applies when buyer and seller are in different states'}
            </Text>
          </View>
        </Animated.View>

        {/* GST Rate Selection */}
        <Animated.View
          style={[
            styles.card,
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
          <Text style={styles.cardTitle}>Select GST Rate</Text>
          <Text style={styles.cardDescription}>
            Choose the applicable GST percentage
          </Text>

          <View style={styles.rateOptions}>
            {GST_RATES.map((rate) => (
              <TouchableOpacity
                key={rate.total}
                style={[
                  styles.rateButton,
                  selectedRate === rate.total && styles.rateButtonSelected,
                ]}
                onPress={() => !isSaving && setSelectedRate(rate.total)}
                activeOpacity={0.9}
                disabled={isSaving}
              >
                <Text
                  style={[
                    styles.rateButtonText,
                    selectedRate === rate.total && styles.rateButtonTextSelected,
                  ]}
                >
                  {rate.total}%
                </Text>
                {taxMode === 'cgst_sgst' ? (
                  <Text
                    style={[
                      styles.rateButtonSubtext,
                      selectedRate === rate.total && styles.rateButtonSubtextSelected,
                    ]}
                  >
                    {rate.cgst}% + {rate.sgst}%
                  </Text>
                ) : (
                  <Text
                    style={[
                      styles.rateButtonSubtext,
                      selectedRate === rate.total && styles.rateButtonSubtextSelected,
                    ]}
                  >
                    IGST {rate.igst}%
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Summary Card */}
        <Animated.View
          style={[
            styles.card,
            styles.summaryCard,
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
          <Text style={styles.summaryTitle}>Selected Tax Breakdown</Text>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total GST:</Text>
            <Text style={styles.summaryValue}>{rateDetails.total}%</Text>
          </View>

          {taxMode === 'cgst_sgst' ? (
            <>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>CGST:</Text>
                <Text style={styles.summaryValue}>{rateDetails.cgst}%</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>SGST:</Text>
                <Text style={styles.summaryValue}>{rateDetails.sgst}%</Text>
              </View>
            </>
          ) : (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>IGST:</Text>
              <Text style={styles.summaryValue}>{rateDetails.igst}%</Text>
            </View>
          )}

          <View style={styles.summaryDivider} />

          <View style={styles.summaryNote}>
            <Text style={styles.summaryNoteText}>
              👉 {taxMode === 'cgst_sgst'
                ? `IGST = CGST + SGST = ${rateDetails.total}%`
                : `IGST ${rateDetails.igst}% = CGST ${rateDetails.cgst}% + SGST ${rateDetails.sgst}%`}
            </Text>
          </View>
        </Animated.View>

        {/* Save Button */}
        <Animated.View
          style={[
            styles.saveButtonContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveSettings}
            activeOpacity={0.9}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Settings</Text>
            )}
          </TouchableOpacity>
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
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    gap: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.44,
    lineHeight: 27,
  },
  cardDescription: {
    fontSize: 14,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 21,
  },

  // Tax Mode Styles
  taxModeButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  taxModeButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  taxModeButtonSelected: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  taxModeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#666666',
    letterSpacing: -0.31,
  },
  taxModeButtonTextSelected: {
    color: '#C62828',
  },
  taxModeButtonSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999999',
  },
  taxModeButtonSubtextSelected: {
    color: '#C62828',
  },

  // Info Box
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F7FF',
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginTop: 4,
  },
  infoIcon: {
    fontSize: 18,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#0066CC',
    lineHeight: 19,
  },

  // Rate Options
  rateOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  rateButton: {
    width: '30%',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    padding: 14,
    alignItems: 'center',
    gap: 4,
  },
  rateButtonSelected: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  rateButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#666666',
  },
  rateButtonTextSelected: {
    color: '#C62828',
  },
  rateButtonSubtext: {
    fontSize: 11,
    fontWeight: '500',
    color: '#999999',
  },
  rateButtonSubtextSelected: {
    color: '#C62828',
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#FAFAFA',
    borderColor: '#C62828',
    borderWidth: 1.5,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 8,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#666666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C62828',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginVertical: 8,
  },
  summaryNote: {
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  summaryNoteText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#C62828',
    lineHeight: 19,
  },

  // Save Button
  saveButtonContainer: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#C62828',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
});

export default GSTSettingsScreen;