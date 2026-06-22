// ==================== Core Types ====================

export interface Product {
  id: number
  barcode?: string
  sku?: string
  name: string
  name_en?: string
  description?: string
  category_id?: number
  category_name?: string
  category_color?: string
  category_icon?: string
  unit: string
  cost_price: number
  sell_price: number
  sell_price2?: number
  sell_price3?: number
  special_price?: number
  discount_percent?: number
  special_price_enabled?: number
  discount_enabled?: number
  price_schedules?: string
  stock_qty: number
  min_stock: number
  max_stock: number
  image_path?: string
  is_service: number
  is_active: number
  has_variants: number
  tax_rate: number
  created_at: string
  updated_at: string
  variants?: ProductVariant[]
}

export interface ProductVariant {
  id: number
  product_id: number
  name: string
  barcode?: string
  sku?: string
  sell_price?: number
  stock_qty: number
  is_active: number
}

export interface Category {
  id: number
  name: string
  name_en?: string
  color: string
  icon: string
  sort_order: number
  is_active: number
  created_at: string
}

export interface Customer {
  id: number
  code: string
  name: string
  phone?: string
  email?: string
  address?: string
  tax_id?: string
  customer_type: 'retail' | 'wholesale' | 'member' | 'vip'
  price_level: number
  credit_limit: number
  credit_days: number
  points: number
  total_spend: number
  discount_percent: number
  note?: string
  is_active: number
  created_at: string
}

export interface Supplier {
  id: number
  code: string
  name: string
  contact_name?: string
  phone?: string
  email?: string
  address?: string
  tax_id?: string
  payment_terms: number
  note?: string
  is_active: number
  created_at: string
}

export interface User {
  id: number
  username: string
  name: string
  role: 'admin' | 'manager' | 'cashier'
  pin?: string
  permissions: string[]
  is_active: number
  created_at: string
  last_login?: string
}

export interface Sale {
  id: number
  receipt_no: string
  sale_date: string
  customer_id?: number
  customer_name?: string
  user_id?: number
  cashier_name?: string
  subtotal: number
  discount_amount: number
  discount_percent: number
  discount_type: string
  coupon_code?: string
  tax_amount: number
  tax_inclusive: number
  service_charge: number
  total: number
  paid_amount: number
  change_amount: number
  payment_method: string
  payment_details?: string
  status: 'completed' | 'void' | 'refund' | 'hold'
  note?: string
  points_earned: number
  points_used: number
  created_at: string
  items?: SaleItem[]
}

export interface SaleItem {
  id?: number
  sale_id?: number
  product_id?: number
  variant_id?: number
  product_name: string
  barcode?: string
  qty: number
  unit: string
  cost_price: number
  unit_price: number
  discount_amount: number
  discount_percent: number
  total: number
  note?: string
}

export interface CartItem extends SaleItem {
  is_service?: number
  product?: Product
}

export interface HeldOrder {
  id: number
  table_name?: string
  customer_id?: number
  items: CartItem[]
  discount_amount: number
  note?: string
  created_at: string
  user_id?: number
}

export interface CashSession {
  id: number
  user_id: number
  user_name?: string
  open_time: string
  close_time?: string
  open_amount: number
  close_amount?: number
  expected_amount?: number
  difference?: number
  total_sales: number
  total_refunds: number
  total_void: number
  cash_sales: number
  card_sales: number
  transfer_sales: number
  qr_sales: number
  note?: string
  status: 'open' | 'closed'
}

export interface CashTransaction {
  id: number
  session_id: number
  type: 'in' | 'out'
  amount: number
  reason?: string
  user_id?: number
  created_at: string
}

export interface PurchaseOrder {
  id: number
  po_no: string
  supplier_id?: number
  supplier_name?: string
  order_date: string
  expected_date?: string
  status: 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled'
  subtotal: number
  discount: number
  tax: number
  total: number
  paid: number
  note?: string
  user_id?: number
  items?: PurchaseOrderItem[]
}

export interface PurchaseOrderItem {
  id?: number
  po_id?: number
  product_id?: number
  variant_id?: number
  product_name: string
  qty_ordered: number
  qty_received: number
  cost_price: number
  total: number
}

export interface StockMovement {
  id: number
  product_id: number
  product_name?: string
  barcode?: string
  variant_id?: number
  type: 'in' | 'out' | 'adjust' | 'transfer' | 'damage' | 'return'
  qty: number
  qty_before: number
  qty_after: number
  ref_type?: string
  ref_id?: number
  cost_price?: number
  note?: string
  user_id?: number
  created_at: string
}

export interface Promotion {
  id: number
  name: string
  type: 'coupon' | 'buy_x_get_y' | 'percent_off' | 'amount_off' | 'free_item'
  code?: string
  discount_value: number
  min_purchase: number
  max_discount?: number
  apply_to: string
  apply_ids?: string
  start_date?: string
  end_date?: string
  usage_limit?: number
  usage_count: number
  is_active: number
  calculated_discount?: number
  created_at: string
}

export interface LoyaltyRule {
  id: number
  name: string
  earn_per_baht: number
  redeem_per_baht: number
  min_redeem: number
  is_active: number
}

export interface ShopSettings {
  shop_name: string
  shop_name_en: string
  shop_address: string
  shop_phone: string
  shop_email: string
  shop_tax_id: string
  vat_enabled: string
  vat_rate: string
  vat_inclusive: string
  currency: string
  language: string
  timezone: string
  date_format: string
  receipt_header: string
  receipt_footer: string
  auto_print: string
  printer_size: string
  points_per_baht: string
  baht_per_point: string
  pin_lock_minutes: string
  backup_enabled: string
  backup_interval_hours: string
  low_stock_alert: string
  [key: string]: string
}

export interface DashboardStats {
  todaySales: { total_sales: number; bill_count: number }
  yesterdaySales: { total_sales: number }
  topProducts: { product_name: string; qty_sold: number; revenue: number }[]
  lowStock: { count: number }
  salesChart: { date: string; total: number; count: number }[]
  currentSession: CashSession | null
}

export interface IPCResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Payment types
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'qr' | 'mixed' | 'credit'

export interface PaymentDetail {
  method: PaymentMethod
  amount: number
  reference?: string
}
