import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  TextInput,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import CalenderIcon from '../assets/icons/CalenderIcon.svg';
import { RootStackParamList } from '../types/business.types';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';

type SelectSummaryDateScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SelectSummaryDate'>;
};

// Define the available units
type TimeUnit = 'days' | 'weeks' | 'months' | 'years';

const SelectSummaryDateScreen: React.FC<SelectSummaryDateScreenProps> = ({ navigation }) => {
  // State for the number input
  const [amount, setAmount] = useState('');
  // State for the selected unit (default to days)
  const [selectedUnit, setSelectedUnit] = useState<TimeUnit>('days');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadLastPreference();
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

  const loadLastPreference = async () => {
    try {
      setIsLoading(true);
      const settings = await getBusinessSettings();
      
      if (settings) {
        // Restore last used amount
        if (settings.last_summary_custom_amount) {
          setAmount(settings.last_summary_custom_amount.toString());
        }
        // Restore last used unit
        if (settings.last_summary_custom_unit) {
          setSelectedUnit(settings.last_summary_custom_unit as TimeUnit);
        }
      }
    } catch (error) {
      console.error('Failed to load summary preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDateRange = () => {
    const numAmount = parseInt(amount, 10);
    if (!numAmount || isNaN(numAmount)) return null;

    const endDate = new Date();
    const startDate = new Date();

    // Calculate start date based on unit
    switch (selectedUnit) {
      case 'days':
        startDate.setDate(endDate.getDate() - numAmount);
        break;
      case 'weeks':
        startDate.setDate(endDate.getDate() - (numAmount * 7));
        break;
      case 'months':
        startDate.setMonth(endDate.getMonth() - numAmount);
        break;
      case 'years':
        startDate.setFullYear(endDate.getFullYear() - numAmount);
        break;
    }

    return {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      label: `Last ${numAmount} ${selectedUnit}`
    };
  };

  const handleApply = async () => {
    try {
      setIsSaving(true);
      const rangeData = calculateDateRange();
      
      if (!rangeData) {
        setIsSaving(false);
        return;
      }

      // Save user's preference to local storage
      const saveData = {
        last_summary_custom_amount: parseInt(amount, 10),
        last_summary_custom_unit: selectedUnit,
        last_summary_date: new Date().toISOString(),
      };

      await saveBusinessSettings(saveData);

      // Navigate to downloading screen with the calculated dates
      // NOTE: We pass the start/end ISO strings so the API can use them directly
      navigation.navigate('DownloadingSummary', {
        dateRange: 'custom',
        startDate: rangeData.start_date,
        endDate: rangeData.end_date,
        displayLabel: rangeData.label,
        customDays: calculateDaysDiff(rangeData.start_date), // Fallback for screens needing just day count
      });

    } catch (error) {
      console.error('Failed to save summary preferences:', error);
      // Proceed even if save fails
      const rangeData = calculateDateRange();
      if (rangeData) {
        navigation.navigate('DownloadingSummary', {
          dateRange: 'custom',
          startDate: rangeData.start_date,
          endDate: rangeData.end_date,
          displayLabel: rangeData.label,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to approximate days for legacy support
  const calculateDaysDiff = (startDateStr: string) => {
    const start = new Date(startDateStr);
    const end = new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const getSummaryText = () => {
    if (!amount) return '';
    const num = parseInt(amount, 10);
    if (isNaN(num)) return '';
    
    // Singular/Plural handling
    const unitLabel = num === 1 ? selectedUnit.slice(0, -1) : selectedUnit;
    return `Summary will include data for the last ${num} ${unitLabel}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading preferences...</Text>
      </View>
    );
  }

  const isApplyEnabled = amount !== '' && parseInt(amount, 10) > 0;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
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
          </TouchableOpacity>

          <View style={styles.headerText}>
            <Text style={styles.title}>Custom Date Range</Text>
            <Text style={styles.subtitle}>Define your specific timeline</Text>
          </View>
        </Animated.View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Calendar Icon */}
          <View style={styles.calendarIconContainer}>
            <View style={styles.calendarIcon}>
              <CalenderIcon width={40} height={40} />
            </View>
          </View>

          {/* Unit Selection Pills */}
          <View style={styles.unitContainer}>
            <Text style={styles.sectionLabel}>Select Unit</Text>
            <View style={styles.pillsRow}>
              {(['days', 'weeks', 'months', 'years'] as TimeUnit[]).map((unit) => (
                <TouchableOpacity
                  key={unit}
                  style={[
                    styles.pill,
                    selectedUnit === unit && styles.pillSelected
                  ]}
                  onPress={() => setSelectedUnit(unit)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.pillText,
                    selectedUnit === unit && styles.pillTextSelected
                  ]}>
                    {unit.charAt(0).toUpperCase() + unit.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Input Section */}
          <View style={styles.inputSection}>
             <Text style={styles.sectionLabel}>Enter Duration</Text>
             <View style={styles.customInputContainer}>
                <TextInput
                  style={styles.numberInput}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="e.g. 1, 3, 6"
                  placeholderTextColor="rgba(51, 51, 51, 0.4)"
                  keyboardType="numeric"
                  editable={!isSaving}
                  maxLength={3}
                />
                <Text style={styles.inputSuffix}>
                  {selectedUnit.toUpperCase()}
                </Text>
            </View>
            
            {/* Dynamic Summary Text */}
            <View style={styles.summaryTextContainer}>
               {amount ? (
                 <Text style={styles.summaryText}>{getSummaryText()}</Text>
               ) : (
                 <Text style={styles.placeholderText}>Enter a number above to see details</Text>
               )}
            </View>
          </View>

        </ScrollView>

        {/* Apply Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.applyButton,
              (!isApplyEnabled || isSaving) && styles.applyButtonDisabled,
            ]}
            onPress={handleApply}
            disabled={!isApplyEnabled || isSaving}
            activeOpacity={0.9}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.applyButtonText}>Apply Filter</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
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
    paddingHorizontal: 16,
    paddingTop: 55,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.6,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '600',
    color: '#C62828',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    color: '#999999',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
    gap: 32,
  },
  calendarIconContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  calendarIcon: {
    width: 80,
    height: 80,
    backgroundColor: '#FEF2F2',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Unit Selection Styles
  unitContainer: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  pill: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#EEEEEE',
  },
  pillSelected: {
    backgroundColor: '#FEF2F2',
    borderColor: '#C62828',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  pillTextSelected: {
    color: '#C62828',
  },

  // Input Section Styles
  inputSection: {
    gap: 4,
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 64,
  },
  numberInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#333333',
    padding: 0,
  },
  inputSuffix: {
    fontSize: 16,
    fontWeight: '700',
    color: '#C62828',
    opacity: 0.8,
  },
  summaryTextContainer: {
    marginTop: 12,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
  },
  summaryText: {
    fontSize: 15,
    color: '#333333',
    fontWeight: '500',
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#999999',
    fontStyle: 'italic',
  },

  // Footer Styles
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.6,
    borderTopColor: '#E0E0E0',
    padding: 16,
    paddingBottom: 24,
  },
  applyButton: {
    height: 52,
    backgroundColor: '#C62828',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  applyButtonDisabled: {
    backgroundColor: '#E0E0E0',
    shadowOpacity: 0,
    elevation: 0,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default SelectSummaryDateScreen;