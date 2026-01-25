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
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { getBusinessSettings, saveBusinessSettings } from '../services/storage';
import { getVendorProfile, updateVendorProfile } from '../services/auth';
import { getImageSource } from '../utils/imageCache';

type LogoUploadScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'LogoUpload'>;
};

const LogoUploadScreen: React.FC<LogoUploadScreenProps> = ({ navigation }) => {
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [removeModalVisible, setRemoveModalVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadLogo();
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

  const loadLogo = async () => {
    try {
      setIsLoading(true);
      
      // Try to get logo from vendor profile
      const vendorProfile = await getVendorProfile();
      
      if (vendorProfile && vendorProfile.logo_url) {
        // Try to get cached local path first
        const localImage = await getImageSource('vendor', vendorProfile.id, vendorProfile.logo_url);
        if (localImage) {
          setLogoUri(localImage.uri);
        } else {
          setLogoUri(vendorProfile.logo_url);
        }
      } else {
        // Fallback to business settings
        const settings = await getBusinessSettings();
        if (settings && settings.logo_path) {
          setLogoUri(settings.logo_path);
        }
      }
    } catch (error) {
      console.error('Failed to load logo:', error);
      Alert.alert('Error', 'Failed to load logo');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangeLogo = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });

      if (result.assets && result.assets.length > 0) {
        const selectedImage = result.assets[0];
        if (selectedImage.uri) {
          setIsSaving(true);
          
          // Create FormData for multipart upload (React Native has global FormData)
          const formData = new FormData();
          
          formData.append('logo', {
            uri: selectedImage.uri,
            type: selectedImage.type || 'image/jpeg',
            name: selectedImage.fileName || 'logo.jpg',
          } as any);
          
          // Upload via API
          const updatedProfile = await updateVendorProfile(formData);
          
          // Update local display
          if (updatedProfile.logo_url) {
            setLogoUri(updatedProfile.logo_url);
          } else {
            setLogoUri(selectedImage.uri);
          }
          
          // Also save to business settings for offline access
          await saveBusinessSettings({
            logo_path: selectedImage.uri,
          });
          
          Alert.alert('Success', 'Logo updated successfully!');
        }
      }
    } catch (error) {
      console.error('Error picking/saving image:', error);
      Alert.alert('Error', 'Failed to save logo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveLogo = () => {
    setRemoveModalVisible(true);
  };

  const confirmRemoveLogo = async () => {
    try {
      setIsSaving(true);
      setRemoveModalVisible(false);

      // Remove from database (set to null)
      await saveBusinessSettings({
        logo_path: null,
      });

      setLogoUri(null);
      
      Alert.alert('Success', 'Logo removed successfully!');
    } catch (error) {
      console.error('Failed to remove logo:', error);
      Alert.alert('Error', 'Failed to remove logo. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelRemoveLogo = () => {
    setRemoveModalVisible(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading logo...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
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
            <Text style={styles.title}>Logo Upload</Text>
            <Text style={styles.subtitle}>Add or change logos</Text>
          </View>
        </Animated.View>

        {/* Logo Card */}
        <Animated.View
          style={[
            styles.logoCard,
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
          <Text style={styles.cardTitle}>Bill Logo</Text>

          {/* Logo Preview Box */}
          <View style={styles.logoPreviewContainer}>
            {logoUri ? (
              // Show uploaded logo
              <Image source={{ uri: logoUri }} style={styles.logoImage} />
            ) : (
              // Show placeholder icon
              <View style={styles.placeholderIcon}>
                <Icon name="image-outline" size={48} color="#999999" />
              </View>
            )}
          </View>

          <Text style={[styles.logoStatus, logoUri && styles.logoStatusSelected]}>
            {logoUri ? 'Logo Selected' : 'No logo'}
          </Text>

          {/* Change Logo Button */}
          <TouchableOpacity
            style={[
              styles.changeButton, 
              logoUri && styles.changeButtonFilled,
              isSaving && styles.buttonDisabled
            ]}
            onPress={handleChangeLogo}
            activeOpacity={0.9}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={logoUri ? '#FFFFFF' : '#C62828'} />
            ) : (
              <>
                <Icon
                  name="image-outline"
                  size={20}
                  color={logoUri ? '#FFFFFF' : '#C62828'}
                  style={styles.buttonIcon}
                />
                <Text style={[styles.changeButtonText, logoUri && styles.changeButtonTextFilled]}>
                  Change Bill Logo
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* Remove Logo Button (only show if logo exists) */}
          {logoUri && (
            <TouchableOpacity
              style={[styles.removeButton, isSaving && styles.buttonDisabled]}
              onPress={handleRemoveLogo}
              activeOpacity={0.9}
              disabled={isSaving}
            >
              <Text style={styles.removeButtonText}>Remove the Logo</Text>
            </TouchableOpacity>
          )}

          {/* Helper Text (only show if no logo) */}
          {!logoUri && <Text style={styles.helperText}>Appears on printed bill</Text>}
        </Animated.View>
      </ScrollView>

      {/* Remove Confirmation Modal */}
      <Modal
        visible={removeModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelRemoveLogo}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Remove the logo</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={confirmRemoveLogo}
                activeOpacity={0.9}
              >
                <Text style={styles.confirmButtonText}>YES, REMOVE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                onPress={cancelRemoveLogo}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelButtonText}>CANCEL</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
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
  scrollContent: {
    padding: 20,
    paddingTop: 48,
    gap: 24,
    flexGrow: 1,
    justifyContent: 'center',
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
  logoCard: {
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
    alignItems: 'center',
    gap: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.44,
    lineHeight: 27,
    alignSelf: 'flex-start',
  },
  logoPreviewContainer: {
    width: 128,
    height: 128,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  placeholderIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoStatus: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  logoStatusSelected: {
    color: '#999999',
  },
  changeButton: {
    width: '100%',
    height: 48,
    borderWidth: 1.81,
    borderColor: '#C62828',
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  changeButtonFilled: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonIcon: {
    marginTop: -2,
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  changeButtonTextFilled: {
    color: '#FFFFFF',
  },
  removeButton: {
    width: '100%',
    height: 48,
    borderWidth: 1.81,
    borderColor: '#C62828',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  helperText: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
    textAlign: 'center',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(51, 51, 51, 0.5)',
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
    gap: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    textAlign: 'center',
    letterSpacing: -0.26,
    lineHeight: 33,
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

export default LogoUploadScreen;