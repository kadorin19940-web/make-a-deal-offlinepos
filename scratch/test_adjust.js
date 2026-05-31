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

// Clear products and insert a test product
db.exec('DELETE FROM products');
const insert = db.prepare(`
  INSERT INTO products (barcode, sku, name, sell_price, cost_price, stock_qty, min_stock, unit)
  VALUES ('1111111111111', 'TEST01', 'สินค้าทดสอบ', 100, 50, 10, 2, 'ชิ้น')
`);
const res = insert.run();
const productId = res.lastInsertRowid;

console.log('Inserted product ID:', productId);

// Simulate adjustStock: 'in'
const productBeforeIn = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId);
console.log('Stock before IN:', productBeforeIn.stock_qty); // should be 10

let newQtyIn = productBeforeIn.stock_qty;
newQtyIn += 5; // Add 5

db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQtyIn, productId);
const productAfterIn = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId);
console.log('Stock after IN:', productAfterIn.stock_qty); // should be 15

// Simulate adjustStock: 'out'
const productBeforeOut = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId);
let newQtyOut = productBeforeOut.stock_qty;
newQtyOut -= 3; // Subtract 3

db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQtyOut, productId);
const productAfterOut = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(productId);
console.log('Stock after OUT:', productAfterOut.stock_qty); // should be 12

process.exit(0);
