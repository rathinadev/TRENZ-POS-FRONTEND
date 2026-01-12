// src/types/database.types.ts

export interface DBCategory {
  id: string;
  name: string;
  description?: string;
  is_active: number; // SQLite boolean (0 or 1)
  sort_order: number;
  vendor_id?: string;
  is_synced: number;
  server_updated_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

export interface DBItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock_quantity: number;
  sku?: string;
  barcode?: string;
  is_active: number;
  sort_order: number;
  vendor_id?: string;
  image_path?: string;
  image_url?: string;
  is_synced: number;
  server_updated_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Joined fields (not in DB, added by query)
  categories?: Array<{ id: string; name: string }>;
  category_ids?: string[];
}

export interface DBBill {
  id: string;
  bill_number: string;
  customer_name?: string;
  customer_phone?: string;
  items: string; // JSON string
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method?: string;
  notes?: string;
  device_id?: string;
  vendor_id?: string;
  is_synced: number;
  printed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ==================== INVENTORY TYPES ====================

export interface DBInventoryItem {
  id: string;
  vendor_id?: string;
  name: string;
  description?: string;
  quantity: string; // Stored as TEXT for decimal precision
  unit_type: string;
  sku?: string;
  barcode?: string;
  supplier_name?: string;
  supplier_contact?: string;
  min_stock_level?: string; // Stored as TEXT for decimal precision
  reorder_quantity?: string; // Stored as TEXT for decimal precision
  is_active: number; // SQLite boolean (0 or 1)
  is_synced: number; // SQLite boolean (0 or 1)
  created_at: string;
  updated_at: string;
  last_restocked_at?: string;
  deleted_at?: string;
}

// ==================== SYNC QUEUE ====================

export interface DBSyncQueue {
  id: number;
  operation_type: 'create' | 'update' | 'delete';
  entity_type: 'category' | 'item' | 'bill' | 'inventory';
  entity_id: string;
  data: string; // JSON string
  timestamp: string;
  retry_count: number;
  last_error?: string;
  synced: number;
  synced_at?: string;
  created_at: string;
}

export interface DBAuth {
  id: number;
  token: string;
  user_id: string;
  username: string;
  vendor_id?: string;
  business_name?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DBBusinessSettings {
  id: number;
  business_name?: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  business_logo_path?: string;
  tax_rate: number;
  currency: string;
  bill_prefix: string;
  bill_footer_note?: string;
  printer_name?: string;
  printer_type?: string;
  device_id?: string;
  is_synced: number;
  created_at: string;
  updated_at: string;
}

export interface DBSetting {
  id: number;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}