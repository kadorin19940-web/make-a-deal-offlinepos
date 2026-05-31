import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useState, useEffect } from 'react'
import { useAuthStore } from './store'
import Layout from './components/layout/Layout'
import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'
import POSPage from './pages/POS'
import ProductsPage from './pages/Products'
import InventoryPage from './pages/Inventory'
import CustomersPage from './pages/Customers'
import SuppliersPage from './pages/Suppliers'
import ReportsPage from './pages/Reports'
import PromotionsPage from './pages/Promotions'
import SessionsPage from './pages/Sessions'
import SettingsPage from './pages/Settings'
import LockScreen from './components/layout/LockScreen'
import ActivationScreen from './pages/Activation'

export default function App() {
  const { isAuthenticated, isLocked, user } = useAuthStore()

  // ── Activation Gate ────────────────────────────────────────────────────────
  // null  = still checking (show nothing to avoid flash)
  // false = not activated  (force ActivationScreen)
  // true  = activated      (proceed normally)
  const [isActivated, setIsActivated] = useState<boolean | null>(null)

  useEffect(() => {
    const api = (window as any).api
    if (!api?.system) {
      // Running in browser dev mode without Electron — skip gate
      setIsActivated(true)
      return
    }
    api.system.checkActivation().then((res: any) => {
      setIsActivated(res.success ? res.data.is_activated === 1 : true)
    }).catch(() => setIsActivated(true))
  }, [])

  // Still reading DB — render nothing to prevent layout flash
  if (isActivated === null) return null

  // Not activated — cover 100 % of the screen, block all routing
  if (!isActivated) {
    return (
      <>
        <ActivationScreen onActivated={() => setIsActivated(true)} />
        <Toaster position="top-right" toastOptions={toastOptions} />
      </>
    )
  }

  if (!isAuthenticated) {
    return (
      <>
        <AmbientBackground />
        <LoginPage />
        <Toaster position="top-right" toastOptions={toastOptions} />
      </>
    )
  }

  if (isLocked) {
    return (
      <>
        <AmbientBackground />
        <LockScreen />
        <Toaster position="top-right" toastOptions={toastOptions} />
      </>
    )
  }

  return (
    <>
      <AmbientBackground />
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/pos" element={<POSPage />} />
          <Route path="/products/*" element={<ProductsPage />} />
          <Route path="/inventory/*" element={<InventoryPage />} />
          <Route path="/customers/*" element={<CustomersPage />} />
          <Route path="/suppliers/*" element={<SuppliersPage />} />
          <Route path="/reports/*" element={<ReportsPage />} />
          <Route path="/promotions/*" element={<PromotionsPage />} />
          <Route path="/sessions/*" element={<SessionsPage />} />
          <Route
            path="/settings/*"
            element={
              user?.role?.toLowerCase() === 'admin' ? (
                <SettingsPage />
              ) : (
                <Navigate to="/dashboard" replace />
              )
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
      <Toaster position="top-right" toastOptions={toastOptions} />
    </>
  )
}

function AmbientBackground() {
  return (
    <div className="ambient-bg">
      <div className="ambient-blob" style={{
        width: 600, height: 600, top: -200, left: -100,
        background: 'radial-gradient(circle, #22c55e, transparent)',
        animationDelay: '0s',
      }} />
      <div className="ambient-blob" style={{
        width: 400, height: 400, bottom: -100, right: 100,
        background: 'radial-gradient(circle, #3b82f6, transparent)',
        animationDelay: '-3s',
      }} />
      <div className="ambient-blob" style={{
        width: 300, height: 300, top: '40%', right: '20%',
        background: 'radial-gradient(circle, #8b5cf6, transparent)',
        animationDelay: '-6s',
        opacity: 0.05,
      }} />
    </div>
  )
}

const toastOptions = {
  style: {
    background: 'rgba(15, 17, 24, 0.9)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(20px)',
    color: 'rgba(255,255,255,0.9)',
    borderRadius: '12px',
    fontSize: '14px',
    fontFamily: 'Sarabun, sans-serif',
  },
  success: {
    iconTheme: { primary: '#22c55e', secondary: '#000' },
  },
  error: {
    iconTheme: { primary: '#ef4444', secondary: '#fff' },
  },
  duration: 3000,
}
