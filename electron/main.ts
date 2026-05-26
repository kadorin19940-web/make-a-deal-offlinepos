import { app, BrowserWindow, ipcMain, dialog, shell, protocol, net } from 'electron'
import path from 'path'
import fs from 'fs'
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
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0a0a0f',
    // vibrancy: 'dark' // macOS only,
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
    icon: path.join(__dirname, '../public/icon.png'),
    show: false,
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

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Initialize database
  const db = initDatabase()

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

  // Hardware Cash Drawer Integration via SerialPort (Standard 9600 baud open/pulse/close)
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
            resolve({ success: false, error: `Failed to open port: ${String(err)}` })
            return
          }

          // Open drawer standard electrical pulse trigger byte
          port.write(Buffer.from([0x01]), (writeErr: any) => {
            // CRITICAL: Close the port immediately to avoid "Port Busy" resource leaks
            port.close(() => {
              if (writeErr) {
                resolve({ success: false, error: `Write failed: ${String(writeErr)}` })
              } else {
                resolve({ success: true })
              }
            })
          })
        })
      })
    } catch (error) {
      return { success: false, error: `Hardware driver error: ${String(error)}` }
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
      const row = db.prepare('SELECT is_activated, license_key FROM activation WHERE id = 1').get() as
        { is_activated: number; license_key: string | null } | undefined
      return { success: true, data: { is_activated: row?.is_activated ?? 0 } }
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

  // Register custom protocol for local images from userData/images using net.fetch
  protocol.handle('local-img', (request) => {
    try {
      const url = new URL(request.url)
      const decodedPath = decodeURIComponent(url.host + url.pathname)
      const imagesDir = path.join(app.getPath('userData'), 'images')
      const absolutePath = path.isAbsolute(decodedPath) ? decodedPath : path.join(imagesDir, decodedPath)

      // Safety check to ensure we only read from images folder
      if (!absolutePath.startsWith(imagesDir)) {
        return new Response('Access Denied', { status: 403 })
      }

      return net.fetch(`file:///${absolutePath}`)
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
