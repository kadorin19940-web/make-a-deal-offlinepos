import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import path from 'path'
import fs from 'fs'
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
