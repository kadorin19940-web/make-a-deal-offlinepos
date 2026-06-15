import { ipcMain, app } from 'electron'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import * as XLSX from 'xlsx'

// Secure helper to double-check user role from SQLite DB
const checkAdmin = (db: Database.Database, userId: number | undefined): boolean => {
  if (!userId) return false
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(userId) as { role: string } | undefined
    return !!user && user.role.toLowerCase() === 'admin'
  } catch {
    return false
  }
}

const checkAdminOrManager = (db: Database.Database, userId: number | undefined): boolean => {
  if (!userId) return false
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(userId) as { role: string } | undefined
    return !!user && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'manager')
  } catch {
    return false
  }
}

// Garbage collection helper to delete unlinked images from userData/images
const deleteImageFile = (fileName: string | undefined) => {
  if (!fileName) return
  try {
    const imagesDir = path.join(app.getPath('userData'), 'images')
    const filePath = path.join(imagesDir, fileName)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  } catch (error) {
    console.error('Failed to delete image file:', error)
  }
}

// Helper utilities for ShopSettings type-casting
const BOOLEAN_KEYS = ['vat_enabled', 'vat_inclusive', 'auto_print', 'backup_enabled', 'low_stock_alert']
const NUMBER_KEYS = ['vat_rate', 'points_per_baht', 'baht_per_point', 'pin_lock_minutes', 'backup_interval_hours']

export function castSettingsGet(raw: Record<string, string>): Record<string, unknown> {
  const casted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (BOOLEAN_KEYS.includes(key)) {
      casted[key] = value === 'true' || value === '1'
    } else if (NUMBER_KEYS.includes(key)) {
      casted[key] = Number(value) || 0
    } else {
      casted[key] = value
    }
  }
  return casted
}

export function castSettingsSave(settings: Record<string, unknown>): Record<string, string> {
  const converted: Record<string, string> = {}
  for (const [key, value] of Object.entries(settings)) {
    if (typeof value === 'boolean') {
      converted[key] = value ? 'true' : 'false'
    } else if (typeof value === 'number') {
      converted[key] = String(value)
    } else {
      converted[key] = String(value ?? '')
    }
  }
  return converted
}

export function registerCustomerHandlers(db: Database.Database) {
  ipcMain.handle('customers:getAll', (_, filters: Record<string, unknown> = {}) => {
    try {
      let query = 'SELECT * FROM customers WHERE is_active = 1'
      const params: unknown[] = []
      if (filters.search) {
        query += ' AND (name LIKE ? OR phone LIKE ? OR code LIKE ?)'
        const s = `%${filters.search}%`
        params.push(s, s, s)
      }
      if (filters.customer_type) { query += ' AND customer_type = ?'; params.push(filters.customer_type) }
      query += ' ORDER BY name ASC'
      return { success: true, data: db.prepare(query).all(...params) }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:getById', (_, id: number) => {
    try {
      const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id)
      return { success: true, data: customer }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:search', (_, query: string) => {
    try {
      const s = `%${query}%`
      const customers = db.prepare(
        'SELECT * FROM customers WHERE is_active = 1 AND (name LIKE ? OR phone LIKE ? OR code LIKE ?) LIMIT 10'
      ).all(s, s, s)
      return { success: true, data: customers }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:create', (_, data: Record<string, unknown>) => {
    try {
      // Auto-generate code
      const lastCustomer = db.prepare("SELECT code FROM customers ORDER BY id DESC LIMIT 1").get() as { code: string } | undefined
      let code = 'CUST001'
      if (lastCustomer?.code) {
        const num = parseInt(lastCustomer.code.replace('CUST', '')) + 1
        code = `CUST${String(num).padStart(3, '0')}`
      }
      const result = db.prepare(`
        INSERT INTO customers (code, name, phone, email, address, tax_id, customer_type, price_level,
          credit_limit, credit_days, discount_percent, note)
        VALUES (@code, @name, @phone, @email, @address, @tax_id, @customer_type, @price_level,
          @credit_limit, @credit_days, @discount_percent, @note)
      `).run({ code, ...data })
      return { success: true, data: { id: result.lastInsertRowid, code } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:update', (_, id: number, data: Record<string, unknown>) => {
    try {
      const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
      db.prepare(`UPDATE customers SET ${fields} WHERE id = @id`).run({ ...data, id })
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:delete', (_, id: number) => {
    try {
      db.prepare('UPDATE customers SET is_active = 0 WHERE id = ?').run(id)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:getHistory', (_, id: number) => {
    try {
      const sales = db.prepare(`
        SELECT s.*, COUNT(si.id) as item_count FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        WHERE s.customer_id = ? AND s.status = 'completed'
        GROUP BY s.id ORDER BY s.sale_date DESC LIMIT 50
      `).all(id)
      return { success: true, data: sales }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('customers:adjustPoints', (_, id: number, amount: number, reason: string) => {
    try {
      db.prepare('UPDATE customers SET points = points + ? WHERE id = ?').run(amount, id)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })
}

export function registerInventoryHandlers(db: Database.Database) {
  ipcMain.handle('inventory:getMovements', (_, filters: Record<string, unknown> = {}) => {
    try {
      let query = `
        SELECT sm.*, p.name as product_name, p.barcode
        FROM stock_movements sm
        LEFT JOIN products p ON sm.product_id = p.id
        WHERE 1=1
      `
      const params: unknown[] = []
      if (filters.product_id) { query += ' AND sm.product_id = ?'; params.push(filters.product_id) }
      if (filters.type) { query += ' AND sm.type = ?'; params.push(filters.type) }
      if (filters.from_date) { query += ' AND DATE(sm.created_at) >= ?'; params.push(filters.from_date) }
      if (filters.to_date) { query += ' AND DATE(sm.created_at) <= ?'; params.push(filters.to_date) }
      query += ' ORDER BY sm.created_at DESC LIMIT 500'
      return { success: true, data: db.prepare(query).all(...params) }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('inventory:adjustStock', (_, data: Record<string, unknown>) => {
    try {
      const productId = Number(data.product_id)
      const inputQty = Number(data.qty)
      const type = String(data.type)

      if (isNaN(productId) || isNaN(inputQty)) {
        return { success: false, error: 'ข้อมูลไม่ถูกต้อง' }
      }

      const product = db.prepare('SELECT stock_qty, cost_price FROM products WHERE id = ?').get(productId) as { stock_qty: number; cost_price: number } | undefined
      if (!product) {
        return { success: false, error: 'ไม่พบสินค้าที่ระบุในคลังสินค้า' }
      }

      const currentQty = Number(product.stock_qty) || 0
      let newQty = currentQty

      if (type === 'adjust') {
        newQty = inputQty
      } else if (type === 'in') {
        newQty = currentQty + inputQty
      } else {
        newQty = currentQty - inputQty
      }

      db.prepare('UPDATE products SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQty, productId)
      
      const costPrice = Number(product.cost_price) || 0
      db.prepare(`
        INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, cost_price, note, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(productId, type, inputQty, currentQty, newQty, costPrice, (data.note as string) || null, (data.user_id as number) || null)
      
      return { success: true }
    } catch (error) { 
      console.error('adjustStock error:', error)
      return { success: false, error: String(error) } 
    }
  })


  ipcMain.handle('inventory:getPurchaseOrders', (_, filters: Record<string, unknown> = {}) => {
    try {
      let query = `
        SELECT po.*, s.name as supplier_name
        FROM purchase_orders po
        LEFT JOIN suppliers s ON po.supplier_id = s.id
        WHERE 1=1
      `
      const params: unknown[] = []
      if (filters.status) { query += ' AND po.status = ?'; params.push(filters.status) }
      query += ' ORDER BY po.id DESC LIMIT 100'
      return { success: true, data: db.prepare(query).all(...params) }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('inventory:createPO', (_, data: Record<string, unknown>) => {
    try {
      const lastPO = db.prepare("SELECT po_no FROM purchase_orders ORDER BY id DESC LIMIT 1").get() as { po_no: string } | undefined
      const num = lastPO ? parseInt(lastPO.po_no.replace('PO', '')) + 1 : 1
      const poNo = `PO${String(num).padStart(5, '0')}`

      const result = db.prepare(`
        INSERT INTO purchase_orders (po_no, supplier_id, expected_date, subtotal, total, note, user_id, status)
        VALUES (@po_no, @supplier_id, @expected_date, @subtotal, @total, @note, @user_id, 'draft')
      `).run({ po_no: poNo, ...data })

      const poId = result.lastInsertRowid
      const items = data.items as Record<string, unknown>[]
      const insertItem = db.prepare(`
        INSERT INTO purchase_order_items (po_id, product_id, product_name, qty_ordered, cost_price, total)
        VALUES (@po_id, @product_id, @product_name, @qty_ordered, @cost_price, @total)
      `)
      for (const item of items) insertItem.run({ po_id: poId, ...item })

      return { success: true, data: { id: poId, po_no: poNo } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('inventory:receivePO', (_, id: number, items: Record<string, unknown>[]) => {
    try {
      const receivePO = db.transaction(() => {
        for (const item of items) {
          if ((item.qty_received as number) > 0) {
            const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number }
            const newQty = product.stock_qty + (item.qty_received as number)
            db.prepare('UPDATE products SET stock_qty = ?, cost_price = ? WHERE id = ?').run(newQty, item.cost_price, item.product_id)
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, cost_price, ref_type, ref_id, note)
              VALUES (?, 'in', ?, ?, ?, ?, 'purchase', ?, 'รับสินค้าตาม PO')
            `).run(item.product_id, item.qty_received, product.stock_qty, newQty, item.cost_price, id)
            db.prepare('UPDATE purchase_order_items SET qty_received = ? WHERE id = ?').run(item.qty_received, item.id)
          }
        }
        db.prepare("UPDATE purchase_orders SET status = 'received' WHERE id = ?").run(id)
      })
      receivePO()
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })
}

export function registerReportHandlers(db: Database.Database) {
  ipcMain.handle('reports:getDashboardStats', () => {
    try {
      const todaySales = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as total_sales, COUNT(*) as bill_count
        FROM sales WHERE DATE(sale_date) = DATE('now', 'localtime') AND status = 'completed'
      `).get() as { total_sales: number; bill_count: number }

      const yesterdaySales = db.prepare(`
        SELECT COALESCE(SUM(total), 0) as total_sales
        FROM sales WHERE DATE(sale_date) = DATE('now', 'localtime', '-1 day') AND status = 'completed'
      `).get() as { total_sales: number }

      const topProducts = db.prepare(`
        SELECT si.product_name, SUM(si.qty) as qty_sold, SUM(si.total) as revenue
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.sale_date) = DATE('now', 'localtime') AND s.status = 'completed'
        GROUP BY si.product_name ORDER BY qty_sold DESC LIMIT 5
      `).all()

      const lowStock = db.prepare(`
        SELECT COUNT(*) as count FROM products
        WHERE is_active = 1 AND is_service = 0 AND stock_qty <= min_stock
      `).get() as { count: number }

      const salesChart = db.prepare(`
        SELECT DATE(sale_date) as date, COALESCE(SUM(total), 0) as total
        FROM sales WHERE sale_date >= DATE('now', 'localtime', '-7 days') AND status = 'completed'
        GROUP BY DATE(sale_date) ORDER BY date ASC
      `).all()

      const currentSession = db.prepare("SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1").get()

      return {
        success: true,
        data: {
          todaySales,
          yesterdaySales,
          topProducts,
          lowStock,
          salesChart,
          currentSession,
        }
      }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('reports:getSalesSummary', (_, filters: Record<string, any>) => {
    try {
      if (!checkAdminOrManager(db, filters.userId)) {
        return { success: false, error: 'Unauthorized: Admin or Manager privileges required.' }
      }

      const summary = db.prepare(`
        SELECT 
          COUNT(*) as bill_count,
          COALESCE(SUM(total), 0) as total_revenue,
          COALESCE(SUM(total - discount_amount), 0) as net_revenue,
          COALESCE(SUM(tax_amount), 0) as total_tax,
          COALESCE(AVG(total), 0) as avg_bill,
          (
            SELECT COALESCE(SUM(si.total - (si.qty * si.cost_price)), 0)
            FROM sale_items si
            JOIN sales s ON si.sale_id = s.id
            WHERE DATE(s.sale_date) BETWEEN ? AND ? AND s.status = 'completed'
          ) as total_profit
        FROM sales 
        WHERE DATE(sale_date) BETWEEN ? AND ? AND status = 'completed'
      `).get(filters.from_date, filters.to_date, filters.from_date, filters.to_date) as Record<string, number>

      return { success: true, data: summary }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('reports:getSalesChart', (_, filters: Record<string, any>) => {
    try {
      if (!checkAdminOrManager(db, filters.userId)) {
        return { success: false, error: 'Unauthorized: Admin or Manager privileges required.' }
      }

      const chart = db.prepare(`
        SELECT DATE(s.sale_date) as date, 
          COALESCE(SUM(s.total), 0) as total,
          COUNT(s.id) as count,
          COALESCE((
            SELECT SUM(si.total - (si.qty * si.cost_price))
            FROM sale_items si
            JOIN sales s2 ON si.sale_id = s2.id
            WHERE DATE(s2.sale_date) = DATE(s.sale_date) AND s2.status = 'completed'
          ), 0) as profit
        FROM sales s
        WHERE DATE(s.sale_date) BETWEEN ? AND ? AND s.status = 'completed'
        GROUP BY DATE(s.sale_date) ORDER BY date ASC
      `).all(filters.from_date, filters.to_date)
      return { success: true, data: chart }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('reports:getTopProducts', (_, filters: Record<string, any>) => {
    try {
      if (!checkAdminOrManager(db, filters.userId)) {
        return { success: false, error: 'Unauthorized: Admin or Manager privileges required.' }
      }

      const products = db.prepare(`
        SELECT si.product_name, si.product_id,
          SUM(si.qty) as qty_sold,
          SUM(si.total) as revenue,
          SUM(si.qty * si.cost_price) as cost,
          SUM(si.total) - SUM(si.qty * si.cost_price) as profit
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        WHERE DATE(s.sale_date) BETWEEN ? AND ? AND s.status = 'completed'
        GROUP BY si.product_name ORDER BY qty_sold DESC LIMIT ?
      `).all(filters.from_date, filters.to_date, filters.limit || 10)
      return { success: true, data: products }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('reports:getTopCustomers', (_, filters: Record<string, any>) => {
    try {
      if (!checkAdminOrManager(db, filters.userId)) {
        return { success: false, error: 'Unauthorized: Admin or Manager privileges required.' }
      }

      const customers = db.prepare(`
        SELECT c.id, c.name, c.phone, c.customer_type,
          COUNT(s.id) as visit_count,
          SUM(s.total) as total_spend,
          MAX(s.sale_date) as last_visit
        FROM customers c
        JOIN sales s ON c.id = s.customer_id
        WHERE DATE(s.sale_date) BETWEEN ? AND ? AND s.status = 'completed'
        GROUP BY c.id ORDER BY total_spend DESC LIMIT ?
      `).all(filters.from_date, filters.to_date, filters.limit || 10)
      return { success: true, data: customers }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('reports:getInventoryValue', () => {
    try {
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as total_products,
          SUM(stock_qty * cost_price) as total_cost_value,
          SUM(stock_qty * sell_price) as total_sell_value,
          COUNT(CASE WHEN stock_qty <= min_stock AND is_service = 0 THEN 1 END) as low_stock_count
        FROM products WHERE is_active = 1 AND is_service = 0
      `).get()
      const products = db.prepare(`
        SELECT p.*, c.name as category_name,
          (p.stock_qty * p.cost_price) as cost_value,
          (p.stock_qty * p.sell_price) as sell_value
        FROM products p LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1 AND p.is_service = 0
        ORDER BY cost_value DESC
      `).all()
      return { success: true, data: { summary, products } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  // Advanced Export to Excel with Date Range Filter and Anti-Memory Leak protection
  // [FIXED: Excel Export — Deleted Product Handling]
  ipcMain.handle('reports:exportSalesExcel', async (_, filters: { from_date: string; to_date: string; filePath: string; userId: number }) => {
    try {
      if (!checkAdminOrManager(db, filters.userId)) {
        return { success: false, error: 'Unauthorized: Admin or Manager privileges required.' }
      }

      const { from_date, to_date, filePath } = filters
      const ws = XLSX.utils.json_to_sheet([])

      // Write Header
      const headers = [
        "ID",
        "เลขที่ใบเสร็จ",
        "วันที่-เวลา",
        "SKU",
        "บาร์โค้ด",
        "ชื่อสินค้า",
        "จำนวน",
        "หน่วย",
        "ราคาต่อหน่วย (บาท)",
        "ยอดรวมสินค้า (บาท)",
        "ชื่อลูกค้า",
        "แคชเชียร์",
        "ยอดรวมก่อนส่วนลดบิล (บาท)",
        "ส่วนลดท้ายบิล (บาท)",
        "ภาษี (บาท)",
        "ยอดสุทธิรวม (บาท)",
        "วิธีชำระเงิน",
        "สถานะ",
        "หมายเหตุ"
      ]
      XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' })
      let rowCount = 1

      // Fetch in chunks
      let offset = 0
      const limit = 1000

      while (true) {
        // RECOMMENDATION: Store a snapshot of product_name and barcode directly in sale_items at time of sale, so exports are never dependent on the products table.
        const rows = db.prepare(`
          SELECT s.id, s.receipt_no, s.sale_date, c.name as customer_name, u.name as cashier_name,
                 s.subtotal, s.discount_amount, s.tax_amount, s.total, s.payment_method, s.status, s.note,
                 si.qty, si.unit, si.unit_price, si.total as item_total,
                 p.name as product_name, p.barcode as product_barcode, p.sku as product_sku
          FROM sales s
          LEFT JOIN sale_items si ON s.id = si.sale_id
          LEFT JOIN products p ON si.product_id = p.id
          LEFT JOIN customers c ON s.customer_id = c.id
          LEFT JOIN users u ON s.user_id = u.id
          WHERE DATE(s.sale_date) BETWEEN ? AND ?
          ORDER BY s.id ASC, si.id ASC
          LIMIT ? OFFSET ?
        `).all(from_date, to_date, limit, offset) as any[]

        if (rows.length === 0) break

        const mapped = rows.map(r => {
          // If products.name IS NULL -> display "(สินค้าถูกลบออกจากระบบ)"
          const pName = r.product_name || '(สินค้าถูกลบออกจากระบบ)'
          // Barcode and SKU are now separate columns
          const pBarcode = r.product_barcode || '-'
          const pSku = r.product_sku || '-'

          return [
            r.id,
            r.receipt_no,
            r.sale_date,
            pSku,
            pBarcode,
            pName,
            Number(r.qty) || 0,
            r.unit || 'ชิ้น',
            Number(r.unit_price) || 0,
            Number(r.item_total) || 0,
            r.customer_name || 'ลูกค้าทั่วไป',
            r.cashier_name || 'ไม่ระบุ',
            Number(r.subtotal) || 0,
            Number(r.discount_amount) || 0,
            Number(r.tax_amount) || 0,
            Number(r.total) || 0,
            r.payment_method === 'cash' ? 'เงินสด' : 
              r.payment_method === 'card' ? 'บัตรเครดิต' : 
              r.payment_method === 'transfer' ? 'โอนเงิน' : 'QR PromptPay',
            r.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก',
            r.note || ''
          ]
        })

        XLSX.utils.sheet_add_aoa(ws, mapped, { origin: `A${rowCount + 1}` })
        rowCount += rows.length
        offset += limit

        // Yield execution to keep the app responsive
        await new Promise(resolve => setTimeout(resolve, 5))
      }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'รายงานสรุปยอดขาย')
      
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
      fs.writeFileSync(filePath, buffer)

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}

export function registerSettingsHandlers(db: Database.Database) {
  ipcMain.handle('settings:get', (_, key: string) => {
    try {
      const row = db.prepare('SELECT value FROM shop_settings WHERE key = ?').get(key) as { value: string } | undefined
      let val: any = row?.value
      if (val !== undefined) {
        if (BOOLEAN_KEYS.includes(key)) val = val === 'true' || val === '1'
        else if (NUMBER_KEYS.includes(key)) val = Number(val) || 0
      }
      return { success: true, data: val }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('settings:getAll', () => {
    try {
      const rows = db.prepare('SELECT key, value FROM shop_settings').all() as { key: string; value: string }[]
      const data: Record<string, string> = {}
      for (const row of rows) data[row.key] = row.value
      // Apply type casting middleware on Get
      const castedData = castSettingsGet(data)
      return { success: true, data: castedData }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('settings:set', (_, key: string, value: unknown, userId?: number) => {
    try {
      if (!checkAdmin(db, userId)) {
        return { success: false, error: 'Unauthorized: Admin privileges required.' }
      }

      // Garbage Collection: Delete old logo if shop_logo changes
      if (key === 'shop_logo') {
        const oldLogo = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_logo'").get() as { value: string } | undefined
        if (oldLogo && oldLogo.value && oldLogo.value !== value) {
          deleteImageFile(oldLogo.value)
        }
      }

      let saveVal = String(value)
      if (typeof value === 'boolean') saveVal = value ? 'true' : 'false'

      db.prepare('INSERT OR REPLACE INTO shop_settings (key, value) VALUES (?, ?)').run(key, saveVal)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('settings:setMultiple', (_, data: Record<string, unknown>, userId?: number) => {
    try {
      if (!checkAdmin(db, userId)) {
        return { success: false, error: 'Unauthorized: Admin privileges required.' }
      }

      // Garbage Collection: Delete old logo if shop_logo changes
      if (data.shop_logo) {
        const oldLogo = db.prepare("SELECT value FROM shop_settings WHERE key = 'shop_logo'").get() as { value: string } | undefined
        if (oldLogo && oldLogo.value && oldLogo.value !== data.shop_logo) {
          deleteImageFile(oldLogo.value)
        }
      }

      // Apply type casting middleware on Save
      const converted = castSettingsSave(data)
      const stmt = db.prepare('INSERT OR REPLACE INTO shop_settings (key, value) VALUES (?, ?)')
      const setAll = db.transaction((d: Record<string, string>) => {
        for (const [k, v] of Object.entries(d)) stmt.run(k, v)
      })
      setAll(converted)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('loyalty:getRules', () => {
    try {
      const rule = db.prepare('SELECT * FROM loyalty_rules WHERE is_active = 1 LIMIT 1').get()
      return { success: true, data: rule }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('loyalty:updateRules', (_, data: Record<string, unknown>) => {
    try {
      db.prepare('UPDATE loyalty_rules SET earn_per_baht = @earn_per_baht, redeem_per_baht = @redeem_per_baht, min_redeem = @min_redeem WHERE is_active = 1').run(data)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })
}

export function registerUserHandlers(db: Database.Database) {
  const bcrypt = require('bcryptjs')

  ipcMain.handle('users:getAll', () => {
    try {
      const users = db.prepare('SELECT id, username, name, role, permissions, is_active, created_at, last_login FROM users').all() as any[]
      const parsed = users.map(u => {
        try {
          u.permissions = JSON.parse(u.permissions || '[]')
        } catch {
          u.permissions = []
        }
        return u
      })
      return { success: true, data: parsed }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('users:login', async (_, username: string, password: string) => {
    try {
      const user = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as Record<string, unknown> | undefined
      if (!user) return { success: false, error: 'ไม่พบผู้ใช้งาน' }
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return { success: false, error: 'รหัสผ่านไม่ถูกต้อง' }
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id)
      const { password_hash, pin, ...safeUser } = user as { password_hash: unknown; pin: unknown; [key: string]: unknown }
      return { success: true, data: safeUser }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('users:verifyPin', (_, id: number, pin: string) => {
    try {
      const user = db.prepare('SELECT pin FROM users WHERE id = ?').get(id) as { pin: string } | undefined
      return { success: true, data: user?.pin === pin }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('users:create', async (_, data: Record<string, unknown>) => {
    try {
      const hash = await bcrypt.hash(data.password, 12)
      const result = db.prepare(`
        INSERT INTO users (username, password_hash, name, role, pin, permissions)
        VALUES (@username, @hash, @name, @role, @pin, @permissions)
      `).run({ ...data, hash, permissions: JSON.stringify(data.permissions || []) })
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('users:update', async (_, id: number, data: Record<string, unknown>) => {
    try {
      if (data.password) {
        data.password_hash = await bcrypt.hash(data.password, 12)
        delete data.password
      }
      if (data.permissions) data.permissions = JSON.stringify(data.permissions)
      const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
      db.prepare(`UPDATE users SET ${fields} WHERE id = @id`).run({ ...data, id })
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('users:delete', (_, id: number) => {
    try {
      db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })
}

export function registerSessionHandlers(db: Database.Database) {
  ipcMain.handle('sessions:getCurrent', () => {
    try {
      const session = db.prepare(`
        SELECT cs.*, u.name as user_name FROM cash_sessions cs
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE cs.status = 'open' ORDER BY cs.id DESC LIMIT 1
      `).get()
      return { success: true, data: session }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('sessions:open', (_, data: Record<string, unknown>) => {
    try {
      // Close any open sessions first
      db.prepare("UPDATE cash_sessions SET status = 'closed', close_time = CURRENT_TIMESTAMP WHERE status = 'open'").run()
      const result = db.prepare(`
        INSERT INTO cash_sessions (user_id, open_amount, status)
        VALUES (@user_id, @open_amount, 'open')
      `).run(data)
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('sessions:close', (_, data: Record<string, unknown>) => {
    try {
      const session = db.prepare("SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as Record<string, number> | undefined
      if (!session) return { success: false, error: 'ไม่มีกะที่เปิดอยู่' }
      const expected = (session.open_amount || 0) + (session.cash_sales || 0) - (session.total_void || 0)
      const diff = (data.close_amount as number) - expected
      db.prepare(`
        UPDATE cash_sessions SET 
          close_time = CURRENT_TIMESTAMP, close_amount = @close_amount,
          expected_amount = @expected, difference = @diff, note = @note, status = 'closed'
        WHERE id = @id
      `).run({ close_amount: data.close_amount, expected, diff, note: data.note || null, id: session.id })
      return { success: true, data: { expected, difference: diff } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('sessions:getAll', (_, filters: Record<string, unknown> = {}) => {
    try {
      let query = `
        SELECT cs.*, u.name as user_name FROM cash_sessions cs
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE 1=1
      `
      const params: any[] = []
      if (filters.from_date) {
        query += " AND DATE(cs.open_time) >= ?"
        params.push(filters.from_date)
      }
      if (filters.to_date) {
        query += " AND DATE(cs.open_time) <= ?"
        params.push(filters.to_date)
      }
      query += " ORDER BY cs.id DESC LIMIT 200"
      
      const sessions = db.prepare(query).all(...params)
      return { success: true, data: sessions }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('sessions:addTransaction', (_, data: Record<string, unknown>) => {
    try {
      const session = db.prepare("SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined
      if (!session) return { success: false, error: 'ไม่มีกะที่เปิดอยู่' }
      db.prepare(`
        INSERT INTO cash_transactions (session_id, type, amount, reason, user_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(session.id, data.type, data.amount, data.reason || null, data.user_id || null)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('sessions:getTransactions', (_, sessionId: number) => {
    try {
      const txns = db.prepare('SELECT * FROM cash_transactions WHERE session_id = ? ORDER BY created_at ASC').all(sessionId)
      return { success: true, data: txns }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('sessions:delete', (_, id: number) => {
    try {
      db.prepare('DELETE FROM cash_transactions WHERE session_id = ?').run(id)
      db.prepare('DELETE FROM cash_sessions WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sessions:exportExcel', async (_, filters: { from_date: string; to_date: string; filePath: string; userId: number }) => {
    try {
      // Allow Admin and Manager to export Excel
      const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(filters.userId) as { role: string } | undefined
      const isAuth = !!user && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'manager')
      if (!isAuth) {
        return { success: false, error: 'Unauthorized: Admin or Manager privileges required.' }
      }

      const { from_date, to_date, filePath } = filters
      const ws = XLSX.utils.json_to_sheet([])

      // Write Header
      const headers = [
        "กะที่",
        "วันที่/เวลาเปิดกะ",
        "วันที่/เวลาปิดกะ",
        "ชื่อพนักงานแคชเชียร์",
        "ยอดเงินทอนเริ่มต้น (บาท)",
        "ยอดขายรวม (บาท)",
        "ยอดขายเงินสด (บาท)",
        "ยอดขายบัตร (บาท)",
        "ยอดขายเงินโอน (บาท)",
        "ยอดขาย QR (บาท)",
        "ยอดส่งกะจริง (บาท)",
        "ยอดกะที่ควรมี (บาท)",
        "ผลต่าง (บาท)",
        "สถานะ",
        "หมายเหตุ"
      ]
      XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' })

      const sessions = db.prepare(`
        SELECT cs.*, u.name as user_name FROM cash_sessions cs
        LEFT JOIN users u ON cs.user_id = u.id
        WHERE DATE(cs.open_time) BETWEEN ? AND ?
        ORDER BY cs.id ASC
      `).all(from_date, to_date) as any[]

      const mapped = sessions.map(s => {
        const expected = (s.open_amount || 0) + (s.cash_sales || 0) - (s.total_void || 0)
        return [
          s.id,
          s.open_time,
          s.close_time || 'ยังไม่ปิดกะ',
          s.user_name || 'ไม่ระบุ',
          Number(s.open_amount) || 0,
          Number(s.total_sales) || 0,
          Number(s.cash_sales) || 0,
          Number(s.card_sales) || 0,
          Number(s.transfer_sales) || 0,
          Number(s.qr_sales) || 0,
          s.close_amount !== null ? Number(s.close_amount) : 'ยังไม่ปิดกะ',
          s.close_amount !== null ? Number(expected) : 'ยังไม่ปิดกะ',
          s.difference !== null ? Number(s.difference) : 'ยังไม่ปิดกะ',
          s.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว',
          s.note || ''
        ]
      })

      XLSX.utils.sheet_add_aoa(ws, mapped, { origin: 'A2' })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'รายงานประวัติกะ')
      
      const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' })
      fs.writeFileSync(filePath, buffer)

      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}

export function registerPromotionHandlers(db: Database.Database) {
  ipcMain.handle('promotions:getAll', () => {
    try {
      return { success: true, data: db.prepare('SELECT * FROM promotions ORDER BY id DESC').all() }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('promotions:validate', (_, code: string, cartTotal: number) => {
    try {
      const promo = db.prepare(`
        SELECT * FROM promotions WHERE code = ? AND is_active = 1
        AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
        AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
        AND (usage_limit IS NULL OR usage_count < usage_limit)
      `).get(code) as Record<string, unknown> | undefined

      if (!promo) return { success: false, error: 'คูปองไม่ถูกต้องหรือหมดอายุ' }
      if ((promo.min_purchase as number) > cartTotal) return { success: false, error: `ยอดซื้อขั้นต่ำ ${promo.min_purchase} บาท` }

      let discount = 0
      if (promo.type === 'percent_off') {
        discount = cartTotal * ((promo.discount_value as number) / 100)
        if (promo.max_discount) discount = Math.min(discount, promo.max_discount as number)
      } else if (promo.type === 'amount_off') {
        discount = promo.discount_value as number
      }

      return { success: true, data: { ...promo, calculated_discount: discount } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('promotions:create', (_, data: Record<string, unknown>) => {
    try {
      const result = db.prepare(`
        INSERT INTO promotions (name, type, code, discount_value, min_purchase, max_discount, apply_to, start_date, end_date, usage_limit, is_active)
        VALUES (@name, @type, @code, @discount_value, @min_purchase, @max_discount, @apply_to, @start_date, @end_date, @usage_limit, @is_active)
      `).run(data)
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('promotions:update', (_, id: number, data: Record<string, unknown>) => {
    try {
      const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
      db.prepare(`UPDATE promotions SET ${fields} WHERE id = @id`).run({ ...data, id })
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('promotions:delete', (_, id: number) => {
    try {
      db.prepare('DELETE FROM promotions WHERE id = ?').run(id)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })
}

export function registerSupplierHandlers(db: Database.Database) {
  ipcMain.handle('suppliers:getAll', () => {
    try {
      return { success: true, data: db.prepare('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC').all() }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('suppliers:create', (_, data: Record<string, unknown>) => {
    try {
      const lastS = db.prepare("SELECT code FROM suppliers ORDER BY id DESC LIMIT 1").get() as { code: string } | undefined
      const num = lastS?.code ? parseInt(lastS.code.replace('SUP', '')) + 1 : 1
      const code = `SUP${String(num).padStart(3, '0')}`
      const result = db.prepare(`
        INSERT INTO suppliers (code, name, contact_name, phone, email, address, tax_id, payment_terms, note)
        VALUES (@code, @name, @contact_name, @phone, @email, @address, @tax_id, @payment_terms, @note)
      `).run({ code, ...data })
      return { success: true, data: { id: result.lastInsertRowid, code } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('suppliers:update', (_, id: number, data: Record<string, unknown>) => {
    try {
      const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
      db.prepare(`UPDATE suppliers SET ${fields} WHERE id = @id`).run({ ...data, id })
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('suppliers:delete', (_, id: number) => {
    try {
      db.prepare('UPDATE suppliers SET is_active = 0 WHERE id = ?').run(id)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })
}

export function registerBackupHandlers(db: Database.Database, scheduleBackup: () => void) {
  const path = require('path')
  const fs = require('fs')
  const { app } = require('electron')

  ipcMain.handle('backup:create', () => {
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups')
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const backupPath = path.join(backupDir, `backup-${timestamp}.db`)
      db.backup(backupPath)
      return { success: true, data: { path: backupPath } }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('backup:list', () => {
    try {
      const backupDir = path.join(app.getPath('userData'), 'backups')
      if (!fs.existsSync(backupDir)) return { success: true, data: [] }
      const files = fs.readdirSync(backupDir)
        .filter((f: string) => f.endsWith('.db'))
        .map((f: string) => {
          const stat = fs.statSync(path.join(backupDir, f))
          return { name: f, path: path.join(backupDir, f), size: stat.size, date: stat.mtime }
        })
        .sort((a: { date: Date }, b: { date: Date }) => b.date.getTime() - a.date.getTime())
      return { success: true, data: files }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('backup:restore', (_, filePath: string) => {
    try {
      const dbPath = path.join(app.getPath('userData'), 'make-a-deal-pos.db')
      const bakPath = dbPath + '.bak'
      fs.copyFileSync(dbPath, bakPath)
      fs.copyFileSync(filePath, dbPath)
      return { success: true }
    } catch (error) { return { success: false, error: String(error) } }
  })

  ipcMain.handle('backup:setAutoBackup', (_: Electron.IpcMainInvokeEvent, settings: { backup_enabled?: boolean; backup_interval_hours?: number }) => {
    try {
      const upsert = db.prepare(`
        INSERT INTO shop_settings (key, value) VALUES (@key, @value)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `)
      if (settings.backup_enabled !== undefined) {
        upsert.run({ key: 'backup_enabled', value: String(settings.backup_enabled) })
      }
      if (settings.backup_interval_hours !== undefined) {
        upsert.run({ key: 'backup_interval_hours', value: String(settings.backup_interval_hours) })
      }
      scheduleBackup()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('backup:export-custom', async (_, targetDir: string) => {
    try {
      if (!targetDir) {
        return { success: false, error: 'โฟลเดอร์ปลายทางไม่ถูกต้อง' }
      }

      // Generate a dynamic clean folder name based on app.name
      const rawAppName = app.name || 'MakeADeal'
      const cleanAppName = rawAppName.replace(/[^a-zA-Z0-9_-]/g, '_')
      
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const second = String(now.getSeconds()).padStart(2, '0')
      const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`
      
      const exportDirName = `${cleanAppName}_Manual_Backup_${timestamp}`
      const fullExportPath = path.join(targetDir, exportDirName)
      
      // Guarantee Destination Directory exists
      fs.mkdirSync(fullExportPath, { recursive: true })
      
      // 1. Atomic Database copy using better-sqlite3 .backup API for active database safety
      const destDbPath = path.join(fullExportPath, 'make-a-deal-pos.db')
      await db.backup(destDbPath)
      
      // 2. Recursive Images copy using Node.js fs.cpSync
      const srcImagesDir = path.join(app.getPath('userData'), 'images')
      if (fs.existsSync(srcImagesDir)) {
        const destImagesDir = path.join(fullExportPath, 'images')
        fs.cpSync(srcImagesDir, destImagesDir, { recursive: true })
      }
      
      return { success: true, data: { path: fullExportPath } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('backup:sync-google-sheets', async () => {
    try {
      const urlRow = db.prepare("SELECT value FROM shop_settings WHERE key = 'google_sheet_url'").get() as { value: string } | undefined
      const googleSheetUrl = urlRow ? urlRow.value : ''
      if (!googleSheetUrl) {
        return { success: false, error: 'กรุณากรอกลิงก์ Google Sheets Web App ในการตั้งค่าก่อนทำการซิงก์ข้อมูล' }
      }
      if (!googleSheetUrl.startsWith('https://script.google.com/macros/s/')) {
        return { 
          success: false, 
          error: 'กรุณาใช้ลิงก์ Web App จาก Google Apps Script ที่สร้างตามคู่มือแนะนำ (ลิงก์ต้องขึ้นต้นด้วย https://script.google.com/macros/s/)' 
        }
      }

      // Query all unsynced sales where is_synced = 0 or is_synced IS NULL
      const sales = db.prepare("SELECT * FROM sales WHERE is_synced = 0 OR is_synced IS NULL LIMIT 100").all() as any[]
      if (sales.length === 0) {
        return { success: true, count: 0, message: 'ไม่มีข้อมูลยอดขายใหม่ที่ต้องซิงก์' }
      }

      const syncedSales: any[] = []
      for (const sale of sales) {
        let customerName = 'ลูกค้าทั่วไป'
        if (sale.customer_id) {
          const cust = db.prepare("SELECT name FROM customers WHERE id = ?").get(sale.customer_id) as { name: string } | undefined
          if (cust) customerName = cust.name
        }

        const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(sale.id) as any[]
        const itemsSummary = items.map(it => `${it.product_name} x${it.qty}`).join(', ')

        syncedSales.push({
          receipt_no: sale.receipt_no,
          sale_date: sale.sale_date,
          customer_name: customerName,
          subtotal: sale.subtotal,
          discount_amount: sale.discount_amount,
          tax_amount: sale.tax_amount,
          total: sale.total,
          payment_method: sale.payment_method,
          status: sale.status,
          points_earned: sale.points_earned,
          items_summary: itemsSummary
        })
      }

      const response = await fetch(googleSheetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_sales',
          sales: syncedSales
        }),
        redirect: 'follow'
      })

      if (!response.ok) {
        return { success: false, error: `Google Sheets Apps Script Respond Error: HTTP ${response.status}` }
      }

      const result = await response.json() as { success: boolean; error?: string }
      if (result && result.success) {
        const updateStmt = db.prepare("UPDATE sales SET is_synced = 1 WHERE id = ?")
        const transaction = db.transaction((salesToUpdate: any[]) => {
          for (const s of salesToUpdate) {
            updateStmt.run(s.id)
          }
        })
        transaction(sales)
        return { success: true, count: sales.length }
      } else {
        return { success: false, error: result.error || 'ระบบเซิร์ฟเวอร์ Google Apps Script ตอบกลับว่าไม่สำเร็จ' }
      }
    } catch (error) {
      return { success: false, error: `เครือข่ายอินเทอร์เน็ตมีปัญหา: ${String(error)}` }
    }
  })
}
