import { useState } from 'react'
import { Lock, Delete } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store'

export default function LockScreen() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const { user, unlock } = useAuthStore()

  const addDigit = (d: string) => {
    if (pin.length >= 6) return
    const newPin = pin + d
    setPin(newPin)
    setError(false)
    if (newPin.length >= 4) {
      setTimeout(() => checkPin(newPin), 150)
    }
  }

  const checkPin = (currentPin: string) => {
    if (currentPin === (user?.pin ?? '1234')) {
      unlock()
      toast.success('ปลดล็อกสำเร็จ')
    } else {
      setError(true)
      setPin('')
      toast.error('PIN ไม่ถูกต้อง')
    }
  }

  const numpad = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 32,
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 64, height: 64, margin: '0 auto 16px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Lock size={28} color="rgba(255,255,255,0.6)" />
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>
          หน้าจอถูกล็อก
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
          {user?.name} · กรอก PIN เพื่อปลดล็อก
        </div>
      </div>

      {/* PIN dots */}
      <div style={{ display: 'flex', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            width: 16, height: 16, borderRadius: '50%',
            background: i < pin.length
              ? (error ? '#ef4444' : '#22c55e')
              : 'rgba(255,255,255,0.12)',
            border: `2px solid ${i < pin.length ? 'transparent' : 'rgba(255,255,255,0.2)'}`,
            transition: 'all 0.15s',
            boxShadow: i < pin.length && !error ? '0 0 8px #22c55e' : 'none',
          }} />
        ))}
      </div>

      {/* Numpad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {numpad.map((d, i) => (
          <button
            key={i}
            onClick={() => {
              if (d === '') return
              if (d === '⌫') setPin(p => p.slice(0, -1))
              else addDigit(d)
            }}
            style={{
              width: 72, height: 72,
              background: d === '' ? 'transparent' : 'rgba(255,255,255,0.06)',
              border: d === '' ? 'none' : '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16,
              fontSize: 22, fontWeight: 600,
              color: d === '⌫' ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.9)',
              cursor: d === '' ? 'default' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={e => { if (d !== '') (e.currentTarget.style.background = 'rgba(255,255,255,0.12)') }}
            onMouseLeave={e => { if (d !== '') (e.currentTarget.style.background = 'rgba(255,255,255,0.06)') }}
          >
            {d === '⌫' ? <Delete size={20} /> : d}
          </button>
        ))}
      </div>
    </div>
  )
}
