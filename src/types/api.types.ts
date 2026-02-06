// src/types/api.types.ts

// ==================== COMMON TYPES ====================

export type BillingMode = 'gst' | 'non_gst';
export type PaymentMode = 'cash' | 'upi' | 'card' | 'credit' | 'other';
export type PriceType = 'exclusive' | 'inclusive';
export type VegNonVeg = 'veg' | 'nonveg';

export interface APIResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

// ==================== AUTH & VENDOR TYPES ====================

export interface VendorProfile {
  id: string;
  username?: string;
  email?: string;
  business_name: string;
  address: string;
  phone: string;
  gst_no: string;
  fssai_license?: string;
  logo_url?: string;        // Pre-signed URL (temporary, expires in 1 hour)
  footer_note?: string;
  bill_prefix?: string;
  bill_starting_number?: number;
  last_bill_number?: number;
  cgst_percentage?: string | number;
  sgst_percentage?: string | number;
  is_approved?: boolean;
  created_at?: string;
  updated_at?: string;
  // Added for settings
  gst_type?: 'Inclusive' | 'Exclusive';
  default_gst_percentage?: number;
  tax_mode?: 'cgst_sgst' | 'igst';  // NEW: Tax mode preference
  item_level_override?: boolean;
  rounding_rule?: 'nearest' | 'up' | 'down' | 'none';
  show_gst_breakdown?: boolean;
  show_item_gst?: boolean;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  username: string;
  message: string;
  vendor?: VendorProfile;
}

export interface RegisterResponse {
  message: string;
  username: string;
  business_name?: string;
  status: string;
}

export interface RegisterRequest {
  username: string;
  email?: string; // Optional field
  password: string;
  password_confirm: string;
  business_name: string;
  phone: string;
  gst_no: string; // Required per docs
  address: string;
  fssai_license?: string;
}


export interface ForgotPasswordRequest {
  username: string;
  phone: string; // Changed from gst_no to phone
}

export interface ResetPasswordRequest {
  username: string;
  phone: string; // Changed from gst_no to phone
  new_password: string;
  new_password_confirm: string;
}

// ==================== CATEGORY TYPES ====================

export interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  item_count?: number;
  vendor_id?: string;
  created_at: string;
  updated_at: string;
}

// ==================== ITEM TYPES ====================

export interface Item {
  id: string;
  vendor?: string;
  vendor_name?: string;
  name: string;
  description?: string;
  price: number;
  mrp_price?: number;
  price_type: PriceType;
  gst_percentage: number;
  veg_nonveg?: VegNonVeg;
  additional_discount?: number;
  discount_percentage?: number;  // Alias for additional_discount (percentage-based)
  stock_quantity: number;
  sku?: string;
  hsn_code?: string;  // HSN code for GST
  barcode?: string;
  is_active: boolean;
  sort_order: number;
  image?: string;
  image_url?: string;
  local_image_path?: string;
  category_ids: string[];
  categories?: string[];
  categories_list?: Array<{ id: string; name: string }>;
  last_updated?: string;
  created_at: string;
}

export interface CreateItemRequest {
  id?: string;
  name: string;
  description?: string;
  price: number;
  mrp_price?: number;
  price_type?: PriceType;
  gst_percentage?: number;
  veg_nonveg?: VegNonVeg;
  additional_discount?: number;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  category_ids?: string[];
  sort_order?: number;
}

export interface UpdateItemRequest {
  name?: string;
  description?: string;
  price?: number;
  mrp_price?: number;
  price_type?: PriceType;
  gst_percentage?: number;
  veg_nonveg?: VegNonVeg;
  additional_discount?: number;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  is_active?: boolean;
  category_ids?: string[];
  sort_order?: number;
}

// ==================== INVENTORY TYPES ====================

export interface InventoryItem {
  id: string;
  vendor?: string;
  vendor_name?: string;
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
  created_at: string;
  updated_at: string;
  last_restocked_at?: string;
}

export interface UnitType {
  value: string;
  label: string;
}

export interface InventorySyncResponse {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  inventory?: InventoryItem[];
}

// ==================== BILL TYPES ====================

export interface BillItem {
  id: string;                   // UUID for this bill item
  item_id?: string;             // Reference to master item (if exists)
  name: string;
  price: number;
  mrp_price: number;
  price_type: PriceType;
  gst_percentage: number;
  quantity: number;
  subtotal: number;
  item_gst: number;             // GST for this item
  additional_discount?: number;
  discount_amount?: number;
  veg_nonveg?: VegNonVeg;
}

export interface Bill {
  // Identifiers
  id: string;                   // UUID (bill_id)
  invoice_number: string;
  bill_number?: string;

  // Billing mode
  billing_mode: BillingMode;

  // Vendor details (snapshot at time of bill)
  restaurant_name: string;
  address: string;
  gstin?: string;
  fssai_license?: string;

  // Dates
  bill_date: string;
  timestamp: string;

  // Items
  items: BillItem[];

  // Amounts
  subtotal: number;
  discount_amount?: number;
  discount_percentage?: number;

  // Tax (only for GST bills)
  cgst?: number;
  cgst_amount?: string | number; // API match
  sgst?: number;
  sgst_amount?: string | number; // API match
  igst?: number;
  igst_amount?: string | number; // API match
  total_tax?: number;

  // Total
  total: number;
  total_amount?: string | number; // API match

  // Payment
  payment_mode: PaymentMode;
  payment_reference?: string;   // For UPI/card transactions
  amount_paid: number;
  change_amount?: number;

  // Customer (optional)
  customer_name?: string;
  customer_phone?: string;

  // Notes
  notes?: string;

  // Sync
  device_id?: string;
  is_synced?: boolean;
  vendor_id?: string;
}

export interface BillSyncRequest {
  invoice_number: string;
  bill_id: string;
  billing_mode: BillingMode;
  restaurant_name: string;
  address: string;
  gstin?: string;
  fssai_license?: string;
  bill_date: string;
  items: BillItem[];
  subtotal: number;
  discount_amount?: number;
  discount_percentage?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total_tax?: number;
  total: number;
  payment_mode: PaymentMode;
  payment_reference?: string;
  amount_paid: number;
  change_amount?: number;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
  timestamp: string;
  device_id?: string;
}

export interface BillDownloadParams {
  since?: string;           // ISO timestamp
  limit?: number;           // Default 1000
  billing_mode?: BillingMode;
  start_date?: string;      // YYYY-MM-DD
  end_date?: string;        // YYYY-MM-DD
}

export interface BillDownloadResponse {
  bills: Bill[];
  count: number;
  has_more?: boolean;
}

// ==================== SYNC TYPES ====================

export interface SyncOperation {
  operation: 'create' | 'update' | 'delete';
  data?: any;
  id?: string;
  timestamp: string;
}

export interface SyncResponse {
  synced: number;
  created: number;
  updated: number;
  deleted: number;
  categories?: Category[];
  items?: Item[];
  bills?: Bill[];
}

// ==================== DASHBOARD TYPES ====================

export interface DashboardStatsResponse {
  vendor_id: string;
  vendor_name: string;
  date_range: {
    start_date: string;
    end_date: string;
  };
  statistics: {
    total_bills: number;
    gst_bills: number;
    non_gst_bills: number;
    total_revenue: string;
    total_tax_collected: string;
    payment_split: {
      cash: { count: number; amount: string };
      upi: { count: number; amount: string };
      card: { count: number; amount: string };
      credit: { count: number; amount: string };
      other: { count: number; amount: string };
    };
  };
}

export interface DashboardSalesResponse {
  date_range: {
    start_date: string;
    end_date: string;
  };
  billing_mode: string;
  summary: {
    total_bills: number;
    total_revenue: string;
    total_tax: string;
    total_cgst: string;
    total_sgst: string;
    total_igst?: string;
  };
  daily_breakdown: Array<{
    date: string;
    bills_count: number;
    revenue: string;
    tax: string;
  }>;
}

export interface DashboardItemsResponse {
  date_range: {
    start_date: string;
    end_date: string;
  };
  sort: 'most_sold' | 'least_sold';
  items: Array<{
    item_name: string;
    item_id?: string;
    total_quantity: string;
    total_revenue: string;
    bill_count: number;
    category?: string[];
    veg_nonveg?: VegNonVeg;
  }>;
}

export interface DashboardPaymentsResponse {
  date_range: {
    start_date: string;
    end_date: string;
  };
  summary: {
    total_transactions: number;
    total_revenue: string;
  };
  payment_split: Array<{
    payment_mode: PaymentMode;
    transaction_count: number;
    total_amount: string;
    percentage: string;
  }>;
}

export interface DashboardTaxResponse {
  date_range: {
    start_date: string;
    end_date: string;
  };
  summary: {
    gst_bills_count: number;
    total_tax_collected: string;
    cgst_collected: string;
    sgst_collected: string;
    igst_collected?: string;
  };
  tax_by_percentage: Array<{
    gst_percentage: string;
    item_count: number;
    tax_collected: string;
  }>;
}

export interface DashboardProfitResponse {
  date_range: {
    start_date: string;
    end_date: string;
  };
  profit_calculation: {
    total_revenue: string;
    estimated_cost: string;
    estimated_cost_percentage: string;
    net_profit: string;
    profit_margin_percentage: string;
  };
  note: string;
}

// ==================== HEALTH CHECK ====================

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  services: {
    database: {
      status: string;
      message: string;
    };
    cache?: {
      status: string;
      message: string;
    };
  };
  system: {
    django_version: string;
    python_version: string;
    debug_mode: boolean;
  };
  stats?: {
    users: number;
    vendors: number;
    items: number;
    categories: number;
    sales_backups: number;
  };
}

// ==================== LEGACY/COMPATIBILITY TYPES ====================
// These are for backward compatibility with existing code

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  joinDate: string;
}

// Legacy MenuItem type (use Item instead)
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  mrp_price?: number;
  price_type?: PriceType;
  gst_percentage?: number;
  veg_nonveg?: VegNonVeg;
  additional_discount?: number;
  discount_percentage?: number;  // Alias for additional_discount (percentage-based)
  category: string;
  category_ids?: string[];
  image?: string;
  image_url?: string;
  image_path?: string;
  local_image_path?: string;
  description?: string;
  stock_quantity?: number;
  sku?: string;
  hsn_code?: string;  // HSN code for GST
  barcode?: string;
  is_active?: boolean;
  sort_order?: number;
  categories?: Array<{ id: string; name: string }>;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

// Legacy BillData type (for navigation params compatibility)
export interface BillData {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  billing_mode: BillingMode;
  cgst?: number;
  sgst?: number;
  igst?: number;
  gst: number;           // Legacy: total tax
  total_tax?: number;
  total: number;
  paymentMethod: PaymentMode;
  paymentReference?: string;
  amountPaid?: number;
  changeAmount?: number;
  billNumber: string;
  invoiceNumber?: string;
  timestamp: string;
  // Added for Bill Success Screen fallback
  vendor_id?: string;
  restaurant_name?: string;
  address?: string;
  gstin?: string; // Legacy
  gst_no?: string; // New naming
  fssai_license?: string;
  customer_name?: string;
  customer_phone?: string;
}

// ==================== NAVIGATION TYPES ====================

export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Signup: undefined;
  SetupSuccess: { businessName?: string };
  SetupFailure: { error: string };
  ModeSelection: undefined;

  // Billing flow
  Billing: undefined;
  Checkout: { cart: CartItem[] };
  BillSuccess: BillData;

  // Dashboard flow
  Dashboard: undefined;
  SelectSummaryDate: undefined;
  DownloadingSummary: {
    dateRange: 'today' | 'yesterday' | 'last7days' | 'custom';
    customDays?: string;
  };
  BillSummary: {
    dateRange: 'today' | 'yesterday' | 'last7days' | 'custom';
    customDays?: string;
  };
  SaveSuccess: undefined;

  // Admin flow
  AdminPin: undefined;
  SetAdminPin: undefined;
  AdminDashboard: undefined;
  ItemManagement: undefined;
  AddItem: undefined;
  EditItem: { item: MenuItem };

  // Inventory Management
  InventoryManagement: undefined;

  // Bill Format Options
  BillFormat: undefined;
  BusinessDetails: undefined;
  InvoiceFormat: undefined;
  InvoiceStructure: undefined;
  LogoUpload: undefined;
  FooterNote: undefined;
  BillNumbering: undefined;

  // Other Admin Options
  GSTSettings: undefined;
  PrinterSetup: undefined;
  AddPeople: undefined;
  BackupData: undefined;
  TestPrintPreview: undefined;
  BackupDetails: undefined;
  BackingUp: undefined;
  BackupComplete: {
    categoriesSynced: number;
    itemsSynced: number;
    billsSynced: number;
    inventorySynced?: number;
  };
  ExportBills: undefined;
  BillScanner: undefined;
  BillPreview: {
    photoPath: string;
  };
  ExportingBills: {
    exportType: 'all' | 'dateRange' | 'today';
    customDays?: string;
    billData?: any;
  };
  ExportSuccess: {
    exportType: string;
    billCount?: number;
    exportData?: any[];
    dateRange?: {
      start: string;
      end: string;
    };
    billData?: any;
  };
  RestoreData: undefined;
  RestoringData: {
    fileName: string;
  };
  RestoreSuccess: {
    fileName: string;
  };
};
