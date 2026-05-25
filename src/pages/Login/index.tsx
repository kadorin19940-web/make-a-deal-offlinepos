import { useState } from 'react'
import { Eye, EyeOff, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore, useSettingsStore } from '../../store'
import type { User } from '../../types'

// Electron API type
declare const window: Window & {
  api: {
    users: { login: (u: string, p: string) => Promise<{ success: boolean; data?: User; error?: string }> }
    settings: { getAll: () => Promise<{ success: boolean; data?: Record<string, string> }> }
  }
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const { setSettings } = useSettingsStore()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      toast.error('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน')
      return
    }

    setLoading(true)
    try {
      // In browser preview, auto-login as admin
      if (!window.api) {
        const mockUser: User = {
          id: 1, username: 'ADMIN', name: 'ผู้ดูแลระบบ', role: 'admin',
          permissions: ['all'], is_active: 1, created_at: new Date().toISOString()
        }
        login(mockUser)
        toast.success('ยินดีต้อนรับ ผู้ดูแลระบบ (Demo)')
        return
      }

      const res = await window.api.users.login(username, password)
      if (!res.success || !res.data) {
        toast.error(res.error || 'เข้าสู่ระบบไม่สำเร็จ')
        return
      }

      // Load settings
      const settingsRes = await window.api.settings.getAll()
      if (settingsRes.success && settingsRes.data) {
        setSettings(settingsRes.data)
      }

      login(res.data as User)
      toast.success(`ยินดีต้อนรับ ${res.data.name}`)
    } catch {
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ fontFamily: 'Sarabun, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center mb-5" style={{
            width: 72, height: 72,
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            borderRadius: 20,
            boxShadow: '0 0 30px rgba(34,197,94,0.4), 0 0 60px rgba(34,197,94,0.15)',
          }}>
            <Zap size={36} color="#000" strokeWidth={2.5} />
          </div>
          <h1 style={{
            fontSize: 28, fontWeight: 800, margin: 0, lineHeight: 1.2,
            background: 'linear-gradient(135deg, #fff 30%, rgba(255,255,255,0.6))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Make a Deal POS
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 6 }}>
            ระบบขายหน้าร้าน — ลงชื่อเข้าใช้
          </p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(40px)',
          WebkitBackdropFilter: 'blur(40px)',
          borderRadius: 24,
          padding: 36,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
        }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                ชื่อผู้ใช้
              </label>
              <input
                className="glass-input"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="กรอกชื่อผู้ใช้"
                autoFocus
                autoComplete="username"
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
                รหัสผ่าน
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  className="glass-input"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  style={{ paddingRight: 48 }}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'rgba(255,255,255,0.4)', padding: 4,
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="glass-btn btn-primary"
              style={{ width: '100%', padding: '13px 20px', fontSize: 15, fontWeight: 700 }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <LoadingSpinner size={16} />
                  กำลังเข้าสู่ระบบ...
                </span>
              ) : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round"
        strokeDasharray="31.416" strokeDashoffset="10" />
    </svg>
  )
}
