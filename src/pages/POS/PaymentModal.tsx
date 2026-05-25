import { useState, useEffect } from 'react'
import { X, Banknote, CreditCard, Smartphone, Layers, Delete, CheckCircle, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CartItem, Customer, PaymentMethod } from '../../types'

const api = (window as any).api

interface PaymentModalProps {
  items: CartItem[]
  subtotal: number
  discountAmount: number
  total: number
  taxAmount: number
  customer: Customer | null
  couponCode?: string
  userId?: number
  onClose: () => void
  onSuccess: () => void
}

export default function PaymentModal({
  items, subtotal, discountAmount, total, taxAmount,
  customer, couponCode, userId, onClose, onSuccess
}: PaymentModalProps) {
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [cashInput, setCashInput] = useState('')
  const [reference, setReference] = useState('')
  const [step, setStep] = useState<'pay' | 'done'>('pay')
  const [receiptNo, setReceiptNo] = useState('')
  const [loading, setLoading] = useState(false)
  const [pointsToUse, setPointsToUse] = useState(0)

  const cashAmount = parseFloat(cashInput) || 0
  const change = method === 'cash' ? Math.max(cashAmount - total + pointsToUse * 0.1, 0) : 0
  const shortfall = method === 'cash' && cashAmount > 0 ? total - pointsToUse * 0.1 - cashAmount : 0

  const QUICK_AMOUNTS = [total, Math.ceil(total / 100) * 100, Math.ceil(total / 500) * 500, Math.ceil(total / 1000) * 1000]
    .filter((v, i, a) => a.indexOf(v) === i).slice(0, 4)

  useEffect(() => {
    generateReceipt()
  }, [])

  const generateReceipt = async () => {
    if (api) {
      const res = await api.sales.generateReceiptNo()
      if (res.success) setReceiptNo(res.data)
    } else {
      setReceiptNo(`RCP${new Date().toISOString().slice(0,10).replace(/-/g,'')}${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`)
    }
  }

  const addNumpadDigit = (d: string) => {
    if (d === '.' && cashInput.includes('.')) return
    setCashInput(prev => prev + d)
  }

  const handlePay = async () => {
    if (method === 'cash' && cashAmount < total - pointsToUse * 0.1) {
      toast.error('ยอดรับไม่เพียงพอ')
      return
    }

    setLoading(true)
    try {
      const saleData = {
        receipt_no: receiptNo,
        customer_id: customer?.id || null,
        user_id: userId || null,
        subtotal,
        discount_amount: discountAmount,
        total,
        tax_amount: taxAmount,
        tax_inclusive: 1,
        paid_amount: method === 'cash' ? cashAmount : total,
        change_amount: change,
        payment_method: method,
        payment_details: reference ? JSON.stringify({ reference }) : null,
        coupon_code: couponCode || null,
        points_earned: customer ? Math.floor(total / 1) : 0,
        points_used: pointsToUse,
        items: items.map(item => ({
          product_id: item.product_id,
          variant_id: item.variant_id,
          product_name: item.product_name,
          barcode: item.barcode,
          qty: item.qty,
          unit: item.unit,
          cost_price: item.cost_price,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
          discount_percent: item.discount_percent,
          total: item.total,
          is_service: item.is_service,
        })),
      }

      if (api) {
        const res = await api.sales.create(saleData)
        if (!res.success) { toast.error(res.error || 'เกิดข้อผิดพลาด'); return }
      }

      setStep('done')
    } catch {
      toast.error('เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  const PAY_METHODS = [
    { id: 'cash', label: 'เงินสด', icon: <Banknote size={18} />, color: '#22c55e' },
    { id: 'card', label: 'บัตร', icon: <CreditCard size={18} />, color: '#3b82f6' },
    { id: 'transfer', label: 'โอน', icon: <Smartphone size={18} />, color: '#8b5cf6' },
    { id: 'qr', label: 'QR', icon: <Layers size={18} />, color: '#f59e0b' },
  ]

  const fmt = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ width: 520, padding: 0, overflow: 'hidden' }}>
        {step === 'done' ? (
          // Success screen
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, margin: '0 auto 20px',
              background: 'rgba(34,197,94,0.1)', border: '2px solid rgba(34,197,94,0.3)',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'scaleIn 0.3s cubic-bezier(0.16,1,0.3,1)',
            }}>
              <CheckCircle size={40} color="#22c55e" />
            </div>
            <h2 style={{ color: 'rgba(255,255,255,0.95)', fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>
              ชำระเงินสำเร็จ
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, margin: '0 0 24px' }}>
              {receiptNo}
            </p>

            <div style={{
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '16px 20px', marginBottom: 24, textAlign: 'left',
            }}>
              <Row label="ยอดรวม" value={fmt(total)} />
              {method === 'cash' && <>
                <Row label="รับเงิน" value={fmt(cashAmount)} />
                <Row label="ทอน" value={fmt(change)} highlight />
              </>}
              {customer && <Row label="แต้มที่ได้รับ" value={`+${Math.floor(total)} แต้ม`} color="#fcd34d" />}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => { toast('กำลังพิมพ์ใบเสร็จ...'); setTimeout(onSuccess, 500) }}
                className="glass-btn btn-secondary"
                style={{ flex: 1, fontSize: 14 }}
              >
                <Printer size={15} /> พิมพ์ใบเสร็จ
              </button>
              <button
                onClick={onSuccess}
                className="glass-btn btn-primary"
                style={{ flex: 1, fontSize: 14, fontWeight: 700 }}
              >
                เสร็จสิ้น
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>ชำระเงิน</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{receiptNo}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ยอดสุทธิ</div>
                <div style={{
                  fontSize: 24, fontWeight: 800,
                  background: 'linear-gradient(135deg, #22c55e, #4ade80)',
                  WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                }}>
                  {fmt(total)}
                </div>
              </div>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px' }}>
              {/* Payment method tabs */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {PAY_METHODS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMethod(m.id as PaymentMethod)}
                    style={{
                      flex: 1, padding: '10px 8px',
                      background: method === m.id ? `${m.color}18` : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${method === m.id ? `${m.color}44` : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                      color: method === m.id ? m.color : 'rgba(255,255,255,0.45)',
                      fontSize: 12, fontWeight: 600,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      transition: 'all 0.15s',
                    }}
                  >
                    {m.icon}
                    {m.label}
                  </button>
                ))}
              </div>

              {/* Cash input */}
              {method === 'cash' && (
                <div>
                  <div style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: '12px 16px', marginBottom: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>รับเงิน</span>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                      <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>฿</span>
                      <span style={{ fontSize: 28, fontWeight: 800, color: cashAmount >= total ? '#22c55e' : 'rgba(255,255,255,0.9)' }}>
                        {cashInput || '0'}
                      </span>
                    </div>
                  </div>

                  {cashInput && cashAmount >= total && (
                    <div style={{
                      background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
                      borderRadius: 10, padding: '10px 14px', marginBottom: 12,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ color: '#4ade80', fontSize: 14, fontWeight: 600 }}>ทอน</span>
                      <span style={{ color: '#4ade80', fontSize: 20, fontWeight: 800 }}>{fmt(change)}</span>
                    </div>
                  )}

                  {/* Quick amount buttons */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {QUICK_AMOUNTS.map((amt, i) => (
                      <button
                        key={i}
                        onClick={() => setCashInput(String(amt))}
                        style={{
                          flex: 1, padding: '7px 4px',
                          background: cashInput === String(amt) ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${cashInput === String(amt) ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                          color: cashInput === String(amt) ? '#22c55e' : 'rgba(255,255,255,0.5)',
                          fontSize: 11, fontWeight: 600,
                        }}
                      >
                        {amt.toLocaleString()}
                      </button>
                    ))}
                  </div>

                  {/* Numpad */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {['7','8','9','4','5','6','1','2','3','.','0','⌫'].map(d => (
                      <button
                        key={d}
                        onClick={() => {
                          if (d === '⌫') setCashInput(p => p.slice(0,-1))
                          else addNumpadDigit(d)
                        }}
                        style={{
                          padding: '14px', borderRadius: 10, fontSize: 18, fontWeight: 600,
                          background: d === '⌫' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                          border: `1px solid ${d === '⌫' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
                          color: d === '⌫' ? '#fca5a5' : 'rgba(255,255,255,0.9)',
                          cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.1s',
                        }}
                        onMouseDown={e => (e.currentTarget.style.transform = 'scale(0.94)')}
                        onMouseUp={e => (e.currentTarget.style.transform = 'scale(1)')}
                      >
                        {d === '⌫' ? <Delete size={18} style={{ margin: '0 auto' }} /> : d}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Card/Transfer - reference input */}
              {(method === 'card' || method === 'transfer') && (
                <div>
                  <div style={{ textAlign: 'center', padding: '20px 0', color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                    {method === 'card' ? 'รูดบัตร / tap' : 'โอนเงิน'}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>
                      เลขอ้างอิง / Ref No.
                    </label>
                    <input
                      className="glass-input"
                      value={reference}
                      onChange={e => setReference(e.target.value)}
                      placeholder="กรอกเลขอ้างอิง (ถ้ามี)"
                    />
                  </div>
                  <div style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12, padding: '16px',  marginBottom: 8, textAlign: 'center',
                  }}>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 4 }}>ยอดที่ต้องชำระ</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: '#22c55e' }}>{fmt(total)}</div>
                  </div>
                </div>
              )}

              {/* QR */}
              {method === 'qr' && (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{
                    width: 160, height: 160, margin: '0 auto 12px',
                    background: 'white', borderRadius: 12, padding: 16,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {/* QR placeholder */}
                    <div style={{
                      width: '100%', height: '100%',
                      background: 'repeating-conic-gradient(#000 0% 25%, #fff 0% 50%) 0/12px 12px',
                      borderRadius: 4, opacity: 0.8,
                    }} />
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 4 }}>
                    สแกน QR PromptPay
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#22c55e' }}>{fmt(total)}</div>
                </div>
              )}

              {/* Loyalty points */}
              {customer && customer.points >= 100 && (
                <div style={{
                  marginTop: 12, padding: '10px 14px',
                  background: 'rgba(252,211,77,0.08)', border: '1px solid rgba(252,211,77,0.2)',
                  borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#fcd34d', fontWeight: 600 }}>ใช้แต้มสะสม</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                      {customer.points.toLocaleString()} แต้ม = ฿{(customer.points * 0.1).toLocaleString()}
                    </div>
                  </div>
                  <input
                    type="number" min="0" max={Math.min(customer.points, Math.floor(total / 0.1))}
                    value={pointsToUse || ''}
                    onChange={e => setPointsToUse(Math.min(parseInt(e.target.value) || 0, customer.points))}
                    placeholder="0"
                    style={{
                      width: 72, padding: '4px 8px', fontSize: 13, textAlign: 'right',
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(252,211,77,0.3)',
                      borderRadius: 6, color: '#fcd34d', outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>แต้ม</span>
                </div>
              )}
            </div>

            {/* Pay button */}
            <div style={{ padding: '0 20px 20px' }}>
              <button
                onClick={handlePay}
                disabled={loading || (method === 'cash' && cashAmount < total - pointsToUse * 0.1 && cashInput !== '')}
                className="glass-btn btn-primary"
                style={{ width: '100%', padding: '15px', fontSize: 16, fontWeight: 800 }}
              >
                {loading ? 'กำลังบันทึก...' : `ยืนยันการชำระ ${fmt(total)}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Row({ label, value, highlight, color }: { label: string; value: string; highlight?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
      <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || (highlight ? '#22c55e' : 'rgba(255,255,255,0.8)'), fontSize: 13, fontWeight: highlight ? 700 : 500 }}>
        {value}
      </span>
    </div>
  )
}
