// [FIXED: Translation Hook — Dynamic String Interpolation]
// [FIXED: Dashboard Date Filtering — Thailand Timezone (UTC+7)]
import { useEffect, useState } from 'react'
import { TrendingUp, ShoppingCart, Users, AlertTriangle, ArrowUpRight, Zap, Calendar, Download, FileText } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { useTranslation, formatAppDate, toThaiLocaleDateString } from '../../hooks/useTranslation'
import * as XLSX from 'xlsx'
import { useSettingsStore } from '../../store'

const api = (window as any).api

export default function Dashboard() {
  const navigate = useNavigate()
  const { t, lang } = useTranslation()
  const { user } = useAuthStore()

  // Date Filters
  const [filterType, setFilterType] = useState<'today' | 'week' | 'month' | 'custom'>('today')
  const [startDate, setStartDate] = useState(() => toThaiLocaleDateString(new Date()))
  const [endDate, setEndDate] = useState(() => toThaiLocaleDateString(new Date()))

  // Loaded states
  const [summary, setSummary] = useState<any>(null)
  const [pivotData, setPivotData] = useState<any[]>([])
  const [salesList, setSalesList] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [lowStockCount, setLowStockCount] = useState<number>(0)
  const [loading, setLoading] = useState(false)
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'cash' | 'card' | 'transfer' | 'qr'>('all')
  const [selectedSale, setSelectedSale] = useState<any | null>(null)
  const [saleDetailLoading, setSaleDetailLoading] = useState(false)
  const { settings } = useSettingsStore()

  // Calculations for dates in UTC+7 Thailand Timezone
  const getThisWeekRange = () => {
    const now = new Date()
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    const thaiNow = new Date(utc + (3600000 * 7))
    const day = thaiNow.getDay()
    const diff = thaiNow.getDate() - day + (day === 0 ? -6 : 1) // Start on Monday
    const monday = new Date(thaiNow.setDate(diff))
    return {
      start: toThaiLocaleDateString(monday),
      end: toThaiLocaleDateString(new Date())
    }
  }

  const getThisMonthRange = () => {
    const now = new Date()
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000)
    const thaiNow = new Date(utc + (3600000 * 7))
    const firstDay = new Date(thaiNow.getFullYear(), thaiNow.getMonth(), 1)
    return {
      start: toThaiLocaleDateString(firstDay),
      end: toThaiLocaleDateString(new Date())
    }
  }

  useEffect(() => {
    loadData()
  }, [filterType, startDate, endDate])

  const loadData = async () => {
    setLoading(true)
    let start = startDate
    let end = endDate

    if (filterType === 'today') {
      const todayStr = toThaiLocaleDateString(new Date())
      start = todayStr
      end = todayStr
    } else if (filterType === 'week') {
      const range = getThisWeekRange()
      start = range.start
      end = range.end
    } else if (filterType === 'month') {
      const range = getThisMonthRange()
      start = range.start
      end = range.end
    }

    try {
      if (api) {
        // 1. Load Summary Stats
        const sumRes = await api.reports.getSalesSummary({ from_date: start, to_date: end, userId: user?.id })
        if (sumRes.success) setSummary(sumRes.data)

        // 2. Load Sales Chart & Pivot Data
        const chartRes = await api.reports.getSalesChart({ from_date: start, to_date: end, userId: user?.id })
        if (chartRes.success) setPivotData(chartRes.data || [])

        // 3. Load Detailed Sales History Feed
        const salesRes = await api.sales.getAll({ from_date: start, to_date: end })
        if (salesRes.success) setSalesList(salesRes.data || [])

        // 4. Load Top Selling Products
        const topRes = await api.reports.getTopProducts({ from_date: start, to_date: end, userId: user?.id })
        if (topRes.success) setTopProducts(topRes.data || [])

        // 5. Load low stock alert count
        const stockRes = await api.reports.getDashboardStats()
        if (stockRes.success && stockRes.data) {
          setLowStockCount(stockRes.data.lowStock?.count || 0)
        }
      } else {
        // Mock fallback for browser dev
        setSummary({
          bill_count: filterType === 'today' ? 47 : 124,
          total_revenue: filterType === 'today' ? 12840 : 45290,
          avg_bill: filterType === 'today' ? 273.19 : 365.24
        })
        setPivotData(Array.from({ length: 7 }, (_, i) => {
          const d = new Date()
          d.setDate(d.getDate() - (6 - i))
          return { date: d.toISOString().slice(0, 10), total: Math.floor(Math.random() * 12000 + 4000), count: Math.floor(Math.random() * 30 + 10) }
        }))
        setSalesList([
          { id: 1, receipt_no: 'RCP202606110001', sale_date: new Date().toISOString(), customer_name: 'สมชาย ใจดี', cashier_name: 'แคชเชียร์ A', total: 450, payment_method: 'cash', status: 'completed' },
          { id: 2, receipt_no: 'RCP202606110002', sale_date: new Date().toISOString(), customer_name: 'ลูกค้าทั่วไป', cashier_name: 'แคชเชียร์ A', total: 1250, payment_method: 'qr', status: 'completed' },
          { id: 3, receipt_no: 'RCP202606110003', sale_date: new Date().toISOString(), customer_name: 'สมหญิง รักดี', cashier_name: 'แคชเชียร์ B', total: 85, payment_method: 'transfer', status: 'void', note: 'ป้อนราคาผิด' },
        ])
        setTopProducts([
          { product_name: 'กาแฟอเมริกาโน่', qty_sold: 45, revenue: 3825 },
          { product_name: 'ชาเย็น', qty_sold: 38, revenue: 2470 },
          { product_name: 'สมาร์ทโฟน X12', qty_sold: 1, revenue: 15900 },
        ])
        setLowStockCount(3)
      }
    } catch (err) {
      console.error('Error loading dashboard statistics:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterClick = (type: 'today' | 'week' | 'month') => {
    setFilterType(type)
  }

  const formatMoney = (n: number) => `฿${(n || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  // Payment label helper
  const paymentLabel = (method: string) => {
    if (method === 'cash') return 'เงินสด'
    if (method === 'card') return 'บัตรเครดิต'
    if (method === 'transfer') return 'โอนเงิน'
    if (method === 'qr') return 'QR/PromptPay'
    return method || '-'
  }

  // Filtered list by payment method
  const filteredSales = paymentFilter === 'all'
    ? salesList
    : salesList.filter(s => s.payment_method === paymentFilter)

  // Summary totals for filtered list
  const filteredTotal = filteredSales.filter(s => s.status === 'completed').reduce((sum, s) => sum + (Number(s.total) || 0), 0)
  const filteredBills = filteredSales.filter(s => s.status === 'completed').length

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredSales.length === 0) return
    const rows = filteredSales.map(s => ({
      'เลขที่ใบเสร็จ': s.receipt_no,
      'วันที่-เวลา': s.sale_date,
      'ลูกค้า': s.customer_name || 'ลูกค้าทั่วไป',
      'แคชเชียร์': s.cashier_name || 'ไม่ระบุ',
      'ช่องทางชำระเงิน': paymentLabel(s.payment_method),
      'ยอดรวม (บาท)': Number(s.total) || 0,
      'สถานะ': s.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก',
      'หมายเหตุ': s.note || '',
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'ประวัติการทำรายการ')
    const filename = `ประวัติรายการ_${startDate}_ถึง_${endDate}.xlsx`
    if ((window as any).api) {
      // Electron: use dialog to pick save path
      ;(async () => {
        const saveRes = await (window as any).api.dialog.saveFile(filename, [{ name: 'Excel Files', extensions: ['xlsx'] }])
        if (saveRes?.filePath) {
          const base64 = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' })
          await (window as any).api.fs.writeExcel(saveRes.filePath, base64)
        }
      })()
    } else {
      XLSX.writeFile(wb, filename)
    }
  }

  // Export to PDF via print dialog
  const handleExportPDF = () => {
    if (filteredSales.length === 0) return
    const payMethodBadge = (m: string) => {
      const colors: Record<string, string> = {
        cash: '#22c55e', card: '#3b82f6', transfer: '#8b5cf6', qr: '#f59e0b'
      }
      return `<span style="background:${colors[m] || '#888'}22;color:${colors[m] || '#888'};border:1px solid ${colors[m] || '#888'}44;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${paymentLabel(m)}</span>`
    }
    const rows = filteredSales.map(s => `
      <tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:8px 10px;font-size:12px;color:#374151">${s.sale_date?.slice(0,16).replace('T',' ') || '-'}</td>
        <td style="padding:8px 10px;font-size:12px;font-weight:600">${s.receipt_no}</td>
        <td style="padding:8px 10px;font-size:12px">${s.customer_name || 'ลูกค้าทั่วไป'}</td>
        <td style="padding:8px 10px;font-size:12px">${s.cashier_name || '-'}</td>
        <td style="padding:8px 10px;text-align:center">${payMethodBadge(s.payment_method)}</td>
        <td style="padding:8px 10px;font-size:13px;font-weight:700;text-align:right;color:${s.status === 'void' ? '#9ca3af' : '#059669'}">${formatMoney(Number(s.total) || 0)}</td>
        <td style="padding:8px 10px;text-align:center">
          <span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:${s.status === 'completed' ? '#dcfce7' : '#fee2e2'};color:${s.status === 'completed' ? '#15803d' : '#b91c1c'}">${s.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'}</span>
        </td>
        <td style="padding:8px 10px;font-size:11px;color:#6b7280">${s.note || ''}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <title>ประวัติการทำรายการ</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700;800&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Sarabun',sans-serif; padding:24px; color:#111827; background:#fff; }
    h1 { font-size:20px; font-weight:800; margin-bottom:4px; }
    .sub { font-size:12px; color:#6b7280; margin-bottom:16px; }
    .summary { display:flex; gap:16px; margin-bottom:20px; }
    .sum-card { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:10px 16px; }
    .sum-card .label { font-size:11px; color:#6b7280; }
    .sum-card .val { font-size:18px; font-weight:800; color:#059669; }
    table { width:100%; border-collapse:collapse; }
    thead th { background:#f3f4f6; padding:10px; font-size:11px; font-weight:700; text-align:left; color:#374151; border-bottom:2px solid #d1d5db; }
    tr:hover { background:#f9fafb; }
    @media print { body { padding:8px; } }
  </style>
</head>
<body>
  <h1>ประวัติการทำรายการ</h1>
  <div class="sub">ช่วงเวลา: ${startDate} ถึง ${endDate} | ช่องทาง: ${paymentFilter === 'all' ? 'ทั้งหมด' : paymentLabel(paymentFilter)}</div>
  <div class="summary">
    <div class="sum-card"><div class="label">จำนวนบิล (เสร็จสิ้น)</div><div class="val">${filteredBills} บิล</div></div>
    <div class="sum-card"><div class="label">ยอดรวม</div><div class="val">${formatMoney(filteredTotal)}</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>วันที่-เวลา</th><th>เลขที่ใบเสร็จ</th><th>ลูกค้า</th><th>แคชเชียร์</th>
        <th style="text-align:center">ช่องทาง</th><th style="text-align:right">ยอดรวม</th>
        <th style="text-align:center">สถานะ</th><th>หมายเหตุ</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload=()=>window.print()<\/script>
</body></html>`
    const w = window.open('', '_blank', 'width=1100,height=800')
    if (w) { w.document.write(html); w.document.close() }
  }

  // Format the time part in UTC+7 local format
  const getSaleTimeStr = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
      const d = new Date(dateStr)
      return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    } catch {
      return dateStr
    }
  }

  const totalSales = summary?.total_revenue || 0
  const totalBills = summary?.bill_count || 0
  const avgBill = totalBills > 0 ? Math.round((totalSales / totalBills) * 100) / 100 : 0

  const openSaleDetail = async (saleId: number) => {
    setSaleDetailLoading(true)
    setSelectedSale(null)
    try {
      const res = await api.sales.getById(saleId)
      if (res.success) setSelectedSale(res.data)
    } catch (e) {
      console.error('[Dashboard] Failed to load sale detail:', e)
    } finally {
      setSaleDetailLoading(false)
    }
  }

  const handleReprint = async () => {
    if (!selectedSale) return
    await api.print.receipt(selectedSale, settings)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'slideUp 0.3s ease-out' }}>
      
      {/* Date Filters Ribbon */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: '12px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}>
        {/* Quick select tabs */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['today', 'week', 'month'] as const).map((type) => {
            const label = type === 'today' ? t('วันนี้') : type === 'week' ? t('สัปดาห์นี้') : t('เดือนนี้')
            const isActive = filterType === type
            return (
              <button
                key={type}
                onClick={() => handleFilterClick(type)}
                className="glass-btn"
                style={{
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
                  borderColor: isActive ? '#22c55e' : 'rgba(255,255,255,0.08)',
                  color: isActive ? '#22c55e' : 'rgba(255,255,255,0.6)'
                }}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={() => setFilterType('custom')}
            className="glass-btn"
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: filterType === 'custom' ? 700 : 500,
              background: filterType === 'custom' ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.03)',
              borderColor: filterType === 'custom' ? '#22c55e' : 'rgba(255,255,255,0.08)',
              color: filterType === 'custom' ? '#22c55e' : 'rgba(255,255,255,0.6)'
            }}
          >
            {t('กำหนดเอง')}
          </button>
        </div>

        {/* Dateinputs for custom filtering */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} color="rgba(255,255,255,0.4)" />
          <input
            type="date"
            className="glass-input"
            value={filterType !== 'custom' ? toThaiLocaleDateString(new Date()) : startDate}
            disabled={filterType !== 'custom'}
            onChange={e => {
              setStartDate(e.target.value)
              setFilterType('custom')
            }}
            style={{ padding: '6px 12px', fontSize: 12, maxWidth: 140, background: 'rgba(0,0,0,0.2)' }}
          />
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>{t('ถึง')}</span>
          <input
            type="date"
            className="glass-input"
            value={filterType !== 'custom' ? toThaiLocaleDateString(new Date()) : endDate}
            disabled={filterType !== 'custom'}
            onChange={e => {
              setEndDate(e.target.value)
              setFilterType('custom')
            }}
            style={{ padding: '6px 12px', fontSize: 12, maxWidth: 140, background: 'rgba(0,0,0,0.2)' }}
          />
        </div>
      </div>

      {/* Quick POS Button */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 20, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: 4 }}>
            {t('พร้อมเริ่มขายสินค้า')}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            {t('เปิดหน้าจอ POS เพื่อเริ่มบันทึกการขาย')}
          </div>
        </div>
        <button
          onClick={() => navigate('/pos')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
            border: 'none', borderRadius: 12,
            color: '#000', fontSize: 14, fontWeight: 800,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 0 24px rgba(34,197,94,0.4)',
          }}
        >
          <Zap size={16} />
          {t('เปิดหน้าขาย')}
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard
          title={t('ยอดขายรวม')}
          value={formatMoney(totalSales)}
          subtitle={t('รายได้ของช่วงเวลา')}
          icon={<TrendingUp size={20} />}
          color="#22c55e"
        />
        <StatCard
          title={t('จำนวนบิล')}
          value={t('{{count}} บิล', { count: totalBills })}
          subtitle={t('บิลที่ทำรายการสำเร็จ')}
          icon={<ShoppingCart size={20} />}
          color="#3b82f6"
        />
        <StatCard
          title={t('สินค้าใกล้หมด')}
          value={String(lowStockCount)}
          subtitle={t('ต้องปรับสต็อกด่วน')}
          icon={<AlertTriangle size={20} />}
          color={lowStockCount > 0 ? '#f59e0b' : '#22c55e'}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title={t('ค่าเฉลี่ย/บิล')}
          value={formatMoney(avgBill)}
          subtitle={t('เฉลี่ยต่อบิลคิดเงิน')}
          icon={<Users size={20} />}
          color="#8b5cf6"
        />
      </div>

      {/* Charts & Lists split row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: 16, alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Charts & Pivot Sales Table */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Recharts area trend */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '20px',
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{t('แนวโน้มยอดขาย')}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t('เปรียบเทียบในแต่ละวัน')}</div>
            </div>
            
            {pivotData.length === 0 ? (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)' }}>
                {t('ไม่มีข้อมูลในช่วงเวลาที่เลือก')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={pivotData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tickFormatter={d => formatAppDate(d, 'd MMM')}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tickFormatter={v => `${(v/1000).toFixed(0)}k`}
                    tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }}
                    axisLine={false} tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15,17,24,0.95)', border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10, color: 'rgba(255,255,255,0.9)', fontSize: 12,
                    }}
                    formatter={(v: number) => [`฿${v.toLocaleString()}`, t('ยอดขาย')]}
                    labelFormatter={l => formatAppDate(l as string, 'dd MMM yyyy')}
                  />
                  <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2}
                    fill="url(#salesGrad)" dot={{ fill: '#22c55e', r: 3 }} activeDot={{ r: 5, fill: '#4ade80' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pivot daily summary table */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '20px 24px',
          }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{t('รายงานยอดรายวัน (Pivot Table)')}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t('สรุปผลการขายแยกรายวัน')}</div>
            </div>
            
            {pivotData.length === 0 ? (
              <div style={{ padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center' }}>
                {t('ไม่มีข้อมูลในช่วงเวลาที่เลือก')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      <th style={{ padding: '8px 12px' }}>{t('วันที่')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>{t('จำนวนบิล')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('ยอดขายรวม')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pivotData.map((day, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.85)' }}>
                        <td style={{ padding: '10px 12px' }}>{formatAppDate(day.date, 'dd MMMM yyyy')}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>{day.count}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatMoney(day.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Sales history Feed */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '20px 24px',
          }}>
            {/* Header row: title + export buttons */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{t('ประวัติการทำรายการ')}</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                  {filteredBills} {t('บิล')} · {formatMoney(filteredTotal)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleExportExcel}
                  disabled={filteredSales.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: filteredSales.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(34,197,94,0.12)',
                    border: `1px solid ${filteredSales.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(34,197,94,0.3)'}`,
                    color: filteredSales.length === 0 ? 'rgba(255,255,255,0.2)' : '#4ade80',
                    cursor: filteredSales.length === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                  }}
                >
                  <Download size={13} /> Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  disabled={filteredSales.length === 0}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: filteredSales.length === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${filteredSales.length === 0 ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.3)'}`,
                    color: filteredSales.length === 0 ? 'rgba(255,255,255,0.2)' : '#fca5a5',
                    cursor: filteredSales.length === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'all 0.2s',
                  }}
                >
                  <FileText size={13} /> PDF
                </button>
              </div>
            </div>

            {/* Payment method filter — Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
                ช่องทางชำระเงิน:
              </span>
              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value as typeof paymentFilter)}
                className="glass-input"
                style={{
                  padding: '6px 32px 6px 12px',
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'rgba(255,255,255,0.05)',
                  color: paymentFilter === 'all' ? '#22c55e'
                    : paymentFilter === 'cash' ? '#22c55e'
                    : paymentFilter === 'card' ? '#3b82f6'
                    : paymentFilter === 'transfer' ? '#8b5cf6'
                    : '#f59e0b',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  cursor: 'pointer',
                  minWidth: 190,
                  appearance: 'auto',
                }}
              >
                {([
                  { key: 'all',      label: 'ทั้งหมด' },
                  { key: 'cash',     label: '💵 เงินสด' },
                  { key: 'card',     label: '💳 บัตรเครดิต' },
                  { key: 'transfer', label: '🏦 โอนเงิน' },
                  { key: 'qr',       label: '📱 QR/PromptPay' },
                ] as const).map(opt => {
                  const count = opt.key === 'all'
                    ? salesList.length
                    : salesList.filter(s => s.payment_method === opt.key).length
                  return (
                    <option key={opt.key} value={opt.key} style={{ background: '#0a0a0f', color: '#fff' }}>
                      {opt.label} ({count} รายการ)
                    </option>
                  )
                })}
              </select>
            </div>

            {filteredSales.length === 0 ? (
              <div style={{ padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center' }}>
                {salesList.length === 0 ? t('ไม่มีข้อมูลในช่วงเวลาที่เลือก') : 'ไม่มีรายการช่องทางนี้'}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                      <th style={{ padding: '8px 12px' }}>{t('เวลา')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('เลขที่ใบเสร็จ')}</th>
                      <th style={{ padding: '8px 12px' }}>{t('ลูกค้า')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>{t('ช่องทางรับเงิน')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('จำนวนเงิน')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>{t('สถานะ')}</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center' }}>{t('จัดการ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => {
                      const pmColor = sale.payment_method === 'cash' ? '#22c55e'
                        : sale.payment_method === 'card' ? '#3b82f6'
                        : sale.payment_method === 'transfer' ? '#8b5cf6'
                        : '#f59e0b'
                      return (
                        <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.85)' }}>
                          <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{getSaleTimeStr(sale.sale_date)}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>{sale.receipt_no}</td>
                          <td style={{ padding: '10px 12px' }}>{sale.customer_name || t('ลูกค้าทั่วไป')}</td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11, padding: '2px 10px', borderRadius: 100,
                              fontWeight: 700,
                              background: `${pmColor}18`,
                              color: pmColor,
                              border: `1px solid ${pmColor}33`
                            }}>
                              {paymentLabel(sale.payment_method)}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: sale.status === 'void' ? 'rgba(255,255,255,0.3)' : '#22c55e' }}>
                            {formatMoney(sale.total)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <span style={{
                              fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 100,
                              background: sale.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                              color: sale.status === 'completed' ? '#4ade80' : '#fca5a5',
                              border: `1px solid ${sale.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                            }}>
                              {sale.status === 'completed' ? t('เสร็จสิ้น') : t('ยกเลิก')}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => openSaleDetail(sale.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: 11,
                                borderRadius: 6,
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.06)',
                                color: 'rgba(255,255,255,0.7)',
                                cursor: 'pointer'
                              }}
                            >
                              {t('รายละเอียด')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN: Top Products */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '20px',
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{t('สินค้าขายดี')}</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t('จัดอันดับตามยอดขาย')}</div>
          </div>
          
          {topProducts.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
              {t('ไม่มีข้อมูลในช่วงเวลาที่เลือก')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {topProducts.slice(0, 8).map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: 6,
                    background: i === 0 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)',
                    color: i === 0 ? '#f59e0b' : 'rgba(255,255,255,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.product_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.qty_sold} {t('หน่วย')}</div>
                  </div>
                  <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {formatMoney(p.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Sale Detail Modal */}
      {(selectedSale || saleDetailLoading) && (
        <div
          onClick={() => setSelectedSale(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#1a1b23',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              padding: 28,
              width: '100%',
              maxWidth: 520,
              maxHeight: '85vh',
              overflowY: 'auto'
            }}
          >
            {saleDetailLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.4)' }}>กำลังโหลด...</div>
            ) : selectedSale ? (
              <>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{t('รายละเอียดใบเสร็จ')}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2, fontFamily: 'monospace' }}>{selectedSale.receipt_no}</div>
                  </div>
                  <button onClick={() => setSelectedSale(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
                </div>

                {/* Info rows */}
                {[
                  { label: t('วันที่'), value: formatAppDate(selectedSale.sale_date) },
                  { label: t('แคชเชียร์'), value: selectedSale.cashier_name || '-' },
                  { label: t('ลูกค้า'), value: selectedSale.customer_name || t('ลูกค้าทั่วไป') },
                  { label: t('ช่องทางรับเงิน'), value: selectedSale.payment_method === 'cash' ? t('เงินสด') : selectedSale.payment_method === 'card' ? t('บัตร') : selectedSale.payment_method === 'transfer' ? t('โอน') : 'QR' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 }}>
                    <span style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                    <span style={{ color: 'rgba(255,255,255,0.85)' }}>{value}</span>
                  </div>
                ))}

                {/* Items */}
                <div style={{ margin: '16px 0 8px', fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{t('รายการสินค้า')}</div>
                {(selectedSale.items || []).map((item: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 13 }}>
                    <div>
                      <span style={{ color: 'rgba(255,255,255,0.85)' }}>{item.product_name}</span>
                      <span style={{ color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>× {item.qty}</span>
                    </div>
                    <span style={{ color: 'rgba(255,255,255,0.7)' }}>{(item.unit_price * item.qty).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                  </div>
                ))}

                {/* Totals */}
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>{t('รวมทั้งหมด')}</span>
                  <span style={{ color: '#22c55e' }}>{(selectedSale.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                </div>

                {/* Void badge */}
                {selectedSale.status === 'void' && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: 13 }}>
                    {t('ใบเสร็จนี้ถูกยกเลิกแล้ว')} {selectedSale.note ? `— ${selectedSale.note}` : ''}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                  {selectedSale.status === 'completed' && (
                    <button
                      onClick={handleReprint}
                      style={{
                        flex: 1,
                        padding: '10px 0',
                        borderRadius: 8,
                        border: '1px solid rgba(34,197,94,0.3)',
                        background: 'rgba(34,197,94,0.1)',
                        color: '#4ade80',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer'
                      }}
                    >
                      {t('พิมพ์ใบเสร็จอีกครั้ง')}
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedSale(null)}
                    style={{
                      flex: 1,
                      padding: '10px 0',
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.12)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.6)',
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer'
                    }}
                  >
                    {t('ปิด')}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, subtitle, icon, color, trend, onClick }: {
  title: string; value: string; subtitle: string; icon: React.ReactNode
  color: string; trend?: number; onClick?: () => void
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20, padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
      onMouseEnter={e => { if (onClick) (e.currentTarget.style.background = 'rgba(255,255,255,0.07)') }}
      onMouseLeave={e => { if (onClick) (e.currentTarget.style.background = 'rgba(255,255,255,0.04)') }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36,
          background: `${color}18`, border: `1px solid ${color}33`,
          borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          {icon}
        </div>
        {onClick && <ArrowUpRight size={14} color="rgba(255,255,255,0.2)" />}
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{subtitle}</div>
    </div>
  )
}
