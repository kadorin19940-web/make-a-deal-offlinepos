import http from 'http'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { ipcMain } from 'electron'
import { Database } from 'better-sqlite3'

let serverInstance: http.Server | null = null
let serverPort: number = 8080
let serverIsRunning: boolean = false

// Scan all local IP addresses of the machine
export function getLocalIPAddresses(): string[] {
  const interfaces = os.networkInterfaces()
  const ips: string[] = []
  for (const name of Object.keys(interfaces)) {
    const ifaceList = interfaces[name]
    if (!ifaceList) continue
    for (const iface of ifaceList) {
      // IPv4 and not loopback
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address)
      }
    }
  }
  return ips
}

export function startLANServer(db: Database, port: number): { success: boolean; port?: number; error?: string } {
  if (serverIsRunning && serverInstance) {
    return { success: true, port: serverPort }
  }

  try {
    // Navigate correctly to the 'dist' directory containing the static HTML/JS/CSS assets
    // If process.resourcesPath is available (in packed app), find 'dist' sibling to 'dist-electron'
    const appDir = path.dirname(__dirname)
    const distPath = path.join(appDir, '../dist')

    serverInstance = http.createServer((req, res) => {
      // Set CORS Headers to allow cross-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

      if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
      }

      const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`)
      const pathname = parsedUrl.pathname

      // Route 1: GET /api/lan/products -> Fetch all active products
      if (pathname === '/api/lan/products' && req.method === 'GET') {
        try {
          const products = db.prepare("SELECT * FROM products WHERE is_active = 1").all()
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ success: true, data: products }))
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ success: false, error: String(err) }))
        }
        return
      }

      // Route 2: GET /api/lan/customers -> Fetch all customers
      if (pathname === '/api/lan/customers' && req.method === 'GET') {
        try {
          const customers = db.prepare("SELECT * FROM customers").all()
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ success: true, data: customers }))
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
          res.end(JSON.stringify({ success: false, error: String(err) }))
        }
        return
      }

      // Route 3: POST /api/lan/sales -> Receive sales from the tablet/iPad
      if (pathname === '/api/lan/sales' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', () => {
          try {
            const sale = JSON.parse(body)
            
            // Insert sale transaction into SQLite
            const stmt = db.prepare(`
              INSERT INTO sales (
                receipt_no, customer_id, user_id, subtotal, discount_amount, discount_percent,
                discount_type, coupon_code, tax_amount, tax_inclusive, service_charge, total,
                paid_amount, change_amount, payment_method, payment_details, status, note,
                ref_sale_id, points_earned, points_used, is_synced
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `)
            
            const info = stmt.run(
              sale.receipt_no,
              sale.customer_id || null,
              sale.user_id || 1,
              sale.subtotal,
              sale.discount_amount || 0,
              sale.discount_percent || 0,
              sale.discount_type || 'amount',
              sale.coupon_code || null,
              sale.tax_amount || 0,
              sale.tax_inclusive !== undefined ? sale.tax_inclusive : 1,
              sale.service_charge || 0,
              sale.total,
              sale.paid_amount || 0,
              sale.change_amount || 0,
              sale.payment_method || 'cash',
              sale.payment_details || null,
              sale.status || 'completed',
              sale.note || null,
              sale.ref_sale_id || null,
              sale.points_earned || 0,
              sale.points_used || 0
            )

            const saleId = info.lastInsertRowid

            // Insert sale items, deduct inventory stock
            if (Array.isArray(sale.items)) {
              const itemStmt = db.prepare(`
                INSERT INTO sale_items (
                  sale_id, product_id, variant_id, product_name, barcode, qty, unit, cost_price, unit_price, discount_amount, discount_percent, total, note
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `)
              for (const it of sale.items) {
                itemStmt.run(
                  saleId,
                  it.product_id || null,
                  it.variant_id || null,
                  it.product_name,
                  it.barcode || null,
                  it.qty,
                  it.unit || 'ชิ้น',
                  it.cost_price || 0,
                  it.unit_price,
                  it.discount_amount || 0,
                  it.discount_percent || 0,
                  it.total,
                  it.note || null
                )
                
                // Deduct stock from SQLite and generate movement logs
                if (it.product_id) {
                  db.prepare("UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?").run(it.qty, it.product_id)
                  db.prepare(`
                    INSERT INTO stock_movements (product_id, type, qty, reference, note)
                    VALUES (?, 'sale', ?, ?, 'ขายผ่านเครื่องลูกข่าย (LAN Client)')
                  `).run(it.product_id, -it.qty, sale.receipt_no)
                }
              }
            }

            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ success: true, data: { saleId } }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ success: false, error: String(err) }))
          }
        })
        return
      }

      // Serve static compiled assets
      let filePath = path.join(distPath, pathname === '/' ? 'index.html' : pathname)

      // Support React Router HTML5 History Fallback to index.html
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distPath, 'index.html')
      }

      const ext = path.extname(filePath).toLowerCase()
      const contentType = {
        '.html': 'text/html; charset=utf-8',
        '.js': 'text/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon'
      }[ext] || 'application/octet-stream'

      fs.readFile(filePath, (err, content) => {
        if (err) {
          res.writeHead(404)
          res.end('File not found')
        } else {
          res.writeHead(200, { 'Content-Type': contentType })
          res.end(content, 'utf-8')
        }
      })
    })

    serverInstance.listen(port, () => {
      console.log(`[LAN Server] HTTP Server running on port ${port}`)
      serverIsRunning = true
      serverPort = port
    })

    return { success: true, port }
  } catch (error) {
    return { success: false, error: String(error) }
  }
}

export function stopLANServer(): { success: boolean } {
  if (serverInstance && serverIsRunning) {
    try {
      serverInstance.close()
      serverInstance = null
      serverIsRunning = false
      console.log(`[LAN Server] HTTP Server stopped.`)
      return { success: true }
    } catch (error) {
      return { success: false }
    }
  }
  return { success: true }
}

export function getLANServerStatus(): { running: boolean; port: number } {
  return { running: serverIsRunning, port: serverPort }
}

export function registerLANServerHandlers(db: Database) {
  ipcMain.handle('lan-server:start', (_, port: number) => {
    return startLANServer(db, port)
  })

  ipcMain.handle('lan-server:stop', () => {
    return stopLANServer()
  })

  ipcMain.handle('lan-server:status', () => {
    return getLANServerStatus()
  })

  ipcMain.handle('lan-server:get-ips', () => {
    return getLocalIPAddresses()
  })
}
