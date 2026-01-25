import React, {useEffect, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {RootStackParamList, MenuItem, CartItem} from '../types/business.types';
import Icon from 'react-native-vector-icons/Ionicons';
import { getItems, getCategories, getBusinessSettings } from '../services/storage';
import CryptoJS from 'crypto-js';

type BillingScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Billing'>;
};

const BillingScreen: React.FC<BillingScreenProps> = ({navigation}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Array<{id: string; name: string}>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [outOfStockItems, setOutOfStockItems] = useState<Set<string>>(new Set());

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;
  const searchTranslateY = useRef(new Animated.Value(20)).current;
  const filtersOpacity = useRef(new Animated.Value(0)).current;
  const filtersTranslateX = useRef(new Animated.Value(-20)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentTranslateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!isLoading) {
      startAnimations();
    }
  }, [isLoading]);

  const loadData = async () => {
    try {
      // ONLINE-FIRST: Try to load from API first
      console.log('🌐 ONLINE-FIRST: Loading billing data...');
      
      let categoriesData: any[] = [];
      let itemsData: any[] = [];
      
      try {
        // Check if online
        const { getNetworkStatus } = await import('../services/sync');
        const isOnline = await getNetworkStatus();
        
        if (isOnline) {
          console.log('📡 Loading from API (online-first)...');
          const API = await import('../services/api');
          
          // Load from API
          const [apiCategories, apiItems] = await Promise.all([
            API.default.categories.getAll(),
            API.default.items.getAll({ is_active: true }),
          ]);
          
          categoriesData = apiCategories;
          itemsData = apiItems;
          
          console.log('✅ Loaded from API:', {
            categories: categoriesData.length,
            items: itemsData.length,
          });
        } else {
          throw new Error('Offline - loading from local storage');
        }
      } catch (apiError) {
        console.warn('⚠️ API failed, loading from local storage:', apiError);
        // Fallback to local storage
        categoriesData = await getCategories();
        itemsData = await getItems();
      }
      
      setCategories(categoriesData);
      
      // Map items with ALL fields including GST-related fields
      const mappedItems: MenuItem[] = itemsData.map(item => {
        // Get category name from first category (for display)
        const categoryId = item.category_ids?.[0] || '';
        const category = categoriesData.find(cat => cat.id === categoryId);
        
        // --- FIX: Parse strings to numbers to prevent .toFixed crashes ---
        const parsedPrice = parseFloat(String(item.price || 0));
        const parsedMrp = item.mrp_price ? parseFloat(String(item.mrp_price)) : parsedPrice;
        const parsedGst = item.gst_percentage ? parseFloat(String(item.gst_percentage)) : 0;
        const parsedDiscount = item.additional_discount ? parseFloat(String(item.additional_discount)) : 0;

        return {
          id: item.id,
          name: item.name,
          price: parsedPrice, // Safe number
          mrp_price: parsedMrp, // Safe number
          price_type: (item.price_type as 'exclusive' | 'inclusive') || 'exclusive',
          gst_percentage: parsedGst, // Safe number
          veg_nonveg: item.veg_nonveg as 'veg' | 'nonveg' | undefined,
          additional_discount: parsedDiscount, // Safe number
          category: category?.name || 'Uncategorized',
          category_ids: item.category_ids || [categoryId],
          image: item.image_url,
          image_url: item.image_url,
          image_path: item.image_path,
          local_image_path: item.local_image_path,
          description: item.description,
          stock_quantity: item.stock_quantity,
          sku: item.sku,
          barcode: item.barcode,
          is_active: item.is_active,
          sort_order: item.sort_order,
        };
      });

      setMenuItems(mappedItems);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startAnimations = () => {
    // Header animation
    Animated.sequence([
      Animated.delay(100),
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(headerTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Search animation
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(searchOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(searchTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Filters animation
    Animated.sequence([
      Animated.delay(400),
      Animated.parallel([
        Animated.timing(filtersOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(filtersTranslateX, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Content animation
    Animated.sequence([
      Animated.delay(550),
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(contentTranslateY, {
          toValue: 0,
          friction: 7,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
      setCart(
        cart.map(cartItem =>
          cartItem.id === item.id
            ? {...cartItem, quantity: cartItem.quantity + 1}
            : cartItem
        )
      );
    } else {
      setCart([...cart, {...item, quantity: 1}]);
    }
  };

  const removeFromCart = (itemId: string) => {
    const existingItem = cart.find(cartItem => cartItem.id === itemId);
    if (existingItem && existingItem.quantity > 1) {
      setCart(
        cart.map(cartItem =>
          cartItem.id === itemId
            ? {...cartItem, quantity: cartItem.quantity - 1}
            : cartItem
        )
      );
    } else {
      setCart(cart.filter(cartItem => cartItem.id !== itemId));
    }
  };

  const getItemQuantity = (itemId: string) => {
    const item = cart.find(cartItem => cartItem.id === itemId);
    return item ? item.quantity : 0;
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    navigation.navigate('Checkout', {cart});
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleMarkOutOfStock = async (itemId: string) => {
    const newOutOfStock = new Set(outOfStockItems);
    if (newOutOfStock.has(itemId)) {
      newOutOfStock.delete(itemId);
      Alert.alert('Success', 'Item marked as available');
    } else {
      newOutOfStock.add(itemId);
      Alert.alert('Success', 'Item marked as out of stock');
    }
    setOutOfStockItems(newOutOfStock);
  };

  const handleEditItem = async (item: MenuItem) => {
    try {
      // Fetch admin PIN from business settings
      const settings = await getBusinessSettings();
      const storedHashedPin = settings?.admin_pin;

      // Check if admin PIN is set
      if (!storedHashedPin) {
        Alert.alert(
          'Admin PIN Not Set',
          'Please set an admin PIN in Admin Dashboard first before editing items.',
          [
            {
              text: 'Go to Admin',
              onPress: () => navigation.navigate('AdminDashboard'),
            },
            {
              text: 'Cancel',
              style: 'cancel',
            },
          ]
        );
        return;
      }

      // Prompt for admin PIN
      Alert.prompt(
        'Admin PIN Required',
        'Enter admin PIN to edit this item',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'OK',
            onPress: (enteredPin?: string) => {
              if (!enteredPin || enteredPin.trim() === '') {
                Alert.alert('Error', 'Please enter a PIN');
                return;
              }
              
              // Hash the entered PIN and compare with stored hash
              const hashedEnteredPin = CryptoJS.SHA256(enteredPin).toString();
              
              if (hashedEnteredPin === storedHashedPin) {
                navigation.navigate('EditItem', { item });
              } else {
                Alert.alert('Error', 'Incorrect admin PIN');
              }
            },
          },
        ],
        'secure-text'
      );
    } catch (error) {
      console.error('Failed to verify admin PIN:', error);
      Alert.alert('Error', 'Failed to verify admin PIN. Please try again.');
    }
  };

  // Get unique category names for filter buttons
  const getCategoryFilters = () => {
    const uniqueCategories = Array.from(new Set(menuItems.map(item => item.category)));
    return ['All Items', ...uniqueCategories];
  };

  // Filter items based on search and category
  const getFilteredItems = () => {
    return menuItems
      .filter(item => 
        selectedCategory === 'All Items' || item.category === selectedCategory
      )
      .filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
      </View>
    );
  }

  const filteredItems = getFilteredItems();
  const categoryFilters = getCategoryFilters();

  return (
    <View style={styles.container}>
      {/* Header */}
      <Animated.View
        style={[
          styles.header,
          {
            opacity: headerOpacity,
            transform: [{translateY: headerTranslateY}],
          },
        ]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Billing</Text>
      </Animated.View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Search Dishes */}
        <Animated.View
          style={[
            styles.searchContainer,
            {
              opacity: searchOpacity,
              transform: [{translateY: searchTranslateY}],
            },
          ]}>
          <View style={styles.searchInputContainer}>
            <Icon name="search-outline" size={20} color="#999999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search dishes (e.g., Idli, Tea, Biryani)"
              placeholderTextColor="#999999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </Animated.View>

        {/* Category Filters - Horizontal Scroll */}
        <Animated.View
          style={[
            styles.categoryContainer,
            {
              opacity: filtersOpacity,
              transform: [{translateX: filtersTranslateX}],
            },
          ]}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScrollContent}>
            {categoryFilters.map(category => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryButton,
                  selectedCategory === category && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category)}>
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === category && styles.categoryTextActive,
                  ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* All Items Section - VERTICAL LAYOUT */}
        <Animated.View
          style={[
            styles.allItemsContainer,
            {opacity: contentOpacity, transform: [{translateY: contentTranslateY}]},
          ]}>
          <Text style={styles.sectionTitle}>Food Items</Text>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No items found</Text>
              <Text style={styles.emptySubtext}>Try a different search or category</Text>
            </View>
          ) : (
            <View style={styles.verticalItemsList}>
              {filteredItems.map(item => {
                const quantity = getItemQuantity(item.id);
                const isOutOfStock = outOfStockItems.has(item.id);
                return (
                  <View 
                    key={item.id} 
                    style={[styles.verticalItemCard, isOutOfStock && styles.outOfStockCard]}>
                    {/* Item Info Section */}
                    <View style={styles.itemInfoSection}>
                      <View style={styles.itemImageSmall}>
                        <Icon name="restaurant-outline" size={28} color={isOutOfStock ? "#999999" : "#C62828"} />
                      </View>
                      <View style={styles.itemDetails}>
                        <View style={styles.itemNameRow}>
                          <Text style={[styles.verticalItemName, isOutOfStock && styles.outOfStockText]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.veg_nonveg && (
                            <View style={[styles.vegBadge, item.veg_nonveg === 'nonveg' && styles.nonVegBadge]}>
                              <View style={[styles.vegDot, item.veg_nonveg === 'nonveg' && styles.nonVegDot]} />
                            </View>
                          )}
                        </View>
                        <Text style={styles.itemCategory}>{item.category}</Text>
                        <Text style={[styles.verticalItemPrice, isOutOfStock && styles.outOfStockText]}>
                          ₹{item.price.toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    {/* Action Buttons Section */}
                    <View style={styles.itemActionsSection}>
                      {/* Out of Stock Button */}
                      <TouchableOpacity
                        style={[styles.stockButton, isOutOfStock && styles.stockButtonActive]}
                        onPress={() => handleMarkOutOfStock(item.id)}>
                        <Icon 
                          name={isOutOfStock ? "close-circle" : "checkmark-circle-outline"} 
                          size={18} 
                          color={isOutOfStock ? "#FFFFFF" : "#666666"} 
                        />
                        <Text style={[styles.stockButtonText, isOutOfStock && styles.stockButtonTextActive]}>
                          {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                        </Text>
                      </TouchableOpacity>

                      {/* Edit Button */}
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => handleEditItem(item)}>
                        <Icon name="create-outline" size={18} color="#C62828" />
                      </TouchableOpacity>

                      {/* Add to Cart */}
                      {!isOutOfStock && (
                        quantity === 0 ? (
                          <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => addToCart(item)}>
                            <Text style={styles.addButtonText}>Add</Text>
                          </TouchableOpacity>
                        ) : (
                          <View style={styles.quantityControl}>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => removeFromCart(item.id)}>
                              <Text style={styles.quantityButtonText}>-</Text>
                            </TouchableOpacity>
                            <Text style={styles.quantityText}>{quantity}</Text>
                            <TouchableOpacity
                              style={styles.quantityButton}
                              onPress={() => addToCart(item)}>
                              <Text style={styles.quantityButtonText}>+</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Cart Footer */}
      {cart.length > 0 && (
        <Animated.View style={styles.cartFooter}>
          <View style={styles.cartInfo}>
            <Text style={styles.cartItems}>Items: {getTotalItems()}</Text>
            <Text style={styles.cartTotal}>Total: ₹{getTotalAmount().toFixed(2)}</Text>
          </View>
          <TouchableOpacity style={styles.checkoutButton} onPress={handleCheckout}>
            <Text style={styles.checkoutText}>Checkout</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
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
  header: {
    paddingTop: 48,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    marginBottom: 8,
  },
  backText: {
    fontSize: 16,
    color: '#C62828',
    fontWeight: '600',
    letterSpacing: -0.31,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.38,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 16.4,
    paddingHorizontal: 16,
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    color: '#333333',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333333',
    marginBottom: 16,
    letterSpacing: -0.26,
    paddingHorizontal: 4,
  },
  emptyState: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#CCCCCC',
  },
  categoryContainer: {
    marginBottom: 24,
  },
  categoryScrollContent: {
    paddingHorizontal: 20,
    gap: 10,
  },
  categoryButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.8,
    borderColor: '#E0E0E0',
    minWidth: 100,
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: '#C62828',
    borderColor: '#C62828',
  },
  categoryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.31,
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  allItemsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  verticalItemsList: {
    gap: 12,
  },
  verticalItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 0.6,
    borderColor: '#E0E0E0',
    padding: 16,
  },
  outOfStockCard: {
    backgroundColor: '#F5F5F5',
    opacity: 0.7,
  },
  itemInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  itemImageSmall: {
    width: 60,
    height: 60,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  verticalItemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    letterSpacing: -0.44,
    flex: 1,
  },
  vegBadge: {
    width: 18,
    height: 18,
    borderWidth: 1.5,
    borderColor: '#4CAF50',
    borderRadius: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nonVegBadge: {
    borderColor: '#D32F2F',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
  },
  nonVegDot: {
    backgroundColor: '#D32F2F',
  },
  itemCategory: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 6,
  },
  verticalItemPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C62828',
    letterSpacing: -0.31,
  },
  outOfStockText: {
    color: '#999999',
  },
  itemActionsSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stockButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  stockButtonActive: {
    backgroundColor: '#FF6B6B',
    borderColor: '#FF6B6B',
  },
  stockButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666666',
  },
  stockButtonTextActive: {
    color: '#FFFFFF',
  },
  editButton: {
    width: 44,
    height: 44,
    backgroundColor: '#FFF5F5',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C62828',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    width: 80,
    paddingVertical: 10,
    backgroundColor: '#C62828',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 4,
    gap: 8,
    minWidth: 100,
  },
  quantityButton: {
    width: 32,
    height: 32,
    backgroundColor: '#C62828',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    minWidth: 24,
    textAlign: 'center',
  },
  cartFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  cartInfo: {
    flex: 1,
  },
  cartItems: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 4,
  },
  cartTotal: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333333',
  },
  checkoutButton: {
    backgroundColor: '#C62828',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default BillingScreen;