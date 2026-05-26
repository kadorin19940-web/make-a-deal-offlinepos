import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'
import bcrypt from 'bcryptjs'
import fs from 'fs'

let db: Database.Database

export function initDatabase(): Database.Database {
  const userDataPath = app.getPath('userData')
  const dbPath = path.join(userDataPath, 'make-a-deal-pos.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  runMigrations()
  seedData()

  console.log('Database initialized at:', dbPath)
  return db
}

export function getDb(): Database.Database {
  return db
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shop_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_en TEXT,
      color TEXT DEFAULT '#22C55E',
      icon TEXT DEFAULT '📦',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT UNIQUE,
      sku TEXT UNIQUE,
      name TEXT NOT NULL,
      name_en TEXT,
      description TEXT,
      category_id INTEGER REFERENCES categories(id),
      unit TEXT DEFAULT 'ชิ้น',
      cost_price REAL DEFAULT 0,
      sell_price REAL NOT NULL,
      sell_price2 REAL,
      sell_price3 REAL,
      stock_qty REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      max_stock REAL DEFAULT 0,
      image_path TEXT,
      is_service INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      has_variants INTEGER DEFAULT 0,
      tax_rate REAL DEFAULT 7,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS product_variants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      barcode TEXT UNIQUE,
      sku TEXT,
      sell_price REAL,
      stock_qty REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      tax_id TEXT,
      customer_type TEXT DEFAULT 'retail',
      price_level INTEGER DEFAULT 1,
      credit_limit REAL DEFAULT 0,
      credit_days INTEGER DEFAULT 0,
      points REAL DEFAULT 0,
      total_spend REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      note TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      tax_id TEXT,
      payment_terms INTEGER DEFAULT 30,
      note TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'cashier',
      pin TEXT,
      permissions TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER REFERENCES users(id),
      subtotal REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      discount_type TEXT DEFAULT 'amount',
      coupon_code TEXT,
      tax_amount REAL DEFAULT 0,
      tax_inclusive INTEGER DEFAULT 1,
      service_charge REAL DEFAULT 0,
      total REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      change_amount REAL DEFAULT 0,
      payment_method TEXT DEFAULT 'cash',
      payment_details TEXT,
      status TEXT DEFAULT 'completed',
      note TEXT,
      ref_sale_id INTEGER,
      points_earned REAL DEFAULT 0,
      points_used REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      variant_id INTEGER REFERENCES product_variants(id),
      product_name TEXT NOT NULL,
      barcode TEXT,
      qty REAL NOT NULL,
      unit TEXT,
      cost_price REAL DEFAULT 0,
      unit_price REAL NOT NULL,
      discount_amount REAL DEFAULT 0,
      discount_percent REAL DEFAULT 0,
      total REAL NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS held_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_name TEXT,
      customer_id INTEGER,
      items TEXT NOT NULL,
      discount_amount REAL DEFAULT 0,
      note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS cash_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      open_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      close_time DATETIME,
      open_amount REAL DEFAULT 0,
      close_amount REAL,
      expected_amount REAL,
      difference REAL,
      total_sales REAL DEFAULT 0,
      total_refunds REAL DEFAULT 0,
      total_void REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      transfer_sales REAL DEFAULT 0,
      qr_sales REAL DEFAULT 0,
      note TEXT,
      status TEXT DEFAULT 'open'
    );

    CREATE TABLE IF NOT EXISTS cash_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES cash_sessions(id),
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      reason TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_no TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      expected_date DATETIME,
      status TEXT DEFAULT 'draft',
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      note TEXT,
      user_id INTEGER
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_id INTEGER REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      variant_id INTEGER,
      product_name TEXT,
      qty_ordered REAL DEFAULT 0,
      qty_received REAL DEFAULT 0,
      cost_price REAL DEFAULT 0,
      total REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER REFERENCES products(id),
      variant_id INTEGER,
      type TEXT NOT NULL,
      qty REAL NOT NULL,
      qty_before REAL,
      qty_after REAL,
      ref_type TEXT,
      ref_id INTEGER,
      cost_price REAL,
      note TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS promotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      code TEXT UNIQUE,
      discount_value REAL,
      min_purchase REAL DEFAULT 0,
      max_discount REAL,
      apply_to TEXT DEFAULT 'all',
      apply_ids TEXT,
      start_date DATETIME,
      end_date DATETIME,
      usage_limit INTEGER,
      usage_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS loyalty_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      earn_per_baht REAL DEFAULT 1,
      redeem_per_baht REAL DEFAULT 1,
      min_redeem REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
    CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
  `)

  // License Activation table — hardware-locked, single-row design
  db.exec(`
    CREATE TABLE IF NOT EXISTS activation (
      id       INTEGER PRIMARY KEY DEFAULT 1,
      is_activated INTEGER NOT NULL DEFAULT 0,
      license_key  TEXT,
      hardware_id  TEXT,
      email        TEXT,
      activated_at DATETIME
    );
    INSERT OR IGNORE INTO activation (id, is_activated) VALUES (1, 0);
  `)
}

function runMigrations() {
  // Version tracking
  const versionRow = db.prepare("SELECT value FROM shop_settings WHERE key = 'db_version'").get() as { value: string } | undefined
  const currentVersion = versionRow ? parseInt(versionRow.value) : 0

  if (currentVersion < 1) {
    // Initial migration already done via createTables
    db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('db_version', '1')").run()
  }

  if (currentVersion < 2) {
    // v2: Hardware-Locked License Activation system
    db.exec(`
      CREATE TABLE IF NOT EXISTS activation (
        id       INTEGER PRIMARY KEY DEFAULT 1,
        is_activated INTEGER NOT NULL DEFAULT 0,
        license_key  TEXT,
        hardware_id  TEXT,
        email        TEXT,
        activated_at DATETIME
      );
      INSERT OR IGNORE INTO activation (id, is_activated) VALUES (1, 0);
    `)
    db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('db_version', '2')").run()
  }

  if (currentVersion < 3) {
    // v3: Add email column to activation table for existing installations
    try {
      db.exec(`ALTER TABLE activation ADD COLUMN email TEXT;`)
    } catch (e) {
      // Column might already exist
    }
    db.prepare("INSERT OR REPLACE INTO shop_settings (key, value) VALUES ('db_version', '3')").run()
  }
}

function seedData() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count
  if (userCount > 0) return

  // Default admin user
  const adminHash = bcrypt.hashSync('admin1234', 12)
  db.prepare(`
    INSERT INTO users (username, password_hash, name, role, pin, permissions, is_active)
    VALUES ('ADMIN', ?, 'ผู้ดูแลระบบ', 'admin', '1234', '["all"]', 1)
  `).run(adminHash)

  const managerHash = bcrypt.hashSync('manager123', 12)
  db.prepare(`
    INSERT INTO users (username, password_hash, name, role, pin, permissions, is_active)
    VALUES ('manager', ?, 'ผู้จัดการ', 'manager', '2345', '["sales","products","customers","reports"]', 1)
  `).run(managerHash)

  const cashierHash = bcrypt.hashSync('cashier123', 12)
  db.prepare(`
    INSERT INTO users (username, password_hash, name, role, pin, permissions, is_active)
    VALUES ('cashier', ?, 'พนักงานขาย', 'cashier', '3456', '["sales","customers"]', 1)
  `).run(cashierHash)

  // Default shop settings
  const defaultSettings = {
    shop_name: 'Make a Deal',
    shop_name_en: 'Make a Deal',
    shop_address: '123 ถนนสุขุมวิท กรุงเทพมหานคร 10110',
    shop_phone: '02-123-4567',
    shop_email: 'info@makeadeal.co.th',
    shop_tax_id: '0-1234-56789-01-2',
    vat_enabled: 'true',
    vat_rate: '7',
    vat_inclusive: 'true',
    currency: '฿',
    language: 'th',
    timezone: 'Asia/Bangkok',
    date_format: 'dd/MM/yyyy',
    receipt_header: 'ขอบคุณที่ใช้บริการ',
    receipt_footer: 'กรุณาเก็บใบเสร็จไว้เป็นหลักฐาน',
    auto_print: 'true',
    printer_size: '80mm',
    points_per_baht: '1',
    baht_per_point: '0.1',
    pin_lock_minutes: '15',
    backup_enabled: 'true',
    backup_interval_hours: '24',
    low_stock_alert: 'true',
  }

  const insertSetting = db.prepare('INSERT OR IGNORE INTO shop_settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value)
  }

  // Default loyalty rule
  db.prepare(`
    INSERT INTO loyalty_rules (name, earn_per_baht, redeem_per_baht, min_redeem, is_active)
    VALUES ('กฎสะสมแต้มมาตรฐาน', 1, 0.1, 100, 1)
  `).run()

  console.log('Seed data created successfully')
}
