import { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, Truck, Phone, Mail, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Supplier } from '../../types'

const MOCK_SUPPLIERS: Supplier[] = [
  { id: 1, code: 'SUP001', name: 'บริษัท เทค ซัพพลาย จำกัด', contact_name: 'คุณสมศักดิ์', phone: '02-111-2222', email: 'supply@tech.co.th', address: '100 ถนนพระราม 4 กรุงเทพ', payment_terms: 30, is_active: 1, created_at: '2024-01-01' },
  { id: 2, code: 'SUP002', name: 'ห้างหุ้นส่วน แฟชั่น กรุ๊ป', contact_name: 'คุณอารีย์', phone: '081-333-4444', email: 'fashion@group.com', payment_terms: 15, is_active: 1, created_at: '2024-01-02' },
  { id: 3, code: 'SUP003', name: 'โรงงาน ฟู้ด อินดัสตรี', contact_name: 'คุณประเสริฐ', phone: '038-555-6666', payment_terms: 45, is_active: 1, created_at: '2024-01-03' },
]

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '', tax_id: '', payment_terms: 30, note: '' })

  const filtered = suppliers.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search) || s.code.includes(search)
  )

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const api = (window as any).api
    if (!api?.suppliers) return
    const res = await api.suppliers.getAll()
    if (res.success && res.data) {
      setSuppliers(res.data)
    }
  }

  const openModal = (s?: Supplier) => {
    setEditing(s || null)
    setForm(s ? { name: s.name, contact_name: s.contact_name || '', phone: s.phone || '', email: s.email || '', address: s.address || '', tax_id: s.tax_id || '', payment_terms: s.payment_terms, note: s.note || '' } : { name: '', contact_name: '', phone: '', email: '', address: '', tax_id: '', payment_terms: 30, note: '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('กรุณากรอกชื่อซัพพลายเออร์'); return }
    const api = (window as any).api
    if (api?.suppliers) {
      if (editing) {
        const res = await api.suppliers.update(editing.id, form)
        if (res.success) {
          toast.success('แก้ไขซัพพลายเออร์แล้ว')
        } else {
          toast.error(res.error || 'เกิดข้อผิดพลาดในการแก้ไข')
          return
        }
      } else {
        const res = await api.suppliers.create(form)
        if (res.success) {
          toast.success('เพิ่มซัพพลายเออร์แล้ว')
        } else {
          toast.error(res.error || 'เกิดข้อผิดพลาดในการเพิ่ม')
          return
        }
      }
      loadData()
    } else {
      if (editing) {
        setSuppliers(s => s.map(x => x.id === editing.id ? { ...x, ...form } : x))
        toast.success('แก้ไขซัพพลายเออร์แล้ว')
      } else {
        const newS: Supplier = { id: Date.now(), code: `SUP${String(suppliers.length + 1).padStart(3, '0')}`, ...form, is_active: 1, created_at: new Date().toISOString() }
        setSuppliers(s => [...s, newS])
        toast.success('เพิ่มซัพพลายเออร์แล้ว')
      }
    }
    setShowModal(false)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบซัพพลายเออร์นี้?')) return
    const api = (window as any).api
    if (api?.suppliers) {
      const res = await api.suppliers.delete(id)
      if (res.success) {
        toast.success('ลบซัพพลายเออร์แล้ว')
        loadData()
      } else {
        toast.error(res.error || 'ไม่สามารถลบได้')
      }
    } else {
      setSuppliers(s => s.filter(x => x.id !== id))
      toast.success('ลบซัพพลายเออร์แล้ว')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาซัพพลายเออร์..." style={{ paddingLeft: 36, maxWidth: 320 }} />
        </div>
        <button onClick={() => openModal()} className="glass-btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
          <Plus size={15} /> เพิ่มซัพพลายเออร์
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'ซัพพลายเออร์ทั้งหมด', value: suppliers.length, color: '#3b82f6' },
          { label: 'เฉลี่ยเครดิต', value: `${suppliers.length > 0 ? Math.round(suppliers.reduce((s, x) => s + x.payment_terms, 0) / suppliers.length) : 0} วัน`, color: '#f59e0b' },
          { label: 'ใช้งานอยู่', value: suppliers.filter(s => s.is_active).length, color: '#22c55e' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 18px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr><th>ซัพพลายเออร์</th><th>ผู้ติดต่อ</th><th>ติดต่อ</th><th>เครดิต</th><th>สถานะ</th><th style={{ width: 80 }}></th></tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={16} color="#60a5fa" />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{s.code}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{s.contact_name || '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {s.phone && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{s.phone}</span>}
                    {s.email && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{s.email}</span>}
                  </div>
                </td>
                <td>
                  <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,0.12)', color: '#fcd34d', border: '1px solid rgba(245,158,11,0.25)' }}>
                    {s.payment_terms} วัน
                  </span>
                </td>
                <td><span className="badge badge-green">ใช้งาน</span></td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openModal(s)} style={{ padding: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', color: '#60a5fa', display: 'flex' }}><Edit2 size={13} /></button>
                    <button onClick={() => handleDelete(s.id)} style={{ padding: '5px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#fca5a5', display: 'flex' }}><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: '60px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
            <Truck size={40} strokeWidth={1} style={{ margin: '0 auto 12px' }} />
            <p>ไม่พบซัพพลายเออร์</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal-content" style={{ width: 500, padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{editing ? 'แก้ไขซัพพลายเออร์' : 'เพิ่มซัพพลายเออร์ใหม่'}</div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['name','ชื่อบริษัท/ร้าน *'], ['contact_name','ชื่อผู้ติดต่อ'], ['phone','เบอร์โทรศัพท์'], ['email','อีเมล'], ['address','ที่อยู่'], ['tax_id','เลขผู้เสียภาษี']].map(([k, l]) => (
                <div key={k}>
                  <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>{l}</label>
                  <input
                    className="glass-input"
                    value={(form as any)[k]}
                    onChange={e => {
                      const val = e.target.value
                      setForm(f => ({ ...f, [k]: val }))
                    }}
                    placeholder={l}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>เครดิต (วัน)</label>
                <input
                  className="glass-input"
                  type="number"
                  value={form.payment_terms}
                  onChange={e => {
                    const val = parseInt(e.target.value) || 0
                    setForm(f => ({ ...f, payment_terms: val }))
                  }}
                />
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
