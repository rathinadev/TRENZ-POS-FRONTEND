import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  Animated,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { 
  getInventoryItems, 
  createInventoryItem, 
  updateInventoryItem, 
  deleteInventoryItem,
  getUnitTypes,
  getUnsyncedInventoryItems,
  bulkUpsertInventoryItems,
  markInventoryItemSynced,
  InventoryItem,
  UnitType,
} from '../services/storage';
import API from '../services/api';

// Temporary type - will be replaced when you update api.types.ts
type InventoryManagementScreenProps = {
  navigation: NativeStackNavigationProp<any, 'InventoryManagement'>;
};

type ModalMode = 'add' | 'edit' | 'stock' | null;

const InventoryManagementScreen: React.FC<InventoryManagementScreenProps> = ({ navigation }) => {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [unitTypes, setUnitTypes] = useState<UnitType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  
  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formQuantity, setFormQuantity] = useState('');
  const [formUnitType, setFormUnitType] = useState('');
  const [formSku, setFormSku] = useState('');
  const [formBarcode, setFormBarcode] = useState('');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formSupplierContact, setFormSupplierContact] = useState('');
  const [formMinStockLevel, setFormMinStockLevel] = useState('');
  const [formReorderQuantity, setFormReorderQuantity] = useState('');
  
  // Stock update form
  const [stockAction, setStockAction] = useState<'set' | 'add' | 'subtract'>('add');
  const [stockQuantity, setStockQuantity] = useState('');
  const [stockNotes, setStockNotes] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadData();
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

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      const [types, items] = await Promise.all([
        getUnitTypes(),
        getInventoryItems()
      ]);
      
      setUnitTypes(types);
      setInventoryItems(items);
    } catch (error) {
      console.error('Failed to load data:', error);
      Alert.alert('Error', 'Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sync inventory with API
   * This function handles the complete sync process
   */
  const handleSync = async () => {
    try {
      setIsSyncing(true);
      
      // Get unsynced items from local database
      const unsyncedItems = await getUnsyncedInventoryItems();
      
      if (unsyncedItems.length === 0) {
        // No local changes, fetch latest from server
        try {
          const serverItems = await API.inventory.getAll();
          await bulkUpsertInventoryItems(serverItems);
          const items = await getInventoryItems();
          setInventoryItems(items);
          Alert.alert('Success', `Downloaded ${serverItems.length} items from server`);
        } catch (error) {
          console.error('Failed to fetch from server:', error);
          Alert.alert('Info', 'Already up to date');
        }
        return;
      }

      // Sync unsynced items
      let syncedCount = 0;
      let errorCount = 0;

      for (const item of unsyncedItems) {
        try {
          // Check if item exists on server
          let existsOnServer = false;
          try {
            await API.inventory.getById(item.id);
            existsOnServer = true;
          } catch (error: any) {
            if (error.response?.status !== 404) {
              throw error;
            }
          }

          if (existsOnServer) {
            // Update on server
            await API.inventory.update(item.id, {
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit_type: item.unit_type,
              sku: item.sku,
              barcode: item.barcode,
              supplier_name: item.supplier_name,
              supplier_contact: item.supplier_contact,
              min_stock_level: item.min_stock_level,
              reorder_quantity: item.reorder_quantity,
              is_active: item.is_active,
            });
          } else {
            // Create on server
            await API.inventory.create({
              name: item.name,
              description: item.description,
              quantity: item.quantity,
              unit_type: item.unit_type,
              sku: item.sku,
              barcode: item.barcode,
              supplier_name: item.supplier_name,
              supplier_contact: item.supplier_contact,
              min_stock_level: item.min_stock_level,
              reorder_quantity: item.reorder_quantity,
              is_active: item.is_active,
            });
          }

          // Mark as synced locally
          await markInventoryItemSynced(item.id);
          syncedCount++;
        } catch (error) {
          console.error(`Failed to sync item ${item.id}:`, error);
          errorCount++;
        }
      }

      // Reload items
      const items = await getInventoryItems();
      setInventoryItems(items);

      if (errorCount === 0) {
        Alert.alert('Success', `Synced ${syncedCount} items`);
      } else {
        Alert.alert('Partial Success', `Synced ${syncedCount} items, ${errorCount} failed`);
      }
    } catch (error) {
      console.error('Sync failed:', error);
      Alert.alert('Error', 'Failed to sync inventory');
    } finally {
      setIsSyncing(false);
    }
  };

  const openAddModal = () => {
    resetForm();
    setModalMode('add');
    setModalVisible(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormName(item.name);
    setFormDescription(item.description || '');
    setFormQuantity(item.quantity);
    setFormUnitType(item.unit_type);
    setFormSku(item.sku || '');
    setFormBarcode(item.barcode || '');
    setFormSupplierName(item.supplier_name || '');
    setFormSupplierContact(item.supplier_contact || '');
    setFormMinStockLevel(item.min_stock_level || '');
    setFormReorderQuantity(item.reorder_quantity || '');
    setModalMode('edit');
    setModalVisible(true);
  };

  const openStockModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setStockAction('add');
    setStockQuantity('');
    setStockNotes('');
    setModalMode('stock');
    setModalVisible(true);
  };

  const resetForm = () => {
    setSelectedItem(null);
    setFormName('');
    setFormDescription('');
    setFormQuantity('');
    setFormUnitType(unitTypes[0]?.value || '');
    setFormSku('');
    setFormBarcode('');
    setFormSupplierName('');
    setFormSupplierContact('');
    setFormMinStockLevel('');
    setFormReorderQuantity('');
  };

  const handleSave = async () => {
    try {
      if (!formName.trim()) {
        Alert.alert('Error', 'Please enter item name');
        return;
      }

      if (!formQuantity || parseFloat(formQuantity) < 0) {
        Alert.alert('Error', 'Please enter valid quantity');
        return;
      }

      if (!formUnitType) {
        Alert.alert('Error', 'Please select unit type');
        return;
      }

      setIsSaving(true);

      const itemData: Partial<InventoryItem> = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        quantity: formQuantity,
        unit_type: formUnitType,
        sku: formSku.trim() || undefined,
        barcode: formBarcode.trim() || undefined,
        supplier_name: formSupplierName.trim() || undefined,
        supplier_contact: formSupplierContact.trim() || undefined,
        min_stock_level: formMinStockLevel || undefined,
        reorder_quantity: formReorderQuantity || undefined,
        is_active: true,
      };

      if (modalMode === 'add') {
        await createInventoryItem(itemData as Omit<InventoryItem, 'id'>);
        Alert.alert('Success', 'Item added successfully');
      } else if (modalMode === 'edit' && selectedItem) {
        await updateInventoryItem(selectedItem.id, itemData);
        Alert.alert('Success', 'Item updated successfully');
      }

      const items = await getInventoryItems();
      setInventoryItems(items);

      setModalVisible(false);
      resetForm();
    } catch (error) {
      console.error('Save failed:', error);
      Alert.alert('Error', 'Failed to save item');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStockUpdate = async () => {
    try {
      if (!selectedItem) return;

      if (!stockQuantity || parseFloat(stockQuantity) <= 0) {
        Alert.alert('Error', 'Please enter valid quantity');
        return;
      }

      setIsSaving(true);

      const currentQty = parseFloat(selectedItem.quantity);
      const changeQty = parseFloat(stockQuantity);
      let newQuantity: number;

      switch (stockAction) {
        case 'set':
          newQuantity = changeQty;
          break;
        case 'add':
          newQuantity = currentQty + changeQty;
          break;
        case 'subtract':
          newQuantity = currentQty - changeQty;
          if (newQuantity < 0) {
            Alert.alert('Error', 'Cannot subtract more than current quantity');
            setIsSaving(false);
            return;
          }
          break;
      }

      await updateInventoryItem(selectedItem.id, {
        quantity: newQuantity.toString(),
        last_restocked_at: new Date().toISOString(),
      });

      Alert.alert('Success', 'Stock updated successfully');

      const items = await getInventoryItems();
      setInventoryItems(items);

      setModalVisible(false);
    } catch (error) {
      console.error('Stock update failed:', error);
      Alert.alert('Error', 'Failed to update stock');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (item: InventoryItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInventoryItem(item.id);
              const items = await getInventoryItems();
              setInventoryItems(items);
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error) {
              console.error('Delete failed:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const filteredItems = inventoryItems.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.supplier_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = !showLowStockOnly || item.is_low_stock;

    return matchesSearch && matchesFilter;
  });

  const lowStockCount = inventoryItems.filter(item => item.is_low_stock).length;

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C62828" />
        <Text style={styles.loadingText}>Loading inventory...</Text>
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
        </TouchableOpacity>

        <View style={styles.headerText}>
          <Text style={styles.title}>Inventory Management</Text>
          <Text style={styles.subtitle}>
            {inventoryItems.length} items • {lowStockCount} low stock
          </Text>
        </View>

        <TouchableOpacity
          style={styles.syncButton}
          onPress={handleSync}
          disabled={isSyncing}
          activeOpacity={0.7}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color="#C62828" />
          ) : (
            <Text style={styles.syncIcon}>⟳</Text>
          )}
        </TouchableOpacity>
      </Animated.View>

      {/* Search and Filter */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search inventory..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999999"
          />
        </View>

        <TouchableOpacity
          style={[styles.filterButton, showLowStockOnly && styles.filterButtonActive]}
          onPress={() => setShowLowStockOnly(!showLowStockOnly)}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, showLowStockOnly && styles.filterTextActive]}>
            Low Stock
          </Text>
        </TouchableOpacity>
      </View>

      {/* Inventory List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {filteredItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateIcon}>📦</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery || showLowStockOnly ? 'No items found' : 'No inventory items'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {searchQuery || showLowStockOnly ? 'Try adjusting your filters' : 'Add your first raw material'}
            </Text>
          </View>
        ) : (
          filteredItems.map((item) => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemTitleRow}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.is_low_stock && (
                    <View style={styles.lowStockBadge}>
                      <Text style={styles.lowStockText}>Low</Text>
                    </View>
                  )}
                </View>
                {item.sku && (
                  <Text style={styles.itemSku}>SKU: {item.sku}</Text>
                )}
              </View>

              <View style={styles.itemDetails}>
                <View style={styles.itemDetailRow}>
                  <Text style={styles.detailLabel}>Stock:</Text>
                  <Text style={[styles.detailValue, item.is_low_stock && styles.detailValueWarning]}>
                    {item.quantity} {item.unit_type_display}
                  </Text>
                </View>
                {item.supplier_name && (
                  <View style={styles.itemDetailRow}>
                    <Text style={styles.detailLabel}>Supplier:</Text>
                    <Text style={styles.detailValue}>{item.supplier_name}</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => openStockModal(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonText}>Update Stock</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonSecondary}
                  onPress={() => openEditModal(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonSecondaryText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButtonDanger}
                  onPress={() => handleDelete(item)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionButtonDangerText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={openAddModal}
        activeOpacity={0.9}
      >
        <Text style={styles.addButtonText}>+ Add Item</Text>
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible && (modalMode === 'add' || modalMode === 'edit')}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {modalMode === 'add' ? 'Add Inventory Item' : 'Edit Inventory Item'}
              </Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalClose}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Name *</Text>
                <TextInput
                  style={styles.formInput}
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="e.g., Wheat Flour"
                  placeholderTextColor="#999999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextArea]}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="Description..."
                  placeholderTextColor="#999999"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Quantity *</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formQuantity}
                    onChangeText={setFormQuantity}
                    placeholder="0"
                    placeholderTextColor="#999999"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.formLabel}>Unit *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {unitTypes.map((unit) => (
                      <TouchableOpacity
                        key={unit.value}
                        style={[
                          styles.unitButton,
                          formUnitType === unit.value && styles.unitButtonActive,
                        ]}
                        onPress={() => setFormUnitType(unit.value)}
                      >
                        <Text
                          style={[
                            styles.unitButtonText,
                            formUnitType === unit.value && styles.unitButtonTextActive,
                          ]}
                        >
                          {unit.value}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>SKU</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formSku}
                    onChangeText={setFormSku}
                    placeholder="SKU code"
                    placeholderTextColor="#999999"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.formLabel}>Barcode</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formBarcode}
                    onChangeText={setFormBarcode}
                    placeholder="Barcode"
                    placeholderTextColor="#999999"
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Supplier Name</Text>
                <TextInput
                  style={styles.formInput}
                  value={formSupplierName}
                  onChangeText={setFormSupplierName}
                  placeholder="Supplier name"
                  placeholderTextColor="#999999"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Supplier Contact</Text>
                <TextInput
                  style={styles.formInput}
                  value={formSupplierContact}
                  onChangeText={setFormSupplierContact}
                  placeholder="Phone/Email"
                  placeholderTextColor="#999999"
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Min Stock Level</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formMinStockLevel}
                    onChangeText={setFormMinStockLevel}
                    placeholder="0"
                    placeholderTextColor="#999999"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                  <Text style={styles.formLabel}>Reorder Qty</Text>
                  <TextInput
                    style={styles.formInput}
                    value={formReorderQuantity}
                    onChangeText={setFormReorderQuantity}
                    placeholder="0"
                    placeholderTextColor="#999999"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonPrimary, isSaving && styles.modalButtonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Stock Update Modal */}
      <Modal
        visible={modalVisible && modalMode === 'stock'}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Update Stock</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalClose}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <>
                <View style={styles.stockInfo}>
                  <Text style={styles.stockInfoTitle}>{selectedItem.name}</Text>
                  <Text style={styles.stockInfoCurrent}>
                    Current: {selectedItem.quantity} {selectedItem.unit_type_display}
                  </Text>
                </View>

                <View style={styles.actionTypeSelector}>
                  {(['set', 'add', 'subtract'] as const).map((action) => (
                    <TouchableOpacity
                      key={action}
                      style={[
                        styles.actionTypeButton,
                        stockAction === action && styles.actionTypeButtonActive,
                      ]}
                      onPress={() => setStockAction(action)}
                    >
                      <Text
                        style={[
                          styles.actionTypeText,
                          stockAction === action && styles.actionTypeTextActive,
                        ]}
                      >
                        {action === 'set' ? 'Set' : action === 'add' ? 'Add' : 'Subtract'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Quantity</Text>
                  <TextInput
                    style={styles.formInput}
                    value={stockQuantity}
                    onChangeText={setStockQuantity}
                    placeholder="Enter quantity"
                    placeholderTextColor="#999999"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Notes (Optional)</Text>
                  <TextInput
                    style={[styles.formInput, styles.formTextArea]}
                    value={stockNotes}
                    onChangeText={setStockNotes}
                    placeholder="Add notes..."
                    placeholderTextColor="#999999"
                    multiline
                    numberOfLines={2}
                  />
                </View>
              </>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalButtonSecondary}
                onPress={() => setModalVisible(false)}
                disabled={isSaving}
              >
                <Text style={styles.modalButtonSecondaryText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButtonPrimary, isSaving && styles.modalButtonDisabled]}
                onPress={handleStockUpdate}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalButtonPrimaryText}>Update</Text>
                )}
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
    fontSize: 16,
    fontWeight: '600',
    color: '#C62828',
    lineHeight: 21,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333333',
    letterSpacing: 0.38,
    lineHeight: 42,
  },
  subtitle: {
    fontSize: 16,
    color: '#999999',
    letterSpacing: -0.31,
    lineHeight: 24,
  },
  syncButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncIcon: {
    fontSize: 24,
    color: '#C62828',
  },
  searchSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 0.6,
    borderBottomColor: '#E0E0E0',
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333333',
  },
  filterButton: {
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#C62828',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999999',
  },
  itemCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.81,
    borderColor: '#E0E0E0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  itemHeader: {
    marginBottom: 12,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  lowStockBadge: {
    backgroundColor: '#FFF3CD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  lowStockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#856404',
  },
  itemSku: {
    fontSize: 14,
    color: '#999999',
  },
  itemDetails: {
    marginBottom: 12,
    gap: 8,
  },
  itemDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  detailValueWarning: {
    color: '#C62828',
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 36,
    backgroundColor: '#C62828',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  actionButtonSecondary: {
    paddingHorizontal: 12,
    height: 36,
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  actionButtonDanger: {
    paddingHorizontal: 12,
    height: 36,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtonDangerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C62828',
  },
  addButton: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    height: 56,
    backgroundColor: '#C62828',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 5,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#333333',
  },
  modalClose: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#999999',
  },
  modalScroll: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  formInput: {
    height: 48,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#333333',
  },
  formTextArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  unitButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F2F2F2',
    borderRadius: 8,
    marginRight: 8,
  },
  unitButtonActive: {
    backgroundColor: '#C62828',
  },
  unitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  unitButtonTextActive: {
    color: '#FFFFFF',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  modalButtonSecondary: {
    flex: 1,
    height: 48,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  modalButtonPrimary: {
    flex: 1,
    height: 48,
    backgroundColor: '#C62828',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButtonPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  modalButtonDisabled: {
    opacity: 0.6,
  },
  stockInfo: {
    padding: 20,
    backgroundColor: '#F2F2F2',
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
  },
  stockInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  stockInfoCurrent: {
    fontSize: 16,
    color: '#666666',
  },
  actionTypeSelector: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
  },
  actionTypeButton: {
    flex: 1,
    height: 44,
    backgroundColor: '#F2F2F2',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionTypeButtonActive: {
    backgroundColor: '#C62828',
  },
  actionTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
  },
  actionTypeTextActive: {
    color: '#FFFFFF',
  },
});

export default InventoryManagementScreen;