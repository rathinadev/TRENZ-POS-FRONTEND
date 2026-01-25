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
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, MenuItem } from '../types/business.types';
import { getCategories, updateItem, getItemById } from '../services/storage';

type EditItemScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'EditItem'>;
  route: RouteProp<RootStackParamList, 'EditItem'>;
};

const EditItemScreen: React.FC<EditItemScreenProps> = ({ navigation, route }) => {
  const { item } = route.params;

  const [itemName, setItemName] = useState(item.name);
  const [price, setPrice] = useState(item.price.toString());
  const [mrpPrice, setMrpPrice] = useState((item.mrp_price || item.price).toString());
  const [priceType, setPriceType] = useState<'exclusive' | 'inclusive'>(
    (item.price_type as 'exclusive' | 'inclusive') || 'exclusive'
  );
  const [gstPercentage, setGstPercentage] = useState((item.gst_percentage || 0).toString());
  const [vegNonVeg, setVegNonVeg] = useState<'veg' | 'nonveg' | ''>(
    (item.veg_nonveg as 'veg' | 'nonveg') || ''
  );
  const [additionalDiscount, setAdditionalDiscount] = useState((item.additional_discount || 0).toString());
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(item.category_ids || []);
  const [imageUrl, setImageUrl] = useState(item.image || '');
  const [useGlobalGST, setUseGlobalGST] = useState(!item.gst_percentage || item.gst_percentage === 0);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [changingImage, setChangingImage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
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
    }
  }, [isLoading]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // First, load from local database (fast)
      const localCategories = await getCategories();
      console.log('📁 Loaded categories from local database:', localCategories.length);
      
      if (localCategories.length > 0) {
        // Set categories immediately if we have them locally
        setCategories(localCategories);
      }
      
      // Then try to fetch from API to get latest (including global categories)
      try {
        console.log('🌐 Fetching categories from API...');
        const API = await import('../services/api');
        const apiCategories = await API.default.categories.getAll();
        console.log(`📥 Received ${apiCategories.length} categories from API`);
        
        // Save to database
        const { getDatabase } = await import('../database/schema');
        const db = getDatabase();
        const now = new Date().toISOString();
        
        for (const category of apiCategories) {
          db.execute(
            `INSERT OR REPLACE INTO categories 
             (id, name, description, is_active, sort_order, vendor_id, is_synced, server_updated_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              category.id,
              category.name,
              category.description,
              category.is_active ? 1 : 0,
              category.sort_order,
              category.vendor_id || null,
              1,
              category.updated_at,
              category.created_at,
              now,
            ]
          );
        }
        console.log(`✅ Synced ${apiCategories.length} categories to database`);
        
        // Reload from database to get the updated list
        const updatedCategories = await getCategories();
        setCategories(updatedCategories);
      } catch (apiError) {
        console.warn('Failed to fetch categories from API, using local data:', apiError);
        
        // If we didn't have local categories and API failed, show a more helpful message
        if (localCategories.length === 0) {
          console.warn('⚠️ No categories available - neither local nor from API');
        }
      }

      // Load fresh item data
      const itemData = await getItemById(item.id);
      if (itemData) {
        setItemName(itemData.name);
        setPrice(itemData.price.toString());
        setMrpPrice((itemData.mrp_price || itemData.price).toString());
        setPriceType((itemData.price_type as 'exclusive' | 'inclusive') || 'exclusive');
        setGstPercentage((itemData.gst_percentage || 0).toString());
        setVegNonVeg((itemData.veg_nonveg as 'veg' | 'nonveg') || '');
        setAdditionalDiscount((itemData.additional_discount || 0).toString());
        setSelectedCategoryIds(itemData.category_ids || []);
        setImageUrl(itemData.image_url || itemData.image_path || '');
        setUseGlobalGST(!itemData.gst_percentage || itemData.gst_percentage === 0);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load item data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter item name');
      return;
    }

    if (!price || parseFloat(price) <= 0) {
      Alert.alert('Error', 'Please enter valid price');
      return;
    }

    if (selectedCategoryIds.length === 0) {
      Alert.alert('Error', 'Please select at least one category');
      return;
    }

    // Price Type is mandatory
    if (!priceType) {
      Alert.alert('Error', 'Please select price type (Exclusive or Inclusive)');
      return;
    }

    try {
      setIsUpdating(true);

      // Update item in database
      await updateItem(item.id, {
        name: itemName.trim(),
        price: parseFloat(price),
        mrp_price: mrpPrice ? parseFloat(mrpPrice) : parseFloat(price),
        price_type: priceType,
        gst_percentage: useGlobalGST ? 0 : (parseFloat(gstPercentage) || 0),
        veg_nonveg: vegNonVeg || undefined,
        additional_discount: parseFloat(additionalDiscount) || 0,
        category_ids: selectedCategoryIds,
        image_url: imageUrl || undefined,
        // Note: Image upload functionality would go here
      });

      Alert.alert(
        'Success',
        'Item updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to update item:', error);
      Alert.alert('Error', 'Failed to update item. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleImageUpload = () => {
    Alert.alert(
      'Upload Image',
      'Choose upload method',
      [
        { text: 'Camera', onPress: () => console.log('Open camera') },
        { text: 'Gallery', onPress: () => console.log('Open gallery') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const handleChangeImage = () => {
    setChangingImage(true);
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategoryIds(prev => {
      if (prev.includes(categoryId)) {
        // Remove category (but keep at least one)
        if (prev.length > 1) {
          return prev.filter(id => id !== categoryId);
        }
        return prev;
      } else {
        // Add category
        return [...prev, categoryId];
      }
    });
  };

  const getSelectedCategoryNames = () => {
    if (selectedCategoryIds.length === 0) return 'Select categories';
    
    const names = selectedCategoryIds
      .map(id => categories.find(cat => cat.id === id)?.name)
      .filter(Boolean);
    
    if (names.length === 0) return 'Select categories';
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1}`;
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading item...</Text>
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
            opacity: headerAnim,
            transform: [
              {
                translateY: headerAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Item</Text>
      </Animated.View>

      {/* Scrollable Form */}
      <Animated.View
        style={[
          styles.formContainer,
          {
            opacity: formAnim,
            transform: [
              {
                translateY: formAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Item Image (Optional) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Item Image (Optional)</Text>
            
            {!changingImage && imageUrl ? (
              /* Show existing image with Change Image link */
              <View style={styles.imagePreviewContainer}>
                <View style={styles.imagePreview}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </View>
                <TouchableOpacity onPress={handleChangeImage}>
                  <Text style={styles.changeImageText}>Change Image</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* Show upload placeholder */
              <View style={styles.imageUploadContainer}>
                <TouchableOpacity style={styles.imageUploadInner} onPress={handleImageUpload}>
                  {/* Upload Icon */}
                  <View style={styles.uploadIcon}>
                    {/* Camera Icon using lines */}
                    <View style={styles.cameraTop} />
                    <View style={styles.cameraBody} />
                    <View style={styles.cameraLens} />
                  </View>
                  <Text style={styles.uploadText}>Upload Item Image</Text>
                  <Text style={styles.browseText}>Tap to browse files</Text>
                </TouchableOpacity>
                
                {/* URL Input */}
                <TextInput
                  style={styles.urlInput}
                  placeholder="Or paste image URL"
                  placeholderTextColor="#999999"
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  editable={!isUpdating}
                />
              </View>
            )}
          </View>

          {/* Item Name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Item Name</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Idli"
              placeholderTextColor="#999999"
              value={itemName}
              onChangeText={setItemName}
              editable={!isUpdating}
            />
          </View>

          {/* Price */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Price</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="40"
                placeholderTextColor="#999999"
                keyboardType="numeric"
                value={price}
                onChangeText={setPrice}
                editable={!isUpdating}
              />
            </View>
          </View>

          {/* MRP Price */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>MRP Price (Optional)</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="Same as price"
                placeholderTextColor="#999999"
                keyboardType="numeric"
                value={mrpPrice}
                onChangeText={setMrpPrice}
                editable={!isUpdating}
              />
            </View>
            <Text style={styles.helperText}>Leave empty to use same as price</Text>
          </View>

          {/* Price Type (MANDATORY) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Item GST Price / MRP Price *</Text>
            <Text style={styles.helperText}>This option is mandatory for GST calculation</Text>
            <View style={styles.priceTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.priceTypeButton,
                  priceType === 'exclusive' && styles.priceTypeButtonActive,
                ]}
                onPress={() => !isUpdating && setPriceType('exclusive')}
                disabled={isUpdating}>
                <Text
                  style={[
                    styles.priceTypeText,
                    priceType === 'exclusive' && styles.priceTypeTextActive,
                  ]}>
                  Exclusive
                </Text>
                <Text style={styles.priceTypeSubtext}>GST added on top</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.priceTypeButton,
                  priceType === 'inclusive' && styles.priceTypeButtonActive,
                ]}
                onPress={() => !isUpdating && setPriceType('inclusive')}
                disabled={isUpdating}>
                <Text
                  style={[
                    styles.priceTypeText,
                    priceType === 'inclusive' && styles.priceTypeTextActive,
                  ]}>
                  Inclusive
                </Text>
                <Text style={styles.priceTypeSubtext}>GST included in price</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Veg/Non-Veg */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Veg or Non-Veg (Optional)</Text>
            <View style={styles.vegNonVegToggle}>
              <TouchableOpacity
                style={[
                  styles.vegNonVegButton,
                  vegNonVeg === 'veg' && styles.vegNonVegButtonActive,
                ]}
                onPress={() => !isUpdating && setVegNonVeg(vegNonVeg === 'veg' ? '' : 'veg')}
                disabled={isUpdating}>
                <Text
                  style={[
                    styles.vegNonVegText,
                    vegNonVeg === 'veg' && styles.vegNonVegTextActive,
                  ]}>
                  Veg
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.vegNonVegButton,
                  vegNonVeg === 'nonveg' && styles.vegNonVegButtonActive,
                ]}
                onPress={() => !isUpdating && setVegNonVeg(vegNonVeg === 'nonveg' ? '' : 'nonveg')}
                disabled={isUpdating}>
                <Text
                  style={[
                    styles.vegNonVegText,
                    vegNonVeg === 'nonveg' && styles.vegNonVegTextActive,
                  ]}>
                  Non-Veg
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Category */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => !isUpdating && setShowCategoryDropdown(true)}
              disabled={isUpdating}
            >
              <Text style={styles.dropdownText}>{getSelectedCategoryNames()}</Text>
              <Text style={styles.dropdownArrow}>▼</Text>
            </TouchableOpacity>
          </View>

          {/* GST Settings (Optional) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>GST Percentage (Optional)</Text>
            <View style={styles.gstContainer}>
              {/* Use Global GST */}
              <TouchableOpacity
                style={[
                  styles.gstButton,
                  useGlobalGST && styles.gstButtonSelected,
                ]}
                onPress={() => !isUpdating && setUseGlobalGST(true)}
                disabled={isUpdating}
              >
                <View style={[styles.radioOuter, useGlobalGST && styles.radioOuterSelected]}>
                  {useGlobalGST && <View style={styles.radioInner} />}
                </View>
                <View style={styles.gstTextContainer}>
                  <Text style={styles.gstTitle}>Use Global GST</Text>
                  <Text style={styles.gstSubtitle}>Apply business-wide GST rate</Text>
                </View>
              </TouchableOpacity>

              {/* Set Item-level GST */}
              <TouchableOpacity
                style={[
                  styles.gstButton,
                  !useGlobalGST && styles.gstButtonSelected,
                ]}
                onPress={() => !isUpdating && setUseGlobalGST(false)}
                disabled={isUpdating}
              >
                <View style={[styles.radioOuter, !useGlobalGST && styles.radioOuterSelected]}>
                  {!useGlobalGST && <View style={styles.radioInner} />}
                </View>
                <View style={styles.gstTextContainer}>
                  <Text style={styles.gstTitle}>Set Item-level GST</Text>
                  <Text style={styles.gstSubtitle}>Custom GST for this item only</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* GST Percentage Input (when not using global) */}
            {!useGlobalGST && (
              <View style={styles.gstPercentageContainer}>
                <Text style={styles.gstPercentageLabel}>GST Percentage</Text>
                <View style={styles.gstPercentageButtons}>
                  {['0', '5', '8', '18'].map((percent) => (
                    <TouchableOpacity
                      key={percent}
                      style={[
                        styles.gstPercentageButton,
                        gstPercentage === percent && styles.gstPercentageButtonActive,
                      ]}
                      onPress={() => !isUpdating && setGstPercentage(percent)}
                      disabled={isUpdating}>
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
                <TextInput
                  style={styles.gstPercentageInput}
                  placeholder="Or enter custom %"
                  placeholderTextColor="#999999"
                  keyboardType="decimal-pad"
                  value={gstPercentage}
                  onChangeText={setGstPercentage}
                  editable={!isUpdating}
                />
              </View>
            )}
          </View>

          {/* Additional Discount */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Additional Discount (Optional)</Text>
            <View style={styles.priceInputContainer}>
              <Text style={styles.rupeeSymbol}>₹</Text>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor="#999999"
                keyboardType="numeric"
                value={additionalDiscount}
                onChangeText={setAdditionalDiscount}
                editable={!isUpdating}
              />
            </View>
            <Text style={styles.helperText}>Item-level discount per unit</Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Footer - Update Button */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.updateButton, isUpdating && styles.updateButtonDisabled]} 
          onPress={handleUpdate}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.updateButtonText}>Update Item</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Category Selection Modal */}
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
                <Text style={styles.modalTitle}>Select Categories</Text>
                <TouchableOpacity 
                  onPress={() => setShowCategoryDropdown(false)}
                  style={styles.modalCloseButton}
                >
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
                        selectedCategoryIds.includes(cat.id) && styles.modalItemSelected
                      ]}
                      onPress={() => toggleCategory(cat.id)}
                    >
                      <View style={styles.checkboxContainer}>
                        <View style={[
                          styles.checkbox,
                          selectedCategoryIds.includes(cat.id) && styles.checkboxSelected
                        ]}>
                          {selectedCategoryIds.includes(cat.id) && (
                            <Text style={styles.checkmark}>✓</Text>
                          )}
                        </View>
                        <Text style={styles.modalItemText}>{cat.name}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.modalItem}>
                    <Text style={styles.modalItemText}>No categories available</Text>
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
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.6,
    borderBottomColor: '#E0E0E0',
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16.6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backArrow: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    color: '#C62828',
    letterSpacing: -0.45,
  },
  backText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#C62828',
    letterSpacing: -0.31,
  },
  headerTitle: {
    fontSize: 28,
    lineHeight: 42,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.38,
    marginTop: 12,
  },
  formContainer: {
    flex: 1,
    paddingTop: 24,
    overflow: 'visible',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
    overflow: 'visible',
  },
  scrollContent: {
    gap: 24,
    paddingBottom: 140,
    overflow: 'visible',
  },
  fieldContainer: {
    gap: 12,
  },
  categoryContainer: {
    zIndex: 9999,
    position: 'relative',
    overflow: 'visible',
  },
  label: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    color: '#333333',
    letterSpacing: -0.15,
  },
  imagePreviewContainer: {
    gap: 12,
  },
  imagePreview: {
    height: 192,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    borderRadius: 16.4,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  changeImageText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '500',
    color: '#C62828',
    letterSpacing: -0.15,
    textDecorationLine: 'underline',
  },
  imageUploadContainer: {
    gap: 12,
  },
  imageUploadInner: {
    height: 192,
    backgroundColor: '#F5F5F5',
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    borderRadius: 16.4,
    justifyContent: 'center',
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  uploadIcon: {
    width: 64,
    height: 64,
    backgroundColor: '#E0E0E0',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cameraTop: {
    width: 10,
    height: 2,
    backgroundColor: '#999999',
    position: 'absolute',
    top: 16,
  },
  cameraBody: {
    width: 18,
    height: 12,
    borderWidth: 2,
    borderColor: '#999999',
    borderRadius: 2,
    position: 'absolute',
    top: 22,
  },
  cameraLens: {
    width: 6,
    height: 6,
    borderWidth: 2,
    borderColor: '#999999',
    borderRadius: 3,
    position: 'absolute',
    top: 25,
  },
  uploadText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#333333',
    letterSpacing: -0.31,
    textAlign: 'center',
  },
  browseText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#999999',
    letterSpacing: -0.31,
    textAlign: 'center',
    marginTop: 8,
  },
  urlInput: {
    height: 49.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.31,
    color: '#333333',
  },
  textInput: {
    height: 49.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.31,
    color: '#333333',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 49.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingLeft: 16,
  },
  rupeeSymbol: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#333333',
    letterSpacing: -0.31,
    marginRight: 8,
  },
  priceInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.31,
    color: '#333333',
    paddingRight: 16,
  },
  dropdown: {
    height: 49.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.31,
    color: '#333333',
  },
  dropdownArrow: {
    fontSize: 12,
    color: '#999999',
  },
  dropdownMenu: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    maxHeight: 200,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 50,
    zIndex: 99999,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F5F5F5',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownItemText: {
    fontSize: 16,
    lineHeight: 19,
    letterSpacing: -0.31,
    color: '#333333',
  },
  gstContainer: {
    gap: 12,
  },
  gstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    height: 73.2,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
  },
  gstButtonSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#C62828',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#C62828',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#C62828',
  },
  gstTextContainer: {
    flex: 1,
  },
  gstTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#333333',
    letterSpacing: -0.31,
  },
  gstSubtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    color: '#999999',
    letterSpacing: -0.31,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 0.6,
    borderTopColor: '#E0E0E0',
    paddingHorizontal: 20,
    paddingTop: 16.6,
    paddingBottom: 32,
  },
  updateButton: {
    height: 52,
    backgroundColor: '#C62828',
    borderRadius: 16.4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.31,
  },
  helperText: {
    fontSize: 12,
    color: '#999999',
    marginTop: 4,
    fontStyle: 'italic',
  },
  priceTypeToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  priceTypeButton: {
    flex: 1,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    alignItems: 'center',
  },
  priceTypeButtonActive: {
    backgroundColor: '#FFF5F5',
    borderColor: '#C62828',
  },
  priceTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  priceTypeTextActive: {
    color: '#C62828',
  },
  priceTypeSubtext: {
    fontSize: 12,
    color: '#999999',
  },
  vegNonVegToggle: {
    flexDirection: 'row',
    gap: 12,
  },
  vegNonVegButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegNonVegButtonActive: {
    backgroundColor: '#FFF5F5',
    borderColor: '#C62828',
  },
  vegNonVegText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  vegNonVegTextActive: {
    color: '#C62828',
  },
  gstPercentageContainer: {
    marginTop: 12,
  },
  gstPercentageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  gstPercentageButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  gstPercentageButton: {
    flex: 1,
    height: 40,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
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
  gstPercentageInput: {
    height: 48,
    backgroundColor: '#FFFFFF',
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
  },
  // Modal Styles
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666666',
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 0.6,
    borderBottomColor: '#F0F0F0',
  },
  modalItemSelected: {
    backgroundColor: '#FFF5F5',
  },
  modalItemText: {
    fontSize: 16,
    color: '#333333',
  },
});

export default EditItemScreen;