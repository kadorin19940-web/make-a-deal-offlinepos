import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'
import { Download, Calendar } from 'lucide-react'
import { format, subDays } from 'date-fns'

const generateChartData = () => Array.from({ length: 30 }, (_, i) => {
  const d = subDays(new Date(), 29 - i)
  return {
    date: format(d, 'dd/MM'),
    total: Math.floor(Math.random() * 20000 + 5000),
    count: Math.floor(Math.random() * 60 + 10),
    profit: Math.floor(Math.random() * 8000 + 2000),
  }
})

const CHART_DATA = generateChartData()

const TOP_PRODUCTS = [
  { name: 'สมาร์ทโฟน X12', qty: 45, revenue: 715500, profit: 270000 },
  { name: 'หูฟัง BT Pro', qty: 120, revenue: 358800, profit: 214800 },
  { name: 'กาแฟอเมริกาโน่', qty: 860, revenue: 73100, profit: 51600 },
  { name: 'เสื้อยืด Cotton', qty: 340, revenue: 101660, profit: 67660 },
  { name: 'ครีมบำรุงผิว SPF50', qty: 180, revenue: 81000, profit: 54000 },
]

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('30d')
  const [tab, setTab] = useState<'sales' | 'products' | 'customers'>('sales')

  const totalRevenue = CHART_DATA.reduce((s, d) => s + d.total, 0)
  const totalProfit = CHART_DATA.reduce((s, d) => s + d.profit, 0)
  const totalBills = CHART_DATA.reduce((s, d) => s + d.count, 0)

  const fmt = (n: number) => `฿${n.toLocaleString()}`

  const TOOLTIP_STYLE = {
    contentStyle: {
      background: 'rgba(15,17,24,0.95)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 10, color: 'rgba(255,255,255,0.9)', fontSize: 12,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[['7d','7 วัน'],['30d','30 วัน'],['90d','90 วัน']].map(([v, l]) => (
            <button key={v} onClick={() => setDateRange(v)}
              style={{
                padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                background: dateRange === v ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${dateRange === v ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)'}`,
                color: dateRange === v ? '#22c55e' : 'rgba(255,255,255,0.5)',
              }}>{l}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <button className="glass-btn btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }}><Download size={14} />ส่งออก Excel</button>
        <button className="glass-btn btn-secondary" style={{ padding: '7px 14px', fontSize: 13 }}><Download size={14} />ส่งออก PDF</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[
          { label: 'รายได้รวม', value: fmt(totalRevenue), sub: `${totalBills} บิล`, color: '#22c55e' },
          { label: 'กำไรขั้นต้น', value: fmt(totalProfit), sub: `${((totalProfit/totalRevenue)*100).toFixed(1)}%`, color: '#3b82f6' },
          { label: 'เฉลี่ย/วัน', value: fmt(Math.floor(totalRevenue / 30)), sub: 'บาท/วัน', color: '#8b5cf6' },
          { label: 'เฉลี่ย/บิล', value: fmt(Math.floor(totalRevenue / totalBills)), sub: 'บาท/บิล', color: '#f59e0b' },
        ].map((s, i) => (
          <div key={i} style={{ padding: '18px 20px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.07)', paddingBottom: 0 }}>
        {[['sales','ยอดขาย'],['products','สินค้า'],['customers','ลูกค้า']].map(([v, l]) => (
          <button key={v} onClick={() => setTab(v as 'sales'|'products'|'customers')}
            style={{
              padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer',
              color: tab === v ? '#22c55e' : 'rgba(255,255,255,0.4)',
              fontSize: 13, fontWeight: tab === v ? 700 : 400, fontFamily: 'inherit',
              borderBottom: tab === v ? '2px solid #22c55e' : '2px solid transparent',
              transition: 'all 0.2s',
            }}>{l}</button>
        ))}
      </div>

      {tab === 'sales' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Revenue line chart */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>รายได้รายวัน</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={CHART_DATA}>
                <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => `${(v/1000).toFixed(0)}k`} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [fmt(v), 'รายได้']} />
                <Line type="monotone" dataKey="total" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {/* Bill count bar chart */}
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginBottom: 16 }}>จำนวนบิลรายวัน</div>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={CHART_DATA}>
                <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [v, 'บิล']} />
                <Bar dataKey="count" fill="#3b82f6" radius={[4,4,0,0]} opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {tab === 'products' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>อันดับ</th><th>สินค้า</th><th>จำนวนขาย</th><th>รายได้</th><th>กำไร</th><th>% กำไร</th></tr>
            </thead>
            <tbody>
              {TOP_PRODUCTS.map((p, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: i < 3 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)', color: i < 3 ? '#f59e0b' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{i+1}</div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>{p.name}</td>
                  <td style={{ color: 'rgba(255,255,255,0.6)' }}>{p.qty.toLocaleString()} ชิ้น</td>
                  <td style={{ color: '#22c55e', fontWeight: 600 }}>{fmt(p.revenue)}</td>
                  <td style={{ color: '#3b82f6', fontWeight: 600 }}>{fmt(p.profit)}</td>
                  <td>
                    <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>
                      {((p.profit/p.revenue)*100).toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'customers' && (
        <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(255,255,255,0.25)' }}>
          ข้อมูลลูกค้าจะแสดงที่นี่
        </div>
      )}
    </div>
  )
}
