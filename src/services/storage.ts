import { getDatabase } from '../database/schema';
import { queueOperation } from './sync';
import { v4 as uuidv4 } from 'uuid';

const now = () => new Date().toISOString();

// Helper to execute SQL and return results
const executeSql = (sql: string, params: any[] = []): any[] => {
  const db = getDatabase();
  const result = db.execute(sql, params);
  return result.rows?._array || [];
};

// ==================== CATEGORIES ====================

export const getCategories = async (includeInactive = false): Promise<any[]> => {
  try {
    const query = includeInactive
      ? 'SELECT * FROM categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC'
      : 'SELECT * FROM categories WHERE is_active = 1 AND deleted_at IS NULL ORDER BY sort_order ASC, name ASC';
    
    const results = executeSql(query);
    console.log(`📁 Loaded ${results.length} categories from database:`, results.map(c => c.name).join(', '));
    return results;
  } catch (error) {
    console.error('❌ Failed to get categories:', error);
    return [];
  }
};

export const getCategoryById = async (id: string): Promise<any | null> => {
  try {
    const results = executeSql(
      'SELECT * FROM categories WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to get category:', error);
    return null;
  }
};

export const createCategory = async (data: {
  name: string;
  description?: string;
  sort_order?: number;
}): Promise<string> => {
  const id = uuidv4();
  const timestamp = now();
  
  try {
    executeSql(
      `INSERT INTO categories 
       (id, name, description, is_active, sort_order, is_synced, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        1,
        data.sort_order || 0,
        0,
        timestamp,
        timestamp,
      ]
    );
    
    // Queue for sync
    await queueOperation({
      operation_type: 'create',
      entity_type: 'category',
      entity_id: id,
      data: {
        id,
        name: data.name,
        description: data.description,
        sort_order: data.sort_order || 0,
        is_active: true,
      },
      timestamp,
    });
    
    console.log(`Category created: ${id}`);
    return id;
  } catch (error) {
    console.error('Failed to create category:', error);
    throw error;
  }
};

export const updateCategory = async (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    is_active: boolean;
    sort_order: number;
  }>
): Promise<void> => {
  const timestamp = now();
  
  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      values.push(data.description);
    }
    if (data.is_active !== undefined) {
      updateFields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    
    updateFields.push('is_synced = ?', 'updated_at = ?');
    values.push(0, timestamp);
    
    values.push(id);
    
    executeSql(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    // Queue for sync
    await queueOperation({
      operation_type: 'update',
      entity_type: 'category',
      entity_id: id,
      data,
      timestamp,
    });
    
    console.log(`Category updated: ${id}`);
  } catch (error) {
    console.error('Failed to update category:', error);
    throw error;
  }
};

export const deleteCategory = async (id: string): Promise<void> => {
  const timestamp = now();
  
  try {
    executeSql(
      'UPDATE categories SET deleted_at = ?, is_synced = ? WHERE id = ?',
      [timestamp, 0, id]
    );
    
    // Queue for sync
    await queueOperation({
      operation_type: 'delete',
      entity_type: 'category',
      entity_id: id,
      data: {},
      timestamp,
    });
    
    console.log(`Category deleted: ${id}`);
  } catch (error) {
    console.error('Failed to delete category:', error);
    throw error;
  }
};

// ==================== ITEMS ====================

export const getItems = async (options?: {
  categoryId?: string;
  search?: string;
  includeInactive?: boolean;
}): Promise<any[]> => {
  try {
    let query = `
      SELECT DISTINCT i.* FROM items i
      LEFT JOIN item_categories ic ON i.id = ic.item_id
      WHERE i.deleted_at IS NULL
    `;
    
    const params: any[] = [];
    
    if (!options?.includeInactive) {
      query += ' AND i.is_active = 1';
    }
    
    if (options?.categoryId) {
      query += ' AND ic.category_id = ?';
      params.push(options.categoryId);
    }
    
    if (options?.search) {
      query += ' AND (i.name LIKE ? OR i.description LIKE ? OR i.sku LIKE ? OR i.barcode LIKE ?)';
      const searchTerm = `%${options.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    query += ' ORDER BY i.sort_order ASC, i.name ASC';
    
    const items = executeSql(query, params);
    
    // Get categories for each item
    for (const item of items) {
      const categories = executeSql(
        `SELECT c.id, c.name 
         FROM categories c
         INNER JOIN item_categories ic ON c.id = ic.category_id
         WHERE ic.item_id = ?`,
        [item.id]
      );
      
      item.categories = categories;
      item.category_ids = categories.map((c: any) => c.id);
    }
    
    return items;
  } catch (error) {
    console.error('Failed to get items:', error);
    return [];
  }
};

export const getItemById = async (id: string): Promise<any | null> => {
  try {
    const results = executeSql(
      'SELECT * FROM items WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (results.length === 0) return null;
    
    const item = results[0];
    
    // Get categories
    const categories = executeSql(
      `SELECT c.id, c.name 
       FROM categories c
       INNER JOIN item_categories ic ON c.id = ic.category_id
       WHERE ic.item_id = ?`,
      [id]
    );
    
    item.categories = categories;
    item.category_ids = categories.map((c: any) => c.id);
    
    return item;
  } catch (error) {
    console.error('Failed to get item:', error);
    return null;
  }
};

export const createItem = async (data: {
  name: string;
  description?: string;
  price: number;
  mrp_price?: number;
  price_type?: 'exclusive' | 'inclusive';
  gst_percentage?: number;
  veg_nonveg?: 'veg' | 'nonveg';
  additional_discount?: number;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  category_ids?: string[];
  image_path?: string;
  image_url?: string;
  local_image_path?: string;
  sort_order?: number;
}): Promise<string> => {
  const id = uuidv4();
  const timestamp = now();
  
  try {
    // Insert item with all new fields
    executeSql(
      `INSERT INTO items 
      (id, name, description, price, mrp_price, price_type, gst_percentage, veg_nonveg, additional_discount,
       stock_quantity, sku, barcode, is_active, sort_order, image_path, image_url, local_image_path, is_synced, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.description || null,
        data.price,
        data.mrp_price || data.price, // Default to price if not specified
        data.price_type || 'exclusive',
        data.gst_percentage || 0,
        data.veg_nonveg || null,
        data.additional_discount || 0,
        data.stock_quantity || 0,
        data.sku || null,
        data.barcode || null,
        1,
        data.sort_order || 0,
        data.image_path || null,
        data.image_url || null,
        data.local_image_path || null,
        0,
        timestamp,
        timestamp,
      ]
    );
    
    // Insert item-category relationships
    if (data.category_ids && data.category_ids.length > 0) {
      for (const categoryId of data.category_ids) {
        executeSql(
          'INSERT INTO item_categories (item_id, category_id, created_at) VALUES (?, ?, ?)',
          [id, categoryId, timestamp]
        );
      }
    }
    
    // Queue for sync
    await queueOperation({
      operation_type: 'create',
      entity_type: 'item',
      entity_id: id,
      data: {
        id,
        name: data.name,
        description: data.description,
        price: data.price,
        mrp_price: data.mrp_price || data.price,
        price_type: data.price_type || 'exclusive',
        gst_percentage: data.gst_percentage || 0,
        veg_nonveg: data.veg_nonveg,
        additional_discount: data.additional_discount || 0,
        stock_quantity: data.stock_quantity || 0,
        sku: data.sku,
        barcode: data.barcode,
        category_ids: data.category_ids || [],
        image_path: data.image_path,
        image_url: data.image_url,
        sort_order: data.sort_order || 0,
        is_active: true,
      },
      timestamp,
    });
    
    console.log(`Item created: ${id}`);
    return id;
  } catch (error) {
    console.error('Failed to create item:', error);
    throw error;
  }
};

export const updateItem = async (
  id: string,
  data: Partial<{
    name: string;
    description: string;
    price: number;
    mrp_price: number;
    price_type: 'exclusive' | 'inclusive';
    gst_percentage: number;
    veg_nonveg: 'veg' | 'nonveg';
    additional_discount: number;
    stock_quantity: number;
    sku: string;
    barcode: string;
    is_active: boolean;
    category_ids: string[];
    sort_order: number;
    image_path: string;
    image_url: string;
    local_image_path: string;
  }>
): Promise<void> => {
  const timestamp = now();
  
  try {
    const updateFields: string[] = [];
    const values: any[] = [];
    
    if (data.name !== undefined) {
      updateFields.push('name = ?');
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updateFields.push('description = ?');
      values.push(data.description);
    }
    if (data.price !== undefined) {
      updateFields.push('price = ?');
      values.push(data.price);
    }
    if (data.mrp_price !== undefined) {
      updateFields.push('mrp_price = ?');
      values.push(data.mrp_price);
    }
    if (data.price_type !== undefined) {
      updateFields.push('price_type = ?');
      values.push(data.price_type);
    }
    if (data.gst_percentage !== undefined) {
      updateFields.push('gst_percentage = ?');
      values.push(data.gst_percentage);
    }
    if (data.veg_nonveg !== undefined) {
      updateFields.push('veg_nonveg = ?');
      values.push(data.veg_nonveg);
    }
    if (data.additional_discount !== undefined) {
      updateFields.push('additional_discount = ?');
      values.push(data.additional_discount);
    }
    if (data.stock_quantity !== undefined) {
      updateFields.push('stock_quantity = ?');
      values.push(data.stock_quantity);
    }
    if (data.sku !== undefined) {
      updateFields.push('sku = ?');
      values.push(data.sku);
    }
    if (data.barcode !== undefined) {
      updateFields.push('barcode = ?');
      values.push(data.barcode);
    }
    if (data.is_active !== undefined) {
      updateFields.push('is_active = ?');
      values.push(data.is_active ? 1 : 0);
    }
    if (data.sort_order !== undefined) {
      updateFields.push('sort_order = ?');
      values.push(data.sort_order);
    }
    if (data.image_path !== undefined) {
      updateFields.push('image_path = ?');
      values.push(data.image_path);
    }
    if (data.image_url !== undefined) {
      updateFields.push('image_url = ?');
      values.push(data.image_url);
    }
    if (data.local_image_path !== undefined) {
      updateFields.push('local_image_path = ?');
      values.push(data.local_image_path);
    }
    
    updateFields.push('is_synced = ?', 'updated_at = ?');
    values.push(0, timestamp);
    
    values.push(id);
    
    executeSql(
      `UPDATE items SET ${updateFields.join(', ')} WHERE id = ?`,
      values
    );
    
    // Update categories if provided
    if (data.category_ids !== undefined) {
      executeSql('DELETE FROM item_categories WHERE item_id = ?', [id]);
      
      for (const categoryId of data.category_ids) {
        executeSql(
          'INSERT INTO item_categories (item_id, category_id, created_at) VALUES (?, ?, ?)',
          [id, categoryId, timestamp]
        );
      }
    }
    
    // Queue for sync
    await queueOperation({
      operation_type: 'update',
      entity_type: 'item',
      entity_id: id,
      data,
      timestamp,
    });
    
    console.log(`Item updated: ${id}`);
  } catch (error) {
    console.error('Failed to update item:', error);
    throw error;
  }
};

export const deleteItem = async (id: string): Promise<void> => {
  const timestamp = now();
  
  try {
    executeSql(
      'UPDATE items SET deleted_at = ?, is_synced = ? WHERE id = ?',
      [timestamp, 0, id]
    );
    
    // Queue for sync
    await queueOperation({
      operation_type: 'delete',
      entity_type: 'item',
      entity_id: id,
      data: {},
      timestamp,
    });
    
    console.log(`Item deleted: ${id}`);
  } catch (error) {
    console.error('Failed to delete item:', error);
    throw error;
  }
};

// ==================== BILLS ====================

export const createBill = async (data: {
  invoice_number: string;
  bill_number: string;
  billing_mode: 'gst' | 'non_gst';
  restaurant_name: string;
  address: string;
  gstin?: string;
  fssai_license?: string;
  bill_date: string;
  items: any[]; // BillItem[]
  subtotal: number;
  discount_amount?: number;
  discount_percentage?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_tax?: number;
  total_amount: number;
  payment_mode: 'cash' | 'upi' | 'card' | 'credit' | 'other';
  payment_reference?: string;
  amount_paid: number;
  change_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  device_id: string;
  vendor_id?: string;
}): Promise<string> => {
  const id = uuidv4();
  const timestamp = now();
  
  try {
    executeSql(
      `INSERT INTO bills 
       (id, invoice_number, bill_number, billing_mode, restaurant_name, address, gstin, fssai_license, bill_date,
        customer_name, customer_phone, items, subtotal, discount_amount, discount_percentage,
        cgst_amount, sgst_amount, igst_amount, total_tax, total_amount,
        payment_mode, payment_reference, amount_paid, change_amount, notes,
        device_id, vendor_id, is_synced, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.invoice_number,
        data.bill_number,
        data.billing_mode,
        data.restaurant_name,
        data.address,
        data.gstin || null,
        data.fssai_license || null,
        data.bill_date,
        data.customer_name || null,
        data.customer_phone || null,
        JSON.stringify(data.items),
        data.subtotal,
        data.discount_amount || 0,
        data.discount_percentage || 0,
        data.cgst_amount || 0,
        data.sgst_amount || 0,
        data.igst_amount || 0,
        data.total_tax || 0,
        data.total_amount,
        data.payment_mode,
        data.payment_reference || null,
        data.amount_paid,
        data.change_amount || 0,
        data.notes || null,
        data.device_id,
        data.vendor_id || null,
        0,
        timestamp,
        timestamp,
      ]
    );
    
    console.log(`Bill created: ${id} (${data.invoice_number})`);
    return id;
  } catch (error) {
    console.error('Failed to create bill:', error);
    throw error;
  }
};

export const getBills = async (options?: {
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}): Promise<any[]> => {
  try {
    let query = 'SELECT * FROM bills WHERE deleted_at IS NULL';
    const params: any[] = [];
    
    if (options?.startDate) {
      query += ' AND created_at >= ?';
      params.push(options.startDate);
    }
    
    if (options?.endDate) {
      query += ' AND created_at <= ?';
      params.push(options.endDate);
    }
    
    query += ' ORDER BY created_at DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      
      if (options?.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }
    
    const bills = executeSql(query, params);
    
    // Parse items JSON
    return bills.map(bill => ({
      ...bill,
      items: JSON.parse(bill.items),
    }));
  } catch (error) {
    console.error('Failed to get bills:', error);
    return [];
  }
};

export const getBillById = async (id: string): Promise<any | null> => {
  try {
    const results = executeSql(
      'SELECT * FROM bills WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (results.length === 0) return null;
    
    const bill = results[0];
    bill.items = JSON.parse(bill.items);
    
    return bill;
  } catch (error) {
    console.error('Failed to get bill:', error);
    return null;
  }
};

export const getUnsyncedBillsCount = async (): Promise<number> => {
  try {
    const results = executeSql(
      'SELECT COUNT(*) as count FROM bills WHERE is_synced = 0 AND deleted_at IS NULL'
    );
    
    return results[0]?.count || 0;
  } catch (error) {
    console.error('Failed to get unsynced bills count:', error);
    return 0;
  }
};

// Wrapper for createBill that handles device_id and vendor profile automatically
export const saveBill = async (data: {
  invoice_number: string;
  bill_number: string;
  billing_mode: 'gst' | 'non_gst';
  items: any[]; // BillItem[] array
  subtotal: number;
  discount_amount?: number;
  discount_percentage?: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  total_tax?: number;
  total_amount: number;
  payment_mode: 'cash' | 'upi' | 'card' | 'credit' | 'other';
  payment_reference?: string;
  amount_paid: number;
  change_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  bill_date?: string;
}): Promise<string> => {
  try {
    // Get device ID (or generate one if not exists)
    let deviceId = '';
    const settings = await getBusinessSettings();
    if (settings && settings.device_id) {
      deviceId = settings.device_id;
    } else {
      deviceId = uuidv4();
      // Save device_id to settings
      await saveBusinessSettings({ device_id: deviceId });
    }
    
    // Get vendor profile for bill header
    const { getVendorProfile, getUserData, saveVendorProfile } = await import('./auth');
    let vendorProfile = await getVendorProfile();
    
    // FALLBACK FIX: If DB profile is missing, check AsyncStorage/User Data
    if (!vendorProfile) {
      console.log('⚠️ Vendor profile not found in DB, attempting fallback to User Data');
      const userData = await getUserData();

      if (userData && userData.vendor_id) {
        // Construct a temporary profile from auth data
        vendorProfile = {
          id: userData.vendor_id,
          username: userData.username,
          email: '', // Defaults if not available
          business_name: userData.business_name || 'Store',
          address: userData.address || '',
          phone: userData.phone || '',
          gst_no: userData.gst_no || '',
          fssai_license: userData.fssai_license || null,
          logo_url: userData.logo_url || null,
          footer_note: userData.footer_note || null,
          is_approved: true, 
        } as any; // Cast as any to satisfy TS partial mismatch

        // Self-heal: Try to save this profile back to DB for next time
        // Using 'as any' to bypass strict Type checking on the argument here
        saveVendorProfile(vendorProfile as any).catch(e => console.warn('Failed to heal vendor profile:', e));
      }
    }

    if (!vendorProfile) {
      throw new Error('Vendor profile not found. Please login again.');
    }
    
    // Use bill_date or current date
    const billDate = data.bill_date || new Date().toISOString().split('T')[0];
    
    // Call createBill with all required fields
    return await createBill({
      invoice_number: data.invoice_number,
      bill_number: data.bill_number,
      billing_mode: data.billing_mode,
      restaurant_name: vendorProfile.business_name || 'Store',
      address: vendorProfile.address || '',
      gstin: vendorProfile.gst_no,
      fssai_license: vendorProfile.fssai_license || undefined,
      bill_date: billDate,
      items: data.items,
      subtotal: data.subtotal,
      discount_amount: data.discount_amount || 0,
      discount_percentage: data.discount_percentage || 0,
      cgst_amount: data.cgst_amount || 0,
      sgst_amount: data.sgst_amount || 0,
      igst_amount: data.igst_amount || 0,
      total_tax: data.total_tax || 0,
      total_amount: data.total_amount,
      payment_mode: data.payment_mode,
      payment_reference: data.payment_reference,
      amount_paid: data.amount_paid,
      change_amount: data.change_amount || 0,
      customer_name: data.customer_name,
      customer_phone: data.customer_phone,
      notes: data.notes,
      device_id: deviceId,
      vendor_id: vendorProfile.id,
    });
  } catch (error) {
    console.error('Failed to save bill:', error);
    throw error;
  }
};

// ==================== BUSINESS SETTINGS ====================

export const getBusinessSettings = async (): Promise<any | null> => {
  try {
    const results = executeSql('SELECT * FROM business_settings LIMIT 1');
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to get business settings:', error);
    return null;
  }
};

export const saveBusinessSettings = async (data: {
  business_name?: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  business_gst?: string;
  tax_rate?: number;
  currency?: string;
  bill_prefix?: string;
  bill_footer_note?: string;
  printer_name?: string;
  printer_type?: string;
  printer_mac_address?: string;
  printer_connection_type?: 'bluetooth' | 'network';
  printer_network_url?: string;
  device_id?: string;
  admin_pin?: string;
  gst_type?: string;
  item_level_override?: number;
  rounding_rule?: string;
  invoice_format?: string;
  gst_breakdown?: number;
  item_tax_split?: number;
  total_quantity?: number;
  payment_method?: number;
  business_code?: string;
  logo_path?: string | null;
  paper_size?: string;
  auto_print?: number;
  printer_connected?: number;
  last_restore_date?: string;
  last_pdf_export_date?: string;
  last_summary_range?: string;
  last_summary_custom_days?: number;
  last_summary_date?: string;
  admin_pin_set_date?: string;
  app_launch_count?: number;
  last_app_launch?: string;
  setup_completed?: number;
  setup_completed_date?: string;
  last_test_print_date?: string;
  test_print_count?: number;
  welcome_screen_view_count?: number;
  last_welcome_view_date?: string;
  first_welcome_view_date?: string;
  onboarding_path?: string;
  onboarding_started_date?: string;
}): Promise<void> => {
  const timestamp = now();
  
  try {
    const existing = await getBusinessSettings();
    
    if (existing) {
      // Update
      const updateFields: string[] = [];
      const values: any[] = [];
      
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          updateFields.push(`${key} = ?`);
          values.push(value);
        }
      });
      
      updateFields.push('is_synced = ?', 'updated_at = ?');
      values.push(0, timestamp);
      values.push(existing.id);
      
      executeSql(
        `UPDATE business_settings SET ${updateFields.join(', ')} WHERE id = ?`,
        values
      );
    } else {
      // Insert
      executeSql(
        `INSERT INTO business_settings 
         (business_name, business_address, business_phone, business_email, business_gst, tax_rate, currency, 
          bill_prefix, bill_footer_note, printer_name, printer_type, printer_mac_address, printer_connection_type, printer_network_url, device_id, admin_pin, 
          gst_type, item_level_override, rounding_rule, invoice_format, 
          gst_breakdown, item_tax_split, total_quantity, payment_method, business_code, logo_path,
          paper_size, auto_print, printer_connected, last_restore_date, last_pdf_export_date,
          last_summary_range, last_summary_custom_days, last_summary_date, admin_pin_set_date,
          app_launch_count, last_app_launch, setup_completed, setup_completed_date,
          last_test_print_date, test_print_count,
          welcome_screen_view_count, last_welcome_view_date, first_welcome_view_date,
          onboarding_path, onboarding_started_date,
          is_synced, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.business_name || null,
          data.business_address || null,
          data.business_phone || null,
          data.business_email || null,
          data.business_gst || null,
          data.tax_rate || 0,
          data.currency || 'INR',
          data.bill_prefix || 'BILL',
          data.bill_footer_note || null,
          data.printer_name || null,
          data.printer_type || null,
          data.printer_mac_address || null,
          data.printer_connection_type || 'bluetooth',
          data.printer_network_url || null,
          data.device_id || null,
          data.admin_pin || null,
          data.gst_type || 'Inclusive',
          data.item_level_override !== undefined ? data.item_level_override : 1,
          data.rounding_rule || 'nearest',
          data.invoice_format || 'classic',
          data.gst_breakdown !== undefined ? data.gst_breakdown : 1,
          data.item_tax_split !== undefined ? data.item_tax_split : 0,
          data.total_quantity !== undefined ? data.total_quantity : 1,
          data.payment_method !== undefined ? data.payment_method : 1,
          data.business_code || null,
          data.logo_path !== undefined ? data.logo_path : null,
          data.paper_size || '58mm',
          data.auto_print !== undefined ? data.auto_print : 0,
          data.printer_connected !== undefined ? data.printer_connected : 0,
          data.last_restore_date || null,
          data.last_pdf_export_date || null,
          data.last_summary_range || null,
          data.last_summary_custom_days || null,
          data.last_summary_date || null,
          data.admin_pin_set_date || null,
          data.app_launch_count || 0,
          data.last_app_launch || null,
          data.setup_completed !== undefined ? data.setup_completed : 0,
          data.setup_completed_date || null,
          data.last_test_print_date || null,
          data.test_print_count || 0,
          data.welcome_screen_view_count || 0,
          data.last_welcome_view_date || null,
          data.first_welcome_view_date || null,
          data.onboarding_path || null,
          data.onboarding_started_date || null,
          0,
          timestamp,
          timestamp,
        ]
      );
    }
    
    console.log('Business settings saved');
  } catch (error) {
    console.error('Failed to save business settings:', error);
    throw error;
  }
};

// ==================== INVENTORY MANAGEMENT ====================

export interface InventoryItem {
  id: string;
  vendor_id?: string;
  name: string;
  description?: string;
  quantity: string;
  unit_type: string;
  unit_type_display?: string;
  sku?: string;
  barcode?: string;
  supplier_name?: string;
  supplier_contact?: string;
  min_stock_level?: string;
  reorder_quantity?: string;
  is_active: boolean;
  is_low_stock?: boolean;
  needs_reorder?: boolean;
  created_at?: string;
  updated_at?: string;
  last_restocked_at?: string;
  is_synced?: boolean;
}

export interface UnitType {
  value: string;
  label: string;
}

const UNIT_TYPES: UnitType[] = [
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'L', label: 'Liter (L)' },
  { value: 'mL', label: 'Milliliter (mL)' },
  { value: 'pcs', label: 'Piece (pcs)' },
  { value: 'pack', label: 'Packet (pack)' },
  { value: 'box', label: 'Box (box)' },
  { value: 'bag', label: 'Bag (bag)' },
  { value: 'bottle', label: 'Bottle (bottle)' },
  { value: 'can', label: 'Can (can)' },
  { value: 'dozen', label: 'Dozen (dozen)' },
];

export const getUnitTypes = (): Promise<UnitType[]> => {
  return Promise.resolve(UNIT_TYPES);
};

const getUnitTypeDisplay = (unitType: string): string => {
  const unit = UNIT_TYPES.find(u => u.value === unitType);
  return unit ? unit.label : unitType;
};

const isLowStock = (quantity: string, minStockLevel?: string): boolean => {
  if (!minStockLevel) return false;
  return parseFloat(quantity) <= parseFloat(minStockLevel);
};

export const initInventoryTable = (): void => {
  try {
    executeSql(
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        vendor_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        quantity TEXT NOT NULL DEFAULT '0',
        unit_type TEXT NOT NULL,
        sku TEXT,
        barcode TEXT,
        supplier_name TEXT,
        supplier_contact TEXT,
        min_stock_level TEXT,
        reorder_quantity TEXT,
        is_active INTEGER DEFAULT 1,
        is_synced INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_restocked_at TEXT,
        deleted_at TEXT,
        UNIQUE(name, vendor_id)
      )`,
      []
    );

    // Create indexes
    executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON inventory_items(vendor_id)', []);
    executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory_items(is_active)', []);
    executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku)', []);
    executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory_items(barcode)', []);
    executeSql('CREATE INDEX IF NOT EXISTS idx_inventory_synced ON inventory_items(is_synced)', []);

    console.log('Inventory table initialized successfully');
  } catch (error) {
    console.error('Failed to initialize inventory table:', error);
  }
};

export const getInventoryItems = async (filters?: {
  isActive?: boolean;
  lowStock?: boolean;
  search?: string;
  unitType?: string;
}): Promise<InventoryItem[]> => {
  try {
    let query = 'SELECT * FROM inventory_items WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (filters?.isActive !== undefined) {
      query += ' AND is_active = ?';
      params.push(filters.isActive ? 1 : 0);
    }

    if (filters?.search) {
      query += ' AND (name LIKE ? OR sku LIKE ? OR barcode LIKE ? OR supplier_name LIKE ?)';
      const searchPattern = `%${filters.search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern);
    }

    if (filters?.unitType) {
      query += ' AND unit_type = ?';
      params.push(filters.unitType);
    }

    query += ' ORDER BY name ASC';

    const results = executeSql(query, params);
    const items: InventoryItem[] = [];

    for (let i = 0; i < results.length; i++) {
      const row = results[i];
      const item: InventoryItem = {
        id: row.id,
        vendor_id: row.vendor_id,
        name: row.name,
        description: row.description,
        quantity: row.quantity,
        unit_type: row.unit_type,
        unit_type_display: getUnitTypeDisplay(row.unit_type),
        sku: row.sku,
        barcode: row.barcode,
        supplier_name: row.supplier_name,
        supplier_contact: row.supplier_contact,
        min_stock_level: row.min_stock_level,
        reorder_quantity: row.reorder_quantity,
        is_active: row.is_active === 1,
        is_low_stock: isLowStock(row.quantity, row.min_stock_level),
        needs_reorder: isLowStock(row.quantity, row.min_stock_level),
        created_at: row.created_at,
        updated_at: row.updated_at,
        last_restocked_at: row.last_restocked_at,
        is_synced: row.is_synced === 1,
      };
      items.push(item);
    }

    if (filters?.lowStock) {
      return items.filter(item => item.is_low_stock);
    }

    return items;
  } catch (error) {
    console.error('Failed to get inventory items:', error);
    return [];
  }
};

export const getInventoryItemById = async (id: string): Promise<InventoryItem | null> => {
  try {
    const results = executeSql(
      'SELECT * FROM inventory_items WHERE id = ? AND deleted_at IS NULL',
      [id]
    );

    if (results.length === 0) return null;

    const row = results[0];
    return {
      id: row.id,
      vendor_id: row.vendor_id,
      name: row.name,
      description: row.description,
      quantity: row.quantity,
      unit_type: row.unit_type,
      unit_type_display: getUnitTypeDisplay(row.unit_type),
      sku: row.sku,
      barcode: row.barcode,
      supplier_name: row.supplier_name,
      supplier_contact: row.supplier_contact,
      min_stock_level: row.min_stock_level,
      reorder_quantity: row.reorder_quantity,
      is_active: row.is_active === 1,
      is_low_stock: isLowStock(row.quantity, row.min_stock_level),
      needs_reorder: isLowStock(row.quantity, row.min_stock_level),
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_restocked_at: row.last_restocked_at,
      is_synced: row.is_synced === 1,
    };
  } catch (error) {
    console.error('Failed to get inventory item:', error);
    return null;
  }
};

export const createInventoryItem = async (
  item: Omit<InventoryItem, 'id' | 'created_at' | 'updated_at' | 'is_synced'>
): Promise<InventoryItem> => {
  const id = uuidv4();
  const timestamp = now();

  try {
    executeSql(
      `INSERT INTO inventory_items (
        id, vendor_id, name, description, quantity, unit_type,
        sku, barcode, supplier_name, supplier_contact,
        min_stock_level, reorder_quantity, is_active,
        is_synced, created_at, updated_at, last_restocked_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        item.vendor_id || null,
        item.name,
        item.description || null,
        item.quantity,
        item.unit_type,
        item.sku || null,
        item.barcode || null,
        item.supplier_name || null,
        item.supplier_contact || null,
        item.min_stock_level || null,
        item.reorder_quantity || null,
        item.is_active ? 1 : 0,
        0,
        timestamp,
        timestamp,
        item.last_restocked_at || null,
      ]
    );

    const created = await getInventoryItemById(id);
    if (!created) {
      throw new Error('Failed to create inventory item');
    }

    console.log(`Inventory item created: ${id}`);
    return created;
  } catch (error) {
    console.error('Failed to create inventory item:', error);
    throw error;
  }
};

export const updateInventoryItem = async (
  id: string,
  updates: Partial<InventoryItem>
): Promise<InventoryItem> => {
  const timestamp = now();
  
  try {
    const setClauses: string[] = [];
    const params: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push('description = ?');
      params.push(updates.description || null);
    }
    if (updates.quantity !== undefined) {
      setClauses.push('quantity = ?');
      params.push(updates.quantity);
    }
    if (updates.unit_type !== undefined) {
      setClauses.push('unit_type = ?');
      params.push(updates.unit_type);
    }
    if (updates.sku !== undefined) {
      setClauses.push('sku = ?');
      params.push(updates.sku || null);
    }
    if (updates.barcode !== undefined) {
      setClauses.push('barcode = ?');
      params.push(updates.barcode || null);
    }
    if (updates.supplier_name !== undefined) {
      setClauses.push('supplier_name = ?');
      params.push(updates.supplier_name || null);
    }
    if (updates.supplier_contact !== undefined) {
      setClauses.push('supplier_contact = ?');
      params.push(updates.supplier_contact || null);
    }
    if (updates.min_stock_level !== undefined) {
      setClauses.push('min_stock_level = ?');
      params.push(updates.min_stock_level || null);
    }
    if (updates.reorder_quantity !== undefined) {
      setClauses.push('reorder_quantity = ?');
      params.push(updates.reorder_quantity || null);
    }
    if (updates.is_active !== undefined) {
      setClauses.push('is_active = ?');
      params.push(updates.is_active ? 1 : 0);
    }
    if (updates.last_restocked_at !== undefined) {
      setClauses.push('last_restocked_at = ?');
      params.push(updates.last_restocked_at || null);
    }

    setClauses.push('updated_at = ?', 'is_synced = ?');
    params.push(timestamp, 0);
    params.push(id);

    executeSql(
      `UPDATE inventory_items SET ${setClauses.join(', ')} WHERE id = ?`,
      params
    );

    const updated = await getInventoryItemById(id);
    if (!updated) {
      throw new Error('Failed to update inventory item');
    }

    console.log(`Inventory item updated: ${id}`);
    return updated;
  } catch (error) {
    console.error('Failed to update inventory item:', error);
    throw error;
  }
};

export const updateInventoryStock = async (
  id: string,
  action: 'set' | 'add' | 'subtract',
  quantity: string,
  notes?: string
): Promise<InventoryItem> => {
  try {
    const item = await getInventoryItemById(id);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    let newQuantity: number;
    const currentQty = parseFloat(item.quantity);
    const changeQty = parseFloat(quantity);

    switch (action) {
      case 'set':
        newQuantity = changeQty;
        break;
      case 'add':
        newQuantity = currentQty + changeQty;
        break;
      case 'subtract':
        newQuantity = currentQty - changeQty;
        if (newQuantity < 0) {
          throw new Error('Cannot subtract more than current quantity');
        }
        break;
      default:
        throw new Error('Invalid action');
    }

    return updateInventoryItem(id, {
      quantity: newQuantity.toString(),
      last_restocked_at: now(),
    });
  } catch (error) {
    console.error('Failed to update inventory stock:', error);
    throw error;
  }
};

export const deleteInventoryItem = async (id: string): Promise<void> => {
  const timestamp = now();
  
  try {
    executeSql(
      'UPDATE inventory_items SET deleted_at = ?, is_synced = ? WHERE id = ?',
      [timestamp, 0, id]
    );
    
    console.log(`Inventory item deleted: ${id}`);
  } catch (error) {
    console.error('Failed to delete inventory item:', error);
    throw error;
  }
};

export const getUnsyncedInventoryItems = async (): Promise<InventoryItem[]> => {
  try {
    const results = executeSql(
      'SELECT * FROM inventory_items WHERE is_synced = 0 AND deleted_at IS NULL'
    );

    return results.map(row => ({
      id: row.id,
      vendor_id: row.vendor_id,
      name: row.name,
      description: row.description,
      quantity: row.quantity,
      unit_type: row.unit_type,
      unit_type_display: getUnitTypeDisplay(row.unit_type),
      sku: row.sku,
      barcode: row.barcode,
      supplier_name: row.supplier_name,
      supplier_contact: row.supplier_contact,
      min_stock_level: row.min_stock_level,
      reorder_quantity: row.reorder_quantity,
      is_active: row.is_active === 1,
      is_low_stock: isLowStock(row.quantity, row.min_stock_level),
      created_at: row.created_at,
      updated_at: row.updated_at,
      last_restocked_at: row.last_restocked_at,
      is_synced: false,
    }));
  } catch (error) {
    console.error('Failed to get unsynced inventory items:', error);
    return [];
  }
};

export const markInventoryItemSynced = async (id: string): Promise<void> => {
  try {
    executeSql(
      'UPDATE inventory_items SET is_synced = 1 WHERE id = ?',
      [id]
    );
  } catch (error) {
    console.error('Failed to mark inventory item as synced:', error);
  }
};

export const bulkUpsertInventoryItems = async (items: InventoryItem[]): Promise<void> => {
  try {
    for (const item of items) {
      const existing = await getInventoryItemById(item.id);
      
      if (existing) {
        executeSql(
          `UPDATE inventory_items SET
            name = ?, description = ?, quantity = ?, unit_type = ?,
            sku = ?, barcode = ?, supplier_name = ?, supplier_contact = ?,
            min_stock_level = ?, reorder_quantity = ?, is_active = ?,
            updated_at = ?, last_restocked_at = ?, is_synced = ?
           WHERE id = ?`,
          [
            item.name,
            item.description || null,
            item.quantity,
            item.unit_type,
            item.sku || null,
            item.barcode || null,
            item.supplier_name || null,
            item.supplier_contact || null,
            item.min_stock_level || null,
            item.reorder_quantity || null,
            item.is_active ? 1 : 0,
            item.updated_at || now(),
            item.last_restocked_at || null,
            1,
            item.id,
          ]
        );
      } else {
        executeSql(
          `INSERT INTO inventory_items (
            id, vendor_id, name, description, quantity, unit_type,
            sku, barcode, supplier_name, supplier_contact,
            min_stock_level, reorder_quantity, is_active,
            created_at, updated_at, last_restocked_at, is_synced
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            item.id,
            item.vendor_id || null,
            item.name,
            item.description || null,
            item.quantity,
            item.unit_type,
            item.sku || null,
            item.barcode || null,
            item.supplier_name || null,
            item.supplier_contact || null,
            item.min_stock_level || null,
            item.reorder_quantity || null,
            item.is_active ? 1 : 0,
            item.created_at || now(),
            item.updated_at || now(),
            item.last_restocked_at || null,
            1,
          ]
        );
      }
    }
    
    console.log(`Bulk upserted ${items.length} inventory items`);
  } catch (error) {
    console.error('Failed to bulk upsert inventory items:', error);
    throw error;
  }
};

export default {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getItems,
  getItemById,
  createItem,
  updateItem,
  deleteItem,
  createBill,
  saveBill,
  getBills,
  getBillById,
  getUnsyncedBillsCount,
  getBusinessSettings,
  saveBusinessSettings,
  // Inventory exports
  getUnitTypes,
  initInventoryTable,
  getInventoryItems,
  getInventoryItemById,
  createInventoryItem,
  updateInventoryItem,
  updateInventoryStock,
  deleteInventoryItem,
  getUnsyncedInventoryItems,
  markInventoryItemSynced,
  bulkUpsertInventoryItems,
};