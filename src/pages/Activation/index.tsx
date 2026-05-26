import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'

const api = (window as any).api

type ActivationStatus = 'idle' | 'loading' | 'success'

export default function ActivationScreen({ onActivated }: { onActivated: () => void }) {
  const [hardwareId, setHardwareId] = useState<string>('กำลังอ่านข้อมูลฮาร์ดแวร์...')
  const [licenseKey, setLicenseKey] = useState('')
  const [status, setStatus] = useState<ActivationStatus>('idle')

  // Fetch hardware fingerprint on mount
  useEffect(() => {
    if (!api?.system) return
    api.system.getHardwareId().then((res: any) => {
      if (res.success) setHardwareId(res.data)
      else setHardwareId('ไม่สามารถอ่านข้อมูลฮาร์ดแวร์ได้')
    })
  }, [])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(hardwareId)
    toast.success('คัดลอก Hardware ID แล้ว')
  }, [hardwareId])

  const handleActivate = async () => {
    const trimmed = licenseKey.trim()
    if (!trimmed) {
      toast.error('กรุณากรอก License Key ก่อนดำเนินการ')
      return
    }
    if (status === 'loading') return

    setStatus('loading')

    try {
      const res = await api.system.activateLicense(trimmed, hardwareId)
      if (res.success) {
        setStatus('success')
        toast.success('เปิดใช้งานซอฟต์แวร์สำเร็จ! 🎉', { duration: 3000 })
        setTimeout(onActivated, 1500)
      } else {
        setStatus('idle')
        toast.error(res.error || 'License Key ไม่ถูกต้องหรือถูกใช้งานแล้ว', { duration: 5000 })
      }
    } catch (err) {
      setStatus('idle')
      toast.error(`เกิดข้อผิดพลาด: ${String(err)}`)
    }
  }

  return (
    <div className="relative min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden px-4">

      {/* Ambient neon glow blobs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full blur-3xl pointer-events-none bg-indigo-500/10" />
      <div className="absolute bottom-1/4 left-1/3 h-56 w-56 rounded-full blur-3xl pointer-events-none bg-violet-500/10" />
      <div className="absolute top-10 right-10 h-32 w-32 rounded-full blur-3xl pointer-events-none bg-indigo-400/5" />

      {/* Activation Card */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo / App branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 shadow-xl shadow-indigo-500/10">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.25-8.25-3.286Z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Make a Deal POS</h1>
          <p className="text-sm text-slate-400 mt-1.5 text-center">
            ซอฟต์แวร์นี้ต้องการ License Key เพื่อเปิดใช้งาน<br />กรุณาติดต่อผู้จัดจำหน่ายเพื่อรับรหัส
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/60 backdrop-blur-xl shadow-2xl shadow-black/40 p-7 space-y-6">

          {/* Hardware ID section */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Hardware ID ของเครื่องนี้
            </label>
            <div className="relative">
              <div className="font-mono text-xs bg-slate-950 border border-slate-700/50 text-indigo-300 rounded-xl p-3 text-center tracking-wide break-all select-all">
                {hardwareId}
              </div>
              <button
                onClick={handleCopy}
                title="คัดลอก Hardware ID"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-slate-800 hover:bg-indigo-500/20 border border-slate-700/50 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-300 transition-all duration-200"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0 0 13.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 0 1-.75.75H9a.75.75 0 0 1-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 0 1-2.25 2.25H6.75A2.25 2.25 0 0 1 4.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 0 1 1.927-.184" />
                </svg>
              </button>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5 text-center">
              ส่ง Hardware ID นี้ให้ผู้จัดจำหน่ายเพื่อออก License Key
            </p>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-800/60" />

          {/* License key input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              License Key
            </label>
            <input
              type="text"
              value={licenseKey}
              onChange={e => setLicenseKey(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && handleActivate()}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              disabled={status === 'loading' || status === 'success'}
              spellCheck={false}
              className="w-full text-center font-mono text-sm tracking-widest rounded-xl bg-slate-950 border border-slate-700/60 text-white placeholder-slate-600 px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-200 disabled:opacity-50"
            />
          </div>

          {/* Activate button — state machine */}
          <button
            onClick={handleActivate}
            disabled={status === 'loading' || status === 'success' || !licenseKey.trim()}
            className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold tracking-wide transition-all duration-300 ${
              status === 'success'
                ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                : status === 'loading'
                ? 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 cursor-not-allowed'
                : !licenseKey.trim()
                ? 'bg-slate-800/60 border border-slate-700/40 text-slate-600 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/50 hover:border-indigo-400 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 cursor-pointer'
            }`}
          >
            {status === 'loading' && (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {status === 'success' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
            {status === 'idle' && (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z" />
              </svg>
            )}
            {status === 'idle' && 'เปิดใช้งานซอฟต์แวร์'}
            {status === 'loading' && 'กำลังตรวจสอบ License...'}
            {status === 'success' && 'เปิดใช้งานสำเร็จ!'}
          </button>

        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-slate-700 mt-6">
          Make a Deal POS v1.0 · ลิขสิทธิ์ © 2026 Make a Deal Co., Ltd.
        </p>
      </div>
    </div>
  )
}
