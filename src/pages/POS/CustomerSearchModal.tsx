import { useState, useEffect } from 'react'
import { Search, X, Star, Phone } from 'lucide-react'
import type { Customer } from '../../types'

const api = (window as any).api

const MOCK_CUSTOMERS: Customer[] = [
  { id: 1, code: 'CUST001', name: 'คุณสมชาย ใจดี', phone: '081-234-5678', customer_type: 'retail', price_level: 1, points: 250, total_spend: 15000, credit_limit: 0, credit_days: 0, discount_percent: 0, is_active: 1, created_at: '' },
  { id: 2, code: 'CUST002', name: 'บริษัท ABC จำกัด', phone: '02-345-6789', customer_type: 'wholesale', price_level: 2, points: 0, total_spend: 85000, credit_limit: 50000, credit_days: 30, discount_percent: 5, is_active: 1, created_at: '' },
  { id: 3, code: 'CUST003', name: 'คุณมาลี สวยงาม', phone: '089-876-5432', customer_type: 'member', price_level: 1, points: 1200, total_spend: 42000, credit_limit: 0, credit_days: 0, discount_percent: 0, is_active: 1, created_at: '' },
]

export default function CustomerSearchModal({ onSelect, onClose }: {
  onSelect: (c: Customer) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Customer[]>(MOCK_CUSTOMERS)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!query.trim()) { setResults(MOCK_CUSTOMERS); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        if (api) {
          const res = await api.customers.search(query)
          if (res.success) setResults(res.data)
        } else {
          setResults(MOCK_CUSTOMERS.filter(c =>
            c.name.includes(query) || c.phone?.includes(query) || c.code.includes(query)
          ))
        }
      } finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const typeLabel = (t: string) => {
    const map: Record<string, [string, string]> = {
      retail: ['ปลีก', '#64748b'],
      wholesale: ['ส่ง', '#3b82f6'],
      member: ['สมาชิก', '#22c55e'],
      vip: ['VIP', '#f59e0b'],
    }
    return map[t] || ['ลูกค้า', '#64748b']
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 460, padding: 0 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }} />
            <input
              className="glass-input"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="ค้นหาชื่อ เบอร์โทร หรือรหัสลูกค้า..."
              style={{ paddingLeft: 36 }}
              autoFocus
            />
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }}>
          {results.map(c => {
            const [label, color] = typeLabel(c.customer_type)
            return (
              <div
                key={c.id}
                onClick={() => onSelect(c)}
                style={{
                  padding: '12px 20px', cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'center',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 40, height: 40,
                  background: `${color}22`, border: `1px solid ${color}44`,
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color,
                }}>
                  {c.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{c.name}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                    {c.phone && <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: 3 }}><Phone size={10} />{c.phone}</span>}
                    <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: `${color}22`, color, border: `1px solid ${color}33` }}>
                      {label}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#fcd34d', fontSize: 12, fontWeight: 600 }}>
                    <Star size={11} fill="#fcd34d" />
                    {c.points.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                    ยอดรวม ฿{c.total_spend.toLocaleString()}
                  </div>
                </div>
              </div>
            )
          })}
          {results.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
              ไม่พบลูกค้า
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
