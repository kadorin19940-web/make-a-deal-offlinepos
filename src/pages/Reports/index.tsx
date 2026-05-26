import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { Download, Calendar, Loader, TrendingUp, DollarSign, Receipt, Percent, FileSpreadsheet, Users } from 'lucide-react'
import { format, subDays } from 'date-fns'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store'

const api = (window as any).api

export default function ReportsPage() {
  const { user: currentUser } = useAuthStore()
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [tab, setTab] = useState<'sales' | 'products' | 'customers'>('sales')

  // Live database data states
  const [summary, setSummary] = useState({
    bill_count: 0,
    total_revenue: 0,
    net_revenue: 0,
    total_tax: 0,
    avg_bill: 0,
    total_profit: 0
  })
  const [chartData, setChartData] = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [topCustomers, setTopCustomers] = useState<any[]>([])

  const isAdmin = currentUser?.role?.toLowerCase() === 'admin'

  // Fetch all report data based on current dates and role verification
  const fetchReportData = async () => {
    if (!api || !currentUser) return
    setLoading(true)
    try {
      const filters = {
        from_date: startDate,
        to_date: endDate,
        userId: currentUser.id
      }

      // 1. Fetch Sales Summary Metrics
      const summaryRes = await api.reports.getSalesSummary(filters)
      if (summaryRes.success) {
        setSummary(summaryRes.data)
      } else {
        toast.error(`ไม่สามารถโหลดสรุปรายงานได้: ${summaryRes.error}`)
      }

      // 2. Fetch Chart (Daily Sales/Bills/Profits)
      const chartRes = await api.reports.getSalesChart(filters)
      if (chartRes.success) {
        const formattedChart = chartRes.data.map((item: any) => {
          const [y, m, d] = item.date.split('-')
          return {
            ...item,
            displayDate: `${d}/${m}`,
            total: Number(item.total) || 0,
            count: Number(item.count) || 0,
            profit: Number(item.profit) || 0
          }
        })
        setChartData(formattedChart)
      } else {
        toast.error(`ไม่สามารถโหลดข้อมูลกราฟได้: ${chartRes.error}`)
      }

      // 3. Fetch Top Performing Products
      const productsRes = await api.reports.getTopProducts({ ...filters, limit: 10 })
      if (productsRes.success) {
        setTopProducts(productsRes.data)
      }

      // 4. Fetch Top Customers
      const customersRes = await api.reports.getTopCustomers({ ...filters, limit: 10 })
      if (customersRes.success) {
        setTopCustomers(customersRes.data)
      }

    } catch (err) {
      console.error(err)
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูลรายงาน')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin) {
      fetchReportData()
    }
  }, [startDate, endDate, currentUser])

  // UI Authorization Guard
  if (!isAdmin) {
    return (
      <div className="glass-card flex flex-col items-center justify-center text-center p-12 max-w-lg mx-auto mt-20" style={{ border: '1px solid rgba(239, 68, 68, 0.2)' }}>
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6 animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-red-400 mb-3">ไม่สามารถเข้าถึงข้อมูลรายงานได้</h2>
        <p className="text-sm text-gray-400 leading-relaxed">
          หน้ารายงานของระบบ POS จำกัดเฉพาะสิทธิ์ผู้ดูแลระบบ (Admin) เท่านั้น คุณไม่มีสิทธิ์เข้าถึงข้อมูลด้านการเงิน คลังสินค้า และรายรับของทางร้าน
        </p>
      </div>
    )
  }

  // Quick Preset Handlers
  const setQuickRange = (rangeType: 'today' | 'this_month' | 'this_year' | '7d' | '30d') => {
    const today = new Date()
    if (rangeType === 'today') {
      const dateStr = format(today, 'yyyy-MM-dd')
      setStartDate(dateStr)
      setEndDate(dateStr)
    } else if (rangeType === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
      setStartDate(format(firstDay, 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    } else if (rangeType === 'this_year') {
      const firstDay = new Date(today.getFullYear(), 0, 1)
      setStartDate(format(firstDay, 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    } else if (rangeType === '7d') {
      setStartDate(format(subDays(today, 6), 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    } else if (rangeType === '30d') {
      setStartDate(format(subDays(today, 29), 'yyyy-MM-dd'))
      setEndDate(format(today, 'yyyy-MM-dd'))
    }
  }

  // Calculate elapsed days for daily average calculations
  const getDaysDiff = () => {
    const s = new Date(startDate)
    const e = new Date(endDate)
    const diffTime = Math.abs(e.getTime() - s.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
    return diffDays || 1
  }

  const daysCount = getDaysDiff()
  const averagePerDay = summary.total_revenue / daysCount

  // High-Performance memory-safe Excel export call with UI overlay
  const handleExportExcel = async () => {
    if (exporting || !currentUser) return
    setExporting(true)
    const toastId = toast.loading('กำลังประมวลผลข้อมูลธุรกรรมในระบบ...')

    try {
      if (api) {
        const defaultName = `รายงานสรุปยอดขาย_${startDate}_ถึง_${endDate}.xlsx`
        const saveRes = await api.dialog.saveFile(defaultName, [{ name: 'Excel Files', extensions: ['xlsx'] }])
        
        if (saveRes.filePath) {
          // Invoke the backend paginated generator to protect memory
          const res = await api.reports.exportSalesExcel(startDate, endDate, saveRes.filePath, currentUser.id)
          if (res.success) {
            toast.success('ส่งออกรายงาน Excel สำเร็จแล้ว!', { id: toastId })
          } else {
            throw new Error(res.error || 'เขียนไฟล์ล้มเหลว')
          }
        } else {
          toast.dismiss(toastId)
        }
      } else {
        toast.error('ระบบเครื่องมือจัดเก็บไฟล์ไม่ทำงานบนบราว์เซอร์ภายนอก', { id: toastId })
      }
    } catch (error) {
      console.error(error)
      toast.error(`ส่งออกล้มเหลว: ${String(error)}`, { id: toastId })
    } finally {
      setExporting(false)
    }
  }

  const fmt = (n: number) => `฿${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

  const TOOLTIP_STYLE = {
    contentStyle: {
      background: 'rgba(15,17,24,0.95)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, color: 'rgba(255,255,255,0.9)', fontSize: 12,
    }
  }

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Blurred Full-screen Loading Overlay for Exporting */}
      {exporting && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in">
          <div className="bg-[#0a0a0f]/80 p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full border-4 border-green-500/20 border-t-green-500 animate-spin flex items-center justify-center">
              <FileSpreadsheet size={20} className="text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mb-1">กำลังเขียนรายงาน Excel...</h3>
              <p className="text-xs text-gray-400">
                ระบบกำลังดึงข้อมูลธุรกรรมจากฐานข้อมูล SQLite และเขียนไฟล์แบบ Chunk-by-Chunk เพื่อป้องกันหน่วยความจำล้น
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Date Picker & Quick Range controls */}
      <div className="glass-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={16} className="text-green-400" />
          <span className="text-sm font-semibold text-white mr-2">ช่วงเวลารายงาน:</span>
          {[
            { type: 'today', label: 'วันนี้' },
            { type: '7d', label: '7 วันล่าสุด' },
            { type: '30d', label: '30 วันล่าสุด' },
            { type: 'this_month', label: 'เดือนนี้' },
            { type: 'this_year', label: 'ปีนี้' }
          ].map(btn => (
            <button
              key={btn.type}
              onClick={() => setQuickRange(btn.type as any)}
              className="glass-btn btn-secondary text-xs px-3 py-1.5"
            >
              {btn.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">เริ่ม:</span>
            <input
              type="date"
              className="glass-input text-xs px-2.5 py-1.5 w-36"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">ถึง:</span>
            <input
              type="date"
              className="glass-input text-xs px-2.5 py-1.5 w-36"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ background: 'rgba(255,255,255,0.03)' }}
            />
          </div>

          <button
            onClick={handleExportExcel}
            disabled={exporting || loading}
            className={`glass-btn btn-primary text-xs px-4 py-1.5 flex items-center gap-1.5 font-bold ${exporting || loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {exporting ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
            ส่งออก Excel
          </button>
        </div>
      </div>

      {/* Main stats loader skeleton */}
      {loading ? (
        <div className="glass-card p-12 flex flex-col items-center justify-center gap-3 min-h-[300px]">
          <Loader size={32} className="animate-spin text-green-500" />
          <span className="text-sm text-gray-400">กำลังคำนวณและประมวลผลข้อมูลจากฐานข้อมูล...</span>
        </div>
      ) : (
        <>
          {/* Summary Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'ยอดขายรวม (Gross Sales)',
                value: fmt(summary.total_revenue),
                sub: `${summary.bill_count} บิลเสร็จสิ้น`,
                color: '#22c55e',
                bg: 'bg-green-500/5',
                border: 'border-green-500/10',
                icon: <DollarSign size={16} className="text-green-400" />
              },
              {
                label: 'กำไรขั้นต้น (Gross Profit)',
                value: fmt(summary.total_profit),
                sub: `${summary.total_revenue > 0 ? ((summary.total_profit / summary.total_revenue) * 100).toFixed(1) : '0'}% กำไรเฉลี่ย`,
                color: '#3b82f6',
                bg: 'bg-blue-500/5',
                border: 'border-blue-500/10',
                icon: <TrendingUp size={16} className="text-blue-400" />
              },
              {
                label: 'ยอดขายเฉลี่ยรายวัน',
                value: fmt(averagePerDay),
                sub: `คำนวณจากทั้งหมด ${daysCount} วัน`,
                color: '#8b5cf6',
                bg: 'bg-purple-500/5',
                border: 'border-purple-500/10',
                icon: <Calendar size={16} className="text-purple-400" />
              },
              {
                label: 'เฉลี่ยต่อบิลใบเสร็จ',
                value: fmt(summary.avg_bill),
                sub: 'มูลค่าการซื้อรายตระกร้า',
                color: '#f59e0b',
                bg: 'bg-amber-500/5',
                border: 'border-amber-500/10',
                icon: <Receipt size={16} className="text-amber-400" />
              },
            ].map((card, i) => (
              <div
                key={i}
                className={`glass-card p-5 flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${card.bg} border ${card.border}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-400 font-medium">{card.label}</span>
                  <div className="p-1.5 rounded-lg bg-white/5">{card.icon}</div>
                </div>
                <div>
                  <div className="text-2xl font-black tracking-tight" style={{ color: card.color }}>{card.value}</div>
                  <div className="text-[11px] text-gray-500 mt-1.5 font-medium">{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Report Tabs */}
          <div className="flex border-b border-white/5 gap-1">
            {[
              { id: 'sales', label: 'วิเคราะห์ยอดขายและผลประกอบการ', icon: <TrendingUp size={14} /> },
              { id: 'products', label: 'สินค้าขายดี / ตารางผลตอบแทน', icon: <FileSpreadsheet size={14} /> },
              { id: 'customers', label: 'ประวัติลูกค้ามูลค่าสูง', icon: <Users size={14} /> }
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as any)}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-semibold border-b-2 transition-all ${tab === t.id ? 'border-green-500 text-green-400 bg-green-500/5' : 'border-transparent text-gray-400 hover:text-white'}`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Sales Analytics Chart View */}
          {tab === 'sales' && (
            <div className="flex flex-col gap-6">
              {/* Daily Sales Chart */}
              <div className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-gray-200">กราฟเปรียบเทียบยอดขายรวม และ ผลกำไรสุทธิรายวัน</h3>
                  <div className="flex gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-green-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> ยอดขายรวม
                    </span>
                    <span className="flex items-center gap-1.5 text-blue-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> กำไรขั้นต้น
                    </span>
                  </div>
                </div>
                {chartData.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-gray-500 text-xs">ไม่มีข้อมูลธุรกรรมเสร็จสิ้นในช่วงเวลาที่ระบุ</div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                      <XAxis dataKey="displayDate" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v: number, name: string) => [fmt(v), name === 'total' ? 'ยอดขาย' : 'กำไร']} />
                      <Line type="monotone" dataKey="total" name="total" stroke="#22c55e" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                      <Line type="monotone" dataKey="profit" name="profit" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Daily Bill count Bar Chart */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-bold text-gray-200 mb-4">ปริมาณการสั่งซื้อบิลใบเสร็จรายวัน (Bill Frequency)</h3>
                {chartData.length === 0 ? (
                  <div className="h-36 flex items-center justify-center text-gray-500 text-xs">ไม่มีข้อมูลปริมาณบิลที่บันทึกไว้</div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={chartData}>
                      <CartesianGrid stroke="rgba(255,255,255,0.03)" strokeDasharray="3 3" />
                      <XAxis dataKey="displayDate" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v} บิล`, 'จำนวนรายการ']} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}

          {/* Top Products Table View */}
          {tab === 'products' && (
            <div className="glass-card overflow-hidden">
              {topProducts.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-xs">ไม่พบข้อมูลการขายสินค้าในช่วงเวลาที่ระบุ</div>
              ) : (
                <table className="data-table w-full">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">อันดับ</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">สินค้า</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">ปริมาณขาย</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">ยอดขายรวม</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">มูลค่าต้นทุน</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">ผลกำไรสุทธิ</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">อัตราส่วนกำไร</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => {
                      const costVal = Number(p.cost) || 0
                      const marginPercent = p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(0) : '0'
                      return (
                        <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                          <td className="px-5 py-4">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'bg-white/5 text-gray-400'}`}>
                              {i + 1}
                            </div>
                          </td>
                          <td className="px-5 py-4 font-bold text-white text-sm">{p.product_name}</td>
                          <td className="px-5 py-4 text-xs text-gray-300 font-medium">{Number(p.qty_sold).toLocaleString()} ชิ้น</td>
                          <td className="px-5 py-4 text-sm font-semibold text-green-400">{fmt(p.revenue)}</td>
                          <td className="px-5 py-4 text-sm text-gray-400 font-semibold">{fmt(costVal)}</td>
                          <td className="px-5 py-4 text-sm font-bold text-blue-400">{fmt(p.profit)}</td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500/10 text-green-400">
                              {marginPercent}%
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Top Customers Table View */}
          {tab === 'customers' && (
            <div className="glass-card overflow-hidden">
              {topCustomers.length === 0 ? (
                <div className="p-12 text-center text-gray-500 text-xs">ไม่พบข้อมูลลูกค้าผู้ซื้อในช่วงเวลาที่ระบุ</div>
              ) : (
                <table className="data-table w-full">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">อันดับ</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">ชื่อลูกค้า</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">เบอร์โทรศัพท์</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">กลุ่มลูกค้า</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">จำนวนการมาใช้บริการ</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">ยอดใช้จ่ายรวม</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-400">การซื้อล่าสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCustomers.map((c, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                        <td className="px-5 py-4">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-black ${i < 3 ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-white/5 text-gray-400'}`}>
                            {i + 1}
                          </div>
                        </td>
                        <td className="px-5 py-4 font-bold text-white text-sm">{c.name}</td>
                        <td className="px-5 py-4 text-xs text-gray-400 font-medium">{c.phone || '-'}</td>
                        <td className="px-5 py-4 text-xs">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${c.customer_type === 'member' ? 'bg-purple-500/10 text-purple-400' : 'bg-gray-500/10 text-gray-400'}`}>
                            {c.customer_type === 'member' ? 'สมาชิก' : 'ทั่วไป'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-300 font-semibold">{c.visit_count} ครั้ง</td>
                        <td className="px-5 py-4 text-sm font-bold text-green-400">{fmt(c.total_spend)}</td>
                        <td className="px-5 py-4 text-xs text-gray-500 font-medium">
                          {c.last_visit ? format(new Date(c.last_visit), 'dd/MM/yyyy HH:mm') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
