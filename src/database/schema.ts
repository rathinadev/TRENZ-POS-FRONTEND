// src/database/schema.ts
import { open } from '@op-engineering/op-sqlite';

const DB_NAME = 'TrenzPOS.db';
const DB_VERSION = 2; // Increment when schema changes

let db: any;

// Initialize database
export const initDatabase = async (): Promise<any> => {
  try {
    db = open({ name: DB_NAME });
    
    console.log('Database opened successfully');
    await createTables();
    await runMigrations();
    return db;
  } catch (error) {
    console.error('Failed to open database:', error);
    throw error;
  }
};

// Get database instance
export const getDatabase = (): any => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return db;
};

// Execute SQL
const executeSql = (sql: string, params: any[] = []): any => {
  try {
    return db.execute(sql, params);
  } catch (error) {
    console.error('SQL Error:', error);
    throw error;
  }
};

// Check if column exists in table
const columnExists = (tableName: string, columnName: string): boolean => {
  try {
    const result = db.execute(`PRAGMA table_info(${tableName})`);
    let columns: any[] = [];
    
    if (result && result.rows) {
      if (result.rows._array) {
        columns = result.rows._array;
      } else if (Array.isArray(result.rows)) {
        columns = result.rows;
      }
    } else if (Array.isArray(result)) {
      columns = result;
    }
    
    return columns.some((col: any) => col && col.name === columnName);
  } catch (error) {
    return false;
  }
};

// Safe add column - FIXED TO REDUCE LOG NOISE
const addColumnIfNotExists = (tableName: string, columnName: string, columnDef: string): void => {
  try {
    // 1. Check if column exists first
    if (columnExists(tableName, columnName)) {
      return; 
    }

    // 2. Try to add column
    db.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDef}`);
    console.log(`✅ Added column ${columnName} to ${tableName}`);

  } catch (error: any) {
    const errorMsg = String(error?.message || error || '').toLowerCase();
    
    // 3. Silently catch "duplicate column" errors
    if (
      errorMsg.includes('duplicate column') || 
      errorMsg.includes('already exists')
    ) {
      return; // It exists, so we are good.
    }
    
    console.warn(`⚠️ Warning: Could not add column ${columnName} to ${tableName}:`, errorMsg);
  }
};

// Create all tables
const createTables = async () => {
  // Auth table
  executeSql(`
    CREATE TABLE IF NOT EXISTS auth (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      vendor_id TEXT,
      business_name TEXT,
      gst_no TEXT,
      fssai_license TEXT,
      logo_url TEXT,
      footer_note TEXT,
      address TEXT,
      phone TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Vendor Profile table (for offline access to vendor details)
  executeSql(`
    CREATE TABLE IF NOT EXISTS vendor_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor_id TEXT UNIQUE,
      username TEXT,
      email TEXT,
      business_name TEXT,
      address TEXT,
      phone TEXT,
      gst_no TEXT,
      fssai_license TEXT,
      logo_url TEXT,
      logo_local_path TEXT,
      footer_note TEXT,
      is_approved INTEGER DEFAULT 0,
      is_synced INTEGER DEFAULT 0,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  // Categories table
  executeSql(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      vendor_id TEXT,
      is_synced INTEGER DEFAULT 0,
      server_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);

  // Items table with all required fields
  executeSql(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      mrp_price REAL,
      price_type TEXT DEFAULT 'exclusive',
      gst_percentage REAL DEFAULT 0,
      veg_nonveg TEXT,
      additional_discount REAL DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      sku TEXT,
      barcode TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      vendor_id TEXT,
      image_path TEXT,
      image_url TEXT,
      local_image_path TEXT,
      is_synced INTEGER DEFAULT 0,
      server_updated_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);

  // Item Categories (Many-to-Many)
  executeSql(`
    CREATE TABLE IF NOT EXISTS item_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE(item_id, category_id)
    );
  `);

  // Inventory items table (for raw materials / stock management)
  executeSql(`
    CREATE TABLE IF NOT EXISTS inventory_items (
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
    );
  `);

  // Bills table with full GST support and billing modes
  executeSql(`
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      invoice_number TEXT,
      bill_number TEXT NOT NULL,
      billing_mode TEXT DEFAULT 'gst',
      restaurant_name TEXT,
      address TEXT,
      gstin TEXT,
      fssai_license TEXT,
      bill_date TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      discount_percentage REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'cash',
      payment_reference TEXT,
      amount_paid REAL,
      change_amount REAL DEFAULT 0,
      notes TEXT,
      device_id TEXT,
      vendor_id TEXT,
      is_synced INTEGER DEFAULT 0,
      printed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);

  // Sync queue table
  executeSql(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operation_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      retry_count INTEGER DEFAULT 0,
      last_error TEXT,
      synced INTEGER DEFAULT 0,
      synced_at TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Settings table
  executeSql(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Business settings table
  executeSql(`
    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_name TEXT,
      business_address TEXT,
      business_phone TEXT,
      business_email TEXT,
      business_gst TEXT,
      business_fssai TEXT,
      business_logo_path TEXT,
      tax_rate REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      bill_prefix TEXT DEFAULT 'BILL',
      bill_footer_note TEXT,
      printer_name TEXT,
      printer_type TEXT,
      printer_mac_address TEXT,
      device_id TEXT,
      admin_pin TEXT,
      gst_type TEXT DEFAULT 'Inclusive',
      item_level_override INTEGER DEFAULT 1,
      rounding_rule TEXT DEFAULT 'nearest',
      invoice_format TEXT DEFAULT 'classic',
      gst_breakdown INTEGER DEFAULT 1,
      item_tax_split INTEGER DEFAULT 0,
      total_quantity INTEGER DEFAULT 1,
      payment_method INTEGER DEFAULT 1,
      business_code TEXT,
      logo_path TEXT,
      paper_size TEXT DEFAULT '58mm',
      auto_print INTEGER DEFAULT 0,
      printer_connected INTEGER DEFAULT 0,
      last_restore_date TEXT,
      last_pdf_export_date TEXT,
      last_summary_range TEXT,
      last_summary_custom_days INTEGER,
      last_summary_date TEXT,
      admin_pin_set_date TEXT,
      app_launch_count INTEGER DEFAULT 0,
      last_app_launch TEXT,
      setup_completed INTEGER DEFAULT 0,
      setup_completed_date TEXT,
      last_test_print_date TEXT,
      test_print_count INTEGER DEFAULT 0,
      welcome_screen_view_count INTEGER DEFAULT 0,
      last_welcome_view_date TEXT,
      first_welcome_view_date TEXT,
      onboarding_path TEXT,
      onboarding_started_date TEXT,
      default_billing_mode TEXT DEFAULT 'gst',
      is_synced INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Invoice sequence table for tracking invoice numbers
  executeSql(`
    CREATE TABLE IF NOT EXISTS invoice_sequences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billing_mode TEXT NOT NULL,
      year INTEGER NOT NULL,
      sequence INTEGER DEFAULT 0,
      prefix TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(billing_mode, year)
    );
  `);

  // Image cache table for tracking cached images
  executeSql(`
    CREATE TABLE IF NOT EXISTS image_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      remote_url TEXT,
      local_path TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      expires_at TEXT,
      UNIQUE(entity_type, entity_id)
    );
  `);

  // Create indexes for better performance
  executeSql(`CREATE INDEX IF NOT EXISTS idx_items_vendor ON items(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_vendor ON categories(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_bills_synced ON bills(is_synced);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_bills_billing_mode ON bills(billing_mode);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_items_synced ON items(is_synced);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON inventory_items(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory_items(is_active);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory_items(barcode);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_synced ON inventory_items(is_synced);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_vendor_profile_vendor_id ON vendor_profile(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_image_cache_entity ON image_cache(entity_type, entity_id);`);

  console.log('All tables created successfully');
};

// Run database migrations for existing installations
const runMigrations = async () => {
  console.log('🔄 Running database migrations...');

  try {
    // Migrate items table
    console.log('Migrating items table...');
    addColumnIfNotExists('items', 'mrp_price', 'REAL');
    addColumnIfNotExists('items', 'price_type', "TEXT DEFAULT 'exclusive'");
    addColumnIfNotExists('items', 'gst_percentage', 'REAL DEFAULT 0');
    addColumnIfNotExists('items', 'veg_nonveg', 'TEXT');
    addColumnIfNotExists('items', 'additional_discount', 'REAL DEFAULT 0');
    addColumnIfNotExists('items', 'local_image_path', 'TEXT');

    // Migrate bills table
    console.log('Migrating bills table...');
    addColumnIfNotExists('bills', 'invoice_number', 'TEXT');
    addColumnIfNotExists('bills', 'billing_mode', "TEXT DEFAULT 'gst'");
    addColumnIfNotExists('bills', 'restaurant_name', 'TEXT');
    addColumnIfNotExists('bills', 'address', 'TEXT');
    addColumnIfNotExists('bills', 'gstin', 'TEXT');
    addColumnIfNotExists('bills', 'fssai_license', 'TEXT');
    addColumnIfNotExists('bills', 'bill_date', 'TEXT');
    addColumnIfNotExists('bills', 'discount_percentage', 'REAL DEFAULT 0');
    addColumnIfNotExists('bills', 'cgst_amount', 'REAL DEFAULT 0');
    addColumnIfNotExists('bills', 'sgst_amount', 'REAL DEFAULT 0');
    addColumnIfNotExists('bills', 'igst_amount', 'REAL DEFAULT 0');
    addColumnIfNotExists('bills', 'total_tax', 'REAL DEFAULT 0');
    addColumnIfNotExists('bills', 'payment_mode', "TEXT DEFAULT 'cash'");
    addColumnIfNotExists('bills', 'payment_reference', 'TEXT');
    addColumnIfNotExists('bills', 'amount_paid', 'REAL');
    addColumnIfNotExists('bills', 'change_amount', 'REAL DEFAULT 0');

    // Migrate auth table
    console.log('Migrating auth table...');
    addColumnIfNotExists('auth', 'gst_no', 'TEXT');
    addColumnIfNotExists('auth', 'fssai_license', 'TEXT');
    addColumnIfNotExists('auth', 'logo_url', 'TEXT');
    addColumnIfNotExists('auth', 'footer_note', 'TEXT');
    addColumnIfNotExists('auth', 'address', 'TEXT');
    addColumnIfNotExists('auth', 'phone', 'TEXT');

    // Migrate business_settings table - CRITICAL for the error you're seeing
    console.log('Migrating business_settings table...');
    addColumnIfNotExists('business_settings', 'business_gst', 'TEXT');
    addColumnIfNotExists('business_settings', 'business_fssai', 'TEXT');
    addColumnIfNotExists('business_settings', 'default_billing_mode', "TEXT DEFAULT 'gst'");
    addColumnIfNotExists('business_settings', 'gst_type', "TEXT DEFAULT 'Inclusive'");
    addColumnIfNotExists('business_settings', 'item_level_override', 'INTEGER DEFAULT 1');
    addColumnIfNotExists('business_settings', 'rounding_rule', "TEXT DEFAULT 'nearest'");
    addColumnIfNotExists('business_settings', 'invoice_format', "TEXT DEFAULT 'classic'");
    addColumnIfNotExists('business_settings', 'printer_mac_address', 'TEXT');
    addColumnIfNotExists('business_settings', 'printer_connection_type', "TEXT DEFAULT 'bluetooth'");
    addColumnIfNotExists('business_settings', 'printer_network_url', 'TEXT');

    console.log('✅ Database migrations completed successfully');
  } catch (error) {
    console.error('❌ Error during database migrations:', error);
    // Don't throw - allow app to continue, but log the error
  }
};

// Drop all tables (use for reset)
export const dropAllTables = async () => {
  executeSql('DROP TABLE IF EXISTS auth;');
  executeSql('DROP TABLE IF EXISTS vendor_profile;');
  executeSql('DROP TABLE IF EXISTS categories;');
  executeSql('DROP TABLE IF EXISTS items;');
  executeSql('DROP TABLE IF EXISTS item_categories;');
  executeSql('DROP TABLE IF EXISTS inventory_items;');
  executeSql('DROP TABLE IF EXISTS bills;');
  executeSql('DROP TABLE IF EXISTS sync_queue;');
  executeSql('DROP TABLE IF EXISTS settings;');
  executeSql('DROP TABLE IF EXISTS business_settings;');
  executeSql('DROP TABLE IF EXISTS invoice_sequences;');
  executeSql('DROP TABLE IF EXISTS image_cache;');
  
  console.log('All tables dropped');
};

// Close database
export const closeDatabase = async () => {
  if (db) {
    db.close();
    console.log('Database closed');
  }
};

// Get current DB version
export const getDbVersion = (): number => {
  return DB_VERSION;
};

export default {
  initDatabase,
  getDatabase,
  dropAllTables,
  closeDatabase,
  getDbVersion,
};