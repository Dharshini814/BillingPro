import { useEffect, useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend
} from 'recharts'
import KpiCard from '../components/dashboard/KpiCard.jsx'
import Card from '../components/common/Card.jsx'
import Badge from '../components/common/Badge.jsx'
import { DollarIcon, RefreshIcon, TrendingUpIcon, AlertIcon, UsersIcon, FileIcon } from '../components/common/Icons.jsx'
import api from '../services/api.js'
import { invoiceService } from '../services/invoiceService.js'
import { paymentService } from '../services/paymentService.js'
import { formatCurrency } from '../utils/formatters'
import { useLang } from '../hooks/useLang.js'
import styles from './Dashboard.module.css'

const PIE_COLORS = ['#D4A800', '#F5C518', '#4CAF50', '#FFB547', '#FF5A5A', '#7C3AED']

function ChartTooltip({ active, payload, label, prefix = '' }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-bg)', borderRadius: 12, padding: '12px 16px',
      boxShadow: 'var(--shadow-float)', fontSize: 13, color: 'var(--color-text-primary)'
    }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  )
}

const EMPTY_STATS = {
  kpis: { totalRevenue: 0, activeSubscriptions: 0, mrr: 0, failedPayments: 0, customersCount: 0, pendingInvoices: 0 },
  revenueTrend: [],
  planDistribution: [],
  subscriptionGrowth: [],
  paymentSuccessRate: [],
}

export default function Dashboard() {
  const { t } = useLang()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(EMPTY_STATS)
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentPayments, setRecentPayments] = useState([])

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {}),
      invoiceService.list({ pageSize: 6 }).then(res => setRecentInvoices(res.items)).catch(() => {}),
      paymentService.list({ pageSize: 5 }).then(res => setRecentPayments(res.items)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const { kpis, revenueTrend, planDistribution, subscriptionGrowth, paymentSuccessRate } = stats

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>
          <p className={styles.pageSubtitle}>{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className={styles.kpiGrid}>
        <KpiCard title={t('dashboard.totalRevenue')} value={kpis.totalRevenue} prefix="$" icon={<DollarIcon size={20}/>} color="#D4A800" loading={loading}/>
        <KpiCard title={t('dashboard.activeSubscriptions')} value={kpis.activeSubscriptions} icon={<RefreshIcon size={20}/>} color="#F5C518" loading={loading}/>
        <KpiCard title={t('dashboard.mrr')} value={kpis.mrr} prefix="$" icon={<TrendingUpIcon size={20}/>} color="#4CAF50" loading={loading}/>
        <KpiCard title={t('dashboard.failedPayments')} value={kpis.failedPayments} icon={<AlertIcon size={20}/>} color="#FF5A5A" loading={loading}/>
        <KpiCard title={t('dashboard.customers')} value={kpis.customersCount} icon={<UsersIcon size={20}/>} color="#FFB547" loading={loading}/>
        <KpiCard title={t('dashboard.pendingInvoices')} value={kpis.pendingInvoices} icon={<FileIcon size={20}/>} color="#D4A800" loading={loading}/>
      </div>

      {/* Charts Row 1 */}
      <div className={styles.chartsRow}>
        <Card className={styles.chartCardLg}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>{t('dashboard.revenueTrend')}</h3>
            <span className={styles.chartBadge}>6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4A800" stopOpacity={0.22}/>
                  <stop offset="95%" stopColor="#D4A800" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`}/>
              <Tooltip content={<ChartTooltip prefix="$" />} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#D4A800" strokeWidth={2.5} fill="url(#revGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.chartCardSm}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>{t('dashboard.planDistribution')}</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                {planDistribution.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v + ' subscribers', n]} />
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.pieLegend}>
            {planDistribution.map((item, i) => (
              <div key={item.name} className={styles.pieLegendItem}>
                <span className={styles.pieDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className={styles.pieName}>{item.name}</span>
                <span className={styles.pieValue}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className={styles.chartsRow}>
        <Card className={styles.chartCardMd}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>{t('dashboard.subscriptionGrowth')}</h3>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={subscriptionGrowth} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="subscriptions" name="New Subs" fill="#D4A800" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className={styles.chartCardMd}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>{t('dashboard.paymentSuccess')}</h3>
            <span className={styles.chartBadge}>6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={paymentSuccessRate} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`}/>
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="rate" name="Success %" stroke="#4CAF50" strokeWidth={2.5} dot={{ fill: '#4CAF50', r: 4 }} activeDot={{ r: 6 }}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className={styles.activityRow}>
        <Card className={styles.activityCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>{t('dashboard.recentInvoices')}</h3>
          </div>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Invoice</span><span>Customer</span><span>Amount</span><span>Status</span>
            </div>
            {recentInvoices.map((inv) => (
              <div key={inv.id} className={styles.tableRow}>
                <span className={styles.mono}>{inv.number}</span>
                <span className={styles.truncate}>{inv.customerName}</span>
                <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                <Badge status={inv.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className={styles.activityCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>{t('dashboard.recentPayments')}</h3>
          </div>
          <div className={styles.paymentList}>
            {recentPayments.map((pay) => (
              <div key={pay.id} className={styles.paymentItem}>
                <div className={styles.paymentLeft}>
                  <div className={styles.paymentAvatar}>{(pay.customer || '?').charAt(0)}</div>
                  <div>
                    <p className={styles.paymentName}>{pay.customer}</p>
                    <p className={styles.paymentMeta}>{pay.paymentMethod}</p>
                  </div>
                </div>
                <div className={styles.paymentRight}>
                  <span className={styles.paymentAmount}>{formatCurrency(pay.amount)}</span>
                  <Badge status={pay.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
