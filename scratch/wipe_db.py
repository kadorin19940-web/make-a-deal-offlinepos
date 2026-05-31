import os
import sqlite3

db_path = os.path.join(os.environ['APPDATA'], 'make-a-deal-pos', 'make-a-deal-pos.db')
if not os.path.exists(db_path):
    print('DB not found at:', db_path)
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

tables_to_clear = [
    'products',
    'product_variants',
    'categories',
    'customers',
    'suppliers',
    'sales',
    'sale_items',
    'stock_movements',
    'promotions',
    'activity_logs',
    'loyalty_rules'
]

# Wipe the mock records
for table in tables_to_clear:
    try:
        cursor.execute(f"DELETE FROM {table}")
        print(f"Cleared table: {table}")
    except sqlite3.OperationalError as e:
        print(f"Skipped table {table}: {e}")

# Reset autoincrement sequences
try:
    cursor.execute("DELETE FROM sqlite_sequence WHERE name IN ('" + "','".join(tables_to_clear) + "')")
    print('Reset auto-increment sequences.')
except Exception as e:
    print('Failed to reset sqlite_sequence:', e)

conn.commit()
conn.close()
print('Local Database successfully wiped of mock data!')
