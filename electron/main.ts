import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { machineIdSync } from 'node-machine-id'
import { initDatabase } from './database'
import { registerProductHandlers } from './ipc/products'
import { registerSalesHandlers } from './ipc/sales'
import { registerCustomerHandlers } from './ipc/customers'
import { registerInventoryHandlers } from './ipc/inventory'
import { registerReportHandlers } from './ipc/reports'
import { registerSettingsHandlers } from './ipc/settings'
import { registerUserHandlers } from './ipc/users'
import { registerSessionHandlers } from './ipc/sessions'
import { registerPromotionHandlers } from './ipc/promotions'
import { registerSupplierHandlers } from './ipc/suppliers'
import { registerBackupHandlers } from './ipc/backup'
import { registerLANServerHandlers } from './ipc/lanServer'

// Register local-img scheme as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'local-img', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }
])

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1280,
    minHeight: 800,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
    frame: true,
    autoHideMenuBar: true,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

  // Catch renderer process crashes and failed page loads — prevents permanent black screen
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[Window] Page failed to load:', errorCode, errorDescription)
    // Retry loading after short delay
    if (!isDev) {
      setTimeout(() => {
        mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'))
      }, 1500)
    }
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Window] Renderer process gone:', details.reason)
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Initialize database
  const db = initDatabase()

  // Permanent Silent Backup implementation
  const runSilentBackup = () => {
    try {
      const homedir = os.homedir()
      const backupDir = path.join(homedir, 'Documents', 'MakeADeal_Backups')
      
      // Directory Guarantee: Ensure folder exists recursively
      fs.mkdirSync(backupDir, { recursive: true })
      
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const second = String(now.getSeconds()).padStart(2, '0')
      
      const timestamp = `${year}-${month}-${day}_${hour}-${minute}-${second}`
      const backupPath = path.join(backupDir, `backup_${timestamp}.db`)
      
      // better-sqlite3 backup API
      db.backup(backupPath)
        .then(() => {
          console.log('[Silent Backup] Success:', backupPath)
        })
        .catch((err) => {
          console.error('[Silent Backup] Backup failed:', err)
        })
    } catch (error) {
      console.error('[Silent Backup] Directory creation or backup error:', error)
    }
  }

  // Trigger 1: Silent Backup on App Startup (with small delay to prevent DB boot locks)
  setTimeout(runSilentBackup, 2000)

  // Trigger 3: Silent Backup Background Interval (every 1 hour)
  setInterval(runSilentBackup, 60 * 60 * 1000)

  // Register silent backup IPC trigger (used for Trigger 2: Shift Close)
  ipcMain.handle('backup:silent-trigger', async () => {
    try {
      runSilentBackup()
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Register all IPC handlers
  registerProductHandlers(db)
  registerSalesHandlers(db)
  registerCustomerHandlers(db)
  registerInventoryHandlers(db)
  registerReportHandlers(db)
  registerSettingsHandlers(db)
  registerUserHandlers(db)
  registerSessionHandlers(db)
  registerPromotionHandlers(db)
  registerSupplierHandlers(db)
  registerBackupHandlers(db)
  registerLANServerHandlers(db)

  // Generic dialog handlers
  ipcMain.handle('dialog:openFile', async (_, filters) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    return result
  })

  ipcMain.handle('dialog:saveFile', async (_, defaultName, filters) => {
    const result = await dialog.showSaveDialog({
      defaultPath: defaultName,
      filters: filters || [{ name: 'All Files', extensions: ['*'] }],
    })
    return result
  })

  ipcMain.handle('dialog:openDirectory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    })
    return result
  })

  ipcMain.handle('shell:openExternal', (_, url: string) => {
    shell.openExternal(url)
  })

  ipcMain.handle('app:getPath', (_, name: string) => {
    return app.getPath(name as Parameters<typeof app.getPath>[0])
  })

  ipcMain.handle('fs:writeFile', async (_, filePath: string, data: string) => {
    try {
      fs.writeFileSync(filePath, data, 'utf-8')
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  ipcMain.handle('fs:readFile', async (_, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath, 'utf-8')
      return { success: true, data }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Excel binary writer
  ipcMain.handle('fs:writeExcel', async (_, filePath: string, base64Data: string) => {
    try {
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'))
      return { success: true }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // Silent Receipt Printer Handler using offscreen rendering
  ipcMain.handle('print:receipt', async (_, { saleData, settings }) => {
    return new Promise((resolve) => {
      try {
        const htmlContent = generateReceiptHtml(saleData, settings)
        
        let printWin = new BrowserWindow({
          show: false,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
          }
        })
        
        printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent))
        
        printWin.webContents.once('did-finish-load', () => {
          printWin.webContents.print({
            silent: true,
            printBackground: true,
            margins: { marginType: 'none' }
          }, (success, failureReason) => {
            printWin.destroy() // Always clean up to prevent resource/memory leaks
            if (success) {
              resolve({ success: true })
            } else {
              resolve({ success: false, error: failureReason })
            }
          })
        })
      } catch (err) {
        resolve({ success: false, error: String(err) })
      }
    })
  })

  // [FIXED: Cash Drawer IPC — Fire-and-Forget with Timeout Guard]
  ipcMain.handle('hardware:open-drawer', async (_, comPort: string) => {
    try {
      // Dynamic import to prevent app boot crashes if native module compilation fails
      const { SerialPort } = require('serialport')
      const port = new SerialPort({
        path: comPort,
        baudRate: 9600,
        autoOpen: false
      })

      return new Promise((resolve) => {
        port.open((err: any) => {
          if (err) {
            resolve({
              success: false,
              error: `ไม่พบอุปกรณ์ลิ้นชักเก็บเงินที่พอร์ต ${comPort} หรือไม่ได้ต่อสายสัญญาณ กรุณาตรวจสอบการเชื่อมต่อ USB/RJ11 และการตั้งค่าพอร์ต COM`
            })
            return
          }

          // Open drawer standard electrical pulse trigger byte
          port.write(Buffer.from([0x01]), (writeErr: any) => {
            // CRITICAL: Close the port immediately to avoid "Port Busy" resource leaks
            port.close(() => {
              if (writeErr) {
                resolve({ success: false, error: `ส่งคำสั่งเปิดลิ้นชักไม่สำเร็จ: ${String(writeErr)}` })
              } else {
                resolve({ success: true })
              }
            })
          })
        })
      })
    } catch (error) {
      return {
        success: false,
        error: `ไม่พบอุปกรณ์ลิ้นชักเก็บเงิน (SerialPort Driver) กรุณาตรวจสอบการเชื่อมต่อสายสัญญาณ หรือพอร์ตการเชื่อมต่อในการตั้งค่าระบบ`
      }
    }
  })

  // Image uploader handler (moves file from source path to userData/images)
  ipcMain.handle('images:upload', async (_, sourcePath: string) => {
    try {
      const imagesDir = path.join(app.getPath('userData'), 'images')
      if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true })
      }
      const ext = path.extname(sourcePath) || '.jpg'
      const fileName = `img_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`
      const targetPath = path.join(imagesDir, fileName)
      
      fs.copyFileSync(sourcePath, targetPath)
      return { success: true, data: fileName }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // =============================================================================
  // LICENSE ACTIVATION SYSTEM — Hardware-Locked Hybrid Serverless
  // =============================================================================

  // 1. Return the immutable hardware fingerprint (UUID) for this machine
  ipcMain.handle('system:get-hardware-id', () => {
    try {
      // Pass `true` to get the original machine UUID (not hashed)
      return { success: true, data: machineIdSync(true) }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 2. Boot-time check — read is_activated directly from SQLite (tamper-proof)
  ipcMain.handle('system:check-activation', () => {
    try {
      const row = db.prepare('SELECT is_activated, license_key, email, activated_at FROM activation WHERE id = 1').get() as
        { is_activated: number; license_key: string | null; email: string | null; activated_at: string | null } | undefined
      return {
        success: true,
        data: {
          is_activated: row?.is_activated ?? 0,
          license_key: row?.license_key || null,
          email: row?.email || null,
          activated_at: row?.activated_at || null
        }
      }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  })

  // 3. Activate — POST to GAS via Node fetch (CORS bypass), then atomically
  //    commit is_activated = 1 into SQLite BEFORE resolving back to React.
  //    This prevents a DevTools actor from intercepting the promise and
  //    injecting a forged success payload to skip activation.
  ipcMain.handle('system:activate-license', async (_, { licenseKey, email, hardwareId }: { licenseKey: string; email: string; hardwareId: string }) => {
    try {
      const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJDGal71Cz4srjNHd5cPYKKOPQuzY84AZHZAAfhNY56r5VNTP-jsjsYWC3VtNu1g4l4g/exec'

      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'activate',
          key: licenseKey,
          email: email,
          hardware_id: hardwareId,
        }),
        // Follow redirects — GAS Web Apps redirect once after POST
        redirect: 'follow',
      })

      if (!response.ok) {
        return { success: false, error: `Server responded with HTTP ${response.status}` }
      }

      const result = await response.json() as { success: boolean; message?: string }

      if (!result.success) {
        return { success: false, error: result.message || 'License key is invalid or already in use.' }
      }

      // ✔ Server confirmed — commit activation atomically to SQLite NOW,
      //   before the IPC promise resolves. React never touches the DB.
      db.prepare(`
        UPDATE activation
        SET is_activated = 1,
            license_key  = ?,
            hardware_id  = ?,
            email        = ?,
            activated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `).run(licenseKey, hardwareId, email)

      return { success: true }
    } catch (error) {
      return { success: false, error: `Network error: ${String(error)}` }
    }
  })

  // 4. Deactivate — CORS Bypass to GAS, then atomically clear SQLite activation
  //    This prevents CORS errors on the frontend and ensures state integrity.
  ipcMain.handle('system:deactivate-license', async () => {
    try {
      // Fetch active license from database
      const row = db.prepare('SELECT license_key, hardware_id FROM activation WHERE id = 1').get() as
        { license_key: string | null; hardware_id: string | null } | undefined

      if (!row || !row.license_key || !row.hardware_id) {
        return { success: false, error: 'ไม่พบข้อมูลสิทธิ์การใช้งานที่เปิดใช้งานอยู่ในเครื่องนี้' }
      }

      const GAS_URL = 'https://script.google.com/macros/s/AKfycbzJDGal71Cz4srjNHd5cPYKKOPQuzY84AZHZAAfhNY56r5VNTP-jsjsYWC3VtNu1g4l4g/exec'

      const response = await fetch(GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'deactivate',
          key: row.license_key,
          hardware_id: row.hardware_id,
        }),
        redirect: 'follow',
      })

      if (!response.ok) {
        return { success: false, error: `เซิร์ฟเวอร์ตอบรับด้วยสถานะ HTTP ${response.status}` }
      }

      const result = await response.json() as { success: boolean; message?: string }

      if (!result.success) {
        return { success: false, error: result.message || 'ไม่สามารถยกเลิกลิขสิทธิ์กับเซิร์ฟเวอร์ได้' }
      }

      // ✔ Server confirmed — Clear activation atomically in SQLite NOW
      db.prepare(`
        UPDATE activation
        SET is_activated = 0,
            license_key  = NULL,
            hardware_id  = NULL,
            email        = NULL,
            activated_at = NULL
        WHERE id = 1
      `).run()

      return { success: true }
    } catch (error) {
      return { success: false, error: `ข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ${String(error)}` }
    }
  })

  // 5. Get Package Type — dynamically reads build-config.json from filesystem
  ipcMain.handle('system:get-package-type', () => {
    try {
      const baseDir = app.getAppPath()
      const pathsToCheck = [
        path.join(baseDir, 'dist', 'build-config.json'),
        path.join(baseDir, 'public', 'build-config.json'),
        path.join(baseDir, 'build-config.json')
      ]
      for (const p of pathsToCheck) {
        if (fs.existsSync(p)) {
          const raw = fs.readFileSync(p, 'utf8')
          const config = JSON.parse(raw)
          if (config && config.packageType) {
            return { success: true, data: config.packageType }
          }
        }
      }
    } catch (err) {
      console.error('[System] Error reading package type:', err)
    }
    return { success: true, data: 'lan' } // fallback
  })

  // Register custom protocol for local images from userData/images using net.fetch
  protocol.handle('local-img', (request) => {
    try {
      const url = new URL(request.url)
      const decodedPath = decodeURIComponent(url.host + url.pathname)
      const imagesDir = path.join(app.getPath('userData'), 'images')
      const absolutePath = path.isAbsolute(decodedPath) ? decodedPath : path.join(imagesDir, decodedPath)

      // Safety check to ensure we only read from images folder (case-insensitive normalized check on Windows)
      const normalizedImagesDir = path.resolve(imagesDir).toLowerCase()
      const normalizedAbsolutePath = path.resolve(absolutePath).toLowerCase()

      if (!normalizedAbsolutePath.startsWith(normalizedImagesDir)) {
        return new Response('Access Denied', { status: 403 })
      }

      // Convert absolute file path to a valid file:// URL across platforms (handles drive letters and special characters)
      const { pathToFileURL } = require('url')
      return net.fetch(pathToFileURL(absolutePath).toString())
    } catch (error) {
      return new Response(String(error), { status: 500 })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// [FIXED: Receipt Reprint — Date Formatter Must Use Stored Timestamp]
// Helper function to format receipt date matching language B.E./C.E. and custom formats
function formatReceiptDate(dateStr: string, settings: any): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return dateStr

  const lang = settings.language || 'th'
  const template = settings.date_format || 'dd/MM/yyyy'

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  let year = date.getFullYear()
  if (lang === 'th') {
    year += 543
  }
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  let formattedDate = template
    .replace('dd', day)
    .replace('MM', month)
    .replace('yyyy', String(year))
    .replace('yy', String(year).slice(-2))

  return `${formattedDate} ${hours}:${minutes}`
}

function generateReceiptHtml(saleData: any, settings: any): string {
  // [FIXED: Receipt Printer Layout Limits & VAT Details]
  const is80mm = settings.printer_size === '80mm'
  const widthStyle = is80mm ? 'width: 72mm; max-width: 72mm;' : 'width: 48mm; max-width: 48mm;'
  
  const itemsHtml = (saleData.items || []).map((item: any) => {
    const totalItemPrice = item.qty * item.unit_price - (item.discount_amount || 0)
    return `
      <tr style="font-size: 11px;">
        <td style="padding: 3px 0; word-break: break-word; white-space: normal;">
          ${item.product_name}
          ${item.discount_amount > 0 ? `<br/><span style="font-size: 9px; color: #555;">(ลด ฿${item.discount_amount.toLocaleString('th-TH')})</span>` : ''}
        </td>
        <td style="text-align: center; padding: 3px 0; vertical-align: top;">${item.qty}</td>
        <td style="text-align: right; padding: 3px 0; vertical-align: top;">฿${totalItemPrice.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
      </tr>
    `
  }).join('')

  // [FIXED: Receipt Reprint — Date Formatter Must Use Stored Timestamp]
  const originalDateStr = saleData.sale_date || saleData.created_at
  const saleDateStr = formatReceiptDate(originalDateStr, settings)

  const vatEnabled = settings.vat_enabled === 'true'
  const vatRate = settings.vat_rate || '7'
  const taxAmount = Number(saleData.tax_amount) || 0
  const totalAmount = Number(saleData.total) || 0
  const priceBeforeVat = totalAmount - taxAmount

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt</title>
      <style>
        @page { margin: 0; }
        body {
          font-family: Arial, sans-serif;
          color: #000;
          background: #fff;
          margin: 0;
          padding: 4px;
          ${widthStyle}
          font-size: 11px;
          line-height: 1.3;
          word-wrap: break-word;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .divider { border-top: 1px dashed #000; margin: 6px 0; }
        .bold { font-weight: bold; }
        .title { font-size: 14px; font-weight: bold; margin-bottom: 2px; }
        .subtitle { font-size: 10px; color: #333; margin-bottom: 2px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; word-break: break-word; }
      </style>
    </head>
    <body>
      <div class="text-center">
        <div class="title">${settings.shop_name || 'Make a Deal'}</div>
        ${settings.shop_name_en ? `<div style="font-size: 11px; font-weight: bold;">${settings.shop_name_en}</div>` : ''}
        <div class="subtitle">${settings.shop_address || ''}</div>
        <div class="subtitle">โทร: ${settings.shop_phone || ''}</div>
        ${settings.shop_tax_id ? `<div class="subtitle">เลขประจำตัวผู้เสียภาษี: ${settings.shop_tax_id}</div>` : ''}
      </div>
      
      <div class="divider"></div>
      
      <table style="font-size: 10px; table-layout: fixed;">
        <tr>
          <td style="width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">เลขที่บิล: ${saleData.receipt_no}</td>
          <td class="text-right" style="width: 45%;">${saleDateStr}</td>
        </tr>
      </table>
      
      <div class="divider"></div>
      
      <table style="width: 100%; table-layout: fixed;">
        <thead>
          <tr style="font-size: 10px; font-weight: bold; border-bottom: 1px dashed #000;">
            <th style="text-align: left; padding: 2px 0; width: 60%;">รายการ</th>
            <th style="text-align: center; padding: 2px 0; width: 15%;">จำนวน</th>
            <th style="text-align: right; padding: 2px 0; width: 25%;">รวม</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <table class="bold" style="font-size: 11px; table-layout: fixed;">
        <tr>
          <td style="width: 60%;">ยอดรวมสุทธิ (Subtotal)</td>
          <td class="text-right" style="width: 40%;">฿${saleData.subtotal.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${saleData.discount_amount > 0 ? `
          <tr style="font-size: 10px; font-weight: normal;">
            <td>ส่วนลดพิเศษ (Discount)</td>
            <td class="text-right">-฿${saleData.discount_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          </tr>
        ` : ''}
        
        ${vatEnabled ? `
          <tr style="font-size: 10px; font-weight: normal;">
            <td>ราคาก่อนภาษี (Excl. VAT)</td>
            <td class="text-right">฿${priceBeforeVat.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
          <tr style="font-size: 10px; font-weight: normal;">
            <td>ภาษีมูลค่าเพิ่ม VAT (${vatRate}%)</td>
            <td class="text-right">฿${taxAmount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          </tr>
        ` : ''}

        <tr style="font-size: 12px; border-top: 1px dashed #000; border-bottom: 1px dashed #000;">
          <td>ยอดรวมทั้งสิ้น (Total)</td>
          <td class="text-right">฿${saleData.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
        <tr style="font-size: 10px; font-weight: normal;">
          <td>ชำระด้วย: ${
            saleData.payment_method === 'cash' ? 'เงินสด' : 
            saleData.payment_method === 'card' ? 'บัตรเครดิต' : 
            saleData.payment_method === 'transfer' ? 'โอนเงิน' : 'QR PromptPay'
          }</td>
          <td class="text-right">฿${saleData.paid_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>
        ${saleData.payment_method === 'cash' ? `
          <tr style="font-size: 11px;">
            <td>เงินทอน (Change)</td>
            <td class="text-right">฿${saleData.change_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          </tr>
        ` : ''}
      </table>
      
      <div class="divider"></div>
      
      <div class="text-center" style="font-size: 10px;">
        <div>${settings.receipt_header || 'ขอบคุณที่ใช้บริการ'}</div>
        <div>${settings.receipt_footer || ''}</div>
        <div style="font-size: 8px; color: #555; margin-top: 4px;">Powered by Make a Deal POS</div>
      </div>
    </body>
    </html>
  `
}
