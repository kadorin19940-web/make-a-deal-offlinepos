import { ipcMain, app } from 'electron'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

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

export function registerProductHandlers(db: Database.Database) {
  // Get all products with optional filters
  ipcMain.handle('products:getAll', (_, filters: Record<string, unknown> = {}) => {
    try {
      let query = `
        SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE 1=1
      `
      const params: unknown[] = []

      if (filters.category_id) {
        query += ' AND p.category_id = ?'
        params.push(filters.category_id)
      }
      if (filters.is_active !== undefined) {
        query += ' AND p.is_active = ?'
        params.push(filters.is_active)
      }
      if (filters.low_stock) {
        query += ' AND p.stock_qty <= p.min_stock AND p.is_service = 0'
      }
      if (filters.search) {
        query += ' AND (p.name LIKE ? OR p.barcode LIKE ? OR p.sku LIKE ?)'
        const s = `%${filters.search}%`
        params.push(s, s, s)
      }
      query += ' ORDER BY p.name ASC'

      const products = db.prepare(query).all(...params)
      return { success: true, data: products }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:getById', (_, id: number) => {
    try {
      const product = db.prepare(`
        SELECT p.*, c.name as category_name, c.color as category_color
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.id = ?
      `).get(id)
      const variants = db.prepare('SELECT * FROM product_variants WHERE product_id = ?').all(id)
      return { success: true, data: { ...product as object, variants } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:search', (_, query: string) => {
    try {
      const s = `%${query}%`
      const products = db.prepare(`
        SELECT p.*, c.name as category_name, c.color as category_color, c.icon as category_icon
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1 AND (p.name LIKE ? OR p.barcode = ? OR p.sku LIKE ?)
        LIMIT 20
      `).all(s, query, s)
      return { success: true, data: products }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:create', (_, data: Record<string, unknown>, userId?: number) => {
    try {
      if (!checkAdmin(db, userId)) {
        return { success: false, error: 'Unauthorized: Admin privileges required to create products.' }
      }

      // Default values to satisfy strict SQLite named bindings
      const defaultProduct = {
        barcode: null,
        sku: null,
        name: '',
        name_en: null,
        description: null,
        category_id: null,
        unit: 'ชิ้น',
        cost_price: 0,
        sell_price: 0,
        sell_price2: null,
        sell_price3: null,
        stock_qty: 0,
        min_stock: 0,
        max_stock: null,
        image_path: null,
        is_service: 0,
        is_active: 1,
        has_variants: 0,
        tax_rate: 7
      }

      const mergedData = { ...defaultProduct, ...data }

      const stmt = db.prepare(`
        INSERT INTO products (barcode, sku, name, name_en, description, category_id, unit,
          cost_price, sell_price, sell_price2, sell_price3, stock_qty, min_stock, max_stock,
          image_path, is_service, is_active, has_variants, tax_rate)
        VALUES (@barcode, @sku, @name, @name_en, @description, @category_id, @unit,
          @cost_price, @sell_price, @sell_price2, @sell_price3, @stock_qty, @min_stock, @max_stock,
          @image_path, @is_service, @is_active, @has_variants, @tax_rate)
      `)
      const result = stmt.run(mergedData)
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      console.error('products:create error:', error)
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:update', (_, id: number, data: Record<string, unknown>, userId?: number) => {
    try {
      if (!checkAdmin(db, userId)) {
        return { success: false, error: 'Unauthorized: Admin privileges required to update products.' }
      }

      // Garbage Collection: delete old image file if image_path is changing
      if (data.image_path !== undefined) {
        const oldProd = db.prepare('SELECT image_path FROM products WHERE id = ?').get(id) as { image_path?: string } | undefined
        if (oldProd && oldProd.image_path && oldProd.image_path !== data.image_path) {
          deleteImageFile(oldProd.image_path)
        }
      }

      // Filter only actual database columns to avoid SQL column mismatch errors
      const validColumns = [
        'barcode', 'sku', 'name', 'name_en', 'description', 'category_id', 'unit',
        'cost_price', 'sell_price', 'sell_price2', 'sell_price3', 'stock_qty', 'min_stock', 'max_stock',
        'image_path', 'is_service', 'is_active', 'has_variants', 'tax_rate',
        'special_price', 'discount_percent', 'special_price_enabled', 'discount_enabled', 'price_schedules'
      ]
      const updateData: Record<string, any> = {}
      for (const col of validColumns) {
        if (data[col] !== undefined) {
          updateData[col] = data[col]
        }
      }

      const fields = Object.keys(updateData).map(k => `${k} = @${k}`).join(', ')
      db.prepare(`UPDATE products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`).run({ ...updateData, id })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Realtime toggle for is_active (no admin DB re-check, uses session user role from preload)
  ipcMain.handle('products:toggleActive', (_, id: number, isActive: number, userId?: number) => {
    try {
      if (!checkAdmin(db, userId)) {
        return { success: false, error: 'Unauthorized: Admin privileges required.' }
      }
      db.prepare('UPDATE products SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(isActive, id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })


  ipcMain.handle('products:delete', (_, id: number, userId?: number) => {
    try {
      if (!checkAdmin(db, userId)) {
        return { success: false, error: 'Unauthorized: Admin privileges required to delete products.' }
      }

      // Garbage Collection: delete associated image file on soft delete
      const oldProd = db.prepare('SELECT image_path FROM products WHERE id = ?').get(id) as { image_path?: string } | undefined
      if (oldProd && oldProd.image_path) {
        deleteImageFile(oldProd.image_path)
      }

      db.prepare('UPDATE products SET is_active = 0, image_path = NULL WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:getLowStock', () => {
    try {
      const products = db.prepare(`
        SELECT p.*, c.name as category_name
        FROM products p
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active = 1 AND p.is_service = 0 AND p.stock_qty <= p.min_stock
        ORDER BY (p.stock_qty - p.min_stock) ASC
      `).all()
      return { success: true, data: products }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:updateStock', (_, id: number, qty: number) => {
    try {
      db.prepare('UPDATE products SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(qty, id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:importCSV', (_, data: Record<string, unknown>[]) => {
    try {
      const insertProduct = db.prepare(`
        INSERT OR REPLACE INTO products (barcode, sku, name, category_id, sell_price, cost_price, stock_qty, min_stock, unit)
        VALUES (@barcode, @sku, @name, @category_id, @sell_price, @cost_price, @stock_qty, @min_stock, @unit)
      `)
      const insertMany = db.transaction((items: Record<string, unknown>[]) => {
        for (const item of items) insertProduct.run(item)
      })
      insertMany(data)
      return { success: true, data: { count: data.length } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('products:exportCSV', () => {
    try {
      const products = db.prepare('SELECT * FROM products WHERE is_active = 1').all()
      return { success: true, data: products }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Categories
  ipcMain.handle('categories:getAll', () => {
    try {
      const categories = db.prepare('SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order ASC').all()
      return { success: true, data: categories }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('categories:create', (_, data: Record<string, unknown>) => {
    try {
      const merged = {
        name: '',
        name_en: null,
        color: '#22C55E',
        icon: '📦',
        sort_order: 0,
        ...data
      }
      const result = db.prepare(`
        INSERT INTO categories (name, name_en, color, icon, sort_order)
        VALUES (@name, @name_en, @color, @icon, @sort_order)
      `).run(merged)
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })


  ipcMain.handle('categories:update', (_, id: number, data: Record<string, unknown>) => {
    try {
      const fields = Object.keys(data).map(k => `${k} = @${k}`).join(', ')
      db.prepare(`UPDATE categories SET ${fields} WHERE id = @id`).run({ ...data, id })
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('categories:delete', (_, id: number) => {
    try {
      db.prepare('UPDATE categories SET is_active = 0 WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('categories:reorder', (_, ids: number[]) => {
    try {
      const update = db.prepare('UPDATE categories SET sort_order = ? WHERE id = ?')
      const updateAll = db.transaction((idList: number[]) => {
        idList.forEach((id, index) => update.run(index, id))
      })
      updateAll(ids)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
