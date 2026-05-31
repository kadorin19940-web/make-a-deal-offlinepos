const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const userDataPath = path.join(process.env.APPDATA, 'make-a-deal-pos');
const dbPath = path.join(userDataPath, 'make-a-deal-pos.db');

if (!fs.existsSync(dbPath)) {
  console.error('DB not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);
const products = db.prepare('SELECT id, name, stock_qty, has_variants, is_active FROM products').all();
console.log('--- PRODUCTS IN DB ---');
console.log(JSON.stringify(products, null, 2));

const movements = db.prepare('SELECT * FROM stock_movements ORDER BY id DESC LIMIT 5').all();
console.log('--- LATEST STOCK MOVEMENTS ---');
console.log(JSON.stringify(movements, null, 2));

process.exit(0);
