import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, ShoppingCart, Package, Users, AlertTriangle, ArrowUpRight, Zap } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { format, parseISO } from 'date-fns'
import { th } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import type { DashboardStats } from '../../types'

const api = (window as any).api

const MOCK_STATS: DashboardStats = {
  todaySales: { total_sales: 12840, bill_count: 47 },
  yesterdaySales: { total_sales: 9520 },
  topProducts: [
    { product_name: 'กาแฟอเมริกาโน่', qty_sold: 34, revenue: 2890 },
    { product_name: 'สมาร์ทโฟน X12', qty_sold: 2, revenue: 31800 },
    { product_name: 'ชาเย็น', qty_sold: 28, revenue: 1820 },
    { product_name: 'หูฟัง BT Pro', qty_sold: 5, revenue: 14950 },
    { product_name: 'เสื้อยืด Cotton', qty_sold: 15, revenue: 4485 },
  ],
  lowStock: { count: 3 },
  salesChart: Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return { date: d.toISOString().slice(0, 10), total: Math.floor(Math.random() * 15000 + 5000), count: Math.floor(Math.random() * 40 + 10) }
  }),
  currentSession: null,
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    if (api) {
      const res = await api.reports.getDashboardStats()
      if (res.success) setStats(res.data)
    } else {
      setStats(MOCK_STATS)
    }
  }

  if (!stats) return <LoadingState />

  const salesGrowth = stats.yesterdaySales.total_sales > 0
    ? ((stats.todaySales.total_sales - stats.yesterdaySales.total_sales) / stats.yesterdaySales.total_sales) * 100
    : 0

  const fmt = (n: number) => `฿${n.toLocaleString('th-TH', { minimumFractionDigits: 0 })}`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, animation: 'slideUp 0.3s ease-out' }}>
      {/* Quick POS Button */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(34,197,94,0.04))',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 20, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: 4 }}>
            พร้อมเริ่มขายสินค้า
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
            เปิดหน้าจอ POS เพื่อเริ่มบันทึกการขาย
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
          เปิดหน้าขาย
        </button>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard
          title="ยอดขายวันนี้"
          value={fmt(stats.todaySales.total_sales)}
          subtitle={`${stats.todaySales.bill_count} บิล`}
          icon={<TrendingUp size={20} />}
          color="#22c55e"
          trend={salesGrowth}
        />
        <StatCard
          title="ยอดเมื่อวาน"
          value={fmt(stats.yesterdaySales.total_sales)}
          subtitle="เปรียบเทียบ"
          icon={<ShoppingCart size={20} />}
          color="#3b82f6"
        />
        <StatCard
          title="สินค้าใกล้หมด"
          value={String(stats.lowStock.count)}
          subtitle="รายการ"
          icon={<AlertTriangle size={20} />}
          color={stats.lowStock.count > 0 ? '#f59e0b' : '#22c55e'}
          onClick={() => navigate('/inventory')}
        />
        <StatCard
          title="ค่าเฉลี่ย/บิล"
          value={fmt(stats.todaySales.bill_count > 0 ? stats.todaySales.total_sales / stats.todaySales.bill_count : 0)}
          subtitle="บาท/บิล"
          icon={<Users size={20} />}
          color="#8b5cf6"
        />
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        {/* Sales chart */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '20px',
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>ยอดขาย 7 วัน</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>รายได้ย้อนหลัง</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.salesChart}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tickFormatter={d => {
                  try { return format(parseISO(d), 'd MMM', { locale: th }) } catch { return d }
                }}
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
                formatter={(v: number) => [`฿${v.toLocaleString()}`, 'ยอดขาย']}
                labelFormatter={l => {
                  try { return format(parseISO(l as string), 'dd MMM yyyy', { locale: th }) } catch { return l }
                }}
              />
              <Area type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2}
                fill="url(#salesGrad)" dot={{ fill: '#22c55e', r: 3 }} activeDot={{ r: 5, fill: '#4ade80' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top products */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: '20px',
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>สินค้าขายดี</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>วันนี้</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stats.topProducts.slice(0, 5).map((p, i) => (
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
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{p.qty_sold} ชิ้น</div>
                </div>
                <div style={{ fontSize: 12, color: '#22c55e', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  ฿{p.revenue.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
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
        {trend !== undefined && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 11, fontWeight: 600,
            color: trend >= 0 ? '#22c55e' : '#ef4444',
          }}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend).toFixed(1)}%
          </div>
        )}
        {onClick && <ArrowUpRight size={14} color="rgba(255,255,255,0.2)" />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.95)', marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>{title}</div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{subtitle}</div>
    </div>
  )
}

function LoadingState() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 120, borderRadius: 20 }} />
      ))}
    </div>
  )
}
