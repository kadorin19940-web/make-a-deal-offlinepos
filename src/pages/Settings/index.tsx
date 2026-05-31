import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store, Percent, Printer, Shield, Users, Database, Globe,
  Save, Check as CheckIcon, ChevronRight, Plus, Edit2, Trash2, X,
  Eye, EyeOff, Key, Lock
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useSettingsStore, useAuthStore } from '../../store'
import type { User as UserType } from '../../types'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import buildConfig from '../../../public/build-config.json'

const api = (window as any).api

const TABS = [
  { id: 'shop',     label: 'ข้อมูลร้าน',    icon: <Store size={16} />,     permission: 'settings' },
  { id: 'tax',      label: 'ภาษีและราคา',    icon: <Percent size={16} />,   permission: 'settings' },
  { id: 'receipt',  label: 'ใบเสร็จ/พิมพ์',  icon: <Printer size={16} />,   permission: 'settings' },
  { id: 'users',    label: 'ผู้ใช้งาน',      icon: <Users size={16} />,     permission: 'users' },
  { id: 'security', label: 'ความปลอดภัย',    icon: <Shield size={16} />,   permission: 'settings' },
  { id: 'backup',   label: 'สำรองข้อมูล',    icon: <Database size={16} />,   permission: 'backup' },
  { id: 'language', label: 'ภาษา/ทั่วไป',    icon: <Globe size={16} />,     permission: 'settings' },
  { id: 'license',  label: 'สิทธิ์การใช้งาน', icon: <Shield size={16} />,   permission: 'settings' },
]

const MOCK_USERS: UserType[] = [
  { id: 1, username: 'admin',   name: 'ผู้ดูแลระบบ',  role: 'admin',   permissions: ['all'],              is_active: 1, created_at: '2024-01-01' },
  { id: 2, username: 'manager', name: 'ผู้จัดการ',     role: 'manager', permissions: ['sales','products'], is_active: 1, created_at: '2024-01-01' },
  { id: 3, username: 'cashier', name: 'พนักงานขาย',   role: 'cashier', permissions: ['sales'],            is_active: 1, created_at: '2024-01-01' },
]

const ALL_PERMISSIONS = [
  { id: 'sales',     label: 'การขายหน้าร้าน (POS & Sales)' },
  { id: 'customers', label: 'จัดการข้อมูลลูกค้า (Customers)' },
  { id: 'products',  label: 'จัดการสินค้า & บาร์โค้ด (Products)' },
  { id: 'reports',   label: 'ดูรายงานวิเคราะห์ (Reports)' },
  { id: 'inventory', label: 'จัดการคลังสินค้า (Inventory)' },
  { id: 'settings',  label: 'การจัดการระบบ & ตั้งค่า (Settings)' },
  { id: 'users',     label: 'จัดการสิทธิ์/ข้อมูลพนักงาน (Users)' },
  { id: 'backup',    label: 'แบ็กอัพ/กู้คืนข้อมูล (Backup)' },
]

const ROLE_DEFAULTS: Record<string, string[]> = {
  admin: ['sales', 'customers', 'products', 'reports', 'inventory', 'settings', 'users', 'backup'],
  manager: ['sales', 'customers', 'products', 'reports'],
  cashier: ['sales', 'customers'],
}

interface UserForm {
  name: string
  username: string
  password: string
  confirmPassword: string
  pin: string
  role: string
  is_active: number
  permissions: string[]
}

const GAS_CODE = `function doPost(e) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = JSON.parse(e.postData.contents);
  if (data.action === "sync_sales") {
    // 💡 Auto-create styled column headers if the sheet is completely blank!
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "เลขที่ใบเสร็จ (Receipt No)",
        "วันที่ขาย (Date & Time)",
        "ชื่อสมาชิก (Customer)",
        "ยอดรวมก่อนลด (Subtotal)",
        "ส่วนลดสมาชิก/โปรโมชัน (Discount)",
        "ภาษีมูลค่าเพิ่ม (VAT/Tax)",
        "ยอดขายสุทธิ (Total Amount)",
        "ช่องทางชำระเงิน (Payment Method)",
        "สถานะรายการ (Status)",
        "แต้มสะสมได้รับ (Points Earned)",
        "สรุปรายการสินค้า (Items Summary)"
      ]);
      // Format headers with bold font and soft grey background for premium look
      sheet.getRange(1, 1, 1, 11).setFontWeight("bold").setBackground("#f3f4f6");
    }

    var sales = data.sales;
    for (var i = 0; i < sales.length; i++) {
      var sale = sales[i];
      sheet.appendRow([
        sale.receipt_no,
        sale.sale_date,
        sale.customer_name,
        sale.subtotal,
        sale.discount_amount,
        sale.tax_amount,
        sale.total,
        sale.payment_method,
        sale.status,
        sale.points_earned,
        sale.items_summary
      ]);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}`;

const EMPTY_FORM: UserForm = {
  name: '', username: '', password: '', confirmPassword: '', pin: '', role: 'cashier', is_active: 1, permissions: ['sales', 'customers']
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab]       = useState('shop')
  const [saved, setSaved]               = useState(false)
  const { settings, setSettings }       = useSettingsStore()
  const { user: currentUser }           = useAuthStore()
  const [local, setLocal]               = useState({ ...settings })
  const [users, setUsers]               = useState<UserType[]>(MOCK_USERS)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editingUser, setEditingUser]   = useState<UserType | null>(null)
  const [userForm, setUserForm]         = useState<UserForm>(EMPTY_FORM)
  const [showPw, setShowPw]             = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [loading, setLoading]           = useState(false)

  // License State and loader
  const [licenseInfo, setLicenseInfo] = useState<{
    is_activated: number
    license_key: string | null
    email: string | null
    activated_at: string | null
  } | null>(null)
  const [showDeactivateModal, setShowDeactivateModal] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [customExporting, setCustomExporting] = useState(false)
  const [exportYear, setExportYear] = useState('all')
  const [exportMonth, setExportMonth] = useState('all')
  const [exportingExcel, setExportingExcel] = useState(false)
  const [syncingSheets, setSyncingSheets] = useState(false)
  const [showGasTutorial, setShowGasTutorial] = useState(false)
  const [lanPort, setLanPort] = useState(8080)
  const [lanServerActive, setLanServerActive] = useState(false)
  const [localIps, setLocalIps] = useState<string[]>([])

  const handleSyncGoogleSheets = async () => {
    if (!api || !api.backup) {
      toast.error('ไม่สามารถเรียกใช้งาน API ของระบบได้')
      return
    }

    setSyncingSheets(true)
    const loadToastId = toast.loading('กำลังเชื่อมต่อและซิงก์ข้อมูลไปยัง Google Sheets...')
    try {
      const res = await api.backup.syncGoogleSheets()
      toast.dismiss(loadToastId)
      if (res.success) {
        if (res.count > 0) {
          toast.success(`ซิงก์ข้อมูลยอดขายใหม่จำนวน ${res.count} รายการสำเร็จแล้ว!`)
        } else {
          toast.success('ข้อมูลยอดขายทั้งหมดได้รับการซิงก์เป็นปัจจุบันแล้ว')
        }
      } else {
        toast.error(`ซิงก์ไม่สำเร็จ: ${res.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`)
      }
    } catch (err) {
      toast.dismiss(loadToastId)
      toast.error(`เกิดข้อผิดพลาด: ${String(err)}`)
    } finally {
      setSyncingSheets(false)
    }
  }

  const handleExportSalesReport = async () => {
    if (!api || !api.dialog || !api.reports) {
      toast.error('ไม่สามารถเรียกใช้งาน API ของระบบได้')
      return
    }

    try {
      let fromDate = '1970-01-01'
      let toDate = '2099-12-31'

      if (exportYear !== 'all') {
        if (exportMonth !== 'all') {
          const yr = parseInt(exportYear)
          const mn = parseInt(exportMonth)
          const lastDay = new Date(yr, mn, 0).getDate()
          fromDate = `${exportYear}-${exportMonth}-01`
          toDate = `${exportYear}-${exportMonth}-${String(lastDay).padStart(2, '0')}`
        } else {
          fromDate = `${exportYear}-01-01`
          toDate = `${exportYear}-12-31`
        }
      }

      const defaultFileName = `sales_report_${exportYear !== 'all' ? exportYear : 'all'}${exportMonth !== 'all' && exportYear !== 'all' ? '_' + exportMonth : ''}.xlsx`
      
      const saveRes = await api.dialog.saveFile(defaultFileName, [
        { name: 'Excel Files', extensions: ['xlsx'] }
      ])

      if (saveRes.canceled || !saveRes.filePath) {
        return
      }

      const targetFilePath = saveRes.filePath
      setExportingExcel(true)
      
      const loadToastId = toast.loading('กำลังประมวลผลธุรกรรมและบันทึกเป็นไฟล์ Excel...')
      
      const res = await api.reports.exportSalesExcel(fromDate, toDate, targetFilePath, currentUser?.id)
      
      toast.dismiss(loadToastId)
      
      if (res.success) {
        toast.success('ส่งออกรายงานยอดขายเป็นไฟล์ Excel เรียบร้อยแล้ว!')
      } else {
        toast.error(`ส่งออกไม่สำเร็จ: ${res.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`)
      }
    } catch (err) {
      toast.error(`เกิดข้อผิดพลาด: ${String(err)}`)
    } finally {
      setExportingExcel(false)
    }
  }

  const loadLicenseInfo = async () => {
    if ((window as any).api && (window as any).api.system) {
      const res = await (window as any).api.system.checkActivation()
      if (res.success && res.data) {
        setLicenseInfo(res.data)
      }
    }
  }

  // Load settings + users on mount
  useEffect(() => { setLocal({ ...settings }) }, [settings])
  useEffect(() => { 
    loadUsers()
    loadLicenseInfo() 
    loadLANServerInfo()
  }, [])

  const loadLANServerInfo = async () => {
    if (api && api.lanServer) {
      const res = await api.lanServer.getStatus()
      setLanServerActive(res.running)
      setLanPort(res.port)
      
      const ips = await api.lanServer.getLocalIPs()
      setLocalIps(ips || [])
    }
  }

  const handleToggleLANServer = async (active: boolean) => {
    if (!api || !api.lanServer) {
      toast.error('ไม่สามารถเรียกใช้งาน API เครือข่ายของระบบได้')
      return
    }

    if (active) {
      const res = await api.lanServer.start(lanPort)
      if (res.success) {
        setLanServerActive(true)
        toast.success(`เปิดรันเซิร์ฟเวอร์ย่อยในวงแลนที่พอร์ต ${res.port} สำเร็จแล้ว!`)
        // Refresh IPs
        const ips = await api.lanServer.getLocalIPs()
        setLocalIps(ips || [])
      } else {
        toast.error(`ไม่สามารถเปิดเซิร์ฟเวอร์ย่อยได้: ${res.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`)
      }
    } else {
      const res = await api.lanServer.stop()
      if (res.success) {
        setLanServerActive(false)
        toast.success('ปิดรันเซิร์ฟเวอร์ย่อยในวงแลนแล้ว')
      } else {
        toast.error('ไม่สามารถปิดการทำงานเซิร์ฟเวอร์ย่อยได้')
      }
    }
  }

  const loadUsers = async () => {
    if (!api) return
    const res = await api.users.getAll()
    if (res.success && res.data) setUsers(res.data)
  }

  const handleSaveSettings = async () => {
    if (api) await api.settings.setMultiple(local, currentUser?.id)
    setSettings(local as Record<string, string>)
    setSaved(true)
    toast.success('บันทึกการตั้งค่าแล้ว')
    setTimeout(() => setSaved(false), 2500)
  }

  const handleCustomExport = async () => {
    if (!api || !api.dialog || !api.backup) {
      toast.error('ไม่สามารถเรียกใช้งาน API ของระบบได้')
      return
    }

    try {
      const folderRes = await api.dialog.openDirectory()
      if (folderRes.canceled || !folderRes.filePaths || folderRes.filePaths.length === 0) {
        return
      }

      const selectedDir = folderRes.filePaths[0]
      setCustomExporting(true)
      
      const loadToastId = toast.loading('กำลังรวบรวมไฟล์และสำรองข้อมูล...')
      
      const res = await api.backup.exportCustom(selectedDir)
      
      toast.dismiss(loadToastId)
      
      if (res.success) {
        toast.success(`สำรองข้อมูลเรียบร้อย! คัดลอกฐานข้อมูลและรูปภาพสินค้าสำเร็จ`, {
          duration: 6000
        })
      } else {
        toast.error(`การสำรองข้อมูลล้มเหลว: ${res.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ'}`)
      }
    } catch (err) {
      toast.error(`ข้อผิดพลาดการเชื่อมต่อระบบ: ${String(err)}`)
    } finally {
      setCustomExporting(false)
    }
  }

  const setField = (k: string, v: string) => setLocal(f => ({ ...f, [k]: v }))

  // Open modal for add or edit
  const openModal = (u?: UserType) => {
    setEditingUser(u || null)
    if (u) {
      let perms: string[] = []
      if (Array.isArray(u.permissions)) {
        perms = u.permissions
      } else if (typeof u.permissions === 'string') {
        try { perms = JSON.parse(u.permissions) } catch { perms = [] }
      }
      setUserForm({
        name: u.name,
        username: u.username,
        password: '',
        confirmPassword: '',
        pin: u.pin || '',
        role: u.role,
        is_active: u.is_active,
        permissions: perms
      })
    } else {
      setUserForm({ ...EMPTY_FORM, permissions: ['sales', 'customers'] })
    }
    setShowPw(false)
    setShowConfirmPw(false)
    setShowUserModal(true)
  }

  const saveUser = async () => {
    // Validation
    if (!userForm.name.trim())     { toast.error('กรุณากรอกชื่อ-นามสกุล');   return }
    if (!userForm.username.trim()) { toast.error('กรุณากรอกชื่อผู้ใช้');      return }

    if (!editingUser && !userForm.password) {
      toast.error('กรุณากรอกรหัสผ่าน'); return
    }
    if (userForm.password && userForm.password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return
    }
    if (userForm.password && userForm.password !== userForm.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน กรุณากรอกใหม่'); return
    }
    if (userForm.pin && (userForm.pin.length < 4 || !/^\d+$/.test(userForm.pin))) {
      toast.error('PIN ต้องเป็นตัวเลข 4-6 หลัก'); return
    }

    setLoading(true)
    try {
      const userRole = userForm.role as UserType['role']

      if (editingUser) {
        // --- UPDATE existing user ---
        const updateData: Record<string, unknown> = {
          name:        userForm.name,
          username:    userForm.username,
          role:        userForm.role,
          pin:         userForm.pin || null,
          is_active:   userForm.is_active,
          permissions: userForm.permissions,
        }
        // Only send password if user actually typed a new one
        if (userForm.password) updateData.password = userForm.password

        if (api) {
          const res = await api.users.update(editingUser.id, updateData)
          if (!res.success) { toast.error(res.error || 'แก้ไขไม่สำเร็จ'); return }
        }

        setUsers(u => u.map(x => x.id === editingUser.id
          ? { ...x, name: userForm.name, username: userForm.username, role: userRole, pin: userForm.pin, is_active: userForm.is_active, permissions: userForm.permissions }
          : x
        ))
        toast.success(`แก้ไขข้อมูล "${userForm.name}" สำเร็จ`)

      } else {
        // --- CREATE new user ---
        const createData = {
          name:        userForm.name,
          username:    userForm.username,
          password:    userForm.password,
          role:        userForm.role,
          pin:         userForm.pin || null,
          is_active:   1,
          permissions: userForm.permissions,
        }
        if (api) {
          const res = await api.users.create(createData)
          if (!res.success) { toast.error(res.error || 'เพิ่มผู้ใช้ไม่สำเร็จ'); return }
        }

        const newU: UserType = {
          id: Date.now(), username: userForm.username, name: userForm.name,
          role: userRole, pin: userForm.pin, permissions: userForm.permissions, is_active: 1,
          created_at: new Date().toISOString(),
        }
        setUsers(u => [...u, newU])
        toast.success(`เพิ่มผู้ใช้ "${userForm.name}" สำเร็จ`)
      }

      setShowUserModal(false)
    } finally {
      setLoading(false)
    }
  }

  const deleteUser = async (u: UserType) => {
    if (u.id === currentUser?.id) { toast.error('ไม่สามารถลบบัญชีตัวเองได้'); return }
    if (!confirm(`ต้องการลบผู้ใช้ "${u.name}"?`)) return
    if (api) await api.users.delete(u.id)
    setUsers(list => list.filter(x => x.id !== u.id))
    toast.success(`ลบ "${u.name}" แล้ว`)
  }

  const toggleActive = async (u: UserType) => {
    if (u.id === currentUser?.id) { toast.error('ไม่สามารถปิดการใช้งานบัญชีตัวเองได้'); return }
    const newActive = u.is_active ? 0 : 1
    if (api) await api.users.update(u.id, { is_active: newActive })
    setUsers(list => list.map(x => x.id === u.id ? { ...x, is_active: newActive } : x))
    toast.success(newActive ? 'เปิดใช้งานแล้ว' : 'ปิดใช้งานแล้ว')
  }

  const roleLabel = (r: string) => ({ admin: 'ผู้ดูแลระบบ', manager: 'ผู้จัดการ', cashier: 'พนักงานขาย' }[r] || r)
  const roleColor = (r: string) => ({ admin: '#f59e0b', manager: '#3b82f6', cashier: '#22c55e' }[r] || '#64748b')

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 120px)' }}>

      {/* Left tab menu */}
      <div style={{ width: 200, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {TABS.filter(t => {
          if (!currentUser) return false
          if (currentUser.role === 'admin') return true

          let perms: string[] = []
          if (Array.isArray(currentUser.permissions)) {
            perms = currentUser.permissions
          } else if (typeof currentUser.permissions === 'string') {
            try { perms = JSON.parse(currentUser.permissions) } catch { perms = [] }
          }

          if (perms.includes('all')) return true
          return perms.includes(t.permission)
        }).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
            width: '100%', padding: '10px 14px', textAlign: 'left',
            background:   activeTab === t.id ? 'rgba(34,197,94,0.12)' : 'transparent',
            border:       `1px solid ${activeTab === t.id ? 'rgba(34,197,94,0.25)' : 'transparent'}`,
            borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
            color:      activeTab === t.id ? '#22c55e' : 'rgba(255,255,255,0.5)',
            fontSize: 13, fontWeight: activeTab === t.id ? 600 : 400,
            display: 'flex', alignItems: 'center', gap: 10, transition: 'all 0.15s',
          }}>
            {t.icon} {t.label}
            {activeTab === t.id && <ChevronRight size={12} style={{ marginLeft: 'auto' }} />}
          </button>
        ))}
      </div>

      {/* Right content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 28, marginBottom: 16 }}>

          {/* ---- Shop Info ---- */}
          {activeTab === 'shop' && (
            <Section title="ข้อมูลร้านค้า" desc="ชื่อร้าน ที่อยู่ และข้อมูลติดต่อ">
              {([
                ['shop_name', 'ชื่อร้าน (ภาษาไทย)', 'ชื่อภาษาไทยของร้านค้า จะแสดงผลบนหน้าจอโปรแกรมหลักและหน้าต่างรายงานต่างๆ'],
                ['shop_name_en', 'ชื่อร้าน (English)', 'ชื่อภาษาอังกฤษของร้านค้า ใช้สำหรับแสดงผลบนรูปแบบเอกสารหรือรายงานที่เป็นภาษาอังกฤษ'],
                ['shop_address', 'ที่อยู่', 'ที่อยู่ร้านค้าแบบละเอียด จะใช้แสดงในส่วนหัวหรือท้ายของใบเสร็จรับเงินที่พิมพ์ให้ลูกค้า'],
                ['shop_phone', 'เบอร์โทรศัพท์', 'เบอร์โทรศัพท์ติดต่อของร้านค้า จะแสดงในใบเสร็จเพื่อให้ลูกค้าสามารถติดต่อกลับได้สะดวก'],
                ['shop_email', 'อีเมล', 'อีเมลติดต่อของร้านค้า สำหรับติดต่อประสานงานและแสดงผลบนใบเสร็จรับเงิน'],
                ['shop_tax_id', 'เลขผู้เสียภาษี', 'เลขประจำตัวผู้เสียภาษีอากร 13 หลักของร้านค้า จำเป็นอย่างยิ่งในการออกใบกำกับภาษีอย่างย่อ'],
                ['promptpay_id', 'เบอร์พร้อมเพย์ / เลขผู้เสียภาษี (สำหรับสร้าง QR Code)', 'เบอร์พร้อมเพย์ หรือเลขผู้เสียภาษี สำหรับสร้าง QR Code ให้ลูกค้าสแกนจ่ายเงินได้สะดวกรวดเร็ว']
              ] as [string,string,string][]).map(([k,l,h]) => (
                <SettingRow key={k} label={l}>
                  <input className="glass-input" value={local[k] || ''} onChange={e => setField(k, e.target.value)} placeholder={l} />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4, lineHeight: 1.4 }}>
                    {h}
                  </p>
                  {k === 'promptpay_id' && (
                    <p style={{
                      fontSize: 12,
                      color: '#fcd34d',
                      marginTop: 6,
                      opacity: 0.85,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      lineHeight: 1.4
                    }}>
                      💡 ข้อมูลนี้จะถูกนำไปใช้สร้าง QR Code พร้อมเพย์อัตโนมัติ เพื่อแสดงบนหน้าจอชำระเงินเมื่อลูกค้าต้องการโอนจ่าย
                    </p>
                  )}
                </SettingRow>
              ))}
            </Section>
          )}

          {/* ---- Tax ---- */}
          {activeTab === 'tax' && (
            <Section title="ภาษีและราคา" desc="VAT และระบบแต้มสะสม">
              <SettingRow label="เปิดใช้ VAT">
                <Toggle checked={local.vat_enabled === 'true'} onChange={v => setField('vat_enabled', v ? 'true' : 'false')} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เปิดหรือปิดการคำนวณภาษีมูลค่าเพิ่มสำหรับรายการสินค้าขายทั้งหมดในหน้าร้าน</p>
              </SettingRow>
              <SettingRow label="อัตรา VAT (%)">
                <input className="glass-input" type="number" value={local.vat_rate || '7'} onChange={e => setField('vat_rate', e.target.value)} style={{ maxWidth: 120 }} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>สัดส่วนเปอร์เซ็นต์ภาษีมูลค่าเพิ่ม (ปกติคือ 7% สำหรับประเทศไทย)</p>
              </SettingRow>
              <SettingRow label="VAT รวมในราคา">
                <Toggle checked={local.vat_inclusive !== 'false'} onChange={v => setField('vat_inclusive', v ? 'true' : 'false')} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เปิดเพื่อให้ราคาขายสินค้ารวมภาษีไว้แล้ว (Inclusive VAT) หรือปิดเพื่อบวกภาษีเพิ่มต่างหาก (Exclusive VAT)</p>
              </SettingRow>
              <SettingRow label="สะสมแต้ม (บาท / 1 แต้ม)">
                <input className="glass-input" type="number" value={local.points_per_baht || '1'} onChange={e => setField('points_per_baht', e.target.value)} style={{ maxWidth: 120 }} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>จำนวนเงินยอดซื้อสินค้าต่อการรับคะแนนสะสม 1 คะแนน (เช่น ยอด 1 บาท ได้ 1 คะแนน)</p>
              </SettingRow>
              <SettingRow label="แลกแต้ม (1 แต้ม = กี่บาท)">
                <input className="glass-input" type="number" value={local.baht_per_point || '0.1'} onChange={e => setField('baht_per_point', e.target.value)} style={{ maxWidth: 120 }} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>มูลค่าเงินคืนหรือส่วนลดที่ลูกค้าได้รับเมื่อนำคะแนนสะสม 1 คะแนนมาแลกรับส่วนลด</p>
              </SettingRow>
            </Section>
          )}

          {/* ---- Receipt ---- */}
          {activeTab === 'receipt' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 28, alignItems: 'start' }}>
              {/* Left Column: Settings Form */}
              <Section title="ใบเสร็จ และเครื่องพิมพ์" desc="ตั้งค่าการพิมพ์ใบเสร็จ">
                <SettingRow label="พิมพ์ใบเสร็จอัตโนมัติ">
                  <Toggle checked={local.auto_print === 'true'} onChange={v => setField('auto_print', v ? 'true' : 'false')} />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เมื่อเปิดใช้งาน เครื่องพิมพ์จะพิมพ์ใบเสร็จโดยอัตโนมัติทันทีที่ชำระเงินเสร็จสิ้น</p>
                </SettingRow>
                <SettingRow label="ขนาดกระดาษ">
                  <select className="glass-input" value={local.printer_size || '80mm'} onChange={e => setField('printer_size', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', maxWidth: 160 }}>
                    <option value="58mm" style={{ color: '#1a1b20', background: '#ffffff' }}>58mm (Thermal)</option>
                    <option value="80mm" style={{ color: '#1a1b20', background: '#ffffff' }}>80mm (Thermal)</option>
                    <option value="A4" style={{ color: '#1a1b20', background: '#ffffff' }}>A4</option>
                    <option value="A5" style={{ color: '#1a1b20', background: '#ffffff' }}>A5</option>
                  </select>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>ขนาดของม้วนกระดาษของเครื่องพิมพ์ใบเสร็จความร้อน หรือแบบรายงานปกติที่ใช้งาน</p>
                </SettingRow>
                <SettingRow label="ข้อความส่วนหัวใบเสร็จ">
                  <input className="glass-input" value={local.receipt_header || ''} onChange={e => setField('receipt_header', e.target.value)} placeholder="ขอบคุณที่ใช้บริการ" />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>ข้อความต้อนรับหรือรายละเอียดเพิ่มเติมที่ต้องการพิมพ์แสดงไว้ส่วนหัวของใบเสร็จ</p>
                </SettingRow>
                <SettingRow label="ข้อความส่วนท้ายใบเสร็จ">
                  <input className="glass-input" value={local.receipt_footer || ''} onChange={e => setField('receipt_footer', e.target.value)} placeholder="กรุณาเก็บใบเสร็จไว้" />
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>ข้อความขอบคุณหรือเงื่อนไขการรับเปลี่ยนคืนสินค้าที่จะพิมพ์ไว้ด้านล่างสุดของใบเสร็จ</p>
                </SettingRow>
              </Section>

              {/* Right Column: Real-Time Thermal Receipt Preview */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 1 }}>ตัวอย่างใบเสร็จจริง (Real-Time)</span>
                
                <div style={{
                  background: '#f8f8fb',
                  color: '#1a1b20',
                  borderRadius: 8,
                  padding: '24px 16px',
                  boxShadow: '0 15px 35px rgba(0, 0, 0, 0.4), inset 0 3px 0 #22c55e',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: 'monospace',
                  fontSize: local.printer_size === '58mm' ? 10.5 : 12,
                  width: local.printer_size === '58mm' ? '250px' : '300px',
                  boxSizing: 'border-box',
                  position: 'relative',
                  transition: 'width 0.25s ease, font-size 0.25s ease'
                }}>
                  {/* Paper cut jagged effect at top */}
                  <div style={{
                    position: 'absolute',
                    top: -6,
                    left: 0,
                    right: 0,
                    height: 6,
                    background: 'linear-gradient(-45deg, transparent 4px, #f8f8fb 0), linear-gradient(45deg, transparent 4px, #f8f8fb 0)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: 'left top'
                  }} />

                  {/* Receipt Header info */}
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 15, fontWeight: 'bold', marginBottom: 4, letterSpacing: 0.5 }}>
                      {local.shop_name || 'MAKE A DEAL STORE'}
                    </div>
                    {local.shop_name_en && (
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.6)', textTransform: 'uppercase', marginBottom: 4 }}>
                        {local.shop_name_en}
                      </div>
                    )}
                    <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.7)', lineHeight: 1.3, marginBottom: 2 }}>
                      {local.shop_address || '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร 10110'}
                    </div>
                    {local.shop_phone && (
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.7)', marginBottom: 2 }}>
                        โทร: {local.shop_phone}
                      </div>
                    )}
                    {local.shop_tax_id && (
                      <div style={{ fontSize: 9, color: 'rgba(0,0,0,0.7)', marginBottom: 4 }}>
                        เลขผู้เสียภาษี: {local.shop_tax_id}
                      </div>
                    )}
                    
                    {/* Real-Time User Message Header */}
                    {local.receipt_header && (
                      <div style={{
                        fontSize: 9.5,
                        fontWeight: 'bold',
                        marginTop: 8,
                        padding: '4px 6px',
                        border: '1px dashed rgba(0,0,0,0.2)',
                        background: 'rgba(0,0,0,0.02)',
                        display: 'inline-block',
                        borderRadius: 4
                      }}>
                        {local.receipt_header}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ borderBottom: '1px dashed rgba(0,0,0,0.3)', margin: '8px 0' }} />

                  {/* Metadata */}
                  <div style={{ fontSize: 8.5, color: 'rgba(0,0,0,0.8)', lineHeight: 1.4, marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>วันที่/เวลา:</span>
                      <span>{format(new Date(), 'dd/MM/yyyy HH:mm')}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>เลขที่บิล:</span>
                      <span style={{ fontWeight: 'bold' }}>INV-20260601-0001</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>แคชเชียร์:</span>
                      <span>{currentUser?.name || 'ADMIN'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>รูปแบบกระดาษ:</span>
                      <span style={{ color: '#22c55e', fontWeight: 'bold' }}>{local.printer_size || '80mm'}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderBottom: '1px dashed rgba(0,0,0,0.3)', margin: '8px 0' }} />

                  {/* Items List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '8px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1, paddingRight: 8 }}>
                        <div>กาแฟอเมริกาโน่เย็น</div>
                        <div style={{ fontSize: 8.5, color: 'rgba(0,0,0,0.6)' }}>1 x ฿85.00</div>
                      </div>
                      <span style={{ fontWeight: 'bold' }}>฿85.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                      <div style={{ flex: 1, paddingRight: 8 }}>
                        <div>ชาเย็นสูตรดั้งเดิม</div>
                        <div style={{ fontSize: 8.5, color: 'rgba(0,0,0,0.6)' }}>2 x ฿65.00</div>
                      </div>
                      <span style={{ fontWeight: 'bold' }}>฿130.00</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderBottom: '1px dashed rgba(0,0,0,0.3)', margin: '8px 0' }} />

                  {/* Calculations */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 9.5, margin: '6px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>ยอดรวมก่อนลด:</span>
                      <span>฿215.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(0,0,0,0.7)' }}>
                      <span>ส่วนลด:</span>
                      <span>฿0.00</span>
                    </div>
                    {local.vat_enabled === 'true' && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(0,0,0,0.7)' }}>
                        <span>ภาษีมูลค่าเพิ่ม VAT ({local.vat_rate || '7'}%):</span>
                        <span>฿14.07</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 'bold', borderTop: '1px solid rgba(0,0,0,0.1)', paddingTop: 4 }}>
                      <span>ยอดรวมสุทธิ (Total):</span>
                      <span>฿215.00</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderBottom: '1px dashed rgba(0,0,0,0.3)', margin: '8px 0' }} />

                  {/* Payment info */}
                  <div style={{ fontSize: 8.5, color: 'rgba(0,0,0,0.8)', lineHeight: 1.4, margin: '6px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>ชำระเงินโดย:</span>
                      <span>เงินสด (Cash)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>รับเงินมา:</span>
                      <span>฿500.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                      <span>เงินทอน:</span>
                      <span>฿285.00</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ borderBottom: '1px dashed rgba(0,0,0,0.3)', margin: '8px 0' }} />

                  {/* Real-Time User Message Footer */}
                  <div style={{ textAlign: 'center', marginTop: 10 }}>
                    {local.receipt_footer ? (
                      <div style={{ fontSize: 9.5, fontStyle: 'italic', color: 'rgba(0,0,0,0.8)', lineHeight: 1.4 }}>
                        {local.receipt_footer}
                      </div>
                    ) : (
                      <div style={{ fontSize: 8.5, color: 'rgba(0,0,0,0.4)' }}>
                        [ ไม่มีข้อความท้ายใบเสร็จ ]
                      </div>
                    )}

                    {/* Simulated barcode */}
                    <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <div style={{
                        width: '80%',
                        height: 24,
                        background: 'repeating-linear-gradient(90deg, #1a1b20, #1a1b20 2px, transparent 2px, transparent 5px, #1a1b20 5px, #1a1b20 7px, transparent 7px, transparent 9px)'
                      }} />
                      <span style={{ fontSize: 6.5, color: 'rgba(0,0,0,0.5)', letterSpacing: 1.2 }}>*INV-20260601-0001*</span>
                    </div>
                    
                    <div style={{ fontSize: 7.5, color: 'rgba(0,0,0,0.4)', marginTop: 8 }}>
                      Powered by Make a Deal POS
                    </div>
                  </div>

                  {/* Paper cut jagged effect at bottom */}
                  <div style={{
                    position: 'absolute',
                    bottom: -6,
                    left: 0,
                    right: 0,
                    height: 6,
                    background: 'linear-gradient(135deg, transparent 4px, #f8f8fb 0), linear-gradient(-135deg, transparent 4px, #f8f8fb 0)',
                    backgroundSize: '8px 8px',
                    backgroundPosition: 'left bottom'
                  }} />
                </div>
              </div>
            </div>
          )}

          {/* ---- Users ---- */}
          {activeTab === 'users' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>ผู้ใช้งาน</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>จัดการบัญชี รหัสผ่าน PIN และสิทธิ์</div>
                </div>
                <button onClick={() => openModal()} className="glass-btn btn-primary" style={{ fontSize: 13, padding: '8px 14px' }}>
                  <Plus size={14} /> เพิ่มผู้ใช้
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {users.map(u => (
                  <div key={u.id} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 18px',
                    background: u.id === currentUser?.id ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${u.id === currentUser?.id ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 14, opacity: u.is_active ? 1 : 0.5, transition: 'all 0.2s',
                  }}>
                    {/* Avatar */}
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%',
                      background: `${roleColor(u.role)}22`, border: `2px solid ${roleColor(u.role)}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: roleColor(u.role), flexShrink: 0,
                    }}>
                      {u.name.charAt(0)}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{u.name}</span>
                        {u.id === currentUser?.id && (
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>คุณ</span>
                        )}
                        {!u.is_active && (
                          <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 100, background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>ปิดใช้งาน</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                        @{u.username}
                        {u.pin ? <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.25)' }}>• PIN ตั้งค่าแล้ว</span> : <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.18)' }}>• ยังไม่มี PIN</span>}
                      </div>
                    </div>

                    {/* Role badge */}
                    <span style={{
                      padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 600, flexShrink: 0,
                      background: `${roleColor(u.role)}18`, color: roleColor(u.role), border: `1px solid ${roleColor(u.role)}33`,
                    }}>
                      {roleLabel(u.role)}
                    </span>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => openModal(u)}
                        title="แก้ไขข้อมูล / เปลี่ยนรหัสผ่าน"
                        style={{ padding: '6px 10px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 8, cursor: 'pointer', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontFamily: 'inherit', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.2)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.1)')}
                      >
                        <Key size={12} /> แก้ไข
                      </button>
                      {u.id !== currentUser?.id && (
                        <>
                          <button
                            onClick={() => toggleActive(u)}
                            title={u.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            style={{ padding: '6px 8px', background: u.is_active ? 'rgba(245,158,11,0.1)' : 'rgba(34,197,94,0.1)', border: `1px solid ${u.is_active ? 'rgba(245,158,11,0.25)' : 'rgba(34,197,94,0.25)'}`, borderRadius: 8, cursor: 'pointer', color: u.is_active ? '#fcd34d' : '#22c55e', display: 'flex', alignItems: 'center', fontSize: 12, fontFamily: 'inherit' }}
                          >
                            {u.is_active ? <Lock size={13} /> : <Check size={13} />}
                          </button>
                          <button
                            onClick={() => deleteUser(u)}
                            title="ลบผู้ใช้"
                            style={{ padding: '6px 8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, cursor: 'pointer', color: '#fca5a5', display: 'flex', alignItems: 'center', fontSize: 12, fontFamily: 'inherit' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ---- Security ---- */}
          {activeTab === 'security' && (
            <Section title="ความปลอดภัย" desc="PIN และการล็อกหน้าจออัตโนมัติ">
              <SettingRow label="ล็อกหน้าจออัตโนมัติ (นาที)">
                <input className="glass-input" type="number" value={local.pin_lock_minutes || '15'} onChange={e => setField('pin_lock_minutes', e.target.value)} style={{ maxWidth: 120 }} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เมื่อไม่มีการขยับหน้าจอในระยะเวลาที่กำหนด ระบบจะล็อกหน้าจอขายอัตโนมัติเพื่อความปลอดภัยและต้องใช้ PIN เพื่อปลดล็อก</p>
              </SettingRow>
            </Section>
          )}

          {/* ---- Backup ---- */}
          {activeTab === 'backup' && (
            <Section title="สำรองข้อมูล" desc="สำรองและกู้คืนฐานข้อมูล SQLite">
              <SettingRow label="สำรองข้อมูลอัตโนมัติ font-medium">
                <Toggle checked={local.backup_enabled === 'true'} onChange={v => setField('backup_enabled', v ? 'true' : 'false')} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เปิดหรือปิดระบบสำรองฐานข้อมูลอัตโนมัติเพื่อความปลอดภัยสูง ป้องกันไฟล์พังกรณีระบบปฏิบัติการค้างหรือไฟตก</p>
              </SettingRow>
              <SettingRow label="ทุกกี่ชั่วโมง">
                <input className="glass-input" type="number" value={local.backup_interval_hours || '24'} onChange={e => setField('backup_interval_hours', e.target.value)} style={{ maxWidth: 120 }} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>ความถี่ในการรันสำรองข้อมูลเบื้องหลังอัตโนมัติในทุกๆ ชั่วโมงขณะโปรแกรมกำลังเปิดรันอยู่</p>
              </SettingRow>
              <SettingRow label="ดำเนินการด่วน">
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={async () => { if (api) { const r = await api.backup.create(); if (r.success) toast.success('สำรองข้อมูลแล้ว') } else toast.success('Demo: สำรองข้อมูลแล้ว') }} className="glass-btn btn-primary" style={{ fontSize: 13 }}>
                    <Database size={14} /> สำรองข้อมูลเดี๋ยวนี้
                  </button>
                  <button onClick={() => toast('กรุณาเลือกไฟล์สำรอง')} className="glass-btn btn-secondary" style={{ fontSize: 13 }}>
                    กู้คืนข้อมูล
                  </button>
                </div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>สั่งรันระบบสำรองฐานข้อมูลแบบเงียบ หรือเลือกกู้คืนไฟล์ระบบผ่านการเลือกไฟล์ต้นฉบับสำรอง</p>
              </SettingRow>

              <SettingRow label="ส่งออกข้อมูลทั้งหมดแบบกำหนดเอง">
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 10,
                }}>
                  <div style={{ fontSize: 13, color: '#60a5fa', fontWeight: 600, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Database size={15} /> สำรองข้อมูลและรูปภาพลงไดรฟ์ภายนอก (USB / Flash Drive)
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    สำหรับผู้ที่ต้องการสำรองข้อมูลด่วนหรือต้องการย้ายเครื่องคอมพิวเตอร์ ระบบจะทำการคัดลอกไฟล์ฐานข้อมูลหลัก (.db) ควบคู่กับแฟ้มรูปภาพสินค้าทั้งหมดในระบบ ไปรวมเก็บไว้ในโฟลเดอร์ปลายทางที่คุณระบุได้ทันทีในคลิกเดียว
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                    <button
                      onClick={handleCustomExport}
                      disabled={customExporting}
                      className="glass-btn"
                      style={{
                        background: customExporting ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2))',
                        border: '1px solid rgba(59,130,246,0.35)',
                        borderRadius: 10,
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: customExporting ? 'rgba(255,255,255,0.3)' : '#60a5fa',
                        cursor: customExporting ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        opacity: customExporting ? 0.6 : 1
                      }}
                      onMouseEnter={e => {
                        if (!customExporting) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(37,99,235,0.3))'
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!customExporting) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2))'
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)'
                        }
                      }}
                    >
                      <Database size={14} />
                      {customExporting ? 'กำลังส่งออกข้อมูล...' : 'เลือกโฟลเดอร์ปลายทาง และสำรองข้อมูล'}
                    </button>
                  </div>
                </div>
              </SettingRow>

              <SettingRow label="ส่งออกรายงานยอดขาย (Export Reported)">
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 10,
                }}>
                  <div style={{ fontSize: 13, color: '#10b981', fontWeight: 600, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Save size={15} /> ส่งออกรายงานยอดขายออกมาเป็นไฟล์ Excel (.xlsx)
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    ฟีเจอร์สำหรับดึงรายงานสรุปยอดขายตามข้อมูลที่เก็บอยู่ในระบบ เพื่อให้ง่ายต่อการนำไปใช้งานจริงของลูกค้า สามารถเลือกกรองตามปี/เดือน หรือดึงข้อมูลทั้งหมดได้ทันที
                  </div>
                  
                  {/* Filters */}
                  <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>เลือกปี (Year)</span>
                      <select 
                        className="glass-input" 
                        value={exportYear} 
                        onChange={e => {
                          setExportYear(e.target.value);
                          if (e.target.value === 'all') setExportMonth('all');
                        }}
                        style={{ background: 'rgba(0,0,0,0.25)', color: 'rgba(255,255,255,0.85)' }}
                      >
                        <option value="all">ทั้งหมด (All Years)</option>
                        <option value="2026">2026</option>
                        <option value="2025">2025</option>
                        <option value="2024">2024</option>
                        <option value="2023">2023</option>
                        <option value="2022">2022</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>เลือกเดือน (Month)</span>
                      <select 
                        className="glass-input" 
                        value={exportMonth} 
                        disabled={exportYear === 'all'}
                        onChange={e => setExportMonth(e.target.value)}
                        style={{ 
                          background: 'rgba(0,0,0,0.25)', 
                          color: exportYear === 'all' ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.85)',
                          cursor: exportYear === 'all' ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="all">ทั้งหมด (All Months)</option>
                        <option value="01">มกราคม (01)</option>
                        <option value="02">กุมภาพันธ์ (02)</option>
                        <option value="03">มีนาคม (03)</option>
                        <option value="04">เมษายน (04)</option>
                        <option value="05">พฤษภาคม (05)</option>
                        <option value="06">มิถุนายน (06)</option>
                        <option value="07">กรกฎาคม (07)</option>
                        <option value="08">สิงหาคม (08)</option>
                        <option value="09">กันยายน (09)</option>
                        <option value="10">ตุลาคม (10)</option>
                        <option value="11">พฤศจิกายน (11)</option>
                        <option value="12">ธันวาคม (12)</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                    <button
                      onClick={handleExportSalesReport}
                      disabled={exportingExcel}
                      className="glass-btn"
                      style={{
                        background: exportingExcel ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))',
                        border: '1px solid rgba(16,185,129,0.35)',
                        borderRadius: 10,
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: exportingExcel ? 'rgba(255,255,255,0.3)' : '#10b981',
                        cursor: exportingExcel ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        opacity: exportingExcel ? 0.6 : 1
                      }}
                      onMouseEnter={e => {
                        if (!exportingExcel) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.3), rgba(5,150,105,0.3))'
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!exportingExcel) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.2))'
                          e.currentTarget.style.borderColor = 'rgba(16,185,129,0.35)'
                        }
                      }}
                    >
                      <Save size={14} />
                      {exportingExcel ? 'กำลังส่งออกรายงาน...' : 'ส่งออกรายงาน Excel (Export Reported)'}
                    </button>
                  </div>
                </div>
              </SettingRow>

              <SettingRow label="ระบบเชื่อมต่อ Google Sheets Cloud Sync">
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 10,
                }}>
                  <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={15} /> ซิงก์ข้อมูลยอดขายไปยังบัญชี Google Sheets ของคุณแบบเรียลไทม์
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    คุณสามารถส่งและอัปเดตข้อมูลการขายในเครื่อง POS นี้ เข้าไปยังไฟล์ Google Sheets ดั้งเดิมของคุณได้ทันที เมื่อเปลี่ยนเครื่องคอมพิวเตอร์ในอนาคต เพียงคัดลอกลิงก์มาใส่ ข้อมูลจะถูกบันทึกต่อจากรายการเดิมโดยอัตโนมัติ
                  </div>

                  {/* Input link field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>ลิงก์ Google Sheets Web App URL *</span>
                    <input 
                      className="glass-input" 
                      value={local.google_sheet_url || ''} 
                      onChange={e => setField('google_sheet_url', e.target.value)} 
                      placeholder="วางลิงก์ https://script.google.com/macros/s/..." 
                      style={{ fontFamily: 'monospace', fontSize: 12 }}
                    />
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>
                      * ต้องใช้ลิงก์ที่สร้างจาก Google Apps Script (ไม่ใช่ลิงก์ของ Google Sheets ตรงๆ) เพื่อความปลอดภัยและความเสถียรสูงสุดตามมาตรฐานระบบ POS
                    </p>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={handleSyncGoogleSheets}
                      disabled={syncingSheets}
                      className="glass-btn"
                      style={{
                        background: syncingSheets ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2))',
                        border: '1px solid rgba(59,130,246,0.35)',
                        borderRadius: 10,
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: syncingSheets ? 'rgba(255,255,255,0.3)' : '#60a5fa',
                        cursor: syncingSheets ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        transition: 'all 0.2s',
                        opacity: syncingSheets ? 0.6 : 1
                      }}
                      onMouseEnter={e => {
                        if (!syncingSheets) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.3), rgba(37,99,235,0.3))'
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.5)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!syncingSheets) {
                          e.currentTarget.style.background = 'linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2))'
                          e.currentTarget.style.borderColor = 'rgba(59,130,246,0.35)'
                        }
                      }}
                    >
                      <Globe size={14} />
                      {syncingSheets ? 'กำลังประมวลผลการซิงก์...' : 'ซิงก์ข้อมูลไป Google Sheets (Sync Now)'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowGasTutorial(v => !v)}
                      className="glass-btn btn-secondary"
                      style={{
                        borderRadius: 10,
                        padding: '10px 18px',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      💡 {showGasTutorial ? 'ซ่อนคู่มือวิธีตั้งค่า' : 'ดูคู่มือขั้นตอนการตั้งค่า (ฟรีใน 3 นาที)'}
                    </button>
                  </div>

                  {/* Expandable GAS Tutorial */}
                  {showGasTutorial && (
                    <div style={{
                      background: 'rgba(0,0,0,0.2)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 10,
                      padding: 16,
                      marginTop: 10,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fcd34d' }}>
                        📖 คู่มือขั้นตอนการเชื่อมต่อ Google Sheets ใน 3 นาที:
                      </div>
                      <ol style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li>สร้างหรือเปิดไฟล์ <strong>Google Sheet</strong> ที่คุณต้องการนำข้อมูลไปเก็บไว้</li>
                        <li>ที่เมนูด้านบน กดไปที่ <strong>ส่วนขยาย (Extensions) &gt; Apps Script</strong></li>
                        <li>ลบโค้ดเดิมในไฟล์ทิ้งให้หมด แล้วกดปุ่ม <strong>"คัดลอกโค้ด Apps Script"</strong> ด้านล่างนี้ไปวางแทนที่:</li>
                      </ol>

                      {/* GAS Script Copy Section */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>Code.gs (Apps Script)</span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(GAS_CODE)
                              toast.success('คัดลอกโค้ด Apps Script ลงในคลิปบอร์ดแล้ว! สามารถนำไปวางได้ทันที')
                            }}
                            className="glass-btn"
                            style={{ padding: '4px 10px', fontSize: 11, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80', borderRadius: 6 }}
                          >
                            คัดลอกโค้ด Apps Script
                          </button>
                        </div>
                        <pre style={{
                          margin: 0,
                          fontSize: 10,
                          maxHeight: 180,
                          overflowY: 'auto',
                          fontFamily: 'monospace',
                          color: '#a7f3d0',
                          background: 'rgba(0,0,0,0.3)',
                          padding: 10,
                          borderRadius: 6,
                          whiteSpace: 'pre-wrap',
                          lineHeight: 1.4
                        }}>
                          {GAS_CODE}
                        </pre>
                      </div>

                      <ol start={4} style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <li>กดปุ่มบันทึกโครงการ (รูปแผ่นดิสก์)</li>
                        <li>กดปุ่ม <strong>การทำให้ใช้งานได้ (Deploy) &gt; การทำให้ใช้งานได้ใหม่ (New deployment)</strong></li>
                        <li>ที่สัญลักษณ์ฟันเฟืองทางซ้าย เลือกประเภทเป็น <strong>เว็บแอป (Web app)</strong></li>
                        <li>ตั้งค่าตามนี้:
                          <ul style={{ paddingLeft: 20, listStyleType: 'disc', marginTop: 4 }}>
                            <li>ผู้มีสิทธิ์เข้าถึง (Who has access) = <strong>ทุกคน (Anyone)</strong> *(สำคัญมาก! เพื่อให้โปรแกรม POS ส่งข้อมูลได้)*</li>
                            <li>เรียกใช้ในฐานะ (Execute as) = <strong>ฉัน (Me)</strong></li>
                          </ul>
                        </li>
                        <li>กด <strong>ทำให้ใช้งานได้ (Deploy)</strong> แล้วระบบจะขอให้อนุญาตสิทธิ์ (Authorize access) ให้กดเลือกบัญชี Google ของคุณ แล้วกด Advanced &gt; Go to Untitled project (unsafe) เพื่อยืนยัน</li>
                        <li>หลังจาก Deployment สำเร็จ ให้คัดลอก <strong>URL เว็บแอป (Web app URL)</strong> ที่ได้ นำมาวางลงในช่อง "ลิงก์ Google Sheets Web App URL" ด้านบนสุด แล้วกดบันทึกการตั้งค่าระบบ</li>
                      </ol>
                    </div>
                  )}
                </div>
              </SettingRow>

              <SettingRow label="ระบบแชร์หน้าจอเครื่องลูกข่าย (Local LAN Server)">
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 14,
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  marginTop: 10,
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {buildConfig.packageType === 'solo' && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-md bg-slate-950/70 p-6 text-center select-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(10, 10, 15, 0.75)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 24, borderRadius: 14 }}>
                      <div style={{
                        background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                        padding: 14,
                        borderRadius: '50%',
                        color: 'white',
                        boxShadow: '0 0 20px rgba(245, 158, 11, 0.4)',
                        marginBottom: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Lock size={28} />
                      </div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, color: '#f59e0b', marginBottom: 8, letterSpacing: '0.03em' }}>
                        🔒 ฟีเจอร์แชร์หน้าจอสำหรับเครื่องลูกข่าย (เฉพาะรุ่น LAN Multi-Station)
                      </h4>
                      <p style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, maxWidth: 460, margin: '0 auto 20px auto' }}>
                        ระบบการจำลองพอร์ตเครือข่ายเป็นวงแลนเครื่องแม่ สงวนไว้สำหรับแพ็กเกจลิขสิทธิ์ระดับ **LAN Multi-Station** ขึ้นไปเท่านั้น หากท่านใช้งานระบบ Solo Standard และต้องการอัปเกรดเพื่อเปิดต่อพ่วงรับออเดอร์จาก **iPad, แท็บเล็ต หรือสมาร์ทโฟน** สามารถติดต่อเจ้าหน้าที่ฝ่ายดูแลลูกค้าเพื่อสั่งซื้อสิทธิ์ปลดล็อกได้ทันทีครับ
                      </p>
                      <a 
                        href="https://line.me/ti/p/@makeadeal" 
                        target="_blank" 
                        rel="noreferrer"
                        className="glass-btn"
                        style={{
                          background: 'linear-gradient(135deg, #f59e0b, #f97316)',
                          color: 'white',
                          border: 'none',
                          padding: '10px 22px',
                          borderRadius: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          textDecoration: 'none',
                          boxShadow: '0 4px 15px rgba(245, 158, 11, 0.35)',
                          transition: 'all 0.2s ease-in-out'
                        }}
                      >
                        <Globe size={14} /> ติดต่อสั่งซื้อคีย์อัปเกรด (LINE ID: @makeadeal)
                      </a>
                    </div>
                  )}
                  <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Globe size={15} /> ตัวเปิดเซิร์ฟเวอร์ย่อยในวงแลนเพื่อต่อพ่วง iPad, แท็บเล็ต และสมาร์ทโฟน
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    เปิดจำลองเครื่องแม่ Windows ตัวนี้เป็นเว็บเซิร์ฟเวอร์ส่วนตัวภายในร้านค้า เพื่อให้โทรศัพท์มือถือ หรือแท็บเล็ตของพนักงานรับออเดอร์เชื่อมเข้าพิมพ์บิลคิดเงินได้พร้อมกันหลาย ๆ จุดโดยไม่ต้องต่อเน็ตบ้าน
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 16, alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: 14, borderRadius: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: lanServerActive ? '#22c55e' : 'rgba(255,255,255,0.4)' }}>
                        {lanServerActive ? '● กำลังเปิดใช้งานระบบเครือข่ายแชร์หน้าจอ' : '○ ระบบเซิร์ฟเวอร์แชร์หน้าจอปิดใช้งานอยู่'}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                        {lanServerActive ? 'อุปกรณ์ในร้านเชื่อมต่อ Wi-Fi และเปิดกล้องสแกน QR Code เข้างานได้ทันที' : 'เปิดรันเพื่อเชื่อมระบบจุดคิดเงินขยายเข้ากับแท็บเล็ต/มือถือ'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Toggle checked={lanServerActive} onChange={handleToggleLANServer} />
                    </div>
                  </div>

                  {/* Port Selection if inactive */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>ตั้งค่าหมายเลขพอร์ตแชร์ข้อมูล (Server Port):</span>
                    <input 
                      type="number"
                      className="glass-input" 
                      value={lanPort} 
                      disabled={lanServerActive}
                      onChange={e => setLanPort(parseInt(e.target.value) || 8080)} 
                      placeholder="8080" 
                      style={{ maxWidth: 100, fontSize: 12, background: 'rgba(0,0,0,0.2)', textAlign: 'center', opacity: lanServerActive ? 0.6 : 1 }}
                    />
                  </div>

                  {/* Active Connection Information and QR Codes */}
                  {lanServerActive && localIps.length > 0 && (
                    <div style={{
                      background: 'rgba(34,197,94,0.03)',
                      border: '1px solid rgba(34,197,94,0.15)',
                      borderRadius: 12,
                      padding: 18,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 16,
                      marginTop: 6
                    }}>
                      <div style={{ fontSize: 12, color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                        🚀 ลิงก์เชื่อมโยง IP สำหรับเครื่องลูก (iPad / Tablet / Phone):
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', justifyContent: 'space-between' }}>
                        
                        {/* List of IP addresses */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                          {localIps.map(ip => {
                            const url = `http://${ip}:${lanPort}`
                            return (
                              <div key={ip} style={{ display: 'flex', flexDirection: 'column', gap: 4, background: 'rgba(0,0,0,0.3)', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>ที่อยู่ IP เครือข่ายเครื่องแม่:</span>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                                  <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#60a5fa', fontWeight: 600 }}>{url}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(url)
                                      toast.success('คัดลอกลิงก์เครื่องแม่แล้ว!')
                                    }}
                                    className="glass-btn"
                                    style={{ padding: '3px 8px', fontSize: 11, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa', borderRadius: 4 }}
                                  >
                                    คัดลอกลิงก์
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* QR Code Container */}
                        <div style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 8,
                          background: 'white',
                          padding: 14,
                          borderRadius: 14,
                          boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
                          flexShrink: 0
                        }}>
                          <QRCodeSVG 
                            value={`http://${localIps[0]}:${lanPort}`}
                            size={120}
                            bgColor={"#ffffff"}
                            fgColor={"#0a0a0f"}
                            level={"L"}
                            includeMargin={false}
                          />
                          <span style={{ fontSize: 10, color: '#0a0a0f', fontWeight: 700, letterSpacing: '0.02em', marginTop: 4 }}>สแกนกล้องเพื่อเปิด POS</span>
                        </div>

                      </div>
                      
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.4, borderTop: '1px solid rgba(34,197,94,0.1)', paddingTop: 10, marginTop: 4 }}>
                        💡 <strong>คำแนะนำการใช้งาน:</strong> เปิดแอปพลิเคชันกล้องบน <strong>iPad / Tablet / โทรศัพท์มือถือ</strong> ของคุณ แล้วเล็งกล้องมาสแกนคิวอาร์โค้ดด้านบนนี้ ระบบจะเด้งหน้าจอรหัสผ่านแคชเชียร์และระบบขายสินค้าขึ้นมาใช้งานได้ทันทีอย่างสมบูรณ์แบบโดยไม่ต้องติดตั้งแอปพลิเคชันใด ๆ เพิ่มเติมเลยครับ!
                      </div>
                    </div>
                  )}
                </div>
              </SettingRow>
            </Section>
          )}

          {/* ---- Language ---- */}
          {activeTab === 'language' && (
            <Section title="ภาษาและทั่วไป" desc="ตั้งค่าภาษาและรูปแบบแสดงผล">
              <SettingRow label="ภาษาระบบ">
                <select className="glass-input" value={local.language || 'th'} onChange={e => setField('language', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', maxWidth: 200 }}>
                  <option value="th">ภาษาไทย</option>
                  <option value="en">English</option>
                </select>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>ภาษาหลักที่จะใช้สำหรับแสดงผลเมนู ข้อมูลนำทาง และสเตตัสต่างๆ ของแอปพลิเคชัน</p>
              </SettingRow>
              <SettingRow label="รูปแบบวันที่">
                <select className="glass-input" value={local.date_format || 'dd/MM/yyyy'} onChange={e => setField('date_format', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', maxWidth: 200 }}>
                  <option value="dd/MM/yyyy">DD/MM/YYYY</option>
                  <option value="MM/dd/yyyy">MM/DD/YYYY</option>
                  <option value="yyyy-MM-dd">YYYY-MM-DD</option>
                </select>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>การจัดเรียงรูปแบบวัน/เดือน/ปีสำหรับการแสดงผลในหน้าร้านและการออกเอกสาร</p>
              </SettingRow>
              <SettingRow label="แจ้งเตือนสินค้าใกล้หมด">
                <Toggle checked={local.low_stock_alert !== 'false'} onChange={v => setField('low_stock_alert', v ? 'true' : 'false')} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เมื่อเปิดใช้งาน จะปรากฏแถบเตือนสีแดงในหน้ารายการสินค้าหากมีสต็อกต่ำกว่าจุดวิกฤตที่ได้กำหนดไว้</p>
              </SettingRow>
            </Section>
          )}

          {/* ---- License ---- */}
          {activeTab === 'license' && (
            <Section title="การจัดการลิขสิทธิ์" desc="ข้อมูลใบอนุญาตและการโอนย้ายเครื่อง">
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14,
                padding: '20px 24px',
                marginBottom: 20
              }}>
                <SettingRow label="สถานะการเปิดใช้งาน">
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: licenseInfo?.is_activated ? '#22c55e' : '#ef4444',
                    background: licenseInfo?.is_activated ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                    padding: '3px 10px',
                    borderRadius: 100,
                    border: `1px solid ${licenseInfo?.is_activated ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                  }}>
                    {licenseInfo?.is_activated ? 'เปิดใช้งานแล้ว (Activated)' : 'ยังไม่ได้เปิดใช้งาน (Unactivated)'}
                  </span>
                </SettingRow>

                {licenseInfo?.is_activated ? (
                  <>
                    <SettingRow label="คีย์ลิขสิทธิ์ (License Key)">
                      <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'rgba(255,255,255,0.85)', letterSpacing: '0.05em' }}>
                        {licenseInfo.license_key ? `${licenseInfo.license_key.slice(0, 8)}-XXXX-XXXX-${licenseInfo.license_key.slice(-8)}` : '-'}
                      </span>
                    </SettingRow>
                    <SettingRow label="อีเมลผู้ลงทะเบียน">
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                        {licenseInfo.email || '-'}
                      </span>
                    </SettingRow>
                    <SettingRow label="วันที่เปิดใช้งาน">
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
                        {licenseInfo.activated_at ? new Date(licenseInfo.activated_at).toLocaleString('th-TH') : '-'}
                      </span>
                    </SettingRow>
                  </>
                ) : null}
              </div>

              {licenseInfo?.is_activated ? (
                <div style={{
                  background: 'rgba(239,68,68,0.04)',
                  border: '1px solid rgba(239,68,68,0.15)',
                  borderRadius: 14,
                  padding: '20px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}>
                  <div style={{ fontSize: 13, color: '#fca5a5', fontWeight: 600, lineHeight: 1.4 }}>
                    ⚠️ คำเตือนการย้ายสิทธิ์เครื่องคอมพิวเตอร์
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                    หากคุณต้องการเปลี่ยนเครื่องคอมพิวเตอร์ หรือล้างระบบวินโดว์ใหม่ กรุณากดปุ่ม <strong>"ถอนสิทธิ์ลิขสิทธิ์"</strong> ด้านล่างนี้เพื่อปล่อยคีย์ชุดเดิมให้ว่างลง ระบบคลาวด์จะลบการเชื่อมต่อคีย์กับเครื่องนี้อัติโนมัติ ทำให้สามารถนำคีย์เดิมไปใช้ลงทะเบียนที่เครื่องใหม่ได้ทันที
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4 }}>
                    <button
                      onClick={() => setShowDeactivateModal(true)}
                      className="glass-btn"
                      style={{
                        background: 'rgba(239,68,68,0.15)',
                        border: '1px solid rgba(239,68,68,0.3)',
                        borderRadius: 8,
                        padding: '10px 18px',
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fca5a5',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = 'rgba(239,68,68,0.25)'
                        e.currentTarget.style.color = '#ef4444'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'rgba(239,68,68,0.15)'
                        e.currentTarget.style.color = '#fca5a5'
                      }}
                    >
                      ถอนการติดตั้งลิขสิทธิ์ย้ายเครื่อง (Deactivate)
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px 0' }}>
                  กรุณาเปิดใช้งานระบบผ่านหน้าระยะเริ่มต้นเพื่อเปิดสิทธิ์การใช้งาน
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Save button (not for users and license tabs) */}
        {activeTab !== 'users' && activeTab !== 'license' && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={handleSaveSettings} className="glass-btn btn-primary" style={{ padding: '10px 24px', fontSize: 14, fontWeight: 700 }}>
              {saved ? <><CheckIcon size={15} /> บันทึกแล้ว</> : <><Save size={15} /> บันทึกการตั้งค่า</>}
            </button>
          </div>
        )}
      </div>

      {/* ===================== User Modal ===================== */}
      {showUserModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUserModal(false)}>
          <div className="modal-content" style={{ width: 460, padding: 0 }}>

            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.95)' }}>
                  {editingUser ? `แก้ไขผู้ใช้ — ${editingUser.name}` : 'เพิ่มผู้ใช้ใหม่'}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {editingUser ? 'ว่างช่องรหัสผ่านไว้ = ไม่เปลี่ยนรหัสผ่าน' : 'กรอกข้อมูลให้ครบก่อนบันทึก'}
                </div>
              </div>
              <button onClick={() => setShowUserModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}>
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '60vh', overflowY: 'auto' }}>

              {/* Name + Username row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="ชื่อ-นามสกุล *">
                  <input className="glass-input" value={userForm.name} onChange={e => setUserForm(f => ({ ...f, name: e.target.value }))} placeholder="สมชาย ใจดี" />
                </FormField>
                <FormField label="ชื่อผู้ใช้ (username) *">
                  <input className="glass-input" value={userForm.username} onChange={e => setUserForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g,'') }))} placeholder="somchai" autoCapitalize="none" />
                </FormField>
              </div>

              {/* Password + Confirm */}
              <FormField label={editingUser ? 'รหัสผ่านใหม่ (ว่าง = ไม่เปลี่ยน)' : 'รหัสผ่าน * (อย่างน้อย 6 ตัว)'}>
                <div style={{ position: 'relative' }}>
                  <input
                    className="glass-input"
                    type={showPw ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                    placeholder={editingUser ? 'กรอกเพื่อเปลี่ยนรหัสผ่าน' : 'รหัสผ่านอย่างน้อย 6 ตัว'}
                    style={{ paddingRight: 42 }}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </FormField>

              <FormField label="ยืนยันรหัสผ่าน">
                <div style={{ position: 'relative' }}>
                  <input
                    className="glass-input"
                    type={showConfirmPw ? 'text' : 'password'}
                    value={userForm.confirmPassword}
                    onChange={e => setUserForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    style={{
                      paddingRight: 42,
                      borderColor: userForm.confirmPassword && userForm.password !== userForm.confirmPassword
                        ? 'rgba(239,68,68,0.6)' : undefined,
                    }}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(v => !v)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
                    {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {userForm.confirmPassword && userForm.password !== userForm.confirmPassword && (
                  <p style={{ fontSize: 11, color: '#fca5a5', margin: '4px 0 0' }}>รหัสผ่านไม่ตรงกัน</p>
                )}
                {userForm.confirmPassword && userForm.password === userForm.confirmPassword && userForm.password && (
                  <p style={{ fontSize: 11, color: '#4ade80', margin: '4px 0 0' }}>รหัสผ่านตรงกัน ✓</p>
                )}
              </FormField>

              {/* PIN + Role row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="PIN ล็อกหน้าจอ (4-6 หลัก)">
                  <input className="glass-input" type="password" inputMode="numeric" value={userForm.pin} onChange={e => setUserForm(f => ({ ...f, pin: e.target.value.replace(/\D/g,'').slice(0,6) }))} placeholder="เช่น 1234" maxLength={6} />
                </FormField>
                <FormField label="บทบาท">
                  <select
                    className="glass-input"
                    value={userForm.role}
                    onChange={e => {
                      const selectedRole = e.target.value
                      const defaultPerms = ROLE_DEFAULTS[selectedRole] || []
                      setUserForm(f => ({ ...f, role: selectedRole, permissions: defaultPerms }))
                    }}
                    style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)' }}
                  >
                    <option value="admin">ผู้ดูแลระบบ</option>
                    <option value="manager">ผู้จัดการ</option>
                    <option value="cashier">พนักงานขาย</option>
                  </select>
                </FormField>
              </div>

              {/* Active toggle (edit only) */}
              {editingUser && editingUser.id !== currentUser?.id && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>สถานะบัญชี</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: userForm.is_active ? '#22c55e' : '#fca5a5' }}>
                      {userForm.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </span>
                    <Toggle checked={!!userForm.is_active} onChange={v => setUserForm(f => ({ ...f, is_active: v ? 1 : 0 }))} />
                  </div>
                </div>
              )}

              {/* Permissions settings grid */}
              <FormField label="การกำหนดสิทธิ์การใช้งาน (Permissions)">
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: '8px',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 10,
                }}>
                  {ALL_PERMISSIONS.map(p => {
                    const isChecked = userForm.permissions.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: isChecked ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const newPerms = e.target.checked
                              ? [...userForm.permissions, p.id]
                              : userForm.permissions.filter(x => x !== p.id)
                            setUserForm(f => ({ ...f, permissions: newPerms }))
                          }}
                          style={{
                            accentColor: '#22c55e',
                            cursor: 'pointer',
                          }}
                        />
                        {p.label}
                      </label>
                    )
                  })}
                </div>
              </FormField>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUserModal(false)} className="glass-btn btn-secondary" style={{ fontSize: 13 }}>ยกเลิก</button>
              <button onClick={saveUser} disabled={loading} className="glass-btn btn-primary" style={{ fontSize: 13, fontWeight: 700, minWidth: 100 }}>
                {loading ? 'กำลังบันทึก...' : editingUser ? 'บันทึกการเปลี่ยนแปลง' : 'เพิ่มผู้ใช้'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== License Deactivation Warning Modal ===================== */}
      {showDeactivateModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !deactivating && setShowDeactivateModal(false)}>
          <div className="modal-content" style={{ width: 440, padding: 0, overflow: 'hidden', border: '1px solid rgba(239,68,68,0.2)' }}>
            
            {/* Header */}
            <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.05)' }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fca5a5' }}>
                  ⚠️ ยืนยันการถอนลิขสิทธิ์ย้ายเครื่อง
                </div>
              </div>
              <button 
                onClick={() => !deactivating && setShowDeactivateModal(false)} 
                disabled={deactivating}
                style={{ background: 'none', border: 'none', cursor: deactivating ? 'not-allowed' : 'pointer', color: 'rgba(255,255,255,0.4)', padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, margin: 0 }}>
                คุณกำลังจะทำการ <strong>ถอนการเชื่อมโยงสิทธิ์การใช้งาน (Deactivate License)</strong> ของเครื่องคอมพิวเตอร์เครื่องนี้ออกจากฐานข้อมูลคลาวด์
              </p>
              <div style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10,
                padding: '12px 14px',
                fontSize: 12,
                color: '#fca5a5',
                lineHeight: 1.5
              }}>
                <strong>ข้อควรระวัง:</strong><br />
                • 🌐 <strong>ต้องเชื่อมต่ออินเทอร์เน็ต:</strong> เครื่องคอมพิวเตอร์ของคุณต้องเชื่อมต่อเน็ตเพื่อส่งคำขอถอนสิทธิ์ไปยังคลาวด์หลังบ้าน<br />
                • หลังถอนสิทธิ์สำเร็จ แอปพลิเคชันในเครื่องนี้จะถูกล็อกทันทีและกลับสู่หน้าลงทะเบียน<br />
                • โควตาการย้ายเครื่องจำกัดสูงสุดไม่เกิน <strong>3 ครั้งต่อปี</strong> เท่านั้น
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 22px 20px', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowDeactivateModal(false)} 
                disabled={deactivating}
                className="glass-btn btn-secondary" 
                style={{ fontSize: 13, cursor: deactivating ? 'not-allowed' : 'pointer' }}
              >
                ยกเลิก
              </button>
              <button 
                onClick={async () => {
                  setDeactivating(true)
                  try {
                    const res = await (window as any).api.system.deactivateLicense()
                    if (res.success) {
                      toast.success('ถอนการติดตั้งสิทธิ์ลิขสิทธิ์สำเร็จ! กำลังรีเซ็ตระบบ...')
                      setTimeout(() => {
                        navigate('/activation')
                      }, 2000)
                    } else {
                      toast.error(res.error || 'เกิดข้อผิดพลาดในการยกเลิกลิขสิทธิ์')
                    }
                  } catch (err) {
                    toast.error(`ข้อผิดพลาดการเชื่อมต่อ: ${String(err)}`)
                  } finally {
                    setDeactivating(false)
                    setShowDeactivateModal(false)
                  }
                }}
                disabled={deactivating} 
                className="glass-btn" 
                style={{ 
                  background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 18px',
                  fontSize: 13, 
                  fontWeight: 700, 
                  color: '#fff',
                  cursor: deactivating ? 'not-allowed' : 'pointer',
                  opacity: deactivating ? 0.6 : 1
                }}
              >
                {deactivating ? 'กำลังยกเลิกสิทธิ์...' : 'ยืนยันถอนลิขสิทธิ์'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---- Sub-components ---- */
function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{title}</div>
        {desc && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{desc}</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>{children}</div>
    </div>
  )
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ width: 210, flexShrink: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)} style={{ width: 48, height: 26, borderRadius: 100, position: 'relative', background: checked ? '#22c55e' : 'rgba(255,255,255,0.12)', border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: checked ? 25 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.3)', transition: 'left 0.2s' }} />
    </button>
  )
}

function Check({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
}
