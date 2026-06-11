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
  promotionsList: Promotion[]
  note: string
  addItem: (item: CartItem) => void
  updateItem: (index: number, updates: Partial<CartItem>) => void
  removeItem: (index: number) => void
  clearCart: () => void
  setCustomer: (customer: Customer | null) => void
  setDiscount: (amount: number, type: 'amount' | 'percent') => void
  setCoupon: (coupon: Promotion | null) => void
  setPromotionsList: (promotions: Promotion[]) => void
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
  promotionsList: [],
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
    coupon: null, promotionsList: [], note: ''
  }),

  setCustomer: (customer) => set({ customer }),
  setDiscount: (discount, discountType) => set({ discount, discountType }),
  setCoupon: (coupon) => set({ coupon }),
  setPromotionsList: (promotionsList) => set({ promotionsList }),
  setNote: (note) => set({ note }),

  getSubtotal: () => get().items.reduce((sum, item) => sum + item.total, 0),

  getDiscountAmount: () => {
    const { discount, discountType, coupon, promotionsList, items } = get()
    const subtotal = get().getSubtotal()
    
    // 1. Manual Discount (Inputted by Cashier)
    let discountAmt = discountType === 'percent' ? subtotal * (discount / 100) : discount
    
    // 2. Manual Coupon Discount (Validated Coupon)
    if (coupon?.calculated_discount) {
      discountAmt += coupon.calculated_discount
    }

    // 3. Automatic Promotions Engine (Auto-applying discounts)
    let autoDiscountAmt = 0
    if (promotionsList && promotionsList.length > 0 && items.length > 0) {
      const now = new Date()
      // Filter active, automatic promotions (where code is null, empty, or starts with 'AUTO_')
      const autoPromos = promotionsList.filter(p =>
        p.is_active === 1 &&
        (!p.code || p.code.trim() === '' || p.code.startsWith('AUTO_')) &&
        (!p.start_date || new Date(p.start_date) <= now) &&
        (!p.end_date || new Date(p.end_date) >= now) &&
        (!p.usage_limit || p.usage_count < p.usage_limit)
      )

      for (const promo of autoPromos) {
        if (promo.min_purchase && subtotal < promo.min_purchase) continue

        let promoDiscount = 0
        if (promo.apply_to === 'all') {
          if (promo.type === 'percent_off') {
            promoDiscount = subtotal * (promo.discount_value / 100)
          } else if (promo.type === 'amount_off') {
            promoDiscount = promo.discount_value
          }
        } else {
          // Specific categories or products
          let targetIds: number[] = []
          try {
            targetIds = JSON.parse(promo.apply_ids || '[]')
          } catch {
            targetIds = String(promo.apply_ids).split(',').map(Number).filter(n => !isNaN(n))
          }

          if (targetIds.length > 0) {
            const matchingItems = items.filter(item => {
              if (promo.apply_to === 'product') {
                return targetIds.includes(item.product_id ?? 0)
              } else if (promo.apply_to === 'category') {
                return targetIds.includes(item.product?.category_id ?? 0)
              }
              return false
            })

            const matchingSubtotal = matchingItems.reduce((sum, item) => sum + (item.qty * item.unit_price), 0)
            if (matchingSubtotal > 0) {
              if (promo.type === 'percent_off') {
                promoDiscount = matchingSubtotal * (promo.discount_value / 100)
              } else if (promo.type === 'amount_off') {
                promoDiscount = promo.discount_value
              }
            }
          }
        }

        if (promo.max_discount && promoDiscount > promo.max_discount) {
          promoDiscount = promo.max_discount
        }
        autoDiscountAmt += promoDiscount
      }
    }

    discountAmt += autoDiscountAmt
    return Math.min(discountAmt, subtotal)
  },

  getTotal: () => {
    const subtotal = get().getSubtotal()
    const discountAmt = get().getDiscountAmount()
    return Math.max(subtotal - discountAmt, 0)
  },
}))

// ============ UI Store ============
// [FIXED: POS Layout Swap — Minimum Width Guard]
interface UIState {
  sidebarOpen: boolean
  theme: 'dark' | 'light'
  cartOnRight: boolean
  setSidebarOpen: (open: boolean) => void
  toggleTheme: () => void
  setCartOnRight: (val: boolean) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      theme: 'dark',
      cartOnRight: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setCartOnRight: (cartOnRight) => set({ cartOnRight }),
    }),
    { name: 'ui-store' }
  )
)
