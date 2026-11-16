import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import UserDashboard from './UserDashboard.jsx'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line
} from 'recharts'
import KpiCard from '../components/dashboard/KpiCard.jsx'
import RiskDashboard from '../components/dashboard/SimpleRiskDashboard.jsx'
import RevenueIntelligence from '../components/dashboard/SimpleRevenueIntelligence.jsx'
import Card from '../components/common/Card.jsx'
import Badge from '../components/common/Badge.jsx'
import {
  DollarIcon, RefreshIcon, TrendingUpIcon, AlertIcon,
  UsersIcon, FileIcon, BarChartIcon
} from '../components/common/Icons.jsx'
import api from '../services/api.js'
import { invoiceService } from '../services/invoiceService.js'
import { paymentService } from '../services/paymentService.js'
import { formatCurrency } from '../utils/formatters'
import { useLang } from '../hooks/useLang.js'
import Chatbot from '../components/chatbot/Chatbot.jsx'
import styles from './Dashboard.module.css'

const PIE_COLORS = ['#4CAF50', '#F5C518', '#FF5A5A', '#D4A800', '#7C3AED', '#FFB547']
const STATUS_COLORS = { active: '#4CAF50', trial: '#F5C518', past_due: '#FF5A5A', cancelled: '#94a3b8' }

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

function MetricBadge({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 18px', borderRadius: 12,
      background: `${color}12`, border: `1px solid ${color}30`
    }}>
      <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, color }}>{value}</span>
    </div>
  )
}

const EMPTY_SUMMARY = {
  total_customers: 0, active_subscriptions: 0, cancelled_subscriptions: 0,
  trial_subscriptions: 0, past_due_subscriptions: 0,
  mrr: 0, churn_rate: 0, trial_conversion_rate: 0,
}

const EMPTY_STATS = {
  kpis: { totalRevenue: 0, activeSubscriptions: 0, mrr: 0, failedPayments: 0, customersCount: 0, pendingInvoices: 0 },
  revenueTrend: [], planDistribution: [], subscriptionGrowth: [], paymentSuccessRate: [],
}

export default function Dashboard() {
  const { user } = useAuth()
  // Non-admin users get their personal dashboard
  if (user && user.role !== 'admin') return <UserDashboard />

  const { t } = useLang()
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('overview') // 'overview', 'risk', or 'revenue'

  // Existing stats (revenue trend, plan dist, etc.)
  const [stats, setStats] = useState(EMPTY_STATS)

  // M3 — Admin Dashboard & Subscription Metrics
  const [summary, setSummary] = useState(EMPTY_SUMMARY)
  const [revenueByPlan, setRevenueByPlan] = useState([])
  const [subMetrics, setSubMetrics] = useState({ active: 0, trial: 0, past_due: 0, cancelled: 0 })

  // Recent activity
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentPayments, setRecentPayments] = useState([])

  useEffect(() => {
    Promise.all([
      // Existing stats endpoint
      api.get('/dashboard/stats').then(r => setStats(r.data)).catch(() => {}),

      // M3 — /dashboard/summary
      api.get('/dashboard/summary').then(r => setSummary(r.data)).catch(() => {}),

      // M3 — /dashboard/revenue-by-plan
      api.get('/dashboard/revenue-by-plan').then(r => setRevenueByPlan(r.data)).catch(() => {}),

      // M3 — /dashboard/subscription-metrics
      api.get('/dashboard/subscription-metrics').then(r => setSubMetrics(r.data)).catch(() => {}),

      // Recent activity
      invoiceService.list({ pageSize: 6 }).then(res => setRecentInvoices(res.items)).catch(() => {}),
      paymentService.list({ pageSize: 5 }).then(res => setRecentPayments(res.items)).catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const { kpis, revenueTrend, planDistribution, subscriptionGrowth, paymentSuccessRate } = stats

  // Build subscription status data for pie/bar chart from M3 metrics
  const subStatusData = [
    { name: 'Active',   value: subMetrics.active,    color: STATUS_COLORS.active },
    { name: 'Trial',    value: subMetrics.trial,     color: STATUS_COLORS.trial },
    { name: 'Past Due', value: subMetrics.past_due,  color: STATUS_COLORS.past_due },
    { name: 'Cancelled',value: subMetrics.cancelled, color: STATUS_COLORS.cancelled },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>{t('dashboard.title')}</h1>
          <p className={styles.pageSubtitle}>{t('dashboard.subtitle')}</p>
        </div>
      </div>

      {/* View Tabs */}
      <div style={{ marginBottom: 24, borderBottom: '2px solid var(--color-border)' }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <button
            onClick={() => setActiveView('overview')}
            style={{
              padding: '12px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeView === 'overview' ? '3px solid #D4A800' : '3px solid transparent',
              color: activeView === 'overview' ? '#D4A800' : 'var(--color-text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 15,
              marginBottom: '-2px'
            }}
          >
            <BarChartIcon size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Overview
          </button>
          <button
            onClick={() => setActiveView('risk')}
            style={{
              padding: '12px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeView === 'risk' ? '3px solid #D4A800' : '3px solid transparent',
              color: activeView === 'risk' ? '#D4A800' : 'var(--color-text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 15,
              marginBottom: '-2px'
            }}
          >
            <AlertIcon size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Payment Risk Intelligence
          </button>
          <button
            onClick={() => setActiveView('revenue')}
            style={{
              padding: '12px 0',
              background: 'none',
              border: 'none',
              borderBottom: activeView === 'revenue' ? '3px solid #D4A800' : '3px solid transparent',
              color: activeView === 'revenue' ? '#D4A800' : 'var(--color-text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: 15,
              marginBottom: '-2px'
            }}
          >
            <TrendingUpIcon size={16} style={{ marginRight: 8, verticalAlign: 'middle' }} />
            Revenue Intelligence
          </button>
        </div>
      </div>

      {/* Render based on active view */}
      {activeView === 'revenue' ? (
        <RevenueIntelligence />
      ) : activeView === 'risk' ? (
        <RiskDashboard />
      ) : (
        <>
          {/* Overview Content */}

      {/* ── M3: Summary KPI Cards ── */}
      <div className={styles.kpiGrid}>
        <KpiCard
          title="Total Customers"
          value={summary.total_customers}
          icon={<UsersIcon size={20}/>}
          color="#D4A800" loading={loading}
        />
        <KpiCard
          title="Active Subscriptions"
          value={summary.active_subscriptions}
          icon={<RefreshIcon size={20}/>}
          color="#4CAF50" loading={loading}
        />
        <KpiCard
          title="MRR"
          value={summary.mrr}
          prefix="$"
          icon={<TrendingUpIcon size={20}/>}
          color="#F5C518" loading={loading}
        />
        <KpiCard
          title="Cancelled Subscriptions"
          value={summary.cancelled_subscriptions}
          icon={<AlertIcon size={20}/>}
          color="#FF5A5A" loading={loading}
        />
        <KpiCard
          title="Failed Payments"
          value={kpis.failedPayments}
          icon={<AlertIcon size={20}/>}
          color="#FF5A5A" loading={loading}
        />
        <KpiCard
          title="Pending Invoices"
          value={kpis.pendingInvoices}
          icon={<FileIcon size={20}/>}
          color="#FFB547" loading={loading}
        />
      </div>

      {/* ── M3: Revenue by Plan + Subscription Status ── */}
      <div className={styles.chartsRow}>
        {/* Revenue by Plan — bar chart */}
        <Card className={styles.chartCardLg}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Revenue by Plan</h3>
            <span className={styles.chartBadge}>Active subs</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueByPlan} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false}/>
              <XAxis dataKey="plan" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`}/>
              <Tooltip content={<ChartTooltip prefix="$" />} />
              <Bar dataKey="revenue" name="Revenue" fill="#D4A800" radius={[6, 6, 0, 0]}/>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Subscription Status — pie chart */}
        <Card className={styles.chartCardSm}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Subscription Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={subStatusData}
                cx="50%" cy="50%"
                innerRadius={48} outerRadius={76}
                paddingAngle={4} dataKey="value"
              >
                {subStatusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color}/>
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v + ' subs', n]}/>
            </PieChart>
          </ResponsiveContainer>
          <div className={styles.pieLegend}>
            {subStatusData.map((item) => (
              <div key={item.name} className={styles.pieLegendItem}>
                <span className={styles.pieDot} style={{ background: item.color }}/>
                <span className={styles.pieName}>{item.name}</span>
                <span className={styles.pieValue}>{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── M3: Churn Rate & Trial Conversion ── */}
      <div className={styles.chartsRow} style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card className={styles.chartCardMd}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Churn & Conversion Metrics</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
            <MetricBadge
              label="Churn Rate"
              value={loading ? '—' : `${summary.churn_rate}%`}
              color="#FF5A5A"
            />
            <MetricBadge
              label="Trial Conversion Rate"
              value={loading ? '—' : `${summary.trial_conversion_rate}%`}
              color="#4CAF50"
            />
            <MetricBadge
              label="Trial Subscriptions"
              value={loading ? '—' : summary.trial_subscriptions}
              color="#F5C518"
            />
            <MetricBadge
              label="Past Due Subscriptions"
              value={loading ? '—' : summary.past_due_subscriptions}
              color="#FFB547"
            />
          </div>
        </Card>

        {/* Revenue Trend — area chart */}
        <Card className={styles.chartCardMd}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Revenue Trend</h3>
            <span className={styles.chartBadge}>6 months</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={revenueTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4A800" stopOpacity={0.22}/>
                  <stop offset="95%" stopColor="#D4A800" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`}/>
              <Tooltip content={<ChartTooltip prefix="$" />}/>
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#D4A800" strokeWidth={2.5} fill="url(#revGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Subscription Growth & Payment Success ── */}
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
              <Tooltip content={<ChartTooltip />}/>
              <Bar dataKey="subscriptions" name="New Subs" fill="#D4A800" radius={[6, 6, 0, 0]}/>
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
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
              <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`}/>
              <Tooltip content={<ChartTooltip />}/>
              <Line type="monotone" dataKey="rate" name="Success %" stroke="#4CAF50" strokeWidth={2.5} dot={{ fill: '#4CAF50', r: 4 }} activeDot={{ r: 6 }}/>
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ── Recent Activity ── */}
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
                <Badge status={inv.status}/>
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
                  <Badge status={pay.status}/>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
        </>
      )}

      {/* AI Chatbot */}
      <Chatbot role="admin" userName={user?.full_name || 'Admin'} />
    </div>
  )
}
