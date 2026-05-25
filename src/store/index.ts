import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, ShopSettings, CashSession, CartItem, Customer, Promotion } from '../types'

// ============ Auth Store ============
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLocked: boolean
  login: (user: User) => void
  logout: () => void
  lock: () => void
  unlock: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLocked: false,
      login: (user) => set({ user, isAuthenticated: true, isLocked: false }),
      logout: () => set({ user: null, isAuthenticated: false, isLocked: false }),
      lock: () => set({ isLocked: true }),
      unlock: () => set({ isLocked: false }),
    }),
    { name: 'auth-store', partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }) }
  )
)

// ============ Settings Store ============
interface SettingsState {
  settings: Partial<ShopSettings>
  setSettings: (settings: Partial<ShopSettings>) => void
  getSetting: (key: string) => string
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      settings: {},
      setSettings: (settings) => set({ settings }),
      getSetting: (key) => get().settings[key] ?? '',
    }),
    { name: 'settings-store' }
  )
)

// ============ Session Store ============
interface SessionState {
  currentSession: CashSession | null
  setSession: (session: CashSession | null) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentSession: null,
      setSession: (session) => set({ currentSession: session }),
    }),
    { name: 'session-store' }
  )
)

// ============ Cart Store ============
interface CartState {
  items: CartItem[]
  customer: Customer | null
  discount: number
  discountType: 'amount' | 'percent'
  coupon: Promotion | null
  note: string
  addItem: (item: CartItem) => void
  updateItem: (index: number, updates: Partial<CartItem>) => void
  removeItem: (index: number) => void
  clearCart: () => void
  setCustomer: (customer: Customer | null) => void
  setDiscount: (amount: number, type: 'amount' | 'percent') => void
  setCoupon: (coupon: Promotion | null) => void
  setNote: (note: string) => void
  getSubtotal: () => number
  getDiscountAmount: () => number
  getTotal: () => number
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  discount: 0,
  discountType: 'amount',
  coupon: null,
  note: '',

  addItem: (item) => {
    const { items } = get()
    // Find existing item (same product_id + variant_id)
    const existingIdx = items.findIndex(
      (i) => i.product_id === item.product_id && i.variant_id === item.variant_id && !item.note
    )
    if (existingIdx >= 0 && !item.note) {
      const updated = [...items]
      updated[existingIdx] = {
        ...updated[existingIdx],
        qty: updated[existingIdx].qty + item.qty,
        total: (updated[existingIdx].qty + item.qty) * updated[existingIdx].unit_price,
      }
      set({ items: updated })
    } else {
      set({ items: [...items, item] })
    }
  },

  updateItem: (index, updates) => {
    const updated = [...get().items]
    updated[index] = { ...updated[index], ...updates }
    if (updates.qty !== undefined || updates.unit_price !== undefined) {
      const item = updated[index]
      item.total = item.qty * item.unit_price - item.discount_amount
    }
    set({ items: updated })
  },

  removeItem: (index) => {
    const updated = [...get().items]
    updated.splice(index, 1)
    set({ items: updated })
  },

  clearCart: () => set({
    items: [], customer: null, discount: 0, discountType: 'amount',
    coupon: null, note: ''
  }),

  setCustomer: (customer) => set({ customer }),
  setDiscount: (discount, discountType) => set({ discount, discountType }),
  setCoupon: (coupon) => set({ coupon }),
  setNote: (note) => set({ note }),

  getSubtotal: () => get().items.reduce((sum, item) => sum + item.total, 0),

  getDiscountAmount: () => {
    const { discount, discountType, coupon } = get()
    const subtotal = get().getSubtotal()
    let discountAmt = discountType === 'percent' ? subtotal * (discount / 100) : discount
    if (coupon?.calculated_discount) discountAmt += coupon.calculated_discount
    return Math.min(discountAmt, subtotal)
  },

  getTotal: () => {
    const subtotal = get().getSubtotal()
    const discountAmt = get().getDiscountAmount()
    return Math.max(subtotal - discountAmt, 0)
  },
}))

// ============ UI Store ============
interface UIState {
  sidebarOpen: boolean
  theme: 'dark' | 'light'
  setSidebarOpen: (open: boolean) => void
  toggleTheme: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
    }),
    { name: 'ui-store' }
  )
)
