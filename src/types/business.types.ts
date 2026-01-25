// src/types/business.types.ts

import type {
  BillingMode,
  PaymentMode,
  PriceType,
  VegNonVeg,
} from './api.types';

// Re-export common types
export type { BillingMode, PaymentMode, PriceType, VegNonVeg };

// Business setup types
export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstNumber?: string;
  fssaiLicense?: string;
  footerNote?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  joinDate: string;
}

// Menu/Item types
export interface MenuItem {
  id: string;
  name: string;
  price: number;
  mrp_price?: number;
  price_type?: PriceType;
  gst_percentage?: number;
  veg_nonveg?: VegNonVeg;
  additional_discount?: number;
  category: string;             // Keep for backward compatibility (first category name)
  category_ids?: string[];      // Array of category IDs
  image?: string;
  image_url?: string;
  image_path?: string;
  local_image_path?: string;
  description?: string;
  stock_quantity?: number;
  sku?: string;
  barcode?: string;
  is_active?: boolean;
  sort_order?: number;
  categories?: Array<{ id: string; name: string }>; // Full category objects
}

export interface CartItem extends MenuItem {
  quantity: number;
  // Calculated fields for checkout
  line_subtotal?: number;       // price * quantity
  line_discount?: number;       // additional_discount * quantity
  line_gst?: number;            // GST for this line
  line_total?: number;          // Final total for line
}

// Bill-related types
export interface BillItemData {
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

export interface BillData {
  // Cart
  cart: CartItem[];
  
  // Amounts
  subtotal: number;
  discount: number;
  
  // Billing mode
  billing_mode: BillingMode;
  
  // Tax breakdown (for GST bills)
  cgst?: number;
  sgst?: number;
  igst?: number;
  gst: number;                  // Legacy: total tax
  total_tax?: number;
  
  // Total
  total: number;
  
  // Payment
  paymentMethod: PaymentMode;
  paymentReference?: string;    // For UPI/card transactions
  amountPaid?: number;
  changeAmount?: number;
  
  // Invoice info
  billNumber: string;
  invoiceNumber?: string;
  timestamp: string;
  
  // Customer
  customerName?: string;
  customerPhone?: string;
  
  // Notes
  notes?: string;
}

// Navigation types
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
  
  // UPDATED: Added flexible date params
  DownloadingSummary: {
    dateRange: 'today' | 'yesterday' | 'last7days' | 'custom';
    customDays?: number | string; // Allow number now
    startDate?: string;           // ISO String for API
    endDate?: string;             // ISO String for API
    displayLabel?: string;        // Human readable label
  };

  // UPDATED: Added flexible date params
  BillSummary: {
    dateRange: 'today' | 'yesterday' | 'last7days' | 'custom';
    customDays?: number | string;
    startDate?: string;
    endDate?: string;
    displayLabel?: string;
  };

  BillHistory: {
    filterType: 'gst' | 'non_gst' | 'all';
    startDate?: string;
    endDate?: string;
    title: string;
  };
  SaveSuccess: undefined;
  
  // Admin flow
  AdminPin: undefined;
  SetAdminPin: undefined;
  AdminDashboard: undefined;
  ItemManagement: undefined;
  InventoryManagement: undefined;
  AddItem: undefined;
  EditItem: { item: MenuItem };
  
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

  // UPDATED: Added start/end date support for exports
  ExportingBills: {
    exportType: 'all' | 'dateRange' | 'today';
    customDays?: string | number;
    billData?: any;
    startDate?: string;
    endDate?: string;
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

// Dashboard data types
export interface DashboardData {
  totalSales: number;
  totalBills: number;
  gstBills?: number;
  nonGstBills?: number;
  avgBillValue: number;
  totalTaxCollected?: number;
  paymentSplit?: {
    cash: { count: number; amount: number };
    upi: { count: number; amount: number };
    card: { count: number; amount: number };
    credit: { count: number; amount: number };
    other: { count: number; amount: number };
  };
  mostSoldProduct: {
    name: string;
    soldCount: number;
    category: string;
    image?: string;
  } | null;
  leastSoldProduct: {
    name: string;
    soldCount: number;
    category: string;
    image?: string;
  } | null;
  mostSoldCategory: {
    name: string;
    itemsSold: number;
  } | null;
  leastSoldCategory: {
    name: string;
    itemsSold: number;
  } | null;
}

// Vendor profile for local storage
export interface VendorProfileLocal {
  vendor_id: string;
  username?: string;
  email?: string;
  business_name: string;
  address: string;
  phone: string;
  gst_no: string;
  fssai_license?: string;
  logo_url?: string;
  logo_local_path?: string;
  footer_note?: string;
  is_approved: boolean;
}

// Settings types
export interface AppSettings {
  device_id?: string;
  default_billing_mode: BillingMode;
  default_payment_mode: PaymentMode;
  gst_type: 'Inclusive' | 'Exclusive';
  paper_size: '58mm' | '80mm';
  auto_print: boolean;
  show_gst_breakdown: boolean;
  show_item_gst: boolean;
  rounding_rule: 'nearest' | 'up' | 'down' | 'none';
}

// GST Settings
export interface GSTSettings {
  gst_type: 'Inclusive' | 'Exclusive';
  default_gst_percentage: number;
  item_level_override: boolean;
  show_gst_breakdown: boolean;
  show_item_gst: boolean;
}

// Print Settings
export interface PrintSettings {
  paper_size: '58mm' | '80mm';
  auto_print: boolean;
  printer_name?: string;
  printer_type?: string;
  printer_connected: boolean;
}