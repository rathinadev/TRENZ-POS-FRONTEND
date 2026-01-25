// src/services/sync.ts
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { formatDisplayDateTime } from '../utils/helpers';
import { getDatabase } from '../database/schema';
import API from './api';
import { getUserData } from './auth';
import { 
  getUnsyncedInventoryItems, 
  bulkUpsertInventoryItems, 
  markInventoryItemSynced 
} from './storage';

export interface SyncOperation {
  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'category' | 'item' | 'bill' | 'inventory';
  entity_id: string;
  data: any;
  timestamp: string;
  retry_count?: number;
}

// Helper to execute SQL
const executeSql = (sql: string, params: any[] = []): any[] => {
  const db = getDatabase();
  const result = db.execute(sql, params);
  return result.rows?._array || [];
};

// ==================== NETWORK STATUS ====================

let isOnline = true;
let offlineTimestamp: number | null = null;
let syncTimeout: NodeJS.Timeout | null = null;

export const initNetworkListener = () => {
  NetInfo.addEventListener(state => {
    const wasOffline = !isOnline;
    const previousOnline = isOnline;
    isOnline = state.isConnected ?? false;
    
    console.log(`📶 Network status: ${isOnline ? '✅ Online' : '📴 Offline'}`);
    
    // Track when we go offline
    if (!isOnline && wasOffline === false) {
      offlineTimestamp = Date.now();
      console.log('📴 Going offline - tracking timestamp');
    }
    
    // AUTO-SYNC: Only trigger when genuinely coming back online after being offline
    if (wasOffline && isOnline) {
      const offlineDuration = offlineTimestamp ? Date.now() - offlineTimestamp : 0;
      
      console.log(`🔄 Network transition detected: offline → online`);
      console.log(`   Offline duration: ${offlineDuration}ms`);
      
      // Only sync if we were offline for more than 3 seconds (prevents false triggers)
      if (offlineDuration > 3000) {
        console.log('🔄 AUTO-SYNC: Network genuinely restored - syncing all local changes to backend...');
        
        // Clear any pending sync timeout
        if (syncTimeout) {
          clearTimeout(syncTimeout);
        }
        
        // Wait 2 seconds to ensure connection is stable
        syncTimeout = setTimeout(async () => {
          try {
            const result = await syncAll();
            
            if (result.success) {
              const total = result.categoriesSynced + result.itemsSynced + result.billsSynced + result.inventorySynced;
              console.log(`✅ AUTO-SYNC: Successfully synced ${total} changes to backend`);
              console.log(`   Categories: ${result.categoriesSynced}, Items: ${result.itemsSynced}, Bills: ${result.billsSynced}, Inventory: ${result.inventorySynced}`);
            } else {
              console.warn('⚠️ AUTO-SYNC: Sync completed with some errors');
            }
          } catch (error) {
            console.error('❌ AUTO-SYNC: Failed to sync:', error);
          } finally {
            offlineTimestamp = null;
          }
        }, 2000);
      } else {
        console.log(`⏭️ AUTO-SYNC: Skipping sync - offline duration too short (${offlineDuration}ms < 3000ms)`);
        console.log('   This was likely a false network state change, not a genuine disconnection');
        offlineTimestamp = null;
      }
    }
  });
};

export const getNetworkStatus = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

// ==================== SYNC HISTORY ====================

/**
 * Save sync operation to history for BackupDetailsScreen
 */
const saveSyncToHistory = async (
  categoriesSynced: number,
  itemsSynced: number,
  billsSynced: number,
  inventorySynced?: number
): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const formattedDate = formatDisplayDateTime(now);
    
    // Create new history entry
    const newEntry = {
      id: now, // Use timestamp as ID
      date: formattedDate,
      timestamp: now,
      items: [
        { name: 'Categories', count: categoriesSynced },
        { name: 'Items', count: itemsSynced },
        { name: 'Bills', count: billsSynced },
        { name: 'Inventory', count: inventorySynced || 0 },
      ].filter(item => item.count > 0), // Only include items that were actually synced
    };
    
    // Load existing history
    const historyJson = await AsyncStorage.getItem('sync_history');
    let history = historyJson ? JSON.parse(historyJson) : [];
    
    // Add new entry to beginning
    history.unshift(newEntry);
    
    // Keep only last 20 entries
    if (history.length > 20) {
      history = history.slice(0, 20);
    }
    
    // Save updated history
    await AsyncStorage.setItem('sync_history', JSON.stringify(history));
    
    console.log('Sync history saved successfully');
  } catch (error) {
    console.error('Failed to save sync history:', error);
    // Don't throw - this is not critical
  }
};

// ==================== QUEUE OPERATIONS ====================

export const queueOperation = async (operation: SyncOperation): Promise<void> => {
  const now = new Date().toISOString();
  
  try {
    executeSql(
      `INSERT INTO sync_queue 
       (operation_type, entity_type, entity_id, data, timestamp, retry_count, synced, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        operation.operation_type,
        operation.entity_type,
        operation.entity_id,
        JSON.stringify(operation.data),
        operation.timestamp,
        0,
        0,
        now,
      ]
    );
    
    console.log(`Queued ${operation.operation_type} operation for ${operation.entity_type}:${operation.entity_id}`);
    
    if (await getNetworkStatus()) {
      setTimeout(() => syncAll(), 500);
    }
  } catch (error) {
    console.error('Failed to queue operation:', error);
    throw error;
  }
};

export const getPendingOperations = async (): Promise<any[]> => {
  try {
    return executeSql(
      'SELECT * FROM sync_queue WHERE synced = 0 ORDER BY created_at ASC'
    );
  } catch (error) {
    console.error('Failed to get pending operations:', error);
    return [];
  }
};

export const markOperationSynced = async (operationId: number): Promise<void> => {
  const now = new Date().toISOString();
  
  try {
    executeSql(
      'UPDATE sync_queue SET synced = 1, synced_at = ? WHERE id = ?',
      [now, operationId]
    );
  } catch (error) {
    console.error('Failed to mark operation as synced:', error);
  }
};

export const updateRetryCount = async (operationId: number, error: string): Promise<void> => {
  try {
    executeSql(
      'UPDATE sync_queue SET retry_count = retry_count + 1, last_error = ? WHERE id = ?',
      [error, operationId]
    );
  } catch (error) {
    console.error('Failed to update retry count:', error);
  }
};

// ==================== SYNC FUNCTIONS ====================

export const syncCategories = async (): Promise<{ success: boolean; synced: number }> => {
  try {
    const operations = executeSql(
      `SELECT * FROM sync_queue 
       WHERE entity_type = 'category' AND synced = 0 
       ORDER BY created_at ASC`
    );
    
    if (operations.length === 0) {
      return { success: true, synced: 0 };
    }
    
    console.log(`Syncing ${operations.length} category operations...`);
    
    const syncPayload = operations.map(op => ({
      operation: op.operation_type,
      data: op.operation_type !== 'delete' ? JSON.parse(op.data) : undefined,
      id: op.operation_type === 'delete' ? op.entity_id : undefined,
      timestamp: op.timestamp,
    }));
    
    const response = await API.categories.sync(syncPayload);
    
    console.log(`Categories synced: ${response.synced} operations`);
    
    for (const op of operations) {
      await markOperationSynced(op.id);
    }
    
    if (response.categories && response.categories.length > 0) {
      for (const category of response.categories) {
        executeSql(
          `UPDATE categories 
           SET is_synced = 1, server_updated_at = ?, updated_at = ?
           WHERE id = ?`,
          [category.updated_at, new Date().toISOString(), category.id]
        );
      }
    }
    
    return { success: true, synced: operations.length };
  } catch (error) {
    console.error('Category sync failed:', error);
    return { success: false, synced: 0 };
  }
};

export const syncItems = async (): Promise<{ success: boolean; synced: number }> => {
  try {
    const operations = executeSql(
      `SELECT * FROM sync_queue 
       WHERE entity_type = 'item' AND synced = 0 
       ORDER BY created_at ASC`
    );
    
    if (operations.length === 0) {
      return { success: true, synced: 0 };
    }
    
    console.log(`Syncing ${operations.length} item operations...`);
    
    const syncPayload = operations.map(op => ({
      operation: op.operation_type,
      data: op.operation_type !== 'delete' ? JSON.parse(op.data) : undefined,
      id: op.operation_type === 'delete' ? op.entity_id : undefined,
      timestamp: op.timestamp,
    }));
    
    const response = await API.items.sync(syncPayload);
    
    console.log(`Items synced: ${response.synced} operations`);
    
    for (const op of operations) {
      await markOperationSynced(op.id);
    }
    
    if (response.items && response.items.length > 0) {
      // Import image cache utility
      const { cacheItemImage } = await import('../utils/imageCache');
      
      for (const item of response.items) {
        executeSql(
          `UPDATE items 
           SET is_synced = 1, server_updated_at = ?, image_url = ?, updated_at = ?
           WHERE id = ?`,
          [item.last_updated, item.image_url, new Date().toISOString(), item.id]
        );
        
        // Cache item image if available
        if (item.image_url) {
          try {
            await cacheItemImage(item.id, item.image_url);
          } catch (error) {
            console.warn(`Failed to cache image for item ${item.id}:`, error);
          }
        }
      }
    }
    
    return { success: true, synced: operations.length };
  } catch (error) {
    console.error('Item sync failed:', error);
    return { success: false, synced: 0 };
  }
};

export const syncBills = async (): Promise<{ success: boolean; synced: number }> => {
  try {
    const userData = await getUserData();
    
    if (!userData) {
      console.log('No user data - skipping bill sync');
      return { success: false, synced: 0 };
    }
    
    const bills = executeSql(
      'SELECT * FROM bills WHERE is_synced = 0 ORDER BY created_at ASC LIMIT 50'
    );
    
    if (bills.length === 0) {
      return { success: true, synced: 0 };
    }
    
    console.log(`Syncing ${bills.length} bills...`);
    
    // Transform bills to API format
    const billPayload = bills.map(bill => {
      const billItems = JSON.parse(bill.items);
      
      return {
        invoice_number: bill.invoice_number || bill.bill_number,
        bill_id: bill.id,
        billing_mode: bill.billing_mode || 'gst',
        restaurant_name: bill.restaurant_name || '',
        address: bill.address || '',
        gstin: bill.gstin || null,
        fssai_license: bill.fssai_license || null,
        bill_date: bill.bill_date || bill.created_at.split('T')[0],
        items: billItems,
        subtotal: bill.subtotal,
        discount_amount: bill.discount_amount || 0,
        discount_percentage: bill.discount_percentage || 0,
        cgst: bill.cgst_amount || 0,
        sgst: bill.sgst_amount || 0,
        igst: bill.igst_amount || 0,
        total_tax: bill.total_tax || 0,
        total: bill.total_amount,
        payment_mode: bill.payment_mode || bill.payment_method || 'cash',
        payment_reference: bill.payment_reference || null,
        amount_paid: bill.amount_paid || bill.total_amount,
        change_amount: bill.change_amount || 0,
        customer_name: bill.customer_name || null,
        customer_phone: bill.customer_phone || null,
        notes: bill.notes || null,
        timestamp: bill.created_at,
        device_id: bill.device_id,
      };
    });
    
    const response = await API.bills.sync(billPayload);
    
    console.log(`Bills synced: ${response.synced} bills`);
    
    const billIds = bills.map(b => b.id);
    const placeholders = billIds.map(() => '?').join(',');
    executeSql(
      `UPDATE bills SET is_synced = 1 WHERE id IN (${placeholders})`,
      billIds
    );
    
    return { success: true, synced: bills.length };
  } catch (error) {
    console.error('Bill sync failed:', error);
    return { success: false, synced: 0 };
  }
};

// ==================== INVENTORY SYNC ====================

export const syncInventory = async (): Promise<{ success: boolean; synced: number }> => {
  try {
    const unsyncedItems = await getUnsyncedInventoryItems();
    
    if (unsyncedItems.length === 0) {
      return { success: true, synced: 0 };
    }
    
    console.log(`Syncing ${unsyncedItems.length} inventory items...`);
    
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
            throw error; // Re-throw if not 404
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

        // Mark as synced
        await markInventoryItemSynced(item.id);
        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync inventory item ${item.id}:`, error);
        errorCount++;
      }
    }

    console.log(`Inventory synced: ${syncedCount} items, ${errorCount} errors`);
    
    return { 
      success: errorCount === 0, 
      synced: syncedCount 
    };
  } catch (error) {
    console.error('Inventory sync failed:', error);
    return { success: false, synced: 0 };
  }
};

export const syncAll = async (): Promise<{
  success: boolean;
  categoriesSynced: number;
  itemsSynced: number;
  billsSynced: number;
  inventorySynced: number;
}> => {
  console.log('🔄 === Starting full sync to backend ===');
  
  const online = await getNetworkStatus();
  if (!online) {
    console.log('📴 Offline - skipping sync');
    return { 
      success: false, 
      categoriesSynced: 0, 
      itemsSynced: 0, 
      billsSynced: 0,
      inventorySynced: 0,
    };
  }
  
  console.log('📡 Online - syncing all local changes to backend...');
  
  const categoriesResult = await syncCategories();
  const itemsResult = await syncItems();
  const billsResult = await syncBills();
  const inventoryResult = await syncInventory();
  
  const success = 
    categoriesResult.success && 
    itemsResult.success && 
    billsResult.success &&
    inventoryResult.success;
  
  console.log('=== Sync complete ===');
  console.log(`Categories: ${categoriesResult.synced}, Items: ${itemsResult.synced}, Bills: ${billsResult.synced}, Inventory: ${inventoryResult.synced}`);
  
  // Save to history if any items were synced
  if (success && (
    categoriesResult.synced > 0 || 
    itemsResult.synced > 0 || 
    billsResult.synced > 0 ||
    inventoryResult.synced > 0
  )) {
    await saveSyncToHistory(
      categoriesResult.synced,
      itemsResult.synced,
      billsResult.synced,
      inventoryResult.synced
    );
    
    // Update last sync time
    const now = new Date().toISOString();
    await AsyncStorage.setItem('last_sync_time', now);
  }
  
  return {
    success,
    categoriesSynced: categoriesResult.synced,
    itemsSynced: itemsResult.synced,
    billsSynced: billsResult.synced,
    inventorySynced: inventoryResult.synced,
  };
};

// ==================== INITIAL SYNC ====================

export const initialSync = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log('=== Starting initial sync from server ===');
    console.log(`📡 API Base URL: ${require('./api').API_BASE_URL}`);
    
    const online = await getNetworkStatus();
    if (!online) {
      console.warn('⚠️ No internet connection detected');
      return { success: false, error: 'No internet connection' };
    }
    
    console.log('✅ Internet connection available');
    const now = new Date().toISOString();
    
    // Download categories
    console.log('📁 Downloading categories...');
    const categories = await API.categories.getAll();
    
    for (const category of categories) {
      executeSql(
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
    
    console.log(`✅ Downloaded ${categories.length} categories`);
    
    // Download items
    console.log('📦 Downloading items...');
    const items = await API.items.getAll();
    
    // Save items to database (fast, synchronous)
    for (const item of items) {
      executeSql(
        `INSERT OR REPLACE INTO items 
         (id, name, description, price, mrp_price, price_type, gst_percentage, veg_nonveg, additional_discount,
          stock_quantity, sku, barcode, is_active, sort_order, 
          vendor_id, image_url, is_synced, server_updated_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          item.id,
          item.name,
          item.description,
          item.price,
          item.mrp_price || item.price,
          item.price_type || 'exclusive',
          item.gst_percentage || 0,
          item.veg_nonveg || null,
          item.additional_discount || 0,
          item.stock_quantity || 0,
          item.sku || null,
          item.barcode || null,
          item.is_active ? 1 : 0,
          item.sort_order || 0,
          item.vendor || null,
          item.image_url || null,
          1,
          item.last_updated || item.updated_at,
          item.created_at,
          now,
        ]
      );
      
      executeSql('DELETE FROM item_categories WHERE item_id = ?', [item.id]);
      
      if (item.category_ids && item.category_ids.length > 0) {
        for (const categoryId of item.category_ids) {
          executeSql(
            'INSERT INTO item_categories (item_id, category_id, created_at) VALUES (?, ?, ?)',
            [item.id, categoryId, now]
          );
        }
      }
    }
    
    console.log(`✅ Downloaded ${items.length} items`);
    
    // Cache images in BACKGROUND (non-blocking) - don't wait for this
    const itemsWithImages = items.filter(item => item.image_url);
    if (itemsWithImages.length > 0) {
      console.log(`🖼️ Caching ${itemsWithImages.length} images in background...`);
      // Fire and forget - cache images after sync completes
      import('../utils/imageCache').then(({ cacheItemImage }) => {
        itemsWithImages.forEach(item => {
          cacheItemImage(item.id, item.image_url).catch(err => 
            console.warn(`Background image cache failed for ${item.id}`)
          );
        });
      });
    }
    
    // Download inventory items (optional - may not exist for all vendors)
    console.log('📦 Downloading inventory...');
    try {
      const inventoryItems = await API.inventory.getAll();
      await bulkUpsertInventoryItems(inventoryItems);
      console.log(`✅ Downloaded ${inventoryItems.length} inventory items`);
    } catch (error) {
      console.log('ℹ️ No inventory data (optional feature)');
    }
    
    // Download recent bills history (limited for faster login)
    console.log('📄 Downloading recent bills...');
    try {
      const billsResponse = await API.bills.download({ limit: 100 });
      
      for (const bill of billsResponse.bills) {
        // Check if bill already exists
        const existing = executeSql(
          'SELECT id FROM bills WHERE invoice_number = ?',
          [bill.invoice_number]
        );
        
        if (existing.length === 0) {
          // Insert bill
          executeSql(
            `INSERT INTO bills (
              id, invoice_number, bill_number, billing_mode, restaurant_name, address, gstin, fssai_license, bill_date,
              customer_name, customer_phone, items, subtotal, discount_amount, discount_percentage,
              cgst_amount, sgst_amount, igst_amount, total_tax, total_amount,
              payment_mode, payment_reference, amount_paid, change_amount, notes,
              device_id, vendor_id, is_synced, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              bill.id,
              bill.invoice_number,
              bill.bill_number || bill.invoice_number,
              bill.billing_mode || 'gst',
              bill.restaurant_name || '',
              bill.address || '',
              bill.gstin || null,
              bill.fssai_license || null,
              bill.bill_date || bill.timestamp.split('T')[0],
              bill.customer_name || null,
              bill.customer_phone || null,
              JSON.stringify(bill.items),
              bill.subtotal,
              bill.discount_amount || 0,
              bill.discount_percentage || 0,
              bill.cgst || 0,
              bill.sgst || 0,
              bill.igst || 0,
              bill.total_tax || 0,
              bill.total,
              bill.payment_mode || 'cash',
              bill.payment_reference || null,
              bill.amount_paid || bill.total,
              bill.change_amount || 0,
              bill.device_id || null,
              bill.vendor_id || null,
              1, // Already synced from server
              bill.timestamp,
              now,
            ]
          );
        }
      }
      
      console.log(`✅ Downloaded ${billsResponse.bills.length} recent bills`);
    } catch (error) {
      console.log('ℹ️ No bills history yet');
    }
    
    // Save initial sync to history
    await saveSyncToHistory(categories.length, items.length, 0, 0);
    
    // Update last sync time
    await AsyncStorage.setItem('last_sync_time', now);
    
    console.log('=== Initial sync complete ===');
    return { success: true };
  } catch (error: any) {
    console.error('Initial sync failed:', error);
    return { 
      success: false, 
      error: error.message || 'Initial sync failed' 
    };
  }
};

export default {
  initNetworkListener,
  getNetworkStatus,
  queueOperation,
  getPendingOperations,
  syncCategories,
  syncItems,
  syncBills,
  syncInventory,
  syncAll,
  initialSync,
};