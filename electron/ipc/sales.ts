import { ipcMain } from 'electron'
import Database from 'better-sqlite3'
import { format } from 'date-fns'

export function registerSalesHandlers(db: Database.Database) {
  ipcMain.handle('sales:generateReceiptNo', () => {
    try {
      const now = new Date()
      const dateStr = format(now, 'yyyyMMdd')
      const lastSale = db.prepare(`
        SELECT receipt_no FROM sales WHERE receipt_no LIKE ? ORDER BY id DESC LIMIT 1
      `).get(`RCP${dateStr}%`) as { receipt_no: string } | undefined

      let seq = 1
      if (lastSale) {
        const lastSeq = parseInt(lastSale.receipt_no.slice(-4))
        seq = lastSeq + 1
      }
      const receiptNo = `RCP${dateStr}${String(seq).padStart(4, '0')}`
      return { success: true, data: receiptNo }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:create', (_, data: Record<string, unknown>) => {
    try {
      const createSale = db.transaction(() => {
        // Create sale header
        const saleResult = db.prepare(`
          INSERT INTO sales (receipt_no, customer_id, user_id, subtotal, discount_amount, discount_percent,
            discount_type, coupon_code, tax_amount, tax_inclusive, total, paid_amount, change_amount,
            payment_method, payment_details, status, note, points_earned, points_used)
          VALUES (@receipt_no, @customer_id, @user_id, @subtotal, @discount_amount, @discount_percent,
            @discount_type, @coupon_code, @tax_amount, @tax_inclusive, @total, @paid_amount, @change_amount,
            @payment_method, @payment_details, @status, @note, @points_earned, @points_used)
        `).run({
          receipt_no: data.receipt_no,
          customer_id: data.customer_id || null,
          user_id: data.user_id || null,
          subtotal: data.subtotal,
          discount_amount: data.discount_amount || 0,
          discount_percent: data.discount_percent || 0,
          discount_type: data.discount_type || 'amount',
          coupon_code: data.coupon_code || null,
          tax_amount: data.tax_amount || 0,
          tax_inclusive: data.tax_inclusive !== false ? 1 : 0,
          total: data.total,
          paid_amount: data.paid_amount || 0,
          change_amount: data.change_amount || 0,
          payment_method: data.payment_method || 'cash',
          payment_details: data.payment_details ? JSON.stringify(data.payment_details) : null,
          status: 'completed',
          note: data.note || null,
          points_earned: data.points_earned || 0,
          points_used: data.points_used || 0,
        })

        const saleId = saleResult.lastInsertRowid

        // Insert sale items
        const items = data.items as Record<string, unknown>[]
        const insertItem = db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, variant_id, product_name, barcode, qty, unit,
            cost_price, unit_price, discount_amount, discount_percent, total, note)
          VALUES (@sale_id, @product_id, @variant_id, @product_name, @barcode, @qty, @unit,
            @cost_price, @unit_price, @discount_amount, @discount_percent, @total, @note)
        `)

        for (const item of items) {
          insertItem.run({
            sale_id: saleId,
            product_id: item.product_id || null,
            variant_id: item.variant_id || null,
            product_name: item.product_name,
            barcode: item.barcode || null,
            qty: item.qty,
            unit: item.unit || 'ชิ้น',
            cost_price: item.cost_price || 0,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            discount_percent: item.discount_percent || 0,
            total: item.total,
            note: item.note || null,
          })

          // Update stock if not a service
          if (item.product_id && !item.is_service) {
            const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number }
            const newQty = product.stock_qty - (item.qty as number)
            db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQty, item.product_id)

            // Record stock movement
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, ref_type, ref_id, note)
              VALUES (?, 'out', ?, ?, ?, 'sale', ?, 'ขายสินค้า')
            `).run(item.product_id, -(item.qty as number), product.stock_qty, newQty, saleId)
          }
        }

        // Update customer points and spend
        if (data.customer_id) {
          const pointsChange = (data.points_earned as number || 0) - (data.points_used as number || 0)
          db.prepare(`
            UPDATE customers SET 
              points = points + ?,
              total_spend = total_spend + ?
            WHERE id = ?
          `).run(pointsChange, data.total, data.customer_id)
        }

        // Update promotion usage
        if (data.coupon_code) {
          db.prepare('UPDATE promotions SET usage_count = usage_count + 1 WHERE code = ?').run(data.coupon_code)
        }

        // Update session totals
        const session = db.prepare("SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as { id: number } | undefined
        if (session) {
          const paymentMethod = data.payment_method as string
          let cashField = ''
          if (paymentMethod === 'cash') cashField = 'cash_sales = cash_sales + @total,'
          else if (paymentMethod === 'card') cashField = 'card_sales = card_sales + @total,'
          else if (paymentMethod === 'transfer') cashField = 'transfer_sales = transfer_sales + @total,'
          else if (paymentMethod === 'qr') cashField = 'qr_sales = qr_sales + @total,'

          db.prepare(`
            UPDATE cash_sessions SET 
              total_sales = total_sales + @total,
              ${cashField}
              total_sales = total_sales + @total
            WHERE id = @sessionId
          `).run({ total: data.total, sessionId: session.id })
        }

        return saleId
      })

      const saleId = createSale()
      return { success: true, data: { id: saleId } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:getAll', (_, filters: Record<string, unknown> = {}) => {
    try {
      let query = `
        SELECT s.*, c.name as customer_name, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE 1=1
      `
      const params: unknown[] = []

      if (filters.from_date) {
        query += ' AND DATE(s.sale_date) >= ?'
        params.push(filters.from_date)
      }
      if (filters.to_date) {
        query += ' AND DATE(s.sale_date) <= ?'
        params.push(filters.to_date)
      }
      if (filters.status) {
        query += ' AND s.status = ?'
        params.push(filters.status)
      }
      if (filters.customer_id) {
        query += ' AND s.customer_id = ?'
        params.push(filters.customer_id)
      }

      query += ' ORDER BY s.id DESC LIMIT 500'
      const sales = db.prepare(query).all(...params)
      return { success: true, data: sales }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:getById', (_, id: number) => {
    try {
      const sale = db.prepare(`
        SELECT s.*, c.name as customer_name, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE s.id = ?
      `).get(id)
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id)
      return { success: true, data: { ...sale as object, items } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:getToday', () => {
    try {
      const sales = db.prepare(`
        SELECT s.*, c.name as customer_name, u.name as cashier_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE DATE(s.sale_date) = DATE('now', 'localtime')
        AND s.status = 'completed'
        ORDER BY s.id DESC
      `).all()
      return { success: true, data: sales }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:void', (_, id: number, reason: string) => {
    try {
      const voidSale = db.transaction(() => {
        db.prepare("UPDATE sales SET status = 'void', note = ? WHERE id = ?").run(`ยกเลิก: ${reason}`, id)

        // Restore stock
        const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as {
          product_id: number; qty: number; cost_price: number
        }[]
        for (const item of items) {
          if (item.product_id) {
            const product = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number }
            const newQty = product.stock_qty + item.qty
            db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQty, item.product_id)
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, ref_type, ref_id, note)
              VALUES (?, 'in', ?, ?, ?, 'void', ?, ?)
            `).run(item.product_id, item.qty, product.stock_qty, newQty, id, `ยกเลิกบิล: ${reason}`)
          }
        }
      })
      voidSale()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:holdOrder', (_, data: Record<string, unknown>) => {
    try {
      const result = db.prepare(`
        INSERT INTO held_orders (table_name, customer_id, items, discount_amount, note, user_id)
        VALUES (@table_name, @customer_id, @items, @discount_amount, @note, @user_id)
      `).run({
        table_name: data.table_name || null,
        customer_id: data.customer_id || null,
        items: JSON.stringify(data.items),
        discount_amount: data.discount_amount || 0,
        note: data.note || null,
        user_id: data.user_id || null,
      })
      return { success: true, data: { id: result.lastInsertRowid } }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:getHeldOrders', () => {
    try {
      const orders = db.prepare('SELECT * FROM held_orders ORDER BY created_at DESC').all()
      return {
        success: true,
        data: (orders as { items: string }[]).map(o => ({ ...o, items: JSON.parse(o.items) }))
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('sales:deleteHeldOrder', (_, id: number) => {
    try {
      db.prepare('DELETE FROM held_orders WHERE id = ?').run(id)
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Pivot report query
  ipcMain.handle('sales:getSaleItemsReport', (_, filters: Record<string, any>) => {
    try {
      let query = `
        SELECT 
          si.id as sale_item_id,
          s.id as sale_id,
          s.receipt_no,
          s.sale_date,
          p.sku,
          si.product_name,
          si.qty,
          si.unit,
          si.unit_price,
          si.discount_amount,
          si.total,
          s.status,
          u.name as cashier_name
        FROM sale_items si
        JOIN sales s ON si.sale_id = s.id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN users u ON s.user_id = u.id
        WHERE 1=1
      `
      const params: any[] = []
      if (filters.from_date) {
        query += " AND DATE(s.sale_date) >= ?"
        params.push(filters.from_date)
      }
      if (filters.to_date) {
        query += " AND DATE(s.sale_date) <= ?"
        params.push(filters.to_date)
      }
      query += " ORDER BY s.sale_date DESC, si.id DESC"
      const items = db.prepare(query).all(...params)
      return { success: true, data: items }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Delete sale with stock restoration and cash session adjust
  ipcMain.handle('sales:delete', (_, id: number, userId?: number) => {
    try {
      // Check role: Only Admin and Manager
      const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(userId) as { role: string } | undefined
      const isAuthorized = !!user && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'manager')
      if (!isAuthorized) {
        return { success: false, error: 'สิทธิ์ไม่ถูกต้อง: เฉพาะ Admin หรือ Manager เท่านั้นที่สามารถลบรายการได้' }
      }

      const deleteTx = db.transaction(() => {
        const sale = db.prepare('SELECT total, payment_method FROM sales WHERE id = ?').get(id) as any
        if (!sale) return

        // 1. Revert stocks for all items
        const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id) as any[]
        for (const item of items) {
          if (item.product_id) {
            const prod = db.prepare('SELECT stock_qty, is_service FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number; is_service: number } | undefined
            if (prod && !prod.is_service) {
              const restoredQty = prod.stock_qty + item.qty
              db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(restoredQty, item.product_id)
              
              // Record stock movement
              db.prepare(`
                INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, ref_type, ref_id, note)
                VALUES (?, 'in', ?, ?, ?, 'void', ?, 'ลบใบเสร็จ: คืนยอดขาย')
              `).run(item.product_id, item.qty, prod.stock_qty, restoredQty, id)
            }
          }
        }

        // 2. Adjust active cash session if open
        const session = db.prepare("SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as any
        if (session) {
          let paymentField = ''
          if (sale.payment_method === 'cash') paymentField = 'cash_sales = cash_sales - @total,'
          else if (sale.payment_method === 'card') paymentField = 'card_sales = card_sales - @total,'
          else if (sale.payment_method === 'transfer') paymentField = 'transfer_sales = transfer_sales - @total,'
          else if (sale.payment_method === 'qr') paymentField = 'qr_sales = qr_sales - @total,'

          db.prepare(`
            UPDATE cash_sessions 
            SET total_sales = total_sales - @total,
                ${paymentField}
                total_sales = total_sales - @total
            WHERE id = @sessionId
          `).run({ total: sale.total, sessionId: session.id })
        }

        // 3. Delete from sales (ON DELETE CASCADE will clear sale_items)
        db.prepare('DELETE FROM sales WHERE id = ?').run(id)
      })

      deleteTx()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Update sale items, recalculate totals, adjust stock difference
  ipcMain.handle('sales:updateSale', (_, saleId: number, data: Record<string, any>, userId?: number) => {
    try {
      // Check role: Only Admin and Manager
      const user = db.prepare('SELECT role FROM users WHERE id = ? AND is_active = 1').get(userId) as { role: string } | undefined
      const isAuthorized = !!user && (user.role.toLowerCase() === 'admin' || user.role.toLowerCase() === 'manager')
      if (!isAuthorized) {
        return { success: false, error: 'สิทธิ์ไม่ถูกต้อง: เฉพาะ Admin หรือ Manager เท่านั้นที่สามารถแก้ไขรายการได้' }
      }

      const updateTx = db.transaction(() => {
        const sale = db.prepare('SELECT total, payment_method FROM sales WHERE id = ?').get(saleId) as any
        if (!sale) throw new Error('ไม่พบข้อมูลใบเสร็จที่ต้องการแก้ไข')

        // 1. Revert stocks for all original items in this sale
        const oldItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId) as any[]
        for (const item of oldItems) {
          if (item.product_id) {
            const prod = db.prepare('SELECT stock_qty, is_service FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number; is_service: number } | undefined
            if (prod && !prod.is_service) {
              const restoredQty = prod.stock_qty + item.qty
              db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(restoredQty, item.product_id)
              
              db.prepare(`
                INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, ref_type, ref_id, note)
                VALUES (?, 'in', ?, ?, ?, 'void', ?, 'แก้ไขบิล: ยกเลิกยอดเก่า')
              `).run(item.product_id, item.qty, prod.stock_qty, restoredQty, saleId)
            }
          }
        }

        // 2. Delete old items
        db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(saleId)

        // 3. Insert new items and deduct stocks
        const items = data.items as any[]
        const insertItem = db.prepare(`
          INSERT INTO sale_items (sale_id, product_id, variant_id, product_name, barcode, qty, unit,
            cost_price, unit_price, discount_amount, discount_percent, total, note)
          VALUES (@sale_id, @product_id, @variant_id, @product_name, @barcode, @qty, @unit,
            @cost_price, @unit_price, @discount_amount, @discount_percent, @total, @note)
        `)

        for (const item of items) {
          insertItem.run({
            sale_id: saleId,
            product_id: item.product_id || null,
            variant_id: item.variant_id || null,
            product_name: item.product_name,
            barcode: item.barcode || null,
            qty: item.qty,
            unit: item.unit || 'ชิ้น',
            cost_price: item.cost_price || 0,
            unit_price: item.unit_price,
            discount_amount: item.discount_amount || 0,
            discount_percent: item.discount_percent || 0,
            total: item.total,
            note: item.note || null,
          })

          // Deduct new stocks if not a service
          if (item.product_id && !item.is_service) {
            const prod = db.prepare('SELECT stock_qty FROM products WHERE id = ?').get(item.product_id) as { stock_qty: number }
            const newQty = prod.stock_qty - item.qty
            db.prepare('UPDATE products SET stock_qty = ? WHERE id = ?').run(newQty, item.product_id)
            
            db.prepare(`
              INSERT INTO stock_movements (product_id, type, qty, qty_before, qty_after, ref_type, ref_id, note)
              VALUES (?, 'out', ?, ?, ?, 'sale', ?, 'แก้ไขบิล: ยอดใหม่')
            `).run(item.product_id, -item.qty, prod.stock_qty, newQty, saleId)
          }
        }

        // 4. Update sale header
        db.prepare(`
          UPDATE sales 
          SET subtotal = @subtotal, 
              discount_amount = @discount_amount, 
              tax_amount = @tax_amount, 
              total = @total,
              paid_amount = @paid_amount,
              change_amount = @change_amount,
              payment_method = @payment_method,
              note = @note,
              sale_date = @sale_date,
              customer_id = @customer_id
          WHERE id = @id
        `).run({
          id: saleId,
          subtotal: data.subtotal,
          discount_amount: data.discount_amount || 0,
          tax_amount: data.tax_amount || 0,
          total: data.total,
          paid_amount: data.paid_amount || data.total,
          change_amount: data.change_amount || 0,
          payment_method: data.payment_method || 'cash',
          note: data.note || null,
          sale_date: data.sale_date,
          customer_id: data.customer_id || null
        })

        // 5. Update cash session totals if there is an active session
        const session = db.prepare("SELECT id FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1").get() as any
        if (session) {
          // Adjust totals: subtract old total, add new total
          const oldSaleTotal = sale.total
          const diffTotal = data.total - oldSaleTotal
          
          let oldPaymentField = ''
          if (sale.payment_method === 'cash') oldPaymentField = 'cash_sales = cash_sales - @oldTotal,'
          else if (sale.payment_method === 'card') oldPaymentField = 'card_sales = card_sales - @oldTotal,'
          else if (sale.payment_method === 'transfer') oldPaymentField = 'transfer_sales = transfer_sales - @oldTotal,'
          else if (sale.payment_method === 'qr') oldPaymentField = 'qr_sales = qr_sales - @oldTotal,'

          let newPaymentField = ''
          if (data.payment_method === 'cash') newPaymentField = 'cash_sales = cash_sales + @newTotal,'
          else if (data.payment_method === 'card') newPaymentField = 'card_sales = card_sales + @newTotal,'
          else if (data.payment_method === 'transfer') newPaymentField = 'transfer_sales = transfer_sales + @newTotal,'
          else if (data.payment_method === 'qr') newPaymentField = 'qr_sales = qr_sales + @newTotal,'

          db.prepare(`
            UPDATE cash_sessions 
            SET total_sales = total_sales - @oldTotal,
                ${oldPaymentField}
                total_sales = total_sales - @oldTotal
            WHERE id = @sessionId
          `).run({ oldTotal: oldSaleTotal, sessionId: session.id })

          db.prepare(`
            UPDATE cash_sessions 
            SET total_sales = total_sales + @newTotal,
                ${newPaymentField}
                total_sales = total_sales + @newTotal
            WHERE id = @sessionId
          `).run({ newTotal: data.total, sessionId: session.id })
        }
      })

      updateTx()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })
}
