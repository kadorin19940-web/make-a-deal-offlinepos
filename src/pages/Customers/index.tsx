import { useState } from 'react'
import { Plus, Search, Edit2, Star, Phone, Mail, Crown, X } from 'lucide-react'
import toast from 'react-hot-toast'
import type { Customer } from '../../types'

const MOCK_CUSTOMERS: Customer[] = [
  { id: 1, code: 'CUST001', name: 'คุณสมชาย ใจดี', phone: '081-234-5678', email: 'somchai@email.com', customer_type: 'retail', price_level: 1, credit_limit: 0, credit_days: 0, points: 250, total_spend: 15000, discount_percent: 0, is_active: 1, created_at: '2024-01-01' },
  { id: 2, code: 'CUST002', name: 'บริษัท ABC จำกัด', phone: '02-345-6789', email: 'abc@company.com', customer_type: 'wholesale', price_level: 2, credit_limit: 50000, credit_days: 30, points: 0, total_spend: 85000, discount_percent: 5, is_active: 1, created_at: '2024-01-02' },
  { id: 3, code: 'CUST003', name: 'คุณมาลี สวยงาม', phone: '089-876-5432', customer_type: 'member', price_level: 1, credit_limit: 0, credit_days: 0, points: 1200, total_spend: 42000, discount_percent: 0, is_active: 1, created_at: '2024-01-03' },
  { id: 4, code: 'CUST004', name: 'คุณวิชัย รวยมาก', phone: '090-111-2222', customer_type: 'vip', price_level: 3, credit_limit: 200000, credit_days: 60, points: 8500, total_spend: 320000, discount_percent: 10, is_active: 1, created_at: '2024-01-04' },
]

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  retail: { label: 'ปลีก', color: '#64748b', icon: null },
  wholesale: { label: 'ส่ง', color: '#3b82f6', icon: null },
  member: { label: 'สมาชิก', color: '#22c55e', icon: null },
  vip: { label: 'VIP', color: '#f59e0b', icon: <Crown size={10} /> },
}

export default function CustomersPage() {
  const [customers] = useState<Customer[]>(MOCK_CUSTOMERS)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Customer | null>(null)

  const filtered = customers.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search) || c.code.includes(search)
  )

  const typeConfig = (t: string) => TYPE_CONFIG[t] || TYPE_CONFIG.retail

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header actions */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
          <input className="glass-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาชื่อ เบอร์ รหัสลูกค้า..." style={{ paddingLeft: 36, maxWidth: 320 }} />
        </div>
        <button onClick={() => { setEditing(null); setShowModal(true) }} className="glass-btn btn-primary" style={{ padding: '8px 16px', fontSize: 13, fontWeight: 700 }}>
          <Plus size={15} />เพิ่มลูกค้า
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'ลูกค้าทั้งหมด', value: customers.length, color: '#3b82f6' },
          { label: 'สมาชิก/VIP', value: customers.filter(c => ['member','vip'].includes(c.customer_type)).length, color: '#f59e0b' },
          { label: 'แต้มรวม', value: customers.reduce((s,c) => s + c.points, 0).toLocaleString(), color: '#22c55e' },
          { label: 'ยอดรวมทั้งหมด', value: `฿${customers.reduce((s,c) => s + c.total_spend, 0).toLocaleString()}`, color: '#8b5cf6' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Customers table */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>ลูกค้า</th>
              <th>ติดต่อ</th>
              <th>ประเภท</th>
              <th>แต้มสะสม</th>
              <th>ยอดซื้อรวม</th>
              <th>ส่วนลด</th>
              <th style={{ width: 60 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const conf = typeConfig(c.customer_type)
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36,
                        background: `${conf.color}22`, border: `1px solid ${conf.color}44`,
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 700, color: conf.color,
                      }}>
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{c.code}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {c.phone && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: 4 }}><Phone size={10} />{c.phone}</span>}
                      {c.email && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={10} />{c.email}</span>}
                    </div>
                  </td>
                  <td>
                    <span style={{ padding: '2px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${conf.color}18`, color: conf.color, border: `1px solid ${conf.color}33`, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {conf.icon}{conf.label}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fcd34d', fontWeight: 600 }}>
                      <Star size={12} fill="#fcd34d" />
                      {c.points.toLocaleString()}
                    </div>
                  </td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>฿{c.total_spend.toLocaleString()}</td>
                  <td style={{ color: c.discount_percent > 0 ? '#fcd34d' : 'rgba(255,255,255,0.3)' }}>
                    {c.discount_percent > 0 ? `${c.discount_percent}%` : '—'}
                  </td>
                  <td>
                    <button onClick={() => { setEditing(c); setShowModal(true) }} style={{ padding: '5px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 6, cursor: 'pointer', color: '#60a5fa', display: 'flex' }}>
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Customer modal */}
      {showModal && (
        <CustomerModal
          customer={editing}
          onClose={() => setShowModal(false)}
          onSave={() => { toast.success(editing ? 'แก้ไขลูกค้าแล้ว' : 'เพิ่มลูกค้าแล้ว'); setShowModal(false) }}
        />
      )}
    </div>
  )
}

function CustomerModal({ customer, onClose, onSave }: { customer: Customer | null; onClose: () => void; onSave: () => void }) {
  const [form, setForm] = useState({
    name: customer?.name || '', phone: customer?.phone || '', email: customer?.email || '',
    address: customer?.address || '', tax_id: customer?.tax_id || '',
    customer_type: customer?.customer_type || 'retail',
    price_level: customer?.price_level || 1, discount_percent: customer?.discount_percent || 0,
    credit_limit: customer?.credit_limit || 0, credit_days: customer?.credit_days || 0, note: customer?.note || '',
  })
  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 520, padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{customer ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้าใหม่'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[['name','ชื่อ-นามสกุล *'],['phone','เบอร์โทรศัพท์'],['email','อีเมล'],['address','ที่อยู่'],['tax_id','เลขผู้เสียภาษี']].map(([k, l]) => (
            <div key={k}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>{l}</label>
              <input className="glass-input" value={(form as any)[k]} onChange={e => set(k, e.target.value)} placeholder={l} />
            </div>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>ประเภทลูกค้า</label>
              <select className="glass-input" value={form.customer_type} onChange={e => set('customer_type', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}>
                <option value="retail">ปลีก</option>
                <option value="wholesale">ส่ง</option>
                <option value="member">สมาชิก</option>
                <option value="vip">VIP</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>ส่วนลดประจำ (%)</label>
              <input className="glass-input" type="number" value={form.discount_percent} onChange={e => set('discount_percent', parseFloat(e.target.value) || 0)} />
            </div>
          </div>
        </div>
        <div style={{ padding: '0 20px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="glass-btn btn-secondary" style={{ fontSize: 13 }}>ยกเลิก</button>
          <button onClick={onSave} className="glass-btn btn-primary" style={{ fontSize: 13, fontWeight: 700 }}>บันทึก</button>
        </div>
      </div>
    </div>
  )
}
