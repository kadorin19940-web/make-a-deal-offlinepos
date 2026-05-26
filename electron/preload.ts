import { contextBridge, ipcRenderer } from 'electron'

// Type-safe IPC API exposed to renderer
const api = {
  // Products
  products: {
    getAll: (filters?: Record<string, unknown>) => ipcRenderer.invoke('products:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('products:getById', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('products:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('products:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('products:delete', id),
    search: (query: string) => ipcRenderer.invoke('products:search', query),
    importCSV: (data: Record<string, unknown>[]) => ipcRenderer.invoke('products:importCSV', data),
    exportCSV: () => ipcRenderer.invoke('products:exportCSV'),
    getLowStock: () => ipcRenderer.invoke('products:getLowStock'),
    updateStock: (id: number, qty: number) => ipcRenderer.invoke('products:updateStock', id, qty),
  },

  // Categories
  categories: {
    getAll: () => ipcRenderer.invoke('categories:getAll'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('categories:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('categories:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('categories:delete', id),
    reorder: (ids: number[]) => ipcRenderer.invoke('categories:reorder', ids),
  },

  // Sales
  sales: {
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('sales:create', data),
    getAll: (filters?: Record<string, unknown>) => ipcRenderer.invoke('sales:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('sales:getById', id),
    void: (id: number, reason: string) => ipcRenderer.invoke('sales:void', id, reason),
    refund: (id: number, items: Record<string, unknown>[]) => ipcRenderer.invoke('sales:refund', id, items),
    getToday: () => ipcRenderer.invoke('sales:getToday'),
    holdOrder: (data: Record<string, unknown>) => ipcRenderer.invoke('sales:holdOrder', data),
    getHeldOrders: () => ipcRenderer.invoke('sales:getHeldOrders'),
    deleteHeldOrder: (id: number) => ipcRenderer.invoke('sales:deleteHeldOrder', id),
    generateReceiptNo: () => ipcRenderer.invoke('sales:generateReceiptNo'),
  },

  // Customers
  customers: {
    getAll: (filters?: Record<string, unknown>) => ipcRenderer.invoke('customers:getAll', filters),
    getById: (id: number) => ipcRenderer.invoke('customers:getById', id),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('customers:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('customers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('customers:delete', id),
    search: (query: string) => ipcRenderer.invoke('customers:search', query),
    getHistory: (id: number) => ipcRenderer.invoke('customers:getHistory', id),
    adjustPoints: (id: number, amount: number, reason: string) => ipcRenderer.invoke('customers:adjustPoints', id, amount, reason),
  },

  // Inventory
  inventory: {
    getMovements: (filters?: Record<string, unknown>) => ipcRenderer.invoke('inventory:getMovements', filters),
    adjustStock: (data: Record<string, unknown>) => ipcRenderer.invoke('inventory:adjustStock', data),
    bulkAdjust: (items: Record<string, unknown>[]) => ipcRenderer.invoke('inventory:bulkAdjust', items),
    getPurchaseOrders: (filters?: Record<string, unknown>) => ipcRenderer.invoke('inventory:getPurchaseOrders', filters),
    createPO: (data: Record<string, unknown>) => ipcRenderer.invoke('inventory:createPO', data),
    updatePO: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('inventory:updatePO', id, data),
    receivePO: (id: number, items: Record<string, unknown>[]) => ipcRenderer.invoke('inventory:receivePO', id, items),
  },

  // Suppliers
  suppliers: {
    getAll: () => ipcRenderer.invoke('suppliers:getAll'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('suppliers:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('suppliers:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('suppliers:delete', id),
  },

  // Reports
  reports: {
    getSalesSummary: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getSalesSummary', filters),
    getSalesChart: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getSalesChart', filters),
    getTopProducts: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getTopProducts', filters),
    getTopCustomers: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getTopCustomers', filters),
    getInventoryValue: () => ipcRenderer.invoke('reports:getInventoryValue'),
    getVATReport: (filters: Record<string, unknown>) => ipcRenderer.invoke('reports:getVATReport', filters),
    getDashboardStats: () => ipcRenderer.invoke('reports:getDashboardStats'),
    getShiftSummary: (sessionId: number) => ipcRenderer.invoke('reports:getShiftSummary', sessionId),
    exportSalesExcel: (startDate: string, endDate: string, filePath: string, userId: number) => ipcRenderer.invoke('reports:exportSalesExcel', { from_date: startDate, to_date: endDate, filePath, userId }),
  },

  // Settings
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    set: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),
    setMultiple: (data: Record<string, unknown>) => ipcRenderer.invoke('settings:setMultiple', data),
  },

  // Users
  users: {
    getAll: () => ipcRenderer.invoke('users:getAll'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('users:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('users:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('users:delete', id),
    login: (username: string, password: string) => ipcRenderer.invoke('users:login', username, password),
    verifyPin: (id: number, pin: string) => ipcRenderer.invoke('users:verifyPin', id, pin),
  },

  // Cash Sessions
  sessions: {
    open: (data: Record<string, unknown>) => ipcRenderer.invoke('sessions:open', data),
    close: (data: Record<string, unknown>) => ipcRenderer.invoke('sessions:close', data),
    getCurrent: () => ipcRenderer.invoke('sessions:getCurrent'),
    getAll: (filters?: Record<string, unknown>) => ipcRenderer.invoke('sessions:getAll', filters),
    addTransaction: (data: Record<string, unknown>) => ipcRenderer.invoke('sessions:addTransaction', data),
    getTransactions: (sessionId: number) => ipcRenderer.invoke('sessions:getTransactions', sessionId),
  },

  // Promotions
  promotions: {
    getAll: () => ipcRenderer.invoke('promotions:getAll'),
    create: (data: Record<string, unknown>) => ipcRenderer.invoke('promotions:create', data),
    update: (id: number, data: Record<string, unknown>) => ipcRenderer.invoke('promotions:update', id, data),
    delete: (id: number) => ipcRenderer.invoke('promotions:delete', id),
    validate: (code: string, cartTotal: number) => ipcRenderer.invoke('promotions:validate', code, cartTotal),
  },

  // Loyalty
  loyalty: {
    getRules: () => ipcRenderer.invoke('loyalty:getRules'),
    updateRules: (data: Record<string, unknown>) => ipcRenderer.invoke('loyalty:updateRules', data),
  },

  // Backup
  backup: {
    create: () => ipcRenderer.invoke('backup:create'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    list: () => ipcRenderer.invoke('backup:list'),
    setAutoBackup: (config: Record<string, unknown>) => ipcRenderer.invoke('backup:setAutoBackup', config),
  },

  // Dialog
  dialog: {
    openFile: (filters?: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('dialog:openFile', filters),
    saveFile: (defaultName?: string, filters?: { name: string; extensions: string[] }[]) => ipcRenderer.invoke('dialog:saveFile', defaultName, filters),
    openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  },

  // Shell
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },

  // App
  app: {
    getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  },

  // FS
  fs: {
    writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeExcel: (filePath: string, base64Data: string) => ipcRenderer.invoke('fs:writeExcel', filePath, base64Data),
  },

  // Images
  images: {
    upload: (sourcePath: string) => ipcRenderer.invoke('images:upload', sourcePath),
  },

  // Hardware
  hardware: {
    openDrawer: (comPort: string) => ipcRenderer.invoke('hardware:open-drawer', comPort),
  },

  // License Activation System
  system: {
    getHardwareId: () => ipcRenderer.invoke('system:get-hardware-id'),
    checkActivation: () => ipcRenderer.invoke('system:check-activation'),
    activateLicense: (licenseKey: string, email: string, hardwareId: string) =>
      ipcRenderer.invoke('system:activate-license', { licenseKey, email, hardwareId }),
  },
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
