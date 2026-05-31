import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Plus, Minus, Trash2, UserPlus,
  ShoppingBag, X, Tag, RotateCcw,
  Zap, CreditCard, Banknote, Smartphone, Package,
  ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useCartStore, useAuthStore, useSettingsStore, useSessionStore } from '../../store'
import type { Product, Category, Customer, CartItem, Promotion } from '../../types'
import PaymentModal from './PaymentModal'
import CustomerSearchModal from './CustomerSearchModal'

// Detect electron or browser
const api = (window as unknown as { api?: unknown }).api as {
  products: {
    getAll: (f?: unknown) => Promise<{ success: boolean; data?: Product[] }>
    search: (q: string) => Promise<{ success: boolean; data?: Product[] }>
  }
  categories: {
    getAll: () => Promise<{ success: boolean; data?: Category[] }>
  }
  promotions: {
    getAll: () => Promise<{ success: boolean; data?: Promotion[] }>
    validate: (code: string, total: number) => Promise<{ success: boolean; data?: Promotion; error?: string }>
  }
} | undefined

export default function POSPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [showPayment, setShowPayment] = useState(false)
  const [showCustomerSearch, setShowCustomerSearch] = useState(false)
  const [couponCode, setCouponCode] = useState('')
  const [showCouponInput, setShowCouponInput] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const {
    items, customer, discount, discountType, coupon, note,
    addItem, updateItem, removeItem, clearCart, setCustomer,
    setDiscount, setCoupon, setPromotionsList, setNote, getSubtotal, getDiscountAmount, getTotal
  } = useCartStore()

  const { user } = useAuthStore()
  const { settings } = useSettingsStore()
  const { currentSession, setSession } = useSessionStore()

  // Session check - Force shift to be open before using POS
  useEffect(() => {
    const checkActiveSession = async () => {
      if ((window as any).api?.sessions) {
        const res = await (window as any).api.sessions.getCurrent()
        if (res.success && res.data) {
          setSession(res.data)
        } else {
          setSession(null)
          toast.error('กรุณาเปิดกะทำงานก่อนเข้าใช้งานหน้าขาย!', { duration: 4000 })
          navigate('/sessions')
        }
      } else {
        if (!currentSession) {
          toast.error('กรุณาเปิดกะทำงานก่อนเข้าใช้งานหน้าขาย!', { duration: 4000 })
          navigate('/sessions')
        }
      }
    }
    checkActiveSession()
  }, [navigate])

  // Load data
  useEffect(() => {
    loadCategories()
    loadProducts()
    loadPromotions()
  }, [])

  const loadPromotions = async () => {
    if (api && api.promotions && api.promotions.getAll) {
      const res = await api.promotions.getAll()
      if (res.success && res.data) {
        setPromotionsList(res.data)
      }
    }
  }

  useEffect(() => {
    filterProducts()
  }, [products, selectedCategory, searchQuery])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F1') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'F2') { e.preventDefault(); if (items.length > 0) setShowPayment(true) }
      if (e.key === 'Escape') { setShowPayment(false); setShowCustomerSearch(false) }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [items.length])

  // Global Barcode Scanner Listener
  useEffect(() => {
    let buffer = ''
    let lastKeyTime = Date.now()

    const handleGlobalScan = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }

      const currentTime = Date.now()
      if (currentTime - lastKeyTime > 100) {
        buffer = '' // Reset if typing delay is too long (human typing)
      }
      lastKeyTime = currentTime

      if (e.key === 'Enter') {
        if (buffer.trim().length > 1) {
          e.preventDefault()
          handleBarcodeScanned(buffer.trim())
          buffer = ''
        }
      } else if (e.key.length === 1) {
        buffer += e.key
      }
    }

    window.addEventListener('keydown', handleGlobalScan)
    return () => window.removeEventListener('keydown', handleGlobalScan)
  }, [products])

  const handleBarcodeScanned = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.sku === barcode)
    if (product) {
      addToCart(product)
      toast.success(`สแกนบาร์โค้ดสำเร็จ: ${product.name}`)
    } else {
      toast.error(`ไม่พบสินค้าสำหรับบาร์โค้ด: ${barcode}`)
    }
  }

  const loadCategories = async () => {
    if (!api) {
      // Mock data for browser
      setCategories([
        { id: 1, name: 'อาหารและเครื่องดื่ม', icon: '🍔', color: '#F59E0B', sort_order: 1, is_active: 1, created_at: '' },
        { id: 2, name: 'เครื่องใช้ไฟฟ้า', icon: '📱', color: '#3B82F6', sort_order: 2, is_active: 1, created_at: '' },
        { id: 3, name: 'เครื่องแต่งกาย', icon: '👕', color: '#EC4899', sort_order: 3, is_active: 1, created_at: '' },
        { id: 4, name: 'สุขภาพและความงาม', icon: '💄', color: '#8B5CF6', sort_order: 4, is_active: 1, created_at: '' },
        { id: 5, name: 'บริการ', icon: '⚡', color: '#22C55E', sort_order: 5, is_active: 1, created_at: '' },
      ])
      return
    }
    const res = await api.categories.getAll()
    if (res.success && res.data) setCategories(res.data)
  }

  const loadProducts = async () => {
    if (!api) {
      // Mock products
      setProducts([
        { id: 1, name: 'กาแฟอเมริกาโน่', sell_price: 85, cost_price: 25, stock_qty: 100, min_stock: 10, max_stock: 200, unit: 'แก้ว', category_id: 1, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110150', sku: 'P001', category_color: '#F59E0B', category_icon: '🍔' },
        { id: 2, name: 'ชาเย็น', sell_price: 65, cost_price: 15, stock_qty: 150, min_stock: 20, max_stock: 300, unit: 'แก้ว', category_id: 1, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110151', sku: 'P002', category_color: '#F59E0B', category_icon: '🍔' },
        { id: 3, name: 'น้ำส้มคั้นสด', sell_price: 75, cost_price: 20, stock_qty: 80, min_stock: 10, max_stock: 150, unit: 'แก้ว', category_id: 1, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110152', sku: 'P003', category_color: '#F59E0B', category_icon: '🍔' },
        { id: 4, name: 'สมาร์ทโฟน X12', sell_price: 15900, cost_price: 10000, stock_qty: 25, min_stock: 3, max_stock: 50, unit: 'เครื่อง', category_id: 2, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110154', sku: 'P004', category_color: '#3B82F6', category_icon: '📱' },
        { id: 5, name: 'หูฟัง BT Pro', sell_price: 2990, cost_price: 1200, stock_qty: 40, min_stock: 5, max_stock: 100, unit: 'ชิ้น', category_id: 2, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110155', sku: 'P005', category_color: '#3B82F6', category_icon: '📱' },
        { id: 6, name: 'สายชาร์จ USB-C', sell_price: 390, cost_price: 80, stock_qty: 200, min_stock: 20, max_stock: 500, unit: 'เส้น', category_id: 2, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110156', sku: 'P006', category_color: '#3B82F6', category_icon: '📱' },
        { id: 7, name: 'เสื้อยืด Cotton', sell_price: 299, cost_price: 90, stock_qty: 100, min_stock: 10, max_stock: 200, unit: 'ตัว', category_id: 3, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110157', sku: 'P007', category_color: '#EC4899', category_icon: '👕' },
        { id: 8, name: 'ครีมบำรุงผิว SPF50', sell_price: 450, cost_price: 150, stock_qty: 80, min_stock: 10, max_stock: 150, unit: 'ขวด', category_id: 4, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110159', sku: 'P008', category_color: '#8B5CF6', category_icon: '💄' },
        { id: 9, name: 'บริการล้างรถ', sell_price: 300, cost_price: 50, stock_qty: 0, min_stock: 0, max_stock: 0, unit: 'ครั้ง', category_id: 5, is_service: 1, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110161', sku: 'P009', category_color: '#22C55E', category_icon: '⚡' },
        { id: 10, name: 'น้ำเปล่า 1.5L', sell_price: 15, cost_price: 5, stock_qty: 500, min_stock: 50, max_stock: 1000, unit: 'ขวด', category_id: 1, is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '', barcode: '8850006110162', sku: 'P010', category_color: '#F59E0B', category_icon: '🍔' },
      ])
      return
    }
    const res = await api.products.getAll({ is_active: 1 })
    if (res.success && res.data) setProducts(res.data)
  }

  const filterProducts = useCallback(() => {
    let filtered = products
    if (selectedCategory) filtered = filtered.filter(p => p.category_id === selectedCategory)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode?.includes(searchQuery)) ||
        (p.sku?.toLowerCase().includes(q))
      )
    }
    setFilteredProducts(filtered)
  }, [products, selectedCategory, searchQuery])

  const addToCart = (product: Product) => {
    if (!product.is_service && product.stock_qty <= 0) {
      toast.error('สินค้าหมด')
      return
    }
    const price = customer?.price_level === 2 ? (product.sell_price2 ?? product.sell_price)
      : customer?.price_level === 3 ? (product.sell_price3 ?? product.sell_price)
      : product.sell_price

    const item: CartItem = {
      product_id: product.id,
      product_name: product.name,
      barcode: product.barcode,
      qty: 1,
      unit: product.unit,
      cost_price: product.cost_price,
      unit_price: price,
      discount_amount: 0,
      discount_percent: 0,
      total: price,
      is_service: product.is_service,
      product: product
    }
    addItem(item)
    toast.success(`เพิ่ม ${product.name}`, { duration: 1200 })
  }

  const applyCoupon = async () => {
    if (!couponCode.trim()) return
    try {
      if (!api) {
        // Mock coupon
        if (couponCode === 'WELCOME10') {
          toast.success('ใช้คูปอง WELCOME10 ลด 10%')
          setCoupon({
            id: 1, name: 'ส่วนลดต้อนรับ', type: 'percent_off', code: 'WELCOME10',
            discount_value: 10, min_purchase: 500, apply_to: 'all',
            usage_count: 5, is_active: 1, created_at: '',
            calculated_discount: getSubtotal() * 0.1
          })
        } else {
          toast.error('คูปองไม่ถูกต้อง')
        }
        return
      }
      const res = await api.promotions.validate(couponCode, getSubtotal())
      if (res.success && res.data) {
        setCoupon(res.data)
        toast.success(`ใช้คูปองสำเร็จ ลด ฿${res.data.calculated_discount?.toLocaleString()}`)
        setShowCouponInput(false)
      } else {
        toast.error(res.error || 'คูปองไม่ถูกต้อง')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const subtotal = getSubtotal()
  const discountAmt = getDiscountAmount()
  const total = getTotal()
  const vatRate = parseFloat(settings.vat_rate || '7')
  const vatInclusive = settings.vat_inclusive !== 'false'
  const taxAmount = vatInclusive ? total * (vatRate / (100 + vatRate)) : total * (vatRate / 100)

  const formatMoney = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      background: 'linear-gradient(135deg, #08090e 0%, #0a0d14 50%, #080e0b 100%)',
      fontFamily: 'Sarabun, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ===== LEFT: Cart (55%) ===== */}
      <div style={{
        width: '55%', height: '100%',
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Cart Header */}
        <div style={{
          padding: '14px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(8,10,15,0.5)',
          backdropFilter: 'blur(20px)',
        }}>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '6px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              marginRight: 4,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
              e.currentTarget.style.color = '#fff'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
            }}
            title="กลับหน้าหลัก (Back to Dashboard)"
          >
            <ArrowLeft size={16} />
          </button>

          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Zap size={16} color="#000" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            Make a Deal POS
          </span>

          <div style={{ flex: 1 }} />

          {/* Manual Drawer Trigger (Admin Only) */}
          {user?.role?.toLowerCase() === 'admin' && (
            <button
              onClick={async () => {
                try {
                  const comPort = settings.cash_drawer_port || 'COM1'
                  const res = await (window as any).api.hardware.openDrawer(comPort)
                  if (res.success) {
                    toast.success('เปิดลิ้นชักเงินสด (Manual) สำเร็จ')
                  } else {
                    toast.error(`เปิดลิ้นชักล้มเหลว: ${res.error}`)
                  }
                } catch (e) {
                  toast.error(`ข้อผิดพลาดฮาร์ดแวร์: ${String(e)}`)
                }
              }}
              className="px-3 py-1.5 bg-amber-950/40 border border-amber-500/30 hover:border-amber-500 text-amber-500 hover:text-amber-400 hover:bg-amber-950/60 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 shadow-md shadow-amber-950/20"
            >
              <Zap size={12} />
              เปิดลิ้นชักเงินสด
            </button>
          )}

          {/* Customer */}
          <button
            onClick={() => setShowCustomerSearch(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px',
              background: customer ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${customer ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 8, cursor: 'pointer',
              color: customer ? '#4ade80' : 'rgba(255,255,255,0.5)',
              fontSize: 12, fontFamily: 'inherit',
              transition: 'all 0.2s',
            }}
          >
            <UserPlus size={13} />
            {customer ? customer.name : 'เลือกลูกค้า'}
            {customer && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>✦{customer.points.toLocaleString()}</span>}
          </button>

          {/* Hold / Clear */}
          <button
            onClick={() => { clearCart(); toast('ล้างตะกร้าแล้ว') }}
            style={{
              padding: '6px 10px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8,
              color: '#fca5a5', cursor: 'pointer', fontSize: 12,
              display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
            }}
          >
            <RotateCcw size={13} />
            ล้าง
          </button>
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
          {items.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', height: '100%', gap: 12,
              color: 'rgba(255,255,255,0.2)',
            }}>
              <ShoppingBag size={48} strokeWidth={1} />
              <p style={{ fontSize: 14, margin: 0 }}>ตะกร้าว่าง · สแกนหรือเลือกสินค้า</p>
              <p style={{ fontSize: 12, margin: 0, color: 'rgba(255,255,255,0.15)' }}>F1 = ค้นหา · F2 = ชำระเงิน</p>
            </div>
          ) : (
            <div style={{ paddingTop: 8 }}>
              {items.map((item, idx) => (
                <CartItemRow
                  key={idx}
                  item={item}
                  index={idx}
                  onUpdate={(updates) => updateItem(idx, updates)}
                  onRemove={() => removeItem(idx)}
                  formatMoney={formatMoney}
                />
              ))}
            </div>
          )}
        </div>

        {/* Cart Summary */}
        <div style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '14px 20px',
          background: 'rgba(8,10,15,0.6)',
          backdropFilter: 'blur(20px)',
        }}>
          {/* Subtotal row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>รวม ({items.length} รายการ)</span>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{formatMoney(subtotal)}</span>
          </div>

          {/* Discount */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>ส่วนลด</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <input
                  value={discount || ''}
                  onChange={e => setDiscount(parseFloat(e.target.value) || 0, discountType)}
                  type="number" min="0"
                  placeholder="0"
                  style={{
                    width: 64, padding: '2px 8px', fontSize: 12,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, color: '#fcd34d', textAlign: 'right', outline: 'none',
                  }}
                />
                <button
                  onClick={() => setDiscount(discount, discountType === 'amount' ? 'percent' : 'amount')}
                  style={{
                    padding: '2px 8px', fontSize: 11, background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                    color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {discountType === 'amount' ? '฿' : '%'}
                </button>
              </div>
            </div>
            <span style={{ color: '#fcd34d', fontSize: 13 }}>-{formatMoney(discountAmt)}</span>
          </div>

          {/* Coupon */}
          {coupon ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Tag size={12} color="#a78bfa" />
                <span style={{ color: '#a78bfa', fontSize: 12 }}>{coupon.code}</span>
                <button onClick={() => { setCoupon(null); setCouponCode('') }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0 }}>
                  <X size={12} />
                </button>
              </div>
              <span style={{ color: '#a78bfa', fontSize: 12 }}>-{formatMoney(coupon.calculated_discount ?? 0)}</span>
            </div>
          ) : (
            <div style={{ marginBottom: 4 }}>
              {showCouponInput ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input
                    value={couponCode}
                    onChange={e => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key === 'Enter' && applyCoupon()}
                    placeholder="คูปองโค้ด"
                    style={{
                      flex: 1, padding: '4px 10px', fontSize: 12,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, color: 'rgba(255,255,255,0.8)', outline: 'none',
                    }}
                  />
                  <button onClick={applyCoupon}
                    style={{ padding: '4px 10px', background: '#22c55e', border: 'none', borderRadius: 6, color: '#000', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                    ใช้
                  </button>
                  <button onClick={() => setShowCouponInput(false)}
                    style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowCouponInput(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(139,92,246,0.7)', fontSize: 12, padding: 0, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tag size={12} /> ใช้คูปอง
                </button>
              )}
            </div>
          )}

          {/* VAT */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>
              VAT {vatRate}% ({vatInclusive ? 'รวมใน' : 'แยก'})
            </span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{formatMoney(taxAmount)}</span>
          </div>

          {/* Total + Pay Button */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>ยอดสุทธิ</div>
              <div style={{
                fontSize: 28, fontWeight: 800,
                background: 'linear-gradient(135deg, #22c55e, #4ade80)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                lineHeight: 1,
              }}>
                {formatMoney(total)}
              </div>
            </div>
            <button
              onClick={() => {
                if (items.length === 0) { toast.error('กรุณาเพิ่มสินค้าก่อน'); return }
                setShowPayment(true)
              }}
              style={{
                padding: '14px 28px',
                background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                border: 'none', borderRadius: 14,
                color: '#000', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 0 24px rgba(34,197,94,0.4), 0 4px 12px rgba(0,0,0,0.3)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <CreditCard size={18} />
              ชำระเงิน
            </button>
          </div>
        </div>
      </div>

      {/* ===== RIGHT: Product Browser (45%) ===== */}
      <div style={{ width: '45%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Search */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(8,10,15,0.5)',
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              className="glass-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ค้นหาสินค้า บาร์โค้ด หรือ SKU... (F1)"
              style={{ paddingLeft: 38, paddingRight: searchQuery ? 36 : 14 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,0.4)', display: 'flex',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Categories */}
        <div style={{
          padding: '10px 16px',
          overflowX: 'auto',
          display: 'flex', gap: 8, flexShrink: 0,
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          <button
            onClick={() => setSelectedCategory(null)}
            className="category-pill"
            style={!selectedCategory ? {
              background: 'rgba(34,197,94,0.15)', color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.3)',
            } : {}}
          >
            ทั้งหมด
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
              className={`category-pill ${selectedCategory === cat.id ? 'active' : ''}`}
              style={selectedCategory === cat.id ? {
                background: `${cat.color}22`,
                color: cat.color,
                border: `1px solid ${cat.color}44`,
              } : {}}
            >
              <span>{cat.icon}</span>
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: 10, alignContent: 'start',
        }}>
          {filteredProducts.map(product => (
            <ProductCard
              key={product.id}
              product={product}
              onAdd={() => addToCart(product)}
              formatMoney={formatMoney}
            />
          ))}
          {filteredProducts.length === 0 && (
            <div style={{
              gridColumn: '1/-1', textAlign: 'center',
              padding: '60px 20px', color: 'rgba(255,255,255,0.2)',
            }}>
              <Package size={40} strokeWidth={1} style={{ margin: '0 auto 12px' }} />
              <p>ไม่พบสินค้า</p>
            </div>
          )}
        </div>

        {/* Quick actions bottom bar */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: 8,
          background: 'rgba(8,10,15,0.5)',
        }}>
          <QuickPayBtn icon={<Banknote size={14} />} label="เงินสด" color="#22c55e" onClick={() => { if (items.length > 0) setShowPayment(true) }} />
          <QuickPayBtn icon={<CreditCard size={14} />} label="บัตรเครดิต" color="#3b82f6" onClick={() => { if (items.length > 0) setShowPayment(true) }} />
          <QuickPayBtn icon={<Smartphone size={14} />} label="QR/โอน" color="#8b5cf6" onClick={() => { if (items.length > 0) setShowPayment(true) }} />
        </div>
      </div>

      {/* Modals */}
      {showPayment && (
        <PaymentModal
          items={items}
          subtotal={subtotal}
          discountAmount={discountAmt}
          total={total}
          taxAmount={taxAmount}
          customer={customer}
          couponCode={coupon?.code}
          userId={user?.id}
          onClose={() => setShowPayment(false)}
          onSuccess={async () => {
            // Safe hardware cash drawer activation
            if (settings.cash_drawer_enabled === 'true') {
              try {
                const comPort = settings.cash_drawer_port || 'COM1'
                const res = await (window as any).api.hardware.openDrawer(comPort)
                if (res.success) {
                  toast.success('เปิดลิ้นชักเก็บเงินอัตโนมัติสำเร็จ')
                } else {
                  toast.error(`เปิดลิ้นชักเก็บเงินล้มเหลว: ${res.error}`)
                }
              } catch (err) {
                console.error('Cash drawer hardware trigger failed:', err)
                toast.error('ฮาร์ดแวร์เปิดลิ้นชักเก็บเงินเกิดข้อผิดพลาด')
              }
            }
            clearCart()
            setShowPayment(false)
            toast.success('ชำระเงินสำเร็จ! 🎉', { duration: 3000 })
          }}
        />
      )}

      {showCustomerSearch && (
        <CustomerSearchModal
          onSelect={(c) => {
            setCustomer(c)
            setShowCustomerSearch(false)
            toast.success(`เลือกลูกค้า: ${c.name}`)
          }}
          onClose={() => setShowCustomerSearch(false)}
        />
      )}
    </div>
  )
}

// ===== Sub-components =====

function CartItemRow({ item, index, onUpdate, onRemove, formatMoney }: {
  item: CartItem
  index: number
  onUpdate: (u: Partial<CartItem>) => void
  onRemove: () => void
  formatMoney: (n: number) => string
}) {
  return (
    <div className="cart-item" style={{ animation: 'slideInRight 0.2s ease-out' }}>
      <div style={{
        width: 32, height: 32, minWidth: 32,
        background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700, color: '#22c55e',
      }}>
        {index + 1}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.product_name}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
          {formatMoney(item.unit_price)} / {item.unit}
        </div>
      </div>

      {/* Qty control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <button
          onClick={() => {
            if (item.qty <= 1) onRemove()
            else onUpdate({ qty: item.qty - 1, total: (item.qty - 1) * item.unit_price - item.discount_amount })
          }}
          style={{ width: 24, height: 24, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
        >
          <Minus size={12} />
        </button>
        <input
          value={item.qty}
          onChange={e => {
            const q = parseFloat(e.target.value) || 1
            onUpdate({ qty: q, total: q * item.unit_price - item.discount_amount })
          }}
          style={{ width: 40, textAlign: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: 600, outline: 'none', padding: '2px 0' }}
        />
        <button
          onClick={() => onUpdate({ qty: item.qty + 1, total: (item.qty + 1) * item.unit_price - item.discount_amount })}
          style={{ width: 24, height: 24, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#22c55e' }}
        >
          <Plus size={12} />
        </button>
      </div>

      <div style={{ textAlign: 'right', minWidth: 72 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
          {formatMoney(item.total)}
        </div>
      </div>

      <button
        onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4, display: 'flex', borderRadius: 6 }}
        onMouseEnter={e => (e.currentTarget.style.color = '#ef4444')}
        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(239,68,68,0.5)')}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

function ProductCard({ product, onAdd, formatMoney }: {
  product: Product
  onAdd: () => void
  formatMoney: (n: number) => string
}) {
  const outOfStock = !product.is_service && product.stock_qty <= 0

  return (
    <div
      onClick={() => !outOfStock && onAdd()}
      className={`product-card-pos ${outOfStock ? 'out-of-stock' : ''}`}
      style={{ cursor: outOfStock ? 'not-allowed' : 'pointer' }}
    >
      {/* Category color indicator */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: product.category_color || '#22c55e',
        borderRadius: '8px 8px 0 0',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', marginTop: 4, overflow: 'hidden' }}>
        {product.image_path ? (
          <img 
            src={`local-img://${product.image_path}`} 
            alt={product.name} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const pNode = e.currentTarget.parentNode as HTMLElement;
              if (pNode) {
                const fallbackSpan = document.createElement('span');
                fallbackSpan.innerText = product.category_icon || '📦';
                fallbackSpan.style.fontSize = '18px';
                pNode.appendChild(fallbackSpan);
              }
            }}
          />
        ) : (
          <span style={{ fontSize: 18 }}>{product.category_icon || '📦'}</span>
        )}
      </div>

      <div style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
        lineHeight: 1.3, marginTop: 2,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {product.name}
      </div>
      <div style={{
        fontSize: 14, fontWeight: 800,
        color: '#22c55e', marginTop: 4,
      }}>
        {formatMoney(product.sell_price)}
      </div>
      {!product.is_service && (
        <div style={{
          fontSize: 10, color: product.stock_qty <= product.min_stock ? '#fca5a5' : 'rgba(255,255,255,0.3)',
        }}>
          {outOfStock ? 'หมด' : `เหลือ ${product.stock_qty} ${product.unit}`}
        </div>
      )}

      {/* Add indicator on hover */}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        width: 20, height: 20, borderRadius: '50%',
        background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: 0.6,
      }}>
        <Plus size={10} color="#22c55e" />
      </div>
    </div>
  )
}

function QuickPayBtn({ icon, label, color, onClick }: { icon: React.ReactNode; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '8px', background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
        color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 11, fontFamily: 'inherit',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = `${color}15`
        e.currentTarget.style.borderColor = `${color}40`
        e.currentTarget.style.color = color
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.color = 'rgba(255,255,255,0.5)'
      }}
    >
      {icon}
      {label}
    </button>
  )
}
