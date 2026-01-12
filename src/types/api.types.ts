// src/types/api.types.ts

export interface APIResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface LoginResponse {
  token: string;
  user_id: number;
  username: string;
  vendor_id?: string;
  business_name?: string;
  message: string;
}

export interface RegisterResponse {
  message: string;
  username: string;
  status: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  sort_order: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  vendor: string;
  categories: string[];
  category_ids: string[];
  categories_list: Array<{ id: string; name: string }>;
  name: string;
  description?: string;
  price: string | number;
  stock_quantity: number;
  sku?: string;
  barcode?: string;
  is_active: boolean;
  sort_order: number;
  vendor_name: string;
  image?: string;
  image_url?: string;
  last_updated: string;
  created_at: string;
}

// ==================== INVENTORY TYPES ====================

export interface InventoryItem {
  id: string;
  vendor: string;
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
  item_id: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface Bill {
  id: string;
  bill_number: string;
  items: BillItem[];
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method?: string;
  customer_name?: string;
  customer_phone?: string;
  notes?: string;
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

// Business setup types
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

// Billing types
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string; // Keep for backward compatibility
  category_ids?: string[]; // Add this for multiple categories
  image?: string;
  image_url?: string;
  image_path?: string;
  description?: string;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  is_active?: boolean;
  sort_order?: number;
  categories?: Array<{ id: string; name: string }>; // Populated from database
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export interface BillData {
  cart: CartItem[];
  subtotal: number;
  discount: number;
  gst: number;
  total: number;
  paymentMethod: 'Cash' | 'UPI';
  billNumber: string;
  timestamp: string;
}

// Navigation types
export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  BusinessSetup1: undefined;
  BusinessSetupStep2: { businessData: any };
  BusinessSetupStep3: { businessData: any };
  CreatingBusiness: { businessData: any };
  SetupSuccess: { businessName?: string };
  SetupFailure: { error: string };
  ModeSelection: undefined;
  JoinBusiness: undefined;
  
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
  
  // Inventory Management (NEW)
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