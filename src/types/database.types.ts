// src/types/database.types.ts

// ==================== VENDOR PROFILE ====================

export interface DBVendorProfile {
  id: number;
  vendor_id: string;
  username?: string;
  email?: string;
  business_name?: string;
  address?: string;
  phone?: string;
  gst_no?: string;
  fssai_license?: string;
  logo_url?: string;
  logo_local_path?: string;
  footer_note?: string;
  is_approved: number;        // SQLite boolean (0 or 1)
  is_synced: number;
  created_at?: string;
  updated_at?: string;
}

// ==================== CATEGORIES ====================

export interface DBCategory {
  id: string;
  name: string;
  description?: string;
  is_active: number;          // SQLite boolean (0 or 1)
  sort_order: number;
  vendor_id?: string;
  is_synced: number;
  server_updated_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ==================== ITEMS ====================

export interface DBItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  mrp_price?: number;
  price_type: string;         // 'exclusive' or 'inclusive'
  gst_percentage: number;
  veg_nonveg?: string;        // 'veg' or 'nonveg'
  additional_discount: number;
  stock_quantity: number;
  sku?: string;
  barcode?: string;
  is_active: number;
  sort_order: number;
  vendor_id?: string;
  image_path?: string;
  image_url?: string;
  local_image_path?: string;
  is_synced: number;
  server_updated_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  // Joined fields (not in DB, added by query)
  categories?: Array<{ id: string; name: string }>;
  category_ids?: string[];
}

// ==================== BILLS ====================

export interface DBBill {
  id: string;
  invoice_number?: string;
  bill_number: string;
  billing_mode: string;        // 'gst' or 'non_gst'
  restaurant_name?: string;
  address?: string;
  gstin?: string;
  fssai_license?: string;
  bill_date?: string;
  customer_name?: string;
  customer_phone?: string;
  items: string;               // JSON string of BillItem[]
  subtotal: number;
  discount_amount: number;
  discount_percentage: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax: number;
  total_amount: number;
  payment_mode: string;        // 'cash', 'upi', 'card', 'credit', 'other'
  payment_reference?: string;
  amount_paid?: number;
  change_amount: number;
  notes?: string;
  device_id?: string;
  vendor_id?: string;
  is_synced: number;
  printed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// Legacy bill fields mapping (for backward compatibility)
export interface DBBillLegacy {
  id: string;
  bill_number: string;
  customer_name?: string;
  customer_phone?: string;
  items: string;               // JSON string
  subtotal: number;
  tax_amount: number;          // Maps to total_tax
  discount_amount: number;
  total_amount: number;
  payment_method?: string;     // Maps to payment_mode
  notes?: string;
  device_id?: string;
  vendor_id?: string;
  is_synced: number;
  printed_at?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// ==================== BILL ITEMS ====================

export interface DBBillItem {
  id: string;
  item_id?: string;
  name: string;
  price: number;
  mrp_price: number;
  price_type: string;
  gst_percentage: number;
  quantity: number;
  subtotal: number;
  item_gst: number;
  additional_discount?: number;
  discount_amount?: number;
  veg_nonveg?: string;
}

// ==================== INVENTORY TYPES ====================

export interface DBInventoryItem {
  id: string;
  vendor_id?: string;
  name: string;
  description?: string;
  quantity: string;            // Stored as TEXT for decimal precision
  unit_type: string;
  sku?: string;
  barcode?: string;
  supplier_name?: string;
  supplier_contact?: string;
  min_stock_level?: string;    // Stored as TEXT for decimal precision
  reorder_quantity?: string;   // Stored as TEXT for decimal precision
  is_active: number;           // SQLite boolean (0 or 1)
  is_synced: number;           // SQLite boolean (0 or 1)
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
  data: string;                // JSON string
  timestamp: string;
  retry_count: number;
  last_error?: string;
  synced: number;
  synced_at?: string;
  created_at: string;
}

// ==================== AUTH ====================

export interface DBAuth {
  id: number;
  token: string;
  user_id: string;
  username: string;
  vendor_id?: string;
  business_name?: string;
  gst_no?: string;
  fssai_license?: string;
  logo_url?: string;
  footer_note?: string;
  address?: string;
  phone?: string;
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

// ==================== BUSINESS SETTINGS ====================

export interface DBBusinessSettings {
  id: number;
  business_name?: string;
  business_address?: string;
  business_phone?: string;
  business_email?: string;
  business_gst?: string;
  business_fssai?: string;
  business_logo_path?: string;
  tax_rate: number;
  currency: string;
  bill_prefix: string;
  bill_footer_note?: string;
  printer_name?: string;
  printer_type?: string;
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
  logo_path?: string;
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
  default_billing_mode?: string;
  is_synced: number;
  created_at: string;
  updated_at: string;
}

// ==================== SETTINGS ====================

export interface DBSetting {
  id: number;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

// ==================== INVOICE SEQUENCE ====================

export interface DBInvoiceSequence {
  id: number;
  billing_mode: string;
  year: number;
  sequence: number;
  prefix?: string;
  created_at: string;
  updated_at: string;
}

// ==================== IMAGE CACHE ====================

export interface DBImageCache {
  id: number;
  entity_type: string;
  entity_id: string;
  remote_url?: string;
  local_path: string;
  cached_at: string;
  expires_at?: string;
}
