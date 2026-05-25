import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Package, Grid, List, Download, Upload, X, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product, Category } from '../../types'

const api = (window as any).api

const MOCK_PRODUCTS: Product[] = [
  { id: 1, barcode: '8850006110150', sku: 'P001', name: 'กาแฟอเมริกาโน่', category_id: 1, category_name: 'อาหารและเครื่องดื่ม', category_color: '#F59E0B', category_icon: '🍔', sell_price: 85, cost_price: 25, stock_qty: 100, min_stock: 10, max_stock: 200, unit: 'แก้ว', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 2, barcode: '8850006110151', sku: 'P002', name: 'ชาเย็น', category_id: 1, category_name: 'อาหารและเครื่องดื่ม', category_color: '#F59E0B', category_icon: '🍔', sell_price: 65, cost_price: 15, stock_qty: 150, min_stock: 20, max_stock: 300, unit: 'แก้ว', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 3, barcode: '8850006110154', sku: 'P003', name: 'สมาร์ทโฟน X12', category_id: 2, category_name: 'เครื่องใช้ไฟฟ้า', category_color: '#3B82F6', category_icon: '📱', sell_price: 15900, cost_price: 10000, stock_qty: 5, min_stock: 3, max_stock: 30, unit: 'เครื่อง', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 4, barcode: '8850006110162', sku: 'P004', name: 'ลิปสติก Matte', category_id: 4, category_name: 'สุขภาพและความงาม', category_color: '#8B5CF6', category_icon: '💄', sell_price: 350, cost_price: 100, stock_qty: 3, min_stock: 10, max_stock: 50, unit: 'แท่ง', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
]

const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'อาหารและเครื่องดื่ม', icon: '🍔', color: '#F59E0B', sort_order: 1, is_active: 1, created_at: '' },
  { id: 2, name: 'เครื่องใช้ไฟฟ้า', icon: '📱', color: '#3B82F6', sort_order: 2, is_active: 1, created_at: '' },
  { id: 3, name: 'เครื่องแต่งกาย', icon: '👕', color: '#EC4899', sort_order: 3, is_active: 1, created_at: '' },
  { id: 4, name: 'สุขภาพและความงาม', icon: '💄', color: '#8B5CF6', sort_order: 4, is_active: 1, created_at: '' },
  { id: 5, name: 'บริการ', icon: '⚡', color: '#22C55E', sort_order: 5, is_active: 1, created_at: '' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS)
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    if (!api) return
    const [pRes, cRes] = await Promise.all([api.products.getAll(), api.categories.getAll()])
    if (pRes.success) setProducts(pRes.data)
    if (cRes.success) setCategories(cRes.data)
  }

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.barcode?.includes(search) || p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !categoryFilter || p.category_id === categoryFilter
    return matchSearch && matchCat
  })

  const deleteProduct = async (id: number) => {
    if (!confirm('ต้องการลบสินค้านี้?')) return
    if (api) { await api.products.delete(id) }
    setProducts(p => p.filter(x => x.id !== id))
    toast.success('ลบสินค้าแล้ว')
  }

  const fmt = (n: number) => `฿${n.toLocaleString()}`
  const profit = (p: Product) => (((p.sell_price - p.cost_price) / p.sell_price) * 100).toFixed(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้า บาร์โค้ด SKU..." style={{ paddingLeft: 36, maxWidth: 320 }} />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setViewMode('table')} className={`glass-btn ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 12px' }}><List size={15} /></button>
          <button onClick={() => setViewMode('grid')} className={`glass-btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: '8px 12px' }}><Grid size={15} /></button>
        </div>
        <button className="glass-btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}><Download size={14} />ส่งออก</button>
        <button className="glass-btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}><Upload size={14} />นำเข้า</button>
        <button onClick={() => { setEditing(null); setShowModal(true) }} className="glass-btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
          <Plus size={15} />เพิ่มสินค้า
        </button>
      </div>

      {/* Category filter pills */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setCategoryFilter(null)} className={`category-pill ${!categoryFilter ? 'active' : ''}`} style={!categoryFilter ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' } : {}}>ทั้งหมด ({products.length})</button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
            className="category-pill"
            style={categoryFilter === c.id ? { background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}44` } : {}}>
            {c.icon} {c.name}
          </button>
        ))}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'สินค้าทั้งหมด', value: products.length, color: '#3b82f6' },
          { label: 'สินค้าใกล้หมด', value: products.filter(p => !p.is_service && p.stock_qty <= p.min_stock).length, color: '#f59e0b' },
          { label: 'มูลค่าสต็อก', value: `฿${products.reduce((s, p) => s + p.stock_qty * p.cost_price, 0).toLocaleString()}`, color: '#22c55e' },
          { label: 'ค่าเฉลี่ยกำไร', value: `${(products.reduce((s, p) => s + parseFloat(profit(p)), 0) / products.length || 0).toFixed(0)}%`, color: '#8b5cf6' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Products table */}
      {viewMode === 'table' ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>สินค้า</th>
                <th>บาร์โค้ด / SKU</th>
                <th>ราคาขาย</th>
                <th>ต้นทุน</th>
                <th>กำไร</th>
                <th>สต็อก</th>
                <th>สถานะ</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isLow = !p.is_service && p.stock_qty <= p.min_stock
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 32, height: 32,
                          background: `${p.category_color || '#22c55e'}22`,
                          borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16,
                        }}>
                          {p.category_icon || '📦'}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.category_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>{p.barcode}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.sku}</div>
                    </td>
                    <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{fmt(p.sell_price)}</td>
                    <td style={{ color: 'rgba(255,255,255,0.5)' }}>{fmt(p.cost_price)}</td>
                    <td>
                      <span style={{
                        padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                        background: 'rgba(34,197,94,0.1)', color: '#22c55e',
                      }}>
                        {profit(p)}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {isLow && <AlertTriangle size={12} color="#f59e0b" />}
                        <span style={{ color: isLow ? '#fcd34d' : 'rgba(255,255,255,0.7)', fontWeight: isLow ? 600 : 400 }}>
                          {p.is_service ? '—' : `${p.stock_qty} ${p.unit}`}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-green' : 'badge-red'}`}>
                        {p.is_active ? 'ใช้งาน' : 'ระงับ'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditing(p); setShowModal(true) }} style={{ padding: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', color: '#60a5fa', display: 'flex' }}>
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => deleteProduct(p.id)} style={{ padding: '5px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fca5a5', display: 'flex' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ padding: '60px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
              <Package size={40} strokeWidth={1} style={{ margin: '0 auto 12px' }} />
              <p>ไม่พบสินค้า</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
          {filtered.map(p => (
            <div key={p.id} className="glass-card" style={{ padding: 16, cursor: 'pointer' }} onClick={() => { setEditing(p); setShowModal(true) }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{p.category_icon || '📦'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#22c55e' }}>฿{p.sell_price.toLocaleString()}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>สต็อก: {p.is_service ? '—' : p.stock_qty}</div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      {showModal && (
        <ProductModal
          product={editing}
          categories={categories}
          onClose={() => setShowModal(false)}
          onSave={async (data) => {
            if (api) {
              if (editing) await api.products.update(editing.id, data)
              else await api.products.create(data)
            }
            toast.success(editing ? 'แก้ไขสินค้าแล้ว' : 'เพิ่มสินค้าแล้ว')
            setShowModal(false)
            loadData()
          }}
        />
      )}
    </div>
  )
}

function ProductModal({ product, categories, onClose, onSave }: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState({
    name: product?.name || '', barcode: product?.barcode || '', sku: product?.sku || '',
    category_id: product?.category_id || '', unit: product?.unit || 'ชิ้น',
    cost_price: product?.cost_price || 0, sell_price: product?.sell_price || 0,
    stock_qty: product?.stock_qty || 0, min_stock: product?.min_stock || 0,
    is_service: product?.is_service || 0, is_active: product?.is_active ?? 1,
    tax_rate: product?.tax_rate || 7,
  })

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 560, padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormRow label="ชื่อสินค้า *">
            <input className="glass-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="ชื่อสินค้า" />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="บาร์โค้ด">
              <input className="glass-input" value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="EAN/UPC" />
            </FormRow>
            <FormRow label="SKU">
              <input className="glass-input" value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="รหัสสินค้า" />
            </FormRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="หมวดหมู่">
              <select className="glass-input" value={form.category_id} onChange={e => set('category_id', parseInt(e.target.value))}
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}>
                <option value="">เลือกหมวดหมู่</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </FormRow>
            <FormRow label="หน่วย">
              <input className="glass-input" value={form.unit} onChange={e => set('unit', e.target.value)} placeholder="ชิ้น, แก้ว, ตัว..." />
            </FormRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="ราคาขาย (฿) *">
              <input className="glass-input" type="number" value={form.sell_price} onChange={e => set('sell_price', parseFloat(e.target.value) || 0)} />
            </FormRow>
            <FormRow label="ต้นทุน (฿)">
              <input className="glass-input" type="number" value={form.cost_price} onChange={e => set('cost_price', parseFloat(e.target.value) || 0)} />
            </FormRow>
          </div>
          {!form.is_service && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormRow label="จำนวนสต็อก">
                <input className="glass-input" type="number" value={form.stock_qty} onChange={e => set('stock_qty', parseFloat(e.target.value) || 0)} />
              </FormRow>
              <FormRow label="สต็อกขั้นต่ำ">
                <input className="glass-input" type="number" value={form.min_stock} onChange={e => set('min_stock', parseFloat(e.target.value) || 0)} />
              </FormRow>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.is_service} onChange={e => set('is_service', e.target.checked ? 1 : 0)} />
              เป็นบริการ (ไม่นับสต็อก)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
              เปิดใช้งาน
            </label>
          </div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="glass-btn btn-secondary" style={{ fontSize: 13 }}>ยกเลิก</button>
          <button onClick={() => onSave(form as unknown as Record<string, unknown>)} className="glass-btn btn-primary" style={{ fontSize: 13, fontWeight: 700 }}>
            {product ? 'บันทึก' : 'เพิ่มสินค้า'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}
