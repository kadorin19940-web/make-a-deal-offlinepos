import { useState, useEffect } from 'react'
import { Warehouse, ArrowUp, ArrowDown, AlertTriangle, Package, Download, Loader, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import type { Product } from '../../types'
import { useAuthStore } from '../../store'

const api = (window as any).api

type StockFilter = 'all' | 'low' | 'out'

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [filter, setFilter] = useState<StockFilter>('all')
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null)
  const [adjustType, setAdjustType] = useState<'in' | 'out' | 'adjust'>('in')
  const [adjustQty, setAdjustQty] = useState('')
  const [adjustNote, setAdjustNote] = useState('')
  const [exporting, setExporting] = useState(false)
  const [loading, setLoading] = useState(true)

  // Auth store to check role
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  const fetchProducts = async () => {
    if (!api?.products) return
    try {
      setLoading(true)
      const res = await api.products.getAll()
      if (res.success) {
        setProducts(res.data)
      } else {
        toast.error(res.error || 'ไม่สามารถดึงข้อมูลคลังสินค้าได้')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProducts()
  }, [])

  const handleDeleteProduct = async (id: number, name: string) => {
    if (!isAdmin) {
      toast.error('ขออภัย เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่มีสิทธิ์ลบสินค้า')
      return
    }

    const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบสินค้า "${name}" ออกจากระบบ? การดำเนินการนี้จะลบรายการสินค้าและข้อมูลประวัติต่างๆ แบบถาวร`)
    if (!confirmDelete) return

    try {
      const res = await api.products.delete(id)
      if (res.success) {
        toast.success('ลบสินค้าเรียบร้อยแล้ว')
        fetchProducts()
      } else {
        toast.error(res.error || 'ลบสินค้าล้มเหลว')
      }
    } catch (e) {
      toast.error(`เกิดข้อผิดพลาด: ${String(e)}`)
    }
  }

  // Batch Processing Excel Exporter for Inventory Stock
  const handleExportExcel = async () => {
    if (exporting) return
    setExporting(true)
    const toastId = toast.loading('กำลังจัดเตรียมข้อมูลคลังสินค้าเพื่อส่งออก...')

    try {
      const dataToExport = [...products]
      const chunkSize = 5 // process 5 records in a batch
      const processedRows: Record<string, unknown>[] = []

      // Batch processing yielding to event loop
      for (let i = 0; i < dataToExport.length; i += chunkSize) {
        await new Promise(resolve => setTimeout(resolve, 60)) // Yield to main thread
        const chunk = dataToExport.slice(i, i + chunkSize).map(item => ({
          'บาร์โค้ด': item.barcode || '—',
          'SKU': item.sku || '—',
          'ชื่อสินค้า': item.name,
          'หมวดหมู่': item.category_name || '—',
          'สต็อกคงเหลือ': item.stock_qty,
          'หน่วย': item.unit,
          'สต็อกขั้นต่ำ': item.min_stock,
          'สต็อกสูงสุด': item.max_stock,
          'ต้นทุน/หน่วย (บาท)': item.cost_price,
          'มูลค่าต้นทุนรวม (บาท)': item.stock_qty * item.cost_price,
          'ราคาขาย (บาท)': item.sell_price,
        }))
        processedRows.push(...chunk)
      }

      const ws = XLSX.utils.json_to_sheet(processedRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'คลังสินค้า')

      if (api) {
        const defaultName = `รายการคลังสินค้า_${new Date().toISOString().slice(0, 10)}.xlsx`
        const saveRes = await api.dialog.saveFile(defaultName, [{ name: 'Excel Files', extensions: ['xlsx'] }])
        
        if (saveRes.filePath) {
          const excelBase64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
          const res = await api.fs.writeExcel(saveRes.filePath, excelBase64)
          if (res.success) {
            toast.success('ส่งออกรายการคลังสินค้าสำเร็จแล้ว!', { id: toastId })
          } else {
            throw new Error(res.error || 'เขียนไฟล์ล้มเหลว')
          }
        } else {
          toast.dismiss(toastId)
        }
      } else {
        // Fallback for browser
        XLSX.writeFile(wb, `รายการคลังสินค้า_${new Date().toISOString().slice(0, 10)}.xlsx`)
        toast.success('ส่งออกรายการคลังสินค้าสำเร็จแล้ว! (โหมดบราวเซอร์)', { id: toastId })
      }
    } catch (error) {
      console.error(error)
      toast.error(`ส่งออกคลังสินค้าล้มเหลว: ${String(error)}`, { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const filtered = products.filter(p => {
    if (p.is_service) return false
    if (filter === 'low') return p.stock_qty <= p.min_stock && p.stock_qty > 0
    if (filter === 'out') return p.stock_qty <= 0
    return true
  })

  const totalValue = products.reduce((s, p) => s + (p.stock_qty * (p.cost_price || 0)), 0)
  const lowCount = products.filter(p => !p.is_service && p.stock_qty <= p.min_stock && p.stock_qty > 0).length
  const outCount = products.filter(p => !p.is_service && p.stock_qty <= 0).length

  const handleAdjust = async () => {
    if (!adjustProduct || !adjustQty) return
    const qty = parseFloat(adjustQty)
    if (isNaN(qty) || qty <= 0) { toast.error('จำนวนไม่ถูกต้อง'); return }
    
    try {
      if (api) {
        const res = await api.inventory.adjustStock({ 
          product_id: adjustProduct.id, 
          type: adjustType, 
          qty, 
          note: adjustNote || 'ปรับปรุงผ่านหน้าคลังสินค้า' 
        })
        if (res.success) {
          toast.success(`ปรับสต็อก ${adjustProduct.name} เรียบร้อยแล้ว`)
          fetchProducts()
        } else {
          toast.error(res.error || 'ปรับสต็อกล้มเหลว')
        }
      }
    } catch (e) {
      toast.error('ปรับสต็อกล้มเหลว: ' + String(e))
    } finally {
      setAdjustProduct(null)
      setAdjustQty('')
      setAdjustNote('')
    }
  }

  const stockStatus = (p: Product) => {
    if (p.stock_qty <= 0) return { label: 'หมด', color: '#ef4444' }
    if (p.stock_qty <= p.min_stock) return { label: 'ใกล้หมด', color: '#f59e0b' }
    return { label: 'ปกติ', color: '#22c55e' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      {/* Loading Spinner Overlay during export */}
      {exporting && (
        <div style={{
          position: 'absolute', inset: -10, background: 'rgba(10,10,15,0.7)',
          zIndex: 100, borderRadius: 20, display: 'flex', alignItems: 'center',
          justifyContent: 'center', backdropFilter: 'blur(4px)',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div className="animate-spin text-green-500">
              <Loader size={36} className="animate-spin" />
            </div>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>กำลังประมวลผลสต็อกสินค้า...</span>
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'มูลค่าสต็อกรวม', value: `฿${totalValue.toLocaleString()}`, color: '#22c55e', icon: <Package size={18} /> },
          { label: 'สินค้าทั้งหมด', value: products.filter(p => !p.is_service).length, color: '#3b82f6', icon: <Warehouse size={18} /> },
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

      {/* Filter buttons and Export */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
        <button 
          onClick={handleExportExcel}
          disabled={exporting}
          className={`glass-btn ${exporting ? 'opacity-50 cursor-not-allowed' : 'btn-secondary'}`}
          style={{ padding: '7px 16px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, borderRadius: 100 }}
        >
          <Download size={14} /> ส่งออก Excel
        </button>
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
              <th style={{ width: 180 }}>การจัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: 'rgba(255,255,255,0.3)' }}>
                  กำลังโหลดข้อมูลคลังสินค้า...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: 'rgba(255,255,255,0.3)' }}>
                  ไม่มีสินค้าในคลัง
                </td>
              </tr>
            ) : (
              filtered.map(p => {
                const { label, color } = stockStatus(p)
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 20 }}>{p.category_icon || '📦'}</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{p.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.barcode || '—'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 700, color: p.stock_qty <= 0 ? '#ef4444' : p.stock_qty <= (p.min_stock || 0) ? '#fcd34d' : 'rgba(255,255,255,0.9)', fontSize: 15 }}>
                      {p.stock_qty} {p.unit || 'ชิ้น'}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.45)' }}>{p.min_stock || 0} {p.unit || 'ชิ้น'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>฿{(p.cost_price || 0).toLocaleString()}</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>฿{(p.stock_qty * (p.cost_price || 0)).toLocaleString()}</td>
                    <td>
                      <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${color}18`, color, border: `1px solid ${color}33` }}>
                        {label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button onClick={() => { setAdjustProduct(p); setAdjustType('in') }}
                          style={{ padding: '5px 8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, cursor: 'pointer', color: '#22c55e', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                          <ArrowUp size={12} /> รับเข้า
                        </button>
                        <button onClick={() => { setAdjustProduct(p); setAdjustType('out') }}
                          style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fca5a5', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}>
                          <ArrowDown size={12} /> ตัดออก
                        </button>
                        
                        {isAdmin && (
                          <button onClick={() => handleDeleteProduct(p.id, p.name)} 
                            title="ลบสินค้าถาวร"
                            style={{ padding: '5px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
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
