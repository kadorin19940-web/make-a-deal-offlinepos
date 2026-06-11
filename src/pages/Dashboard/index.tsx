// [FIXED: Translation Hook — Dynamic String Interpolation]
// [FIXED: Dashboard Date Filtering — Thailand Timezone (UTC+7)]
import { useEffect, useState } from 'react'
import { TrendingUp, ShoppingCart, Package, Users, AlertTriangle, ArrowUpRight, Zap, Calendar } from 'lucide-react'
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store'
import { useTranslation, formatAppDate, toThaiLocaleDateString } from '../../hooks/useTranslation'

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
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{t('ประวัติการทำรายการ')}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{t('รายละเอียดประวัติขายล่าสุด')}</div>
            </div>

            {salesList.length === 0 ? (
              <div style={{ padding: '20px 0', color: 'rgba(255,255,255,0.2)', fontSize: 13, textAlign: 'center' }}>
                {t('ไม่มีข้อมูลในช่วงเวลาที่เลือก')}
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
                    </tr>
                  </thead>
                  <tbody>
                    {salesList.map((sale) => (
                      <tr key={sale.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.85)' }}>
                        <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{getSaleTimeStr(sale.sale_date)}</td>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{sale.receipt_no}</td>
                        <td style={{ padding: '10px 12px' }}>{sale.customer_name || t('ลูกค้าทั่วไป')}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 6,
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.7)',
                            border: '1px solid rgba(255,255,255,0.08)'
                          }}>
                            {sale.payment_method === 'cash' ? t('เงินสด') : 
                              sale.payment_method === 'card' ? t('บัตร') : 
                              sale.payment_method === 'transfer' ? t('โอน') : 'QR'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: sale.status === 'void' ? 'rgba(255,255,255,0.3)' : '#22c55e' }}>
                          {formatMoney(sale.total)}
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 100,
                            background: sale.status === 'completed' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                            color: sale.status === 'completed' ? '#4ade80' : '#fca5a5',
                            border: `1px solid ${sale.status === 'completed' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`
                          }}>
                            {sale.status === 'completed' ? t('เสร็จสิ้น') : t('ยกเลิก')}
                          </span>
                        </td>
                      </tr>
                    ))}
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
