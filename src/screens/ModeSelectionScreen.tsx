import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BillingIcon from '../assets/icons/BillingIcon.svg';
import { RootStackParamList } from '../types/business.types';
import { getBusinessSettings } from '../services/storage';

type ModeSelectionScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ModeSelection'>;
};

const ModeSelectionScreen: React.FC<ModeSelectionScreenProps> = ({
  navigation,
}) => {
  const [businessName, setBusinessName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadBusinessInfo();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading]);

  const loadBusinessInfo = async () => {
    try {
      setIsLoading(true);
      const settings = await getBusinessSettings();
      
      if (settings && settings.business_name) {
        setBusinessName(settings.business_name);
      }
    } catch (error) {
      console.error('Failed to load business info:', error);
      // Continue with empty business name
    } finally {
      setIsLoading(false);
    }
  };

  const handleBillingMode = () => {
    navigation.navigate('Billing');
  };

  const handleAdminMode = () => {
    navigation.navigate('AdminPin');
  };

  const handleDashboardMode = () => {
    navigation.navigate('Dashboard');
  };

  const handleInventoryMode = () => {
    navigation.navigate('InventoryManagement');
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Select Mode</Text>
          {businessName ? (
            <Text style={styles.businessName}>{businessName}</Text>
          ) : null}
        </View>

        {/* Billing Mode - Large Card */}
        <TouchableOpacity
          style={styles.largeCard}
          onPress={handleBillingMode}
          activeOpacity={0.9}
        >
          <View style={styles.imageContainer}>
            <BillingIcon width={317} height={192} />
          </View>

          <View style={styles.largeCardContent}>
            <Text style={styles.largeCardTitle}>Billing Mode</Text>
            <Text style={styles.largeCardSubtitle}>
              Create bills and process sales
            </Text>
          </View>
        </TouchableOpacity>

        {/* Small Cards Container */}
        <View style={styles.smallCardsContainer}>
          {/* Dashboard Mode */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={handleDashboardMode}
            activeOpacity={0.9}
          >
            <Text style={styles.smallCardTitle}>Dashboard</Text>
            <Text style={styles.smallCardSubtitle}>View sales and insights</Text>
          </TouchableOpacity>

          {/* Inventory Mode */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={handleInventoryMode}
            activeOpacity={0.9}
          >
            <Text style={styles.smallCardTitle}>Inventory</Text>
            <Text style={styles.smallCardSubtitle}>Manage stock levels</Text>
          </TouchableOpacity>

          {/* Admin Mode */}
          <TouchableOpacity
            style={styles.smallCard}
            onPress={handleAdminMode}
            activeOpacity={0.9}
          >
            <Text style={styles.smallCardTitle}>Admin</Text>
            <Text style={styles.smallCardSubtitle}>Settings and configuration</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 16,
  },
  titleContainer: {
    marginTop: 86,
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.382812,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999999',
    marginTop: 4,
    letterSpacing: -0.3125,
  },
  largeCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 192,
    backgroundColor: '#F5F5F5',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  placeholderIcon: {
    fontSize: 64,
    opacity: 0.5,
  },
  largeCardContent: {
    padding: 24,
  },
  largeCardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 4,
    letterSpacing: -0.257812,
  },
  largeCardSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999999',
    letterSpacing: -0.3125,
  },
  smallCardsContainer: {
    gap: 16,
  },
  smallCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  smallCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
    letterSpacing: -0.439453,
  },
  smallCardSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#999999',
    letterSpacing: -0.3125,
  },
});

export default ModeSelectionScreen;