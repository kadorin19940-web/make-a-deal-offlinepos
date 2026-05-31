import { useState, useEffect } from 'react'
import { DollarSign, Play, Square, ArrowUp, ArrowDown, Clock, X, Trash2, FileSpreadsheet, Calendar, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSessionStore, useAuthStore } from '../../store'
import type { CashSession } from '../../types'
import { format, subDays } from 'date-fns'
import { th } from 'date-fns/locale'

const api = (window as any).api

export default function SessionsPage() {
  const { currentSession, setSession } = useSessionStore()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'manager'

  const [history, setHistory] = useState<CashSession[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [showOpen, setShowOpen] = useState(false)
  const [showClose, setShowClose] = useState(false)
  const [showCash, setShowCash] = useState(false)
  const [openAmount, setOpenAmount] = useState('1000')
  const [closeAmount, setCloseAmount] = useState('')
  const [cashType, setCashType] = useState<'in' | 'out'>('in')
  const [cashAmount, setCashAmount] = useState('')
  const [cashReason, setCashReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Date filters
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))

  const fetchActiveSession = async () => {
    if (!api?.sessions) return
    try {
      const res = await api.sessions.getCurrent()
      if (res.success && res.data) {
        setSession(res.data)
      } else {
        setSession(null)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const fetchHistory = async () => {
    if (!api?.sessions) return
    try {
      setLoading(true)
      const res = await api.sessions.getAll({ from_date: startDate, to_date: endDate })
      if (res.success) {
        setHistory(res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActiveSession()
  }, [])

  useEffect(() => {
    fetchHistory()
  }, [startDate, endDate])

  const setQuickRange = (rangeType: 'today' | '7d' | '30d' | 'this_month') => {
    const today = new Date()
    if (rangeType === 'today') {
      const dateStr = format(today, 'yyyy-MM-dd')
      setStartDate(dateStr)
      setEndDate(dateStr)
    } else if (rangeType === '7d') {
      setStartDate(format(subDays(today, 6), 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    } else if (rangeType === '30d') {
      setStartDate(format(subDays(today, 29), 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    } else if (rangeType === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(format(firstDay, 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    }
  }

  const handleOpenSession = async () => {
    if (!openAmount || parseFloat(openAmount) < 0) { toast.error('กรุณากรอกยอดเปิดกะ'); return }
    const sessionData = { user_id: user?.id, open_amount: parseFloat(openAmount) }
    
    setSubmitting(true)
    try {
      if (api) {
        const res = await api.sessions.open(sessionData)
        if (!res.success) { 
          toast.error(res.error || 'เกิดข้อผิดพลาดในการเปิดกะ')
          return 
        }
      }
      
      toast.success('เปิดกะสำเร็จ')
      setShowOpen(false)
      fetchActiveSession()
      fetchHistory()
    } catch (e) {
      toast.error('เปิดกะล้มเหลว: ' + String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseSession = async () => {
    if (!closeAmount) { toast.error('กรุณากรอกยอดเงินในลิ้นชัก'); return }
    
    setSubmitting(true)
    try {
      if (api) {
        // Trigger 2: Silent Backup Trigger on Shift Close (Day Close)
        // This ensures the current state of transaction records is backed up permanently
        try {
          await api.backup.triggerSilentBackup()
          console.log('[Shift Close] Auto Backup Completed')
        } catch (err) {
          console.error('[Shift Close] Auto Backup Failed:', err)
        }

        const res = await api.sessions.close({ close_amount: parseFloat(closeAmount) })
        if (!res.success) {
          toast.error(res.error || 'เกิดข้อผิดพลาดในการปิดกะ')
          return
        }
      }
      
      setSession(null)
      toast.success('ปิดกะสำเร็จ')
      setShowClose(false)
      fetchActiveSession()
      fetchHistory()
    } catch (e) {
      toast.error('ปิดกะล้มเหลว: ' + String(e))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCashTx = async () => {
    if (!cashAmount || parseFloat(cashAmount) <= 0) { toast.error('กรุณากรอกจำนวนเงิน'); return }
    
    try {
      if (api) {
        const res = await api.sessions.addTransaction({ 
          type: cashType, 
          amount: parseFloat(cashAmount), 
          reason: cashReason, 
          user_id: user?.id 
        })
        if (!res.success) {
          toast.error(res.error || 'บันทึกธุรกรรมล้มเหลว')
          return
        }
      }
      
      toast.success(`${cashType === 'in' ? 'รับเงินเข้า' : 'จ่ายเงินออก'}สำเร็จ`)
      setCashAmount('')
      setCashReason('')
      setShowCash(false)
      fetchActiveSession()
    } catch (e) {
      toast.error('บันทึกธุรกรรมล้มเหลว: ' + String(e))
    }
  }

  const handleDeleteSession = async (id: number) => {
    if (!isAdmin) {
      toast.error('ขออภัย เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่มีสิทธิ์ลบประวัติกะ')
      return
    }

    const confirmDelete = window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบประวัติกะนี้ออกจากระบบ? การดำเนินการนี้จะลบรายการประวัติกะและประวัติรับ/จ่ายเงินสดทั้งหมดแบบถาวร')
    if (!confirmDelete) return

    try {
      if (api) {
        const res = await api.sessions.delete(id)
        if (res.success) {
          toast.success('ลบประวัติกะสำเร็จแล้ว')
          fetchHistory()
          if (currentSession && currentSession.id === id) {
            setSession(null)
          }
        } else {
          toast.error(res.error || 'ลบประวัติกะล้มเหลว')
        }
      }
    } catch (e) {
      toast.error('ลบกะล้มเหลว: ' + String(e))
    }
  }

  const handleExportExcel = async () => {
    if (exporting || !user) return
    if (!isManagerOrAdmin) {
      toast.error('ขออภัย เฉพาะผู้ดูแลระบบ (Admin) หรือผู้จัดการ (Manager) เท่านั้นที่มีสิทธิ์ส่งออกประวัติกะ')
      return
    }

    setExporting(true)
    const toastId = toast.loading('กำลังประมวลผลข้อมูลประวัติกะในระบบ...')

    try {
      if (api) {
        const defaultName = `รายงานประวัติกะ_${startDate}_ถึง_${endDate}.xlsx`
        const saveRes = await api.dialog.saveFile(defaultName, [{ name: 'Excel Files', extensions: ['xlsx'] }])
        
        if (saveRes.filePath) {
          const res = await api.sessions.exportExcel({
            from_date: startDate,
            to_date: endDate,
            filePath: saveRes.filePath,
            userId: user.id
          })
          if (res.success) {
            toast.success('ส่งออกรายงานกะ Excel สำเร็จแล้ว!', { id: toastId })
          } else {
            throw new Error(res.error || 'เขียนไฟล์ล้มเหลว')
          }
        } else {
          toast.dismiss(toastId)
        }
      } else {
        toast.error('ระบบเครื่องมือจัดเก็บไฟล์ไม่ทำงานบนบราวเซอร์ภายนอก', { id: toastId })
      }
    } catch (error) {
      console.error(error)
      toast.error(`ส่งออกล้มเหลว: ${String(error)}`, { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const fmt = (n: number) => `฿${(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`
  const fmtDate = (d: string) => { try { return format(new Date(d), 'dd MMM yyyy HH:mm', { locale: th }) } catch { return d } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      {/* Blurred Full-screen Loading Overlay for Exporting */}
      {exporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in" style={{ zIndex: 9999 }}>
          <div className="bg-[#0a0a0f]/80 p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">กำลังเขียนรายงานกะ Excel...</h3>
              <p className="text-xs text-gray-400">
                ระบบกำลังดึงข้อมูลประวัติกะและธุรกรรมจากฐานข้อมูล SQLite เพื่อบันทึกเป็นไฟล์ Excel
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Session History section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>ประวัติกะ</div>
        </div>

        {/* Date Picker & Quick Range controls */}
        <div className="glass-card" style={{
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 16,
          padding: 16,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          marginBottom: 12
        }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <Calendar size={16} className="text-green-400" />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginRight: 8 }}>ช่วงเวลาตัวกรอง:</span>
            {[
              { type: 'today', label: 'วันนี้' },
              { type: '7d', label: '7 วันล่าสุด' },
              { type: '30d', label: '30 วันล่าสุด' },
              { type: 'this_month', label: 'เดือนนี้' }
            ].map(btn => (
              <button
                key={btn.type}
                onClick={() => setQuickRange(btn.type as any)}
                className="glass-btn btn-secondary"
                style={{ fontSize: 11, padding: '6px 12px' }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>เริ่ม:</span>
              <input
                type="date"
                className="glass-input"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.03)', padding: '5px 10px', fontSize: 12, width: 130, height: 32, borderRadius: 8, color: '#fff' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>ถึง:</span>
              <input
                type="date"
                className="glass-input"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.03)', padding: '5px 10px', fontSize: 12, width: 130, height: 32, borderRadius: 8, color: '#fff' }}
              />
            </div>

            {isManagerOrAdmin && (
              <button
                onClick={handleExportExcel}
                disabled={exporting || loading}
                className="glass-btn btn-primary"
                style={{
                  fontSize: 12,
                  padding: '6px 16px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  opacity: exporting || loading ? 0.5 : 1,
                  cursor: exporting || loading ? 'not-allowed' : 'pointer',
                  height: 32
                }}
              >
                {exporting ? <Loader size={12} className="animate-spin" /> : <FileSpreadsheet size={13} />}
                ส่งออกประวัติกะ
              </button>
            )}
          </div>
        </div>

        {/* History Table */}
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>วันที่/เวลา</th>
                <th>พนักงาน</th>
                <th>เปิดกะ</th>
                <th>ยอดขาย</th>
                <th>ปิดกะ</th>
                <th>ผลต่าง</th>
                <th>สถานะ</th>
                <th style={{ width: 80 }}>การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: 'rgba(255,255,255,0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Loader size={16} className="animate-spin text-green-500" />
                      กำลังโหลดข้อมูลประวัติกะ...
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', paddingTop: 32, paddingBottom: 32, color: 'rgba(255,255,255,0.3)' }}>
                    ไม่มีข้อมูลประวัติการทำงานกะในช่วงเวลานี้
                  </td>
                </tr>
              ) : (
                history.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{fmtDate(s.open_time)}</div>
                      {s.close_time && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>ถึง {fmtDate(s.close_time)}</div>}
                    </td>
                    <td style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>{s.user_name || 'ผู้จัดการ'}</td>
                    <td style={{ color: 'rgba(255,255,255,0.6)' }}>{fmt(s.open_amount)}</td>
                    <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(s.total_sales)}</td>
                    <td style={{ color: 'rgba(255,255,255,0.7)' }}>{s.close_amount !== null && s.close_amount !== undefined ? fmt(s.close_amount) : '—'}</td>
                    <td>
                      {s.difference !== null && s.difference !== undefined ? (
                        <span style={{ color: s.difference >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600, fontSize: 13 }}>
                          {s.difference >= 0 ? '+' : ''}{fmt(s.difference)}
                        </span>
                      ) : (
                        <span style={{ color: 'rgba(255,255,255,0.3)' }}>—</span>
                      )}
                    </td>
                    <td><span className={`badge ${s.status === 'open' ? 'badge-green' : 'badge-blue'}`}>{s.status === 'open' ? 'เปิดอยู่' : 'ปิดแล้ว'}</span></td>
                    <td>
                      {isAdmin && (
                        <button onClick={() => handleDeleteSession(s.id)}
                          title="ลบประวัติกะถาวร"
                          style={{ padding: '6px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, cursor: 'pointer', color: '#f87171', display: 'flex', alignItems: 'center' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
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
              <button onClick={() => !submitting && setShowOpen(false)} disabled={submitting} className="glass-btn btn-secondary" style={{ flex: 1, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer' }}>ยกเลิก</button>
              <button 
                onClick={handleOpenSession} 
                disabled={submitting}
                className="glass-btn btn-primary" 
                style={{ 
                  flex: 1, 
                  fontSize: 13, 
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'กำลังเปิดกะ...' : 'เปิดกะ'}
              </button>
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
                    {fmt((currentSession.open_amount || 0) + (currentSession.cash_sales || 0))}
                  </span>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>ยอดเงินในลิ้นชักจริง (฿)</label>
              <input className="glass-input" type="number" value={closeAmount} onChange={e => setCloseAmount(e.target.value)} placeholder="0.00" autoFocus style={{ fontSize: 18, fontWeight: 700 }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => !submitting && setShowClose(false)} disabled={submitting} className="glass-btn btn-secondary" style={{ flex: 1, fontSize: 13, cursor: submitting ? 'not-allowed' : 'pointer' }}>ยกเลิก</button>
              <button 
                onClick={handleCloseSession} 
                disabled={submitting}
                className="glass-btn btn-danger" 
                style={{ 
                  flex: 1, 
                  fontSize: 13, 
                  fontWeight: 700,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? 'กำลังปิดกะ & แบ็กอัพ...' : 'ปิดกะ'}
              </button>
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
