import { useState } from 'react'
import { Warehouse, ArrowUp, ArrowDown, RefreshCw, AlertTriangle, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Product } from '../../types'

const api = (window as any).api

const MOCK_PRODUCTS: Product[] = [
  { id: 1, name: 'กาแฟอเมริกาโน่', barcode: '8850006110150', sku: 'P001', sell_price: 85, cost_price: 25, stock_qty: 100, min_stock: 10, max_stock: 200, unit: 'แก้ว', category_name: 'อาหาร', category_icon: '🍔', category_color: '#F59E0B', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 2, name: 'สมาร์ทโฟน X12', barcode: '8850006110154', sku: 'P003', sell_price: 15900, cost_price: 10000, stock_qty: 2, min_stock: 3, max_stock: 20, unit: 'เครื่อง', category_name: 'ไฟฟ้า', category_icon: '📱', category_color: '#3B82F6', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 3, name: 'ลิปสติก Matte', barcode: '8850006110162', sku: 'P004', sell_price: 350, cost_price: 100, stock_qty: 0, min_stock: 10, max_stock: 50, unit: 'แท่ง', category_name: 'ความงาม', category_icon: '💄', category_color: '#8B5CF6', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
  { id: 4, name: 'น้ำเปล่า 1.5L', barcode: '8850006110169', sku: 'P010', sell_price: 15, cost_price: 5, stock_qty: 500, min_stock: 50, max_stock: 1000, unit: 'ขวด', category_name: 'อาหาร', category_icon: '🍔', category_color: '#F59E0B', is_service: 0, is_active: 1, has_variants: 0, tax_rate: 7, created_at: '', updated_at: '' },
]

type StockFilter = 'all' | 'low' | 'out'

export default function InventoryPage() {
  const [filter, setFilter] = useState<StockFilter>('all')
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'adjust'>('in')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  const filtered = MOCK_PRODUCTS.filter(p => {
    if (p.is_service) return false
    if (filter === 'low') return p.stock_qty <= p.min_stock && p.stock_qty > 0
    if (filter === 'out') return p.stock_qty <= 0
    return true
  })

  const totalValue = MOCK_PRODUCTS.reduce((s, p) => s + p.stock_qty * p.cost_price, 0)
  const lowCount = MOCK_PRODUCTS.filter(p => !p.is_service && p.stock_qty <= p.min_stock).length
  const outCount = MOCK_PRODUCTS.filter(p => !p.is_service && p.stock_qty <= 0).length

  const handleAdjust = async () => {
    if (!adjustProduct || !adjustQty) return
    const qty = parseFloat(adjustQty)
    if (isNaN(qty) || qty <= 0) { toast.error('จำนวนไม่ถูกต้อง'); return }
    if (api) {
      await api.inventory.adjustStock({ product_id: adjustProduct.id, type: adjustType, qty, note: adjustNote })
    }
    toast.success(`ปรับสต็อก ${adjustProduct.name} แล้ว`)
    setAdjustProduct(null)
    setAdjustQty('')
    setAdjustNote('')
  }

  const stockStatus = (p: Product) => {
    if (p.stock_qty <= 0) return { label: 'หมด', color: '#ef4444' }
    if (p.stock_qty <= p.min_stock) return { label: 'ใกล้หมด', color: '#f59e0b' }
    return { label: 'ปกติ', color: '#22c55e' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'มูลค่าสต็อกรวม', value: `฿${totalValue.toLocaleString()}`, color: '#22c55e', icon: <Package size={18} /> },
          { label: 'สินค้าทั้งหมด', value: MOCK_PRODUCTS.filter(p => !p.is_service).length, color: '#3b82f6', icon: <Warehouse size={18} /> },
          { label: 'ใกล้หมด', value: lowCount, color: '#f59e0b', icon: <AlertTriangle size={18} /> },
          { label: 'หมดสต็อก', value: outCount, color: '#ef4444', icon: <AlertTriangle size={18} /> },
        ].map((s, i) => (
          <div key={i} style={{ padding: '16px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: s.color, opacity: 0.7 }}>{s.icon}</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['all', 'ทั้งหมด'], ['low', 'ใกล้หมด'], ['out', 'หมดสต็อก']].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v as StockFilter)}
            style={{
              padding: '7px 16px', borderRadius: 100, fontSize: 13, fontWeight: 500, cursor: 'pointer', border: '1px solid transparent', fontFamily: 'inherit',
              background: filter === v ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
              color: filter === v ? '#22c55e' : 'rgba(255,255,255,0.5)',
              borderColor: filter === v ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
            }}>{l}</button>
        ))}
      </div>

      {/* Products table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>สินค้า</th>
              <th>สต็อกปัจจุบัน</th>
              <th>ขั้นต่ำ</th>
              <th>ต้นทุน/ชิ้น</th>
              <th>มูลค่ารวม</th>
              <th>สถานะ</th>
              <th style={{ width: 120 }}>ปรับสต็อก</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const { label, color } = stockStatus(p)
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{p.category_icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{p.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.barcode}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, color: p.stock_qty <= 0 ? '#ef4444' : p.stock_qty <= p.min_stock ? '#fcd34d' : 'rgba(255,255,255,0.9)', fontSize: 15 }}>
                    {p.stock_qty} {p.unit}
                  </td>
                  <td style={{ color: 'rgba(255,255,255,0.45)' }}>{p.min_stock} {p.unit}</td>
                  <td style={{ color: 'rgba(255,255,255,0.6)' }}>฿{p.cost_price.toLocaleString()}</td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>฿{(p.stock_qty * p.cost_price).toLocaleString()}</td>
                  <td>
                    <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}33` }}>
                      {label}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setAdjustProduct(p); setAdjustType('in') }}
                        style={{ padding: '5px 10px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, cursor: 'pointer', color: '#22c55e', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                        <ArrowUp size={12} /> รับเข้า
                      </button>
                      <button onClick={() => { setAdjustProduct(p); setAdjustType('out') }}
                        style={{ padding: '5px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fca5a5', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                        <ArrowDown size={12} /> ตัดออก
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Adjust modal */}
      {adjustProduct && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdjustProduct(null)}>
          <div className="modal-content" style={{ width: 400, padding: 24 }}>
            <h3 style={{ color: 'rgba(255,255,255,0.9)', margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>
              {adjustType === 'in' ? '📥 รับสินค้าเข้า' : adjustType === 'out' ? '📤 ตัดสินค้าออก' : '🔄 ปรับยอด'} 
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, margin: '0 0 20px' }}>{adjustProduct.name} · สต็อกปัจจุบัน: {adjustProduct.stock_qty} {adjustProduct.unit}</p>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['in','รับเข้า'],['out','ตัดออก'],['adjust','ปรับยอด']].map(([t, l]) => (
                <button key={t} onClick={() => setAdjustType(t as 'in'|'out'|'adjust')}
                  style={{ flex: 1, padding: '8px', background: adjustType === t ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)', border: `1px solid ${adjustType === t ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', color: adjustType === t ? '#22c55e' : 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'inherit' }}>
                  {l}
                </button>
              ))}
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>จำนวน ({adjustProduct.unit})</label>
              <input className="glass-input" type="number" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} placeholder="0" autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>หมายเหตุ</label>
              <input className="glass-input" value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder="เหตุผลการปรับสต็อก" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAdjustProduct(null)} className="glass-btn btn-secondary" style={{ flex: 1, fontSize: 13 }}>ยกเลิก</button>
              <button onClick={handleAdjust} className="glass-btn btn-primary" style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
