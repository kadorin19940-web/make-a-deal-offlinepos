// [FIXED: Translation Hook — Dynamic String Interpolation]
// [FIXED: Receipt Reprint — Date Formatter Must Use Stored Timestamp]
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation, formatAppDate } from '../../hooks/useTranslation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'แดชบอร์ด',
  '/pos': 'หน้าขาย',
  '/products': 'สินค้า',
  '/inventory': 'คลังสินค้า',
  '/customers': 'ลูกค้า',
  '/suppliers': 'ซัพพลายเออร์',
  '/reports': 'รายงาน',
  '/promotions': 'โปรโมชัน',
  '/sessions': 'เปิด-ปิดกะ',
  '/settings': 'ตั้งค่า',
}

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation()
  const { t } = useTranslation()
  const isPOS = location.pathname === '/pos'
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const pagePath = Object.keys(PAGE_TITLES).find(path =>
    location.pathname.startsWith(path)
  ) || ''

  const rawTitle = PAGE_TITLES[pagePath] ?? ''
  const pageTitle = t(rawTitle)

  if (isPOS) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    )
  }

  // Format date using B.E./C.E. aware formatAppDate
  const dateStr = formatAppDate(time, 'dd MMM yyyy')
  const timeStr = time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <Sidebar />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Top Bar */}
        <header style={{
          height: 56,
          background: 'rgba(8,10,15,0.7)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 24,
          paddingRight: 24,
          gap: 16,
          flexShrink: 0,
        }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.9)', margin: 0, flex: 1 }}>
            {pageTitle}
          </h1>

          {/* Clock */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            color: 'rgba(255,255,255,0.4)', fontSize: 13,
          }}>
            <Clock size={13} />
            <span style={{ fontFeatureSettings: '"tnum"' }}>
              {timeStr}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.25)' }}>·</span>
            <span>{dateStr}</span>
          </div>
        </header>

        {/* Page Content */}
        <main style={{
          flex: 1,
          overflow: 'auto',
          padding: 24,
          animation: 'fadeIn 0.25s ease-out',
        }}>
          {children}
        </main>
      </div>
    </div>
  )
}
