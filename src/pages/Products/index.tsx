import { useState, useEffect, useCallback } from 'react'
import {
  Plus, Search, Edit2, Trash2, Package, Grid, List,
  Download, Upload, X, AlertTriangle, Settings2, Tag,
  Layers, Check, Clock, Percent, Star, ChevronDown
} from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product, Category } from '../../types'
import { useAuthStore, usePresetsStore } from '../../store'

const api = (window as any).api

// ── Reusable toggle switch ──────────────────────────────────────────
function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: 40, height: 22, borderRadius: 11, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: checked ? '#22c55e' : 'rgba(255,255,255,0.12)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, outline: 'none',
        boxShadow: checked ? '0 0 8px rgba(34,197,94,0.4)' : 'none',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: checked ? 21 : 3,
        width: 16, height: 16, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }} />
    </button>
  )
}

const MOCK_PRODUCTS: Product[] = [
  { id: 1, barcode: '8850006110150', sku: 'P001', name: 'กาแฟอเมริกาโน่', category_id: 1, category_name: 'อาหารและเครื่องดื่ม', category_color: '#F59E0B', category_icon: '🍔', sell_price: 85, cost_price: 25, stock_qty: 100, min_stock: 10, max_stock: 200, unit: 'แก้ว', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 2, barcode: '8850006110151', sku: 'P002', name: 'ชาเย็น', category_id: 1, category_name: 'อาหารและเครื่องดื่ม', category_color: '#F59E0B', category_icon: '🍔', sell_price: 65, cost_price: 15, stock_qty: 150, min_stock: 20, max_stock: 300, unit: 'แก้ว', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
]

const MOCK_CATEGORIES: Category[] = [
  { id: 1, name: 'อาหารและเครื่องดื่ม', icon: '🍔', color: '#F59E0B', sort_order: 1, is_active: 1, created_at: '' },
  { id: 2, name: 'เครื่องใช้ไฟฟ้า', icon: '📱', color: '#3B82F6', sort_order: 2, is_active: 1, created_at: '' },
]

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>(MOCK_PRODUCTS)
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const { user: currentUser } = useAuthStore()
  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  // Category manager state
  const [showCatManager, setShowCatManager] = useState(false)
  const [addCatForm, setAddCatForm] = useState({ name: '', icon: '📦', color: '#22c55e' })
  const [catSaving, setCatSaving] = useState(false)

  // Preset manager state
  const [showPresetManager, setShowPresetManager] = useState(false)

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
    if (api) { await api.products.delete(id, currentUser?.id) }
    setProducts(p => p.filter(x => x.id !== id))
    toast.success('ลบสินค้าแล้ว')
  }

  // Realtime toggle — Req 4
  const handleToggleActive = useCallback(async (product: Product, newActive: boolean) => {
    if (!isAdmin) return
    const newVal = newActive ? 1 : 0
    // Optimistic update
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: newVal } : p))
    if (api) {
      const res = await api.products.toggleActive(product.id, newVal, currentUser?.id)
      if (!res.success) {
        // Rollback
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: product.is_active } : p))
        toast.error(res.error || 'ไม่สามารถเปลี่ยนสถานะได้')
      }
    }
  }, [isAdmin, currentUser])

  const handleAddCategory = async () => {
    if (!addCatForm.name.trim()) { toast.error('กรุณาใส่ชื่อหมวดหมู่'); return }
    setCatSaving(true)
    try {
      if (api) {
        const res = await api.categories.create(addCatForm)
        if (res.success) {
          toast.success('เพิ่มหมวดหมู่แล้ว')
          setAddCatForm({ name: '', icon: '📦', color: '#22c55e' })
          const cRes = await api.categories.getAll()
          if (cRes.success) setCategories(cRes.data)
        } else { toast.error(res.error || 'ไม่สามารถเพิ่มได้') }
      } else {
        const newCat = { id: Date.now(), ...addCatForm, sort_order: categories.length, is_active: 1, created_at: '' }
        setCategories(prev => [...prev, newCat as any])
        setAddCatForm({ name: '', icon: '📦', color: '#22c55e' })
        toast.success('เพิ่มหมวดหมู่แล้ว')
      }
    } finally { setCatSaving(false) }
  }

  const handleDeleteCategory = async (id: number, name: string) => {
    const usedCount = products.filter(p => p.category_id === id).length
    const msg = usedCount > 0
      ? `หมวดหมู่ "${name}" มีสินค้าใช้งานอยู่ ${usedCount} รายการ ยืนยันลบหมวดหมู่นี้หรือไม่?`
      : `ต้องการลบหมวดหมู่ "${name}" หรือไม่?`
    if (!confirm(msg)) return
    if (api) {
      const res = await api.categories.delete(id)
      if (!res.success) { toast.error(res.error || 'ไม่สามารถลบได้'); return }
    }
    setCategories(prev => prev.filter(c => c.id !== id))
    if (categoryFilter === id) setCategoryFilter(null)
    toast.success(`ลบหมวดหมู่ "${name}" แล้ว`)
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
        {isAdmin && (
          <>
            {/* Preset Manager button — Req 1 */}
            <button
              onClick={() => setShowPresetManager(true)}
              className="glass-btn btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
              title="จัดการพรีเซ็ตสินค้า"
            >
              <Layers size={14} /> Preset
            </button>
            <button className="glass-btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}><Upload size={14} />ส่งออก</button>
            <button className="glass-btn btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}><Download size={14} />นำเข้า</button>
            <button onClick={() => { setEditing(null); setShowModal(true) }} className="glass-btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
              <Plus size={15} />เพิ่มสินค้า
            </button>
          </>
        )}
      </div>

      {/* Category filter pills + manage button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setCategoryFilter(null)} className={`category-pill ${!categoryFilter ? 'active' : ''}`} style={!categoryFilter ? { background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' } : {}}>ทั้งหมด ({products.length})</button>
        {categories.map(c => (
          <button key={c.id} onClick={() => setCategoryFilter(categoryFilter === c.id ? null : c.id)}
            className="category-pill"
            style={categoryFilter === c.id ? { background: `${c.color}22`, color: c.color, border: `1px solid ${c.color}44` } : {}}>
            {c.icon} {c.name}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setShowCatManager(true)}
            title="จัดการหมวดหมู่"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 100, fontSize: 12,
              fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.5)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#fff'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.25)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.12)' }}
          >
            <Settings2 size={13} /> จัดการหมวดหมู่
          </button>
        )}
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
                const hasSpecial = p.special_price_enabled || p.discount_enabled
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
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            {p.name}
                            {hasSpecial && <span title="มีราคาพิเศษ" style={{ display: 'inline-flex' }}><Star size={10} color="#f59e0b" fill="#f59e0b" /></span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.category_name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'rgba(255,255,255,0.5)' }}>{p.barcode}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.sku}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{fmt(p.sell_price)}</div>
                      {p.special_price_enabled && p.special_price != null && (
                        <div style={{ fontSize: 11, color: '#f59e0b' }}>⭐ {fmt(p.special_price)}</div>
                      )}
                      {p.discount_enabled && p.discount_percent != null && (
                        <div style={{ fontSize: 11, color: '#fb923c' }}>-{p.discount_percent}%</div>
                      )}
                    </td>
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
                    {/* Realtime toggle — Req 4 */}
                    <td>
                      <ToggleSwitch
                        checked={!!p.is_active}
                        onChange={v => handleToggleActive(p, v)}
                        disabled={!isAdmin}
                      />
                    </td>
                    <td>
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditing(p); setShowModal(true) }} style={{ padding: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', color: '#60a5fa', display: 'flex' }}>
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => deleteProduct(p.id)} style={{ padding: '5px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fca5a5', display: 'flex' }}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
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
            <div key={p.id} className="glass-card" style={{ padding: 16, cursor: isAdmin ? 'pointer' : 'default' }} onClick={() => { if (isAdmin) { setEditing(p); setShowModal(true) } }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                {p.image_path ? (
                  <img
                    src={`local-img://${p.image_path}`}
                    alt={p.name}
                    className="w-12 h-12 object-cover rounded-lg border border-white/10"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const pNode = e.currentTarget.parentNode as HTMLElement;
                      if (pNode) {
                        const fallbackSpan = document.createElement('span');
                        fallbackSpan.innerText = p.category_icon || '📦';
                        pNode.appendChild(fallbackSpan);
                      }
                    }}
                  />
                ) : (
                  p.category_icon || '📦'
                )}
              </div>
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
              let res
              if (editing) {
                res = await api.products.update(editing.id, data, currentUser?.id)
              } else {
                res = await api.products.create(data, currentUser?.id)
              }
              if (res && !res.success) {
                toast.error(res.error || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล')
                return
              }
            }
            toast.success(editing ? 'แก้ไขสินค้าแล้ว' : 'เพิ่มสินค้าแล้ว')
            setShowModal(false)
            loadData()
          }}
        />
      )}

      {/* Category Manager Modal */}
      {showCatManager && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCatManager(false)}>
          <div className="modal-content" style={{ width: 460, padding: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={16} color="#22c55e" />
                <span style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>จัดการหมวดหมู่</span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>({categories.length} หมวด)</span>
              </div>
              <button onClick={() => setShowCatManager(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '12px 20px' }}>
              {categories.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>ยังไม่มีหมวดหมู่</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {categories.map(c => {
                    const usedCount = products.filter(p => p.category_id === c.id).length
                    return (
                      <div key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                        <span style={{ fontSize: 18, lineHeight: 1 }}>{c.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{usedCount} สินค้า</div>
                        </div>
                        <button
                          onClick={() => handleDeleteCategory(c.id, c.name)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                            background: 'rgba(239,68,68,0.08)',
                            border: '1px solid rgba(239,68,68,0.2)',
                            color: '#fca5a5', cursor: 'pointer', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.2)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 20px', flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.45)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>เพิ่มหมวดหมู่ใหม่</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input className="glass-input" placeholder="ชื่อหมวดหมู่..." value={addCatForm.name}
                  onChange={e => setAddCatForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                    {['📦', '🍔', '📱', '👕', '💄', '⚡', '🏠', '🚗', '📚', '🎮'].map(icon => (
                      <button key={icon} onClick={() => setAddCatForm(f => ({ ...f, icon }))}
                        style={{
                          width: 32, height: 32, borderRadius: 8, fontSize: 16,
                          border: addCatForm.icon === icon ? '2px solid #22c55e' : '1px solid rgba(255,255,255,0.1)',
                          background: addCatForm.icon === icon ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.04)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{icon}</button>
                    ))}
                    <input className="glass-input" value={addCatForm.icon}
                      onChange={e => setAddCatForm(f => ({ ...f, icon: e.target.value }))}
                      style={{ width: 40, textAlign: 'center', fontSize: 16, padding: '4px' }} maxLength={2} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>สี:</span>
                    <input type="color" value={addCatForm.color}
                      onChange={e => setAddCatForm(f => ({ ...f, color: e.target.value }))}
                      style={{ width: 36, height: 32, border: 'none', borderRadius: 8, cursor: 'pointer', background: 'transparent', padding: 2 }} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    flex: 1, padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    background: `${addCatForm.color}15`, border: `1px solid ${addCatForm.color}40`, color: addCatForm.color,
                  }}>{addCatForm.icon} {addCatForm.name || 'ตัวอย่างหมวดหมู่'}</div>
                  <button onClick={handleAddCategory} disabled={catSaving || !addCatForm.name.trim()}
                    className="glass-btn btn-primary"
                    style={{ padding: '8px 18px', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', opacity: (!addCatForm.name.trim() || catSaving) ? 0.4 : 1 }}>
                    <Plus size={14} /> เพิ่ม
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preset Manager Modal — Req 1 */}
      {showPresetManager && (
        <PresetManagerModal
          products={products}
          onClose={() => setShowPresetManager(false)}
        />
      )}
    </div>
  )
}

// ── Preset Manager Modal ────────────────────────────────────────────
function PresetManagerModal({ products, onClose }: { products: Product[]; onClose: () => void }) {
  const {
    presets, activePresetId,
    createPreset, renamePreset, deletePreset,
    toggleProductInPreset, setActivePreset, enableAllInPreset
  } = usePresetsStore()

  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(activePresetId ?? presets[0]?.id ?? null)
  const [newPresetName, setNewPresetName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [search, setSearch] = useState('')

  const selectedPreset = presets.find(p => p.id === selectedPresetId)

  const handleCreate = () => {
    if (!newPresetName.trim()) return
    const id = createPreset(newPresetName.trim())
    setSelectedPresetId(id)
    setNewPresetName('')
    toast.success(`สร้าง Preset "${newPresetName.trim()}" แล้ว`)
  }

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`ลบ Preset "${name}" หรือไม่?`)) return
    deletePreset(id)
    if (selectedPresetId === id) setSelectedPresetId(presets.find(p => p.id !== id)?.id ?? null)
    toast.success('ลบ Preset แล้ว')
  }

  const handleRenameSubmit = (id: string) => {
    if (!renameVal.trim()) return
    renamePreset(id, renameVal.trim())
    setRenamingId(null)
    toast.success('เปลี่ยนชื่อ Preset แล้ว')
  }

  const filteredProducts = products.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  )

  const enabledCount = selectedPreset
    ? Object.values(selectedPreset.productEnabled).filter(Boolean).length
    : 0

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content animate-scale-up" style={{ width: 720, padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={16} color="#818cf8" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>จัดการ Product Preset</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>กำหนดสินค้าที่แสดงในแต่ละ Preset (ค่าเริ่มต้น: ปิดทั้งหมด)</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left sidebar — Preset list */}
          <div style={{ width: 220, borderRight: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 6 }}>
              <input
                className="glass-input"
                placeholder="ชื่อ Preset ใหม่..."
                value={newPresetName}
                onChange={e => setNewPresetName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
                style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
              />
              <button onClick={handleCreate} disabled={!newPresetName.trim()} className="glass-btn btn-primary" style={{ padding: '6px 10px' }}>
                <Plus size={14} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {presets.length === 0 && (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
                  ยังไม่มี Preset<br />กรุณาสร้าง Preset ใหม่
                </div>
              )}
              {presets.map(preset => {
                const count = Object.values(preset.productEnabled).filter(Boolean).length
                return (
                  <div
                    key={preset.id}
                    onClick={() => setSelectedPresetId(preset.id)}
                    style={{
                      padding: '10px 14px', cursor: 'pointer',
                      background: selectedPresetId === preset.id ? 'rgba(99,102,241,0.12)' : 'transparent',
                      borderLeft: selectedPresetId === preset.id ? '2px solid #818cf8' : '2px solid transparent',
                      transition: 'all 0.15s',
                    }}
                  >
                    {renamingId === preset.id ? (
                      <input
                        className="glass-input"
                        value={renameVal}
                        autoFocus
                        onChange={e => setRenameVal(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameSubmit(preset.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={() => handleRenameSubmit(preset.id)}
                        style={{ fontSize: 12, padding: '4px 8px' }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: selectedPresetId === preset.id ? '#a5b4fc' : 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {preset.name}
                          </div>
                          {activePresetId === preset.id && (
                            <span style={{ fontSize: 9, background: 'rgba(34,197,94,0.2)', color: '#4ade80', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>ใช้งาน</span>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{count} สินค้าเปิดอยู่</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
                          <button
                            onClick={e => { e.stopPropagation(); setActivePreset(activePresetId === preset.id ? null : preset.id); toast.success(activePresetId === preset.id ? 'ยกเลิก Preset แล้ว' : `เลือก Preset "${preset.name}" แล้ว`) }}
                            style={{ flex: 1, fontSize: 10, padding: '3px 0', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)', background: activePresetId === preset.id ? 'rgba(34,197,94,0.2)' : 'transparent', color: activePresetId === preset.id ? '#4ade80' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'inherit' }}
                          >{activePresetId === preset.id ? '✓ ใช้งานอยู่' : 'เลือกใช้'}</button>
                          <button
                            onClick={e => { e.stopPropagation(); setRenamingId(preset.id); setRenameVal(preset.name) }}
                            style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer' }}
                          ><Edit2 size={10} /></button>
                          <button
                            onClick={e => { e.stopPropagation(); handleDelete(preset.id, preset.name) }}
                            style={{ padding: '3px 6px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: '#fca5a5', cursor: 'pointer' }}
                          ><Trash2 size={10} /></button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right — Product toggle list */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {!selectedPreset ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13, flexDirection: 'column', gap: 8 }}>
                <Layers size={32} strokeWidth={1} />
                <span>เลือก Preset จากด้านซ้าย</span>
              </div>
            ) : (
              <>
                {/* Preset header actions */}
                <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <Search size={12} style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
                    <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาสินค้า..." style={{ paddingLeft: 28, fontSize: 12, padding: '6px 6px 6px 28px' }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{enabledCount}/{products.length} เปิดอยู่</span>
                  <button
                    onClick={() => enableAllInPreset(selectedPreset.id, products.map(p => p.id))}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.1)', color: '#4ade80', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >เปิดทั้งหมด</button>
                  <button
                    onClick={() => {
                      const allDisabled: Record<number, boolean> = {}
                      products.forEach(p => { allDisabled[p.id] = false })
                      usePresetsStore.setState(s => ({
                        presets: s.presets.map(pr => pr.id === selectedPreset.id ? { ...pr, productEnabled: allDisabled } : pr)
                      }))
                    }}
                    style={{ fontSize: 11, padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#fca5a5', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
                  >ปิดทั้งหมด</button>
                </div>

                {/* Product list with toggles */}
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  {filteredProducts.map(p => {
                    const enabled = !!selectedPreset.productEnabled[p.id]
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '9px 16px',
                          borderBottom: '1px solid rgba(255,255,255,0.04)',
                          background: enabled ? 'rgba(34,197,94,0.04)' : 'transparent',
                          transition: 'background 0.15s',
                        }}
                      >
                        <div style={{
                          width: 28, height: 28, background: `${p.category_color || '#22c55e'}22`,
                          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0
                        }}>
                          {p.category_icon || '📦'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: enabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {p.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{p.category_name} · ฿{p.sell_price.toLocaleString()}</div>
                        </div>
                        <ToggleSwitch
                          checked={enabled}
                          onChange={v => toggleProductInPreset(selectedPreset.id, p.id, v)}
                        />
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Product Modal ───────────────────────────────────────────────────
function ProductModal({ product, categories, onClose, onSave }: {
  product: Product | null
  categories: Category[]
  onClose: () => void
  onSave: (data: Record<string, unknown>) => void
}) {
  const [form, setForm] = useState({
    name: product?.name || '', barcode: product?.barcode || '', sku: product?.sku || '',
    category_id: product?.category_id || '', unit: product?.unit || 'ชิ้น',
    cost_price: product?.cost_price !== undefined ? String(product.cost_price) : '0',
    sell_price: product?.sell_price !== undefined ? String(product.sell_price) : '0',
    stock_qty: product?.stock_qty !== undefined ? String(product.stock_qty) : '0',
    min_stock: product?.min_stock !== undefined ? String(product.min_stock) : '0',
    is_service: product?.is_service || 0, is_active: product?.is_active ?? 1,
    tax_rate: product?.tax_rate || 7,
    image_path: product?.image_path || '',
    image_path_preview: product?.image_path ? `local-img://${product.image_path}` : '',
    // Special pricing — Req 2
    special_price_enabled: product?.special_price_enabled ?? 0,
    special_price: product?.special_price != null ? String(product.special_price) : '',
    discount_enabled: product?.discount_enabled ?? 0,
    discount_percent: product?.discount_percent != null ? String(product.discount_percent) : '',
    // Time schedules — Req 3
    price_schedules: product?.price_schedules || '[]',
  })

  const [isDragActive, setIsDragActive] = useState(false)
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [customCategoryName, setCustomCategoryName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(!!(product?.special_price_enabled || product?.discount_enabled || product?.price_schedules))

  const setF = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // Parse/stringify schedules
  const getSchedules = (): { start: string; end: string }[] => {
    try { return JSON.parse(form.price_schedules) } catch { return [] }
  }
  const setSchedules = (arr: { start: string; end: string }[]) => setF('price_schedules', JSON.stringify(arr))

  const handleImageFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error('ไฟล์รูปภาพมีขนาดใหญ่เกินไป! (จำกัดไม่เกิน 5MB)'); return }
    if (!file.type.startsWith('image/')) { toast.error('กรุณาเลือกไฟล์ที่เป็นรูปภาพเท่านั้น'); return }
    try {
      const filePath = (file as any).path
      if (api && filePath) {
        const uploadRes = await api.images.upload(filePath)
        if (uploadRes.success && uploadRes.data) {
          setF('image_path', uploadRes.data)
          setF('image_path_preview', `local-img://${uploadRes.data}`)
          toast.success('อัปโหลดและเตรียมไฟล์รูปภาพเรียบร้อยแล้ว')
        } else throw new Error(uploadRes.error || 'ย้ายไฟล์ไม่สำเร็จ')
      } else {
        setF('image_path', file.name)
        setF('image_path_preview', URL.createObjectURL(file))
        toast.success('อัปโหลดรูปภาพสำเร็จ (Demo)')
      }
    } catch (error) {
      console.error(error)
      toast.error(`ไม่สามารถอัปโหลดรูปภาพได้: ${String(error)}`)
    }
  }

  const schedules = getSchedules()

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 600, padding: 0, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
            {product ? 'แก้ไขสินค้า' : 'เพิ่มสินค้าใหม่'}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto', flex: 1 }}>

          {/* Image Upload */}
          <FormRow label="รูปภาพสินค้า">
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragActive(true) }}
              onDragLeave={() => setIsDragActive(false)}
              onDrop={async (e) => { e.preventDefault(); setIsDragActive(false); const file = e.dataTransfer.files[0]; if (file) handleImageFile(file) }}
              onClick={() => document.getElementById('product-image-input')?.click()}
              className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${isDragActive ? 'border-green-500 bg-green-500/10' : 'border-white/10 hover:border-green-500/50 bg-white/5 hover:bg-white/10'}`}
            >
              <input id="product-image-input" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) handleImageFile(file) }} style={{ display: 'none' }} />
              {form.image_path ? (
                <div style={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
                  <img src={form.image_path_preview} alt="Preview" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)' }} />
                  <button type="button" onClick={e => { e.stopPropagation(); setF('image_path', ''); setF('image_path_preview', '') }}
                    style={{ position: 'absolute', top: -8, right: 'calc(50% - 58px)', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 0' }}>
                  <Download size={24} style={{ color: 'rgba(255,255,255,0.3)', transform: 'rotate(180deg)' }} />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>ลากรูปภาพมาวางที่นี่ หรือคลิกเพื่ออัปโหลด</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>จำกัดขนาดไฟล์ไม่เกิน 5MB (PNG, JPG)</span>
                </div>
              )}
            </div>
          </FormRow>

          <FormRow label="ชื่อสินค้า *">
            <input className="glass-input" value={form.name} onChange={e => setF('name', e.target.value)} placeholder="ชื่อสินค้า" />
          </FormRow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="บาร์โค้ด">
              <input className="glass-input" value={form.barcode} onChange={e => setF('barcode', e.target.value)} placeholder="EAN/UPC" />
            </FormRow>
            <FormRow label="SKU">
              <input className="glass-input" value={form.sku} onChange={e => setF('sku', e.target.value)} placeholder="รหัสสินค้า" />
            </FormRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="หมวดหมู่">
              {!isCustomCategory ? (
                <select className="glass-input" value={form.category_id} onChange={e => {
                  if (e.target.value === 'custom') { setIsCustomCategory(true) }
                  else { setF('category_id', parseInt(e.target.value) || '') }
                }} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}>
                  <option value="" style={{ color: '#1a1b20', background: '#ffffff' }}>เลือกหมวดหมู่</option>
                  {categories.map(c => <option key={c.id} value={c.id} style={{ color: '#1a1b20', background: '#ffffff' }}>{c.icon} {c.name}</option>)}
                  <option value="custom" style={{ color: '#1a1b20', background: '#ffffff' }}>➕ กำหนดหมวดหมู่เอง (พิมพ์ใหม่)...</option>
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="glass-input" value={customCategoryName} onChange={e => setCustomCategoryName(e.target.value)} placeholder="พิมพ์หมวดหมู่ใหม่..." autoFocus />
                  <button type="button" onClick={() => { setIsCustomCategory(false); setCustomCategoryName(''); setF('category_id', product?.category_id || '') }} className="glass-btn btn-secondary text-xs" style={{ padding: '0 12px' }}>ย้อนกลับ</button>
                </div>
              )}
            </FormRow>
            <FormRow label="หน่วย">
              <input className="glass-input" value={form.unit} onChange={e => setF('unit', e.target.value)} placeholder="ชิ้น, แก้ว, ตัว..." />
            </FormRow>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FormRow label="ราคาขาย (฿) *">
              <input className="glass-input" type="number" value={form.sell_price} onChange={e => setF('sell_price', e.target.value)} />
            </FormRow>
            <FormRow label="ต้นทุน (฿)">
              <input className="glass-input" type="number" value={form.cost_price} onChange={e => setF('cost_price', e.target.value)} />
            </FormRow>
          </div>
          {!form.is_service && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormRow label="จำนวนสต็อก">
                <input className="glass-input" type="number" value={form.stock_qty} onChange={e => setF('stock_qty', e.target.value)} />
              </FormRow>
              <FormRow label="สต็อกขั้นต่ำ">
                <input className="glass-input" type="number" value={form.min_stock} onChange={e => setF('min_stock', e.target.value)} />
              </FormRow>
            </div>
          )}
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.is_service} onChange={e => setF('is_service', e.target.checked ? 1 : 0)} />
              เป็นบริการ (ไม่นับสต็อก)
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
              <input type="checkbox" checked={!!form.is_active} onChange={e => setF('is_active', e.target.checked ? 1 : 0)} />
              สถานะ: {form.is_active ? 'ใช้งาน' : 'ปิดใช้งาน'}
            </label>
          </div>

          {/* ── Special Pricing Section — Req 2 & 3 ─────────────── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => setShowAdvanced(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0, marginBottom: showAdvanced ? 12 : 0,
              }}
            >
              <Star size={14} color="#f59e0b" />
              ราคาพิเศษ &amp; ส่วนลด (ขั้นสูง)
              <ChevronDown size={14} style={{ marginLeft: 'auto', transform: showAdvanced ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </button>

            {showAdvanced && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Special Price toggle row */}
                <div style={{ padding: '12px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.special_price_enabled ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Star size={14} color="#f59e0b" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>ราคาพิเศษ</span>
                    </div>
                    <ToggleSwitch checked={!!form.special_price_enabled} onChange={v => setF('special_price_enabled', v ? 1 : 0)} />
                  </div>
                  {!!form.special_price_enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>฿</span>
                      <input
                        className="glass-input"
                        type="number"
                        placeholder="ราคาพิเศษ (฿)"
                        value={form.special_price}
                        onChange={e => setF('special_price', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                        {form.sell_price && form.special_price
                          ? `ลด ${Math.round((1 - parseFloat(form.special_price) / parseFloat(form.sell_price)) * 100)}%`
                          : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Discount % toggle row */}
                <div style={{ padding: '12px 14px', background: 'rgba(251,146,60,0.06)', border: '1px solid rgba(251,146,60,0.15)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: form.discount_enabled ? 10 : 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Percent size={14} color="#fb923c" />
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>ส่วนลด (%)</span>
                    </div>
                    <ToggleSwitch checked={!!form.discount_enabled} onChange={v => setF('discount_enabled', v ? 1 : 0)} />
                  </div>
                  {!!form.discount_enabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        className="glass-input"
                        type="number"
                        min={0} max={100}
                        placeholder="% ส่วนลด (0-100)"
                        value={form.discount_percent}
                        onChange={e => setF('discount_percent', e.target.value)}
                        style={{ flex: 1 }}
                      />
                      <span style={{ fontSize: 12, color: '#fb923c' }}>%</span>
                      {form.sell_price && form.discount_percent && (
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                          ราคาจริง ฿{(parseFloat(form.sell_price) * (1 - parseFloat(form.discount_percent) / 100)).toFixed(0)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Time Schedule — Req 3 */}
                {(!!form.special_price_enabled || !!form.discount_enabled) && (
                  <div style={{ padding: '12px 14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock size={14} color="#818cf8" />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>ช่วงเวลาราคาพิเศษ</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSchedules([...schedules, { start: '09:00', end: '12:00' }])}
                        className="glass-btn btn-secondary"
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      ><Plus size={11} /> เพิ่มช่วง</button>
                    </div>
                    {schedules.length === 0 && (
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '6px 0' }}>
                        ไม่มีช่วงเวลา = ใช้ราคาพิเศษตลอดเวลา
                      </div>
                    )}
                    {schedules.map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <input type="time" className="glass-input" value={s.start} onChange={e => {
                          const arr = [...schedules]; arr[i] = { ...arr[i], start: e.target.value }; setSchedules(arr)
                        }} style={{ flex: 1, fontSize: 12 }} />
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>–</span>
                        <input type="time" className="glass-input" value={s.end} onChange={e => {
                          const arr = [...schedules]; arr[i] = { ...arr[i], end: e.target.value }; setSchedules(arr)
                        }} style={{ flex: 1, fontSize: 12 }} />
                        <button type="button" onClick={() => setSchedules(schedules.filter((_, j) => j !== i))}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: 4 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                    {schedules.length > 0 && (
                      <div style={{ fontSize: 11, color: 'rgba(99,102,241,0.7)', marginTop: 6 }}>
                        💡 ราคาพิเศษจะใช้งานเฉพาะในช่วงเวลาที่กำหนด (ตามนาฬิกาเครื่อง)
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} className="glass-btn btn-secondary" style={{ fontSize: 13 }}>ยกเลิก</button>
          <button onClick={async () => {
            let categoryId = form.category_id
            if (isCustomCategory && customCategoryName.trim()) {
              const name = customCategoryName.trim()
              const existing = categories.find(c => c.name.toLowerCase() === name.toLowerCase())
              if (existing) {
                categoryId = existing.id
              } else if (api) {
                const res = await api.categories.create({ name, icon: '📦', color: '#22c55e', sort_order: categories.length + 1 })
                if (res.success && res.data) categoryId = res.data.id
              }
            }
            const { image_path_preview, ...cleanForm } = form
            onSave({
              ...cleanForm,
              category_id: categoryId || null,
              cost_price: parseFloat(form.cost_price) || 0,
              sell_price: parseFloat(form.sell_price) || 0,
              stock_qty: parseFloat(form.stock_qty) || 0,
              min_stock: parseFloat(form.min_stock) || 0,
              special_price: form.special_price ? parseFloat(form.special_price) : null,
              discount_percent: form.discount_percent ? parseFloat(form.discount_percent) : null,
            })
          }} className="glass-btn btn-primary" style={{ fontSize: 13, fontWeight: 700 }}>
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
