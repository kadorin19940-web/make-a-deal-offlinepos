import { useState } from 'react'
import { DollarSign, Play, Square, ArrowUp, ArrowDown, Clock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSessionStore, useAuthStore } from '../../store'
import type { CashSession } from '../../types'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'

const api = (window as any).api

const MOCK_HISTORY: CashSession[] = [
  { id: 1, user_id: 1, user_name: 'ผู้ดูแลระบบ', open_time: '2024-01-15T08:00:00', close_time: '2024-01-15T18:30:00', open_amount: 1000, close_amount: 8540, expected_amount: 8500, difference: 40, total_sales: 12800, total_refunds: 0, total_void: 300, cash_sales: 7500, card_sales: 3200, transfer_sales: 2100, qr_sales: 0, status: 'closed' },
  { id: 2, user_id: 2, user_name: 'ผู้จัดการ', open_time: '2024-01-14T08:00:00', close_time: '2024-01-14T18:00:00', open_amount: 1000, close_amount: 6200, expected_amount: 6180, difference: 20, total_sales: 9800, total_refunds: 0, total_void: 0, cash_sales: 5180, card_sales: 2800, transfer_sales: 1820, qr_sales: 0, status: 'closed' },
]

export default function SessionsPage() {
  const { currentSession, setSession } = useSessionStore()
  const { user } = useAuthStore()
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showCash, setShowCash] = useState(false)
  const [openAmount, setOpenAmount] = useState('1000')
  const [closeAmount, setCloseAmount] = useState('')
  const [cashType, setCashType] = useState<'in' | 'out'>('in')
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')

  const handleOpenSession = async () => {
    if (!openAmount || parseFloat(openAmount) < 0) { toast.error('กรุณากรอกยอดเปิดกะ'); return }
    const sessionData = { user_id: user?.id, open_amount: parseFloat(openAmount) }
    if (api) {
      const res = await api.sessions.open(sessionData)
      if (!res.success) { toast.error(res.error); return }
    }
    const fakeSession: CashSession = {
      id: Date.now(), user_id: user?.id || 1, user_name: user?.name,
      open_time: new Date().toISOString(), open_amount: parseFloat(openAmount),
      total_sales: 0, total_refunds: 0, total_void: 0,
      cash_sales: 0, card_sales: 0, transfer_sales: 0, qr_sales: 0,
      status: 'open',
    }
    setSession(fakeSession)
    toast.success('เปิดกะสำเร็จ')
    setShowOpen(false)
  }

  const handleCloseSession = async () => {
    if (!closeAmount) { toast.error('กรุณากรอกยอดเงินในลิ้นชัก'); return }
    if (api) await api.sessions.close({ close_amount: parseFloat(closeAmount) })
    setSession(null)
    toast.success('ปิดกะสำเร็จ')
    setShowClose(false)
  }

  const handleCashTx = async () => {
    if (!cashAmount || parseFloat(cashAmount) <= 0) { toast.error('กรุณากรอกจำนวนเงิน'); return }
    if (api) await api.sessions.addTransaction({ type: cashType, amount: parseFloat(cashAmount), reason: cashReason, user_id: user?.id })
    toast.success(`${cashType === 'in' ? 'รับเงินเข้า' : 'จ่ายเงินออก'}สำเร็จ`)
    setCashAmount(''); setCashReason(''); setShowCash(false)
  }

  const fmt = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
  const fmtDate = (d: string) => { try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: th }) } catch { return d } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Current session card */}
      <div style={{
        background: currentSession
          ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.04))'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${currentSession ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: 20, padding: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', marginBottom: 2 }}>
              {currentSession ? 'กะที่เปิดอยู่' : 'ไม่มีกะที่เปิดอยู่'}
            </div>
            {currentSession && (
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                เปิดโดย {currentSession.user_name} · {fmtDate(currentSession.open_time)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentSession ? (
              <>
                <button onClick={() => setShowCash(true)} className="glass-btn btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }}>
                  <DollarSign size={14} /> รับ/จ่ายเงิน
                </button>
                <button onClick={() => setShowClose(true)} className="glass-btn btn-danger" style={{ fontSize: 13, padding: '8px 14px', fontWeight: 700 }}>
                  <Square size={14} /> ปิดกะ
                </button>
              </>
            ) : (
              <button onClick={() => setShowOpen(true)} className="glass-btn btn-primary" style={{ fontSize: 13, padding: '10px 20px', fontWeight: 700 }}>
                <Play size={14} /> เปิดกะ
              </button>
            )}
          </div>
        </div>

        {currentSession && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {[
              { label: 'ยอดขายรวม', value: fmt(currentSession.total_sales), color: '#22c55e' },
              { label: 'เงินสด', value: fmt(currentSession.cash_sales), color: '#4ade80' },
              { label: 'บัตร', value: fmt(currentSession.card_sales), color: '#60a5fa' },
              { label: 'โอน', value: fmt(currentSession.transfer_sales), color: '#a78bfa' },
              { label: 'เปิดกะด้วย', value: fmt(currentSession.open_amount), color: 'rgba(255,255,255,0.6)' },
            ].map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session History */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 12 }}>ประวัติกะ</div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>วันที่/เวลา</th><th>พนักงาน</th><th>เปิดกะ</th><th>ยอดขาย</th><th>ปิดกะ</th><th>ผลต่าง</th><th>สถานะ</th></tr>
            </thead>
            <tbody>
              {MOCK_HISTORY.map(s => (
                <tr key={s.id}>
                  <td>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmtDate(s.open_time)}</div>
                    {s.close_time && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>ถึง {fmtDate(s.close_time)}</div>}
                  </td>
                  <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{s.user_name}</td>
                  <td style={{ color: 'rgba(255,255,255,0.6)' }}>{fmt(s.open_amount)}</td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(s.total_sales)}</td>
                  <td style={{ color: 'rgba(255,255,255,0.7)' }}>{s.close_amount !== undefined ? fmt(s.close_amount) : '—'}</td>
                  <td>
                    {s.difference !== undefined && (
                      <span style={{ color: s.difference >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: 13 }}>
                        {s.difference >= 0 ? '+' : ''}{fmt(s.difference)}
                      </span>
                    )}
                  </td>
                  <td><span className={`badge ${s.status === 'open' ? 'badge-green' : 'badge-blue'}`}>{s.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Open session modal */}
      {showOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowOpen(false)}>
          <div className="modal-content" style={{ width: 380, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: 16, fontWeight: 700 }}>🟢 เปิดกะใหม่</h3>
              <button onClick={() => setShowOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>ยอดเงินในลิ้นชัก (฿)</label>
              <input className="glass-input" type="number" value={openAmount} onChange={e => setOpenAmount(e.target.value)} placeholder="1000" autoFocus style={{ fontSize: 18, fontWeight: 700 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowOpen(false)} className="glass-btn btn-secondary" style={{ flex: 1, fontSize: 13 }}>ยกเลิก</button>
              <button onClick={handleOpenSession} className="glass-btn btn-primary" style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>เปิดกะ</button>
            </div>
          </div>
        </div>
      )}

      {/* Close session modal */}
      {showClose && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowClose(false)}>
          <div className="modal-content" style={{ width: 420, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: 16, fontWeight: 700 }}>🔴 ปิดกะ</h3>
              <button onClick={() => setShowClose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            {currentSession && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>ยอดขายวันนี้</span>
                  <span style={{ color: '#22c55e', fontWeight: 700 }}>{fmt(currentSession.total_sales)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>ยอดที่ควรมีในลิ้นชัก</span>
                  <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 700 }}>
                    {fmt(currentSession.open_amount + currentSession.cash_sales)}
                  </span>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>ยอดเงินในลิ้นชักจริง (฿)</label>
              <input className="glass-input" type="number" value={closeAmount} onChange={e => setCloseAmount(e.target.value)} placeholder="0.00" autoFocus style={{ fontSize: 18, fontWeight: 700 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowClose(false)} className="glass-btn btn-secondary" style={{ flex: 1, fontSize: 13 }}>ยกเลิก</button>
              <button onClick={handleCloseSession} className="glass-btn btn-danger" style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>ปิดกะ</button>
            </div>
          </div>
        </div>
      )}

      {/* Cash transaction modal */}
      {showCash && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCash(false)}>
          <div className="modal-content" style={{ width: 380, padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: 'rgba(255,255,255,0.9)', margin: 0, fontSize: 16, fontWeight: 700 }}>รับ/จ่ายเงิน</h3>
              <button onClick={() => setShowCash(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[['in','รับเงินเข้า', '#22c55e'], ['out','จ่ายเงินออก', '#ef4444']].map(([t, l, c]) => (
                <button key={t} onClick={() => setCashType(t as 'in' | 'out')}
                  style={{ flex: 1, padding: '10px', background: cashType === t ? `${c}18` : 'rgba(255,255,255,0.05)', border: `1px solid ${cashType === t ? `${c}44` : 'rgba(255,255,255,0.08)'}`, borderRadius: 10, cursor: 'pointer', color: cashType === t ? c : 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' }}>
                  {t === 'in' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}{l}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>จำนวนเงิน (฿)</label>
              <input className="glass-input" type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} placeholder="0.00" autoFocus />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 5 }}>เหตุผล</label>
              <input className="glass-input" value={cashReason} onChange={e => setCashReason(e.target.value)} placeholder="เหตุผลการรับ/จ่ายเงิน" />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCash(false)} className="glass-btn btn-secondary" style={{ flex: 1, fontSize: 13 }}>ยกเลิก</button>
              <button onClick={handleCashTx} className="glass-btn btn-primary" style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>บันทึก</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
