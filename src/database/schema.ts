// src/database/schema.ts
import { open } from '@op-engineering/op-sqlite';

const DB_NAME = 'TrenzPOS.db';

let db: any;

// Initialize database
export const initDatabase = async (): Promise<any> => {
  try {
    db = open({ name: DB_NAME });
    
    console.log('Database opened successfully');
    await createTables();
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
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

  // Items table
  executeSql(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock_quantity INTEGER DEFAULT 0,
      sku TEXT,
      barcode TEXT,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      vendor_id TEXT,
      image_path TEXT,
      image_url TEXT,
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

  // ==================== NEW: INVENTORY ITEMS TABLE ====================
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
  // ==================== END NEW ====================

  // Bills table
  executeSql(`
    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL UNIQUE,
      customer_name TEXT,
      customer_phone TEXT,
      items TEXT NOT NULL,
      subtotal REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      discount_amount REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      payment_method TEXT,
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
      business_logo_path TEXT,
      tax_rate REAL DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      bill_prefix TEXT DEFAULT 'BILL',
      bill_footer_note TEXT,
      printer_name TEXT,
      printer_type TEXT,
      device_id TEXT,
      admin_pin TEXT,
      is_synced INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create indexes for better performance
  executeSql(`CREATE INDEX IF NOT EXISTS idx_items_vendor ON items(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_vendor ON categories(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_bills_synced ON bills(is_synced);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_items_synced ON items(is_synced);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_sync_queue_synced ON sync_queue(synced);`);
  
  // ==================== NEW: INVENTORY INDEXES ====================
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON inventory_items(vendor_id);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_active ON inventory_items(is_active);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory_items(sku);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_barcode ON inventory_items(barcode);`);
  executeSql(`CREATE INDEX IF NOT EXISTS idx_inventory_synced ON inventory_items(is_synced);`);
  // ==================== END NEW ====================

  console.log('All tables created successfully');
};

// Drop all tables (use for reset)
export const dropAllTables = async () => {
  executeSql('DROP TABLE IF EXISTS auth;');
  executeSql('DROP TABLE IF EXISTS categories;');
  executeSql('DROP TABLE IF EXISTS items;');
  executeSql('DROP TABLE IF EXISTS item_categories;');
  executeSql('DROP TABLE IF EXISTS inventory_items;'); // NEW
  executeSql('DROP TABLE IF EXISTS bills;');
  executeSql('DROP TABLE IF EXISTS sync_queue;');
  executeSql('DROP TABLE IF EXISTS settings;');
  executeSql('DROP TABLE IF EXISTS business_settings;');
  
  console.log('All tables dropped');
};

// Close database
export const closeDatabase = async () => {
  if (db) {
    db.close();
    console.log('Database closed');
  }
};

export default {
  initDatabase,
  getDatabase,
  dropAllTables,
  closeDatabase,
};