import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Image,
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/business.types';
import { getCategories, createItem } from '../services/storage';
import {syncItems} from '../services/sync';
import { launchCamera, launchImageLibrary, ImageLibraryOptions, CameraOptions } from 'react-native-image-picker';
import {API} from '../services/api';

type AddItemScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddItem'>;
};

const AddItemScreen: React.FC<AddItemScreenProps> = ({ navigation }) => {
  // --- State Management ---
  const [itemName, setItemName] = useState('');
  const [sku, setSku] = useState(''); // New SKU State
  
  // Pricing State
  const [basePrice, setBasePrice] = useState('');
  const [mrpPrice, setMrpPrice] = useState('');
  
  // Attributes
  // Changed default from '0' to '' so no option is pre-selected
  const [gstPercentage, setGstPercentage] = useState(''); 
  const [vegNonVeg, setVegNonVeg] = useState<'veg' | 'nonveg' | ''>('');
  const [additionalDiscount, setAdditionalDiscount] = useState('');
  
  // Categories
  const [category, setCategory] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  
  // Image
  const [imagePath, setImagePath] = useState('');
  
  // System State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  // --- Initialization ---
  useEffect(() => {
    initializeCategories();
    
    // Entrance Animation
    Animated.stagger(100, [
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(formAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // --- Auto-Calculation Logic ---
  
  // 1. Calculate MRP when Base Price or GST changes
  const updateMrpFromBase = (base: string, gst: string) => {
    const baseVal = parseFloat(base);
    const gstVal = parseFloat(gst);
    
    if (!isNaN(baseVal) && !isNaN(gstVal)) {
      const calculatedMrp = baseVal + (baseVal * (gstVal / 100));
      // Round to 2 decimals
      setMrpPrice(calculatedMrp.toFixed(2));
    } else if (!isNaN(baseVal) && gst === '') {
       // If no GST selected, MRP = Base
       setMrpPrice(baseVal.toFixed(2));
    } else if (base === '') {
      setMrpPrice('');
    }
  };

  // 2. Calculate Base Price when MRP changes
  const updateBaseFromMrp = (mrp: string, gst: string) => {
    const mrpVal = parseFloat(mrp);
    const gstVal = parseFloat(gst);

    if (!isNaN(mrpVal) && !isNaN(gstVal)) {
      // Formula: Base = MRP / (1 + GST/100)
      const calculatedBase = mrpVal / (1 + (gstVal / 100));
      setBasePrice(calculatedBase.toFixed(2));
    } else if (!isNaN(mrpVal) && gst === '') {
      // If no GST selected, Base = MRP
      setBasePrice(mrpVal.toFixed(2));
    } else if (mrp === '') {
      setBasePrice('');
    }
  };

  // Handler for GST Change
  const handleGstChange = (newGst: string) => {
    setGstPercentage(newGst);
    // If we have a base price, update MRP to reflect new tax
    if (basePrice) {
      updateMrpFromBase(basePrice, newGst);
    }
  };

  // --- Data Loading ---
  const initializeCategories = async () => {
    try {
      // 1. Try Local DB first for speed
      const localCategories = await getCategories();
      
      if (localCategories.length > 0) {
        setCategories(localCategories);
        // Default select first category
        setCategory(localCategories[0].name);
        setCategoryId(localCategories[0].id);
        setIsLoading(false);
        
        // Background Refresh
        loadCategories(true);
      } else {
        // 2. If empty, fetch from API immediately
        await loadCategories(true);
      }
    } catch (error) {
      console.error('Failed to initialize categories:', error);
      setIsLoading(false);
    }
  };

  const loadCategories = async (fromApi = false) => {
    try {
      if (fromApi) {
        // Dynamic import to avoid circular dependencies if any
        const API = await import('../services/api');
        const apiCategories = await API.default.categories.getAll();
        
        // Update UI State IMMEDIATELY with API data
        if (apiCategories && apiCategories.length > 0) {
          setCategories(apiCategories);
          
          // If no category selected yet, select the first one
          if (!categoryId) {
            setCategory(apiCategories[0].name);
            setCategoryId(apiCategories[0].id);
          }
        }

        // Save to DB in background
        const { getDatabase } = await import('../database/schema');
        const db = getDatabase();
        const now = new Date().toISOString();
        
        for (const cat of apiCategories) {
          await db.execute(
            `INSERT OR REPLACE INTO categories 
             (id, name, description, is_active, sort_order, vendor_id, is_synced, server_updated_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              cat.id, 
              cat.name, 
              cat.description, 
              cat.is_active ? 1 : 0, 
              cat.sort_order, 
              cat.vendor_id, 
              1, // is_synced
              cat.updated_at, 
              cat.created_at, 
              now
            ]
          );
        }
      }
    } catch (error: any) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncCategories = async () => {
    try {
      setIsLoading(true);
      await loadCategories(true);
      Alert.alert('Success', 'Categories synced from server!');
    } catch (error) {
      Alert.alert('Sync Failed', 'Could not fetch categories. Check internet connection.');
    }
  };

  // --- Save Logic ---
  const handleSave = async () => {
    // 1. Validation
    if (!itemName.trim()) {
      Alert.alert('Missing Info', 'Please enter an Item Name.');
      return;
    }
    if (!basePrice) {
      Alert.alert('Missing Info', 'Please enter the Price.');
      return;
    }
    if (!categoryId) {
      Alert.alert('Missing Info', 'Please select a Category.');
      return;
    }

    setIsSaving(true);

    try {
      // 2. Prepare Payload
      const itemData: any = {
        name: itemName.trim(),
        sku: sku.trim() || undefined,
        price: parseFloat(basePrice),
        mrp_price: parseFloat(mrpPrice) || parseFloat(basePrice),
        price_type: 'exclusive', 
        gst_percentage: gstPercentage === '' ? 0 : parseFloat(gstPercentage),
        veg_nonveg: vegNonVeg || undefined,
        additional_discount: parseFloat(additionalDiscount) || 0,
        category_ids: [categoryId],
        stock_quantity: 0,
      };

      // 3. Save to Local Storage (Keep this for offline backup)
      try {
        await createItem({ ...itemData, image_path: imagePath });
        console.log("Saved to local database");
      } catch (localErr) {
        console.warn("Local save failed, proceeding to API:", localErr);
      }

      // 4. CALL API IMMEDIATELY
      console.log("🚀 Sending to API...");
      
      let response;
      if (imagePath) {
        // Use the method from your api.ts that handles Multipart/Form-Data
        response = await API.items.createWithImage(itemData, imagePath);
      } else {
        // Use the standard JSON creation
        response = await API.items.create(itemData);
      }

      console.log("✅ API Success:", response);

      Alert.alert(
        'Success',
        'Item added to server successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error: any) {
      console.error('❌ API Failed:', error);
      
      // Extract error message from API response if available
      let errorMessage = 'Failed to save item. Please check your internet connection.';
      if (error.response?.data) {
        // Should handle object or array error responses
        errorMessage = JSON.stringify(error.response.data);
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // --- Image Handling ---
  const handleImagePicker = (type: 'camera' | 'gallery') => {
    const options: CameraOptions | ImageLibraryOptions = { 
      mediaType: 'photo', 
      quality: 0.8, 
      saveToPhotos: true,
      includeBase64: false 
    };

    const callback = (response: any) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        Alert.alert('Error', response.errorMessage || 'Failed to pick image');
        return;
      }
      if (response.assets && response.assets[0]?.uri) {
        setImagePath(response.assets[0].uri);
      }
    };

    if (type === 'camera') launchCamera(options, callback);
    else launchImageLibrary(options, callback);
  };

  const handleImageUpload = () => {
    Alert.alert(
      'Upload Image',
      'Choose an option',
      [
        { text: 'Camera', onPress: () => handleImagePicker('camera') },
        { text: 'Gallery', onPress: () => handleImagePicker('gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  // --- Render ---
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={{ marginTop: 10, color: '#666' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <Animated.View style={[styles.header, { 
        opacity: headerAnim, 
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] 
      }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Item</Text>
      </Animated.View>

      {/* Form Content */}
      <Animated.View style={[styles.formContainer, { 
        opacity: formAnim, 
        transform: [{ translateY: formAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] 
      }]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          
          {/* 1. Image Upload */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Item Image</Text>
            <TouchableOpacity style={styles.imageUploadInner} onPress={handleImageUpload}>
              {imagePath ? (
                <Image source={{ uri: imagePath }} style={styles.previewImage} resizeMode="cover" />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <View style={styles.uploadIcon}>
                    <View style={styles.cameraBody} />
                    <View style={styles.cameraLens} />
                  </View>
                  <Text style={styles.uploadText}>Tap to upload image</Text>
                </View>
              )}
            </TouchableOpacity>
            {imagePath ? (
              <TouchableOpacity onPress={() => setImagePath('')} style={styles.removeImageBtn}>
                <Text style={styles.removeImageText}>Remove Image</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          {/* 2. Item Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Item Name *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Butter Chicken"
              placeholderTextColor="#999"
              value={itemName}
              onChangeText={setItemName}
            />
          </View>

          {/* 3. SKU / Item Code (Added) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Item Code / SKU (Optional)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 1001"
              placeholderTextColor="#999"
              value={sku}
              onChangeText={setSku}
            />
          </View>

          {/* 4. Veg / Non-Veg Icons */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Dietary Type</Text>
            <View style={styles.dietaryContainer}>
              
              {/* Veg Button */}
              <TouchableOpacity 
                style={[styles.dietaryButton, vegNonVeg === 'veg' && styles.dietaryActive]}
                onPress={() => setVegNonVeg(vegNonVeg === 'veg' ? '' : 'veg')}
              >
                {/* Green Square with Dot */}
                <View style={[styles.vegIconBorder, vegNonVeg === 'veg' ? { opacity: 1 } : { opacity: 0.5 }]}>
                  <View style={styles.vegIconDot} />
                </View>
                <Text style={[styles.dietaryText, vegNonVeg === 'veg' && styles.dietaryTextActive]}>Veg</Text>
              </TouchableOpacity>

              {/* Non-Veg Button */}
              <TouchableOpacity 
                style={[styles.dietaryButton, vegNonVeg === 'nonveg' && styles.dietaryActive]}
                onPress={() => setVegNonVeg(vegNonVeg === 'nonveg' ? '' : 'nonveg')}
              >
                {/* Red/Brown Square with Triangle */}
                <View style={[styles.nonVegIconBorder, vegNonVeg === 'nonveg' ? { opacity: 1 } : { opacity: 0.5 }]}>
                  <View style={styles.nonVegIconTriangle} />
                </View>
                <Text style={[styles.dietaryText, vegNonVeg === 'nonveg' && styles.dietaryTextActive]}>Non-Veg</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* 5. GST Percentage Selection */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>GST Rate (%)</Text>
            <View style={styles.gstPercentageButtons}>
              {['0', '5', '8', '12', '18', '28'].map((percent) => (
                <TouchableOpacity
                  key={percent}
                  style={[
                    styles.gstPercentageButton,
                    gstPercentage === percent && styles.gstPercentageButtonActive,
                  ]}
                  onPress={() => handleGstChange(percent)}>
                  <Text
                    style={[
                      styles.gstPercentageText,
                      gstPercentage === percent && styles.gstPercentageTextActive,
                    ]}>
                    {percent}%
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom GST Input */}
            <TextInput
              style={[styles.textInput, { marginTop: 8 }]}
              placeholder="Or enter custom GST %"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
              value={gstPercentage}
              onChangeText={handleGstChange}
            />
          </View>

          {/* 6. Pricing Fields (Split) */}
          <View style={styles.rowContainer}>
            {/* Base Price Input */}
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.label}>Base Price *</Text>
              <Text style={styles.helperText}>(Excl. GST)</Text>
              <View style={styles.priceInputContainer}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  value={basePrice}
                  onChangeText={(val) => {
                    setBasePrice(val);
                    updateMrpFromBase(val, gstPercentage);
                  }}
                />
              </View>
            </View>

            {/* MRP Input */}
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.label}>MRP *</Text>
              <Text style={styles.helperText}>(Incl. GST)</Text>
              <View style={[styles.priceInputContainer, { backgroundColor: '#F8F9FA' }]}>
                <Text style={styles.rupeeSymbol}>₹</Text>
                <TextInput
                  style={styles.priceInput}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                  value={mrpPrice}
                  onChangeText={(val) => {
                    setMrpPrice(val);
                    updateBaseFromMrp(val, gstPercentage);
                  }}
                />
              </View>
            </View>
          </View>

          {/* 7. Discount */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Additional Discount (Optional)</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={additionalDiscount}
                onChangeText={setAdditionalDiscount}
              />
            </View>
          </View>

          {/* 8. Category Selection */}
          <View style={[styles.fieldContainer, { marginBottom: 20 }]}>
            <Text style={styles.label}>Category *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowCategoryDropdown(true)}
            >
              <Text style={styles.dropdownText}>
                {category || 'Select Category'}
              </Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </Animated.View>

      {/* Footer - Save Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]} 
          onPress={handleSave}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Add Item</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Modal */}
      <Modal
        visible={showCategoryDropdown}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCategoryDropdown(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCategoryDropdown(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <TouchableOpacity onPress={() => setShowCategoryDropdown(false)} style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalScrollView}>
                {categories.length > 0 ? (
                  categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.modalItem,
                        category === cat.name && styles.modalItemSelected
                      ]}
                      onPress={() => {
                        setCategory(cat.name);
                        setCategoryId(cat.id);
                        setShowCategoryDropdown(false);
                      }}
                    >
                      <Text style={[
                        styles.modalItemText,
                        category === cat.name && styles.modalItemTextSelected
                      ]}>
                        {cat.name}
                      </Text>
                      {category === cat.name && <Text style={styles.checkMark}>✓</Text>}
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No categories found</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Categories are synced from server. Check your connection.
                    </Text>
                    <TouchableOpacity
                      style={styles.syncButton}
                      onPress={() => {
                        setShowCategoryDropdown(false);
                        handleSyncCategories();
                      }}
                    >
                      <Text style={styles.syncButtonText}>🔄 Force Sync</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    paddingTop: Platform.OS === 'ios' ? 48 : 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    marginTop: 12,
  },
  formContainer: {
    flex: 1,
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 120, // Space for footer
    gap: 24,
  },
  fieldContainer: {
    gap: 8,
  },
  rowContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  helperText: {
    fontSize: 12,
    color: '#999999',
    marginTop: -4,
    marginBottom: 4,
  },
  
  // Image Styles
  imageUploadInner: {
    height: 180,
    backgroundColor: '#FAFAFA',
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  uploadPlaceholder: {
    alignItems: 'center',
  },
  uploadIcon: {
    width: 60,
    height: 60,
    backgroundColor: '#E0E0E0',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  cameraBody: {
    width: 24,
    height: 18,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  cameraLens: {
    width: 8,
    height: 8,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 4,
    position: 'absolute',
    top: 5,
    backgroundColor: 'transparent',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  removeImageBtn: {
    alignSelf: 'center',
    marginTop: 8,
  },
  removeImageText: {
    color: '#C62828',
    fontSize: 14,
    fontWeight: '500',
  },

  // Input Styles
  textInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    color: '#333333',
  },
  
  // Veg/Non-Veg Styles
  dietaryContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  dietaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  dietaryActive: {
    backgroundColor: '#F9FAFB',
    borderColor: '#333333',
  },
  dietaryText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666666',
  },
  dietaryTextActive: {
    color: '#333333',
    fontWeight: '700',
  },
  
  // Veg Icon (Green Square, Green Dot)
  vegIconBorder: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#43A047',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  vegIconDot: {
    width: 10,
    height: 10,
    backgroundColor: '#43A047',
    borderRadius: 5,
  },

  // Non-Veg Icon (Red Square, Red Triangle)
  nonVegIconBorder: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#D32F2F', // Standard brown/red for non-veg
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
  },
  nonVegIconTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#D32F2F',
  },

  // GST Buttons
  gstPercentageButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gstPercentageButton: {
    width: 50,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    backgroundColor: '#FAFAFA',
  },
  gstPercentageButtonActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  gstPercentageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  gstPercentageTextActive: {
    color: '#FFFFFF',
  },

  // Price Inputs
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  rupeeSymbol: {
    fontSize: 16,
    color: '#333333',
    marginRight: 4,
    fontWeight: '500',
  },
  priceInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333333',
  },

  // Dropdown
  dropdown: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333333',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#999999',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 20,
  },
  saveButton: {
    height: 52,
    backgroundColor: '#C62828',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#C62828',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
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
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '85%',
    maxHeight: '70%',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#999999',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F9F9F9',
  },
  modalItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333333',
  },
  modalItemTextSelected: {
    color: '#C62828',
    fontWeight: '600',
  },
  checkMark: {
    fontSize: 16,
    color: '#C62828',
    fontWeight: 'bold',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 16,
  },
  syncButton: {
    backgroundColor: '#C62828',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AddItemScreen;