import React, {useEffect, useRef, useState} from 'react';
import {View, Text, StyleSheet, Animated, ActivityIndicator} from 'react-native';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import Svg, {Path, Circle} from 'react-native-svg';
import AnimatedButton from '../components/AnimatedButton';
import type {RootStackParamList} from '../types/business.types';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';

type SetupSuccessScreenProps = NativeStackScreenProps<RootStackParamList, 'SetupSuccess'>;

const CheckIcon = () => (
  <Svg width="64" height="64" viewBox="0 0 64 64" fill="none">
    <Circle cx="32" cy="32" r="32" fill="#10B981" />
    <Path
      d="M20 32L28 40L44 24"
      stroke="#FFFFFF"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

const SetupSuccessScreen: React.FC<SetupSuccessScreenProps> = ({navigation}) => {
  const [businessName, setBusinessName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    loadBusinessInfo();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLoading]);

  const loadBusinessInfo = async () => {
    try {
      setIsLoading(true);
      const settings = await getBusinessSettings();
      
      if (settings) {
        // Load business name
        if (settings.business_name) {
          setBusinessName(settings.business_name);
        }

        // Save setup completion timestamp
        const timestamp = new Date().toISOString();
        await saveBusinessSettings({
          setup_completed: 1,
          setup_completed_date: timestamp,
        });
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
      // Continue anyway
    } finally {
      setIsLoading(false);
    }
  };

  const handleContinue = () => {
    navigation.navigate('ModeSelection');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.loadingText}>Finalizing setup...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{scale: scaleAnim}],
          },
        ]}>
        <View style={styles.iconContainer}>
          <CheckIcon />
        </View>
        
        <Text style={styles.title}>Business Setup Complete!</Text>
        
        {businessName ? (
          <Text style={styles.businessName}>{businessName}</Text>
        ) : null}
        
        <Text style={styles.subtitle}>
          Your business profile has been created successfully
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>Business details saved</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>Settings configured</Text>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoDot} />
            <Text style={styles.infoText}>Ready to start billing</Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <AnimatedButton
            title="Continue"
            onPress={handleContinue}
            variant="primary"
          />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2c2c2c',
    textAlign: 'center',
    marginBottom: 12,
  },
  businessName: {
    fontSize: 22,
    fontWeight: '600',
    color: '#10B981',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  infoCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  infoText: {
    fontSize: 15,
    color: '#2c2c2c',
  },
  buttonContainer: {
    width: '100%',
  },
});

export default SetupSuccessScreen;