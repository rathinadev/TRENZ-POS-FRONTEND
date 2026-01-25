import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  TextInput,
  Switch,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';

type GSTSettingsScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GSTSettings'>;
};

type GSTType = 'Inclusive' | 'Exclusive';
type RoundingRule = 'nearest' | 'up' | 'down' | 'none';

const GSTSettingsScreen: React.FC<GSTSettingsScreenProps> = ({ navigation }) => {
  const [gstPercent, setGstPercent] = useState('18');
  const [itemLevelOverride, setItemLevelOverride] = useState(true);
  const [gstType, setGstType] = useState<GSTType>('Inclusive');
  const [roundingRule, setRoundingRule] = useState<RoundingRule>('nearest');
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
      const settings = await getBusinessSettings();
      
      if (settings) {
        // Load tax_rate as gst percent
        if (settings.tax_rate !== undefined) {
          setGstPercent((settings.tax_rate * 100).toString());
        }
        
        // Load other GST settings if they exist
        if (settings.gst_type) {
          setGstType(settings.gst_type as GSTType);
        }
        if (settings.item_level_override !== undefined) {
          setItemLevelOverride(settings.item_level_override === 1);
        }
        if (settings.rounding_rule) {
          setRoundingRule(settings.rounding_rule as RoundingRule);
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
    const percent = parseFloat(gstPercent);
    
    if (isNaN(percent) || percent < 0 || percent > 100) {
      Alert.alert('Invalid GST', 'Please enter a valid GST percentage (0-100)');
      return;
    }

    try {
      setIsSaving(true);
      
      await saveBusinessSettings({
        tax_rate: percent / 100, // Store as decimal (e.g., 0.18 for 18%)
        gst_type: gstType,
        item_level_override: itemLevelOverride ? 1 : 0,
        rounding_rule: roundingRule,
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

  const getGstTypeDescription = () => {
    if (gstType === 'Inclusive') {
      return '✓ Prices shown to customers already include GST';
    } else {
      return '✓ GST will be added on top of prices';
    }
  };

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
          <Text style={styles.subtitle}>Configure tax settings</Text>
        </View>
      </Animated.View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Global GST Percent */}
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
          <Text style={styles.cardTitle}>Global GST Percent</Text>
          <Text style={styles.cardDescription}>
            Set a default GST percentage for all items
          </Text>

          {/* Quick Select Buttons */}
          <View style={styles.gstPresetsContainer}>
            <TouchableOpacity
              style={[
                styles.gstPresetButton,
                gstPercent === '0' && styles.gstPresetButtonSelected,
              ]}
              onPress={() => !isSaving && setGstPercent('0')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.gstPresetButtonText,
                  gstPercent === '0' && styles.gstPresetButtonTextSelected,
                ]}
              >
                0%
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gstPresetButton,
                gstPercent === '5' && styles.gstPresetButtonSelected,
              ]}
              onPress={() => !isSaving && setGstPercent('5')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.gstPresetButtonText,
                  gstPercent === '5' && styles.gstPresetButtonTextSelected,
                ]}
              >
                5%
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gstPresetButton,
                gstPercent === '8' && styles.gstPresetButtonSelected,
              ]}
              onPress={() => !isSaving && setGstPercent('8')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.gstPresetButtonText,
                  gstPercent === '8' && styles.gstPresetButtonTextSelected,
                ]}
              >
                8%
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gstPresetButton,
                gstPercent === '18' && styles.gstPresetButtonSelected,
              ]}
              onPress={() => !isSaving && setGstPercent('18')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.gstPresetButtonText,
                  gstPercent === '18' && styles.gstPresetButtonTextSelected,
                ]}
              >
                18%
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Input */}
          <Text style={styles.customLabel}>Or enter custom percentage:</Text>
          <View style={styles.percentInputContainer}>
            <TextInput
              style={styles.percentInput}
              value={gstPercent}
              onChangeText={setGstPercent}
              placeholder="Enter custom GST %"
              placeholderTextColor="#999999"
              keyboardType="numeric"
              maxLength={5}
              editable={!isSaving}
            />
            <Text style={styles.percentSymbol}>%</Text>
          </View>
        </Animated.View>

        {/* Item Level GST Override */}
        <Animated.View
          style={[
            styles.card,
            styles.toggleCard,
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
          <View style={styles.toggleContent}>
            <View style={styles.toggleInfo}>
              <Text style={styles.cardTitle}>Item Level GST Override</Text>
              <Text style={styles.cardDescription}>
                Allow custom GST percent for specific items
              </Text>
            </View>

            <Switch
              value={itemLevelOverride}
              onValueChange={setItemLevelOverride}
              trackColor={{ false: '#E0E0E0', true: '#C62828' }}
              thumbColor="#FFFFFF"
              ios_backgroundColor="#E0E0E0"
              disabled={isSaving}
            />
          </View>
        </Animated.View>

        {/* GST Type */}
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
          <Text style={styles.cardTitle}>GST Type</Text>
          <Text style={styles.cardDescription}>
            Choose whether prices include or exclude GST
          </Text>

          <View style={styles.gstTypeButtons}>
            <TouchableOpacity
              style={[
                styles.gstTypeButton,
                gstType === 'Inclusive' && styles.gstTypeButtonSelected,
              ]}
              onPress={() => !isSaving && setGstType('Inclusive')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.gstTypeButtonText,
                  gstType === 'Inclusive' && styles.gstTypeButtonTextSelected,
                ]}
              >
                Inclusive
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gstTypeButton,
                gstType === 'Exclusive' && styles.gstTypeButtonSelected,
              ]}
              onPress={() => !isSaving && setGstType('Exclusive')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.gstTypeButtonText,
                  gstType === 'Exclusive' && styles.gstTypeButtonTextSelected,
                ]}
              >
                Exclusive
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gstTypeHint}>
            <Text style={styles.gstTypeHintText}>
              {getGstTypeDescription()}
            </Text>
          </View>
        </Animated.View>

        {/* Rounding Rules */}
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
          <Text style={styles.cardTitle}>Rounding Rules</Text>
          <Text style={styles.cardDescription}>
            Configure bill total rounding behavior
          </Text>

          <View style={styles.roundingOptions}>
            <TouchableOpacity
              style={[
                styles.roundingButton,
                roundingRule === 'nearest' && styles.roundingButtonSelected,
              ]}
              onPress={() => !isSaving && setRoundingRule('nearest')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.roundingButtonText,
                  roundingRule === 'nearest' && styles.roundingButtonTextSelected,
                ]}
              >
                Round to Nearest Rupee
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roundingButton,
                roundingRule === 'up' && styles.roundingButtonSelected,
              ]}
              onPress={() => !isSaving && setRoundingRule('up')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.roundingButtonText,
                  roundingRule === 'up' && styles.roundingButtonTextSelected,
                ]}
              >
                Always Round Up
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roundingButton,
                roundingRule === 'down' && styles.roundingButtonSelected,
              ]}
              onPress={() => !isSaving && setRoundingRule('down')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.roundingButtonText,
                  roundingRule === 'down' && styles.roundingButtonTextSelected,
                ]}
              >
                Always Round Down
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.roundingButton,
                roundingRule === 'none' && styles.roundingButtonSelected,
              ]}
              onPress={() => !isSaving && setRoundingRule('none')}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text
                style={[
                  styles.roundingButtonText,
                  roundingRule === 'none' && styles.roundingButtonTextSelected,
                ]}
              >
                No Rounding (Exact Amount)
              </Text>
            </TouchableOpacity>
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
    padding: 21,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
    gap: 8,
  },
  toggleCard: {
    paddingVertical: 21,
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
  gstPresetsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  gstPresetButton: {
    flex: 1,
    height: 48,
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gstPresetButtonSelected: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  gstPresetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  gstPresetButtonTextSelected: {
    color: '#C62828',
  },
  customLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666666',
    marginTop: 16,
    marginBottom: 8,
  },
  percentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    height: 49,
    paddingHorizontal: 16,
  },
  percentInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
  },
  percentSymbol: {
    fontSize: 16,
    color: '#333333',
    letterSpacing: -0.31,
    marginLeft: 8,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  toggleInfo: {
    flex: 1,
    gap: 4,
  },
  gstTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  gstTypeButton: {
    flex: 1,
    height: 48,
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gstTypeButtonSelected: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  gstTypeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  gstTypeButtonTextSelected: {
    color: '#C62828',
  },
  gstTypeHint: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
  },
  gstTypeHintText: {
    fontSize: 16,
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  roundingOptions: {
    gap: 13,
  },
  roundingButton: {
    height: 48,
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  roundingButtonSelected: {
    borderColor: '#C62828',
    backgroundColor: '#FFF5F5',
  },
  roundingButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  roundingButtonTextSelected: {
    color: '#C62828',
  },
  saveButtonContainer: {
    marginTop: 8,
  },
  saveButton: {
    backgroundColor: '#C62828',
    height: 52,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
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