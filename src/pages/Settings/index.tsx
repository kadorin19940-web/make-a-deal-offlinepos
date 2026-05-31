import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Store, Percent, Printer, Shield, Users, Database, Globe,
  Save, Check as CheckIcon, ChevronRight, Plus, Edit2, Trash2, X,
  Eye, EyeOff, Key, Lock
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useSettingsStore, useAuthStore } from '../../store'
import type { User as UserType } from '../../types'

const api = (window as any).api

const TABS = [
  { id: 'shop',     label: 'ข้อมูลร้าน',    icon: <Store size={16} /> },
  { id: 'tax',      label: 'ภาษีและราคา',    icon: <Percent size={16} /> },
  { id: 'receipt',  label: 'ใบเสร็จ/พิมพ์',  icon: <Printer size={16} /> },
  { id: 'users',    label: 'ผู้ใช้งาน',      icon: <Users size={16} /> },
  { id: 'security', label: 'ความปลอดภัย',    icon: <Shield size={16} /> },
  { id: 'backup',   label: 'สำรองข้อมูล',    icon: <Database size={16} /> },
  { id: 'language', label: 'ภาษา/ทั่วไป',    icon: <Globe size={16} /> },
  { id: 'license',  label: 'สิทธิ์การใช้งาน', icon: <Shield size={16} /> },
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
  useEffect(() => { loadUsers(); loadLicenseInfo() }, [])

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
        {TABS.map(t => (
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
            <Section title="ใบเสร็จ และเครื่องพิมพ์" desc="ตั้งค่าการพิมพ์ใบเสร็จ">
              <SettingRow label="พิมพ์ใบเสร็จอัตโนมัติ">
                <Toggle checked={local.auto_print === 'true'} onChange={v => setField('auto_print', v ? 'true' : 'false')} />
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>เมื่อเปิดใช้งาน เครื่องพิมพ์จะพิมพ์ใบเสร็จโดยอัตโนมัติทันทีที่ชำระเงินเสร็จสิ้น</p>
              </SettingRow>
              <SettingRow label="ขนาดกระดาษ">
                <select className="glass-input" value={local.printer_size || '80mm'} onChange={e => setField('printer_size', e.target.value)} style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', maxWidth: 160 }}>
                  <option value="58mm">58mm (Thermal)</option>
                  <option value="80mm">80mm (Thermal)</option>
                  <option value="A4">A4</option>
                  <option value="A5">A5</option>
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
