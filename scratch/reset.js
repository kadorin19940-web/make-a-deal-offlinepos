const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const userDataPath = path.join(process.env.APPDATA, 'make-a-deal-pos');
const dbPath = path.join(userDataPath, 'make-a-deal-pos.db');

if (!fs.existsSync(dbPath)) {
  console.error('DB not found at:', dbPath);
  process.exit(1);
}

const db = new Database(dbPath);

// Generate hash for 'admin1234'
const hash = bcrypt.hashSync('admin1234', 12);

// Update username 'admin' password hash
const result = db.prepare("UPDATE users SET password_hash = ? WHERE username = 'admin'").run(hash);

console.log('Password reset result:', result);
process.exit(0);
