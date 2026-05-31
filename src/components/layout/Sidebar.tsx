import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  Users, Truck, BarChart2, Tag, DollarSign, Settings,
  Zap, LogOut, Lock, ChevronLeft, ChevronRight,
  Bell
} from 'lucide-react'
import { useAuthStore, useUIStore, useSessionStore } from '../../store'
import toast from 'react-hot-toast'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', labelTh: 'แดชบอร์ด' },
  { to: '/pos', icon: ShoppingCart, label: 'POS', labelTh: 'หน้าขาย', highlight: true, permission: 'sales' },
  { to: '/products', icon: Package, label: 'Products', labelTh: 'สินค้า', permission: 'products' },
  { to: '/inventory', icon: Warehouse, label: 'Inventory', labelTh: 'คลังสินค้า', permission: 'inventory' },
  { to: '/customers', icon: Users, label: 'Customers', labelTh: 'ลูกค้า', permission: 'customers' },
  { to: '/suppliers', icon: Truck, label: 'Suppliers', labelTh: 'ซัพพลายเออร์', permission: 'inventory' },
  { to: '/reports', icon: BarChart2, label: 'Reports', labelTh: 'รายงาน', permission: 'reports' },
  { to: '/promotions', icon: Tag, label: 'Promotions', labelTh: 'โปรโมชัน', permission: 'products' },
  { to: '/sessions', icon: DollarSign, label: 'Sessions', labelTh: 'เปิด-ปิดกะ', permission: 'sales' },
  { to: '/settings', icon: Settings, label: 'Settings', labelTh: 'ตั้งค่า', permission: 'settings' },
]

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, lock } = useAuthStore()
  const { sidebarOpen, setSidebarOpen } = useUIStore()
  const { currentSession } = useSessionStore()

  const isPOS = location.pathname === '/pos'

  if (isPOS) return null // Full screen POS

  return (
    <aside style={{
      width: sidebarOpen ? 220 : 68,
      minWidth: sidebarOpen ? 220 : 68,
      height: '100%',
      background: 'rgba(8, 10, 15, 0.8)',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.25s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        padding: sidebarOpen ? '20px 16px 16px' : '20px 12px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <div style={{
          width: 36, height: 36, minWidth: 36,
          background: 'linear-gradient(135deg, #22c55e, #16a34a)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 16px rgba(34,197,94,0.4)',
        }}>
          <Zap size={18} color="#000" strokeWidth={2.5} />
        </div>
        {sidebarOpen && (
          <div style={{ overflow: 'hidden' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.95)', whiteSpace: 'nowrap' }}>
              Make a Deal
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>
              POS System v1.0
            </div>
          </div>
        )}
      </div>

      {/* Session indicator */}
      {currentSession && sidebarOpen && (
        <div style={{
          margin: '8px 12px',
          padding: '8px 12px',
          background: 'rgba(34,197,94,0.08)',
          border: '1px solid rgba(34,197,94,0.2)',
          borderRadius: 10,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#22c55e',
            boxShadow: '0 0 6px #22c55e',
            animation: 'pulse 2s infinite',
          }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#4ade80' }}>กะเปิดอยู่</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
              ฿{currentSession.total_sales.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.filter(item => {
          if (!user) return false
          
          // Require explicitly 'admin' role for system settings
          if (item.to === '/settings') {
            return user.role?.toLowerCase() === 'admin'
          }
          
          if (!item.permission) return true
          if (user.role?.toLowerCase() === 'admin') return true
          
          let perms: string[] = []
          if (Array.isArray(user.permissions)) {
            perms = user.permissions
          } else if (typeof user.permissions === 'string') {
            try { perms = JSON.parse(user.permissions) } catch { perms = [] }
          }
          
          if (perms.includes('all')) return true
          return perms.includes(item.permission)
        }).map(item => {
          const Icon = item.icon
          const isActive = location.pathname.startsWith(item.to)
          const isHighlight = item.highlight

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="sidebar-item"
              style={({ isActive: active }) => ({
                marginBottom: 2,
                ...(active ? {
                  background: isHighlight
                    ? 'rgba(34,197,94,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  color: isHighlight ? '#22c55e' : 'rgba(255,255,255,0.9)',
                  border: `1px solid ${isHighlight ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.1)'}`,
                } : {}),
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                padding: sidebarOpen ? '9px 12px' : '9px',
              })}
              title={!sidebarOpen ? item.labelTh : undefined}
            >
              <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} style={{ minWidth: 17 }} />
              {sidebarOpen && (
                <span style={{ fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {item.labelTh}
                </span>
              )}
            </NavLink>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div style={{
        padding: '10px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* User info */}
        {sidebarOpen && user && (
          <div style={{
            padding: '8px 10px',
            marginBottom: 6,
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
              {user.name}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
              {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.role === 'manager' ? 'ผู้จัดการ' : 'พนักงานขาย'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={() => { lock(); toast('ล็อกหน้าจอแล้ว') }}
            style={{
              flex: 1, padding: '8px', background: 'none',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s', fontSize: 12, fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            title="ล็อกหน้าจอ"
          >
            <Lock size={14} />
            {sidebarOpen && 'ล็อก'}
          </button>
          <button
            onClick={() => {
              navigate('/dashboard', { replace: true })
              logout()
              toast('ออกจากระบบแล้ว')
            }}
            style={{
              flex: 1, padding: '8px', background: 'none',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
              color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              transition: 'all 0.2s', fontSize: 12, fontFamily: 'inherit',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            title="ออกจากระบบ"
          >
            <LogOut size={14} />
            {sidebarOpen && 'ออก'}
          </button>
        </div>
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'absolute', bottom: 100, right: -12,
          width: 24, height: 24,
          background: 'rgba(15,17,24,0.9)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
          transition: 'all 0.2s', zIndex: 11,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(15,17,24,0.9)')}
      >
        {sidebarOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
      </button>
    </aside>
  )
}
