import { useState, useEffect } from 'react'
import { Plus, Tag, Percent, DollarSign, X, Edit2, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Promotion } from '../../types'

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  percent_off: { label: 'ลด %', color: '#22c55e', icon: <Percent size={14} /> },
  amount_off: { label: 'ลด ฿', color: '#3b82f6', icon: <DollarSign size={14} /> },
  coupon: { label: 'คูปอง', color: '#8b5cf6', icon: <Tag size={14} /> },
  buy_x_get_y: { label: 'ซื้อครบแถม', color: '#f59e0b', icon: <Tag size={14} /> },
}

export default function PromotionsPage() {
  const [promos, setPromos] = useState<Promotion[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [form, setForm] = useState({ name: '', type: 'percent_off', code: '', discount_value: 0, min_purchase: 0, max_discount: '', usage_limit: '', is_active: 1 })

  const api = (window as any).api

  const loadData = async () => {
    if (!api?.promotions) return
    try {
      const res = await api.promotions.getAll()
      if (res.success && res.data) {
        setPromos(res.data)
      }
    } catch (error) {
      console.error(error)
      toast.error('ไม่สามารถโหลดข้อมูลโปรโมชันได้')
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const toggleActive = async (id: number) => {
    const promo = promos.find(x => x.id === id)
    if (!promo) return
    const newStatus = promo.is_active ? 0 : 1
    
    if (api?.promotions) {
      try {
        const res = await api.promotions.update(id, { is_active: newStatus })
        if (res.success) {
          setPromos(p => p.map(x => x.id === id ? { ...x, is_active: newStatus } : x))
          toast.success(newStatus ? 'เปิดใช้งานโปรโมชันแล้ว' : 'ปิดใช้งานโปรโมชันแล้ว')
        } else {
          toast.error(res.error || 'เกิดข้อผิดพลาดในการแก้ไขสถานะ')
        }
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล')
      }
    } else {
      setPromos(p => p.map(x => x.id === id ? { ...x, is_active: newStatus } : x))
      toast.success(newStatus ? 'เปิดใช้งานโปรโมชันแล้ว' : 'ปิดใช้งานโปรโมชันแล้ว')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบโปรโมชันนี้?')) return
    
    if (api?.promotions) {
      try {
        const res = await api.promotions.delete(id)
        if (res.success) {
          toast.success('ลบโปรโมชันแล้ว')
          loadData()
        } else {
          toast.error(res.error || 'เกิดข้อผิดพลาดในการลบ')
        }
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล')
      }
    } else {
      setPromos(p => p.filter(x => x.id !== id))
      toast.success('ลบโปรโมชันแล้ว')
    }
  }

  const openEdit = (p?: Promotion) => {
    setEditing(p || null)
    setForm(p ? { name: p.name, type: p.type, code: p.code || '', discount_value: p.discount_value, min_purchase: p.min_purchase, max_discount: String(p.max_discount ?? ''), usage_limit: String(p.usage_limit ?? ''), is_active: p.is_active } : { name: '', type: 'percent_off', code: '', discount_value: 0, min_purchase: 0, max_discount: '', usage_limit: '', is_active: 1 })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('กรุณากรอกชื่อโปรโมชัน'); return }
    const promoType = form.type as Promotion['type']
    
    const payload = {
      name: form.name,
      type: promoType,
      code: form.code.trim() || null,
      discount_value: Number(form.discount_value),
      min_purchase: Number(form.min_purchase),
      max_discount: form.max_discount ? Number(form.max_discount) : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      is_active: form.is_active,
      apply_to: 'all'
    }

    if (api?.promotions) {
      try {
        let res
        if (editing) {
          res = await api.promotions.update(editing.id, payload)
        } else {
          res = await api.promotions.create(payload)
        }
        
        if (res.success) {
          toast.success(editing ? 'แก้ไขโปรโมชันแล้ว' : 'เพิ่มโปรโมชันแล้ว')
          loadData()
          setShowModal(false)
        } else {
          toast.error(res.error || 'เกิดข้อผิดพลาดในการบันทึก')
        }
      } catch (error) {
        toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อข้อมูล')
      }
    } else {
      if (editing) {
        setPromos(p => p.map(x => x.id === editing.id
          ? {
              ...x,
              ...payload,
              code: payload.code || undefined,
              max_discount: payload.max_discount || undefined,
              usage_limit: payload.usage_limit || undefined,
            }
          : x
        ))
        toast.success('แก้ไขโปรโมชันแล้ว')
      } else {
        const newP: Promotion = {
          id: Date.now(),
          ...payload,
          code: payload.code || undefined,
          max_discount: payload.max_discount || undefined,
          usage_limit: payload.usage_limit || undefined,
          usage_count: 0,
          created_at: new Date().toISOString()
        }
        setPromos(p => [...p, newP])
        toast.success('เพิ่มโปรโมชันแล้ว')
      }
      setShowModal(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => openEdit()} className="glass-btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
          <Plus size={15} /> เพิ่มโปรโมชัน
        </button>
      </div>

      {/* Promo cards grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
        {promos.map(p => {
          const conf = TYPE_CONFIG[p.type] || TYPE_CONFIG.coupon
          return (
            <div key={p.id} style={{
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${p.is_active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`,
              borderRadius: 18, padding: 20, opacity: p.is_active ? 1 : 0.55,
              transition: 'all 0.2s',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, background: `${conf.color}18`, border: `1px solid ${conf.color}33`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: conf.color }}>
                    {conf.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{p.name}</div>
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: `${conf.color}18`, color: conf.color, border: `1px solid ${conf.color}33` }}>{conf.label}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(p)} style={{ padding: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', color: '#60a5fa', display: 'flex' }}><Edit2 size={12} /></button>
                  <button onClick={() => handleDelete(p.id)} style={{ padding: '5px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fca5a5', display: 'flex' }}><Trash2 size={12} /></button>
                </div>
              </div>

              {p.code && (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '6px 12px', marginBottom: 10, fontFamily: 'monospace', fontSize: 15, fontWeight: 800, color: conf.color, letterSpacing: 2, textAlign: 'center' }}>
                  {p.code}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>ส่วนลด</span>
                  <span style={{ color: conf.color, fontWeight: 700 }}>
                    {p.type === 'percent_off' ? `${p.discount_value}%` : `฿${p.discount_value.toLocaleString()}`}
                    {p.max_discount ? ` (สูงสุด ฿${p.max_discount.toLocaleString()})` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>ยอดขั้นต่ำ</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>฿{p.min_purchase.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>ใช้แล้ว</span>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{p.usage_count}{p.usage_limit ? ` / ${p.usage_limit}` : ''} ครั้ง</span>
                </div>
              </div>

              {/* Toggle */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: p.is_active ? '#22c55e' : 'rgba(255,255,255,0.35)' }}>
                  {p.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                </span>
                <button onClick={() => toggleActive(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: p.is_active ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
                  {p.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ width: 460, padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{editing ? 'แก้ไขโปรโมชัน' : 'เพิ่มโปรโมชันใหม่'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>ชื่อโปรโมชัน *</label>
                <input
                  className="glass-input"
                  value={form.name}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, name: val }))
                  }}
                  placeholder="ชื่อโปรโมชัน"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>ประเภท</label>
                <select
                  className="glass-input"
                  value={form.type}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, type: val }))
                  }}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}
                >
                  <option value="percent_off">ลด % จากราคา</option>
                  <option value="amount_off">ลดจำนวนเงิน ฿</option>
                  <option value="buy_x_get_y">ซื้อครบแถม</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>คูปองโค้ด</label>
                <input
                  className="glass-input"
                  value={form.code}
                  onChange={e => {
                    const val = e.target.value.toUpperCase()
                    setForm(f => ({ ...f, code: val }))
                  }}
                  placeholder="เช่น SALE20 (ว่างได้)"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>
                    มูลค่าส่วนลด {form.type === 'percent_off' ? '(%)' : '(฿)'}
                  </label>
                  <input
                    className="glass-input"
                    type="number"
                    value={form.discount_value}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0
                      setForm(f => ({ ...f, discount_value: val }))
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>ยอดขั้นต่ำ (฿)</label>
                  <input
                    className="glass-input"
                    type="number"
                    value={form.min_purchase}
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0
                      setForm(f => ({ ...f, min_purchase: val }))
                    }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>ส่วนลดสูงสุด (฿)</label>
                  <input
                    className="glass-input"
                    type="number"
                    value={form.max_discount}
                    onChange={e => {
                      const val = e.target.value
                      setForm(f => ({ ...f, max_discount: val }))
                    }}
                    placeholder="ไม่จำกัด"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>จำกัดการใช้ (ครั้ง)</label>
                  <input
                    className="glass-input"
                    type="number"
                    value={form.usage_limit}
                    onChange={e => {
                      const val = e.target.value
                      setForm(f => ({ ...f, usage_limit: val }))
                    }}
                    placeholder="ไม่จำกัด"
                  />
                </div>
              </div>
            </div>
            <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} className="glass-btn btn-secondary" style={{ fontSize: 13 }}>ยกเลิก</button>
              <button onClick={handleSave} className="glass-btn btn-primary" style={{ fontSize: 13, fontWeight: 700 }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
