import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { invoiceService } from '../services/invoiceService'
import { paymentService } from '../services/paymentService'
import { subscriptionService } from '../services/subscriptionService'
import { formatCurrency, formatDate } from '../utils/formatters'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts'
import Badge from '../components/common/Badge.jsx'
import Card from '../components/common/Card.jsx'
import KpiCard from '../components/dashboard/KpiCard.jsx'
import { FileIcon, CreditCardIcon, DollarIcon, RefreshIcon, TrendingUpIcon, CheckIcon } from '../components/common/Icons.jsx'
import { useNavigate } from 'react-router-dom'
import styles from './Dashboard.module.css'

const PIE_COLORS = ['#4CAF50', '#F5C518', '#FF5A5A', '#D4A800']

export default function UserDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState([])
  const [payments, setPayments] = useState([])
  const [subscription, setSubscription] = useState(null)
  const [invoiceTotal, setInvoiceTotal] = useState(0)

  useEffect(() => {
    if (!user?.email) return
    Promise.all([
      invoiceService.list({ pageSize: 50, customer_email: user.email }).then(r => { setInvoices(r.items); setInvoiceTotal(r.total) }),
      paymentService.list({ pageSize: 50, customer_email: user.email }).then(r => setPayments(r.items)),
      subscriptionService.list({ status: 'all', pageSize: 10, customer_email: user.email })
        .then(r => {
          const items = r.items || []
          const active = items.find(s => ['active', 'trial', 'trialing', 'past_due'].includes(s.status))
          setSubscription(active || items[0] || null)
        }),
    ]).finally(() => setLoading(false))
  }, [user?.email])

  // Compute KPIs from real data
  const totalSpend = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0)
  const pendingInvoices = invoices.filter(i => i.status === 'unpaid' || i.status === 'draft').length
  const paidInvoices = invoices.filter(i => i.status === 'paid').length
  const failedPayments = payments.filter(p => p.status === 'failed').length

  // Invoice status pie data
  const pieData = [
    { name: 'Paid', value: paidInvoices },
    { name: 'Unpaid', value: pendingInvoices },
    { name: 'Failed', value: failedPayments },
    { name: 'Refunded', value: invoices.filter(i => i.status === 'refunded').length },
  ].filter(d => d.value > 0)

  // Spending trend by month (last 6 months from payment data)
  const trendMap = {}
  payments.filter(p => p.status === 'paid').forEach(p => {
    const d = new Date(p.paymentDate || p.createdAt)
    if (isNaN(d)) return
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' })
    trendMap[key] = (trendMap[key] || 0) + (p.amount || 0)
  })
  const spendTrend = Object.entries(trendMap).slice(-6).map(([month, amount]) => ({ month, amount }))

  const renewDate = subscription?.nextBilling ? new Date(subscription.nextBilling) : null
  const daysLeft = renewDate ? Math.max(0, Math.ceil((renewDate - Date.now()) / 86400000)) : null

  return (
    <div className={styles.page}>
      {/* Header */}
      <div style={{ marginBottom: 4 }}>
        <h1 className={styles.title}>
          Welcome back, {user?.full_name || user?.name || 'User'} 👋
        </h1>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginTop: 3 }}>
          Here's your billing overview
        </p>
      </div>

      {/* Current Subscription Banner */}
      {subscription && (
        <Card style={{ padding: '18px 24px', background: 'linear-gradient(135deg, rgba(var(--color-primary-rgb),0.08), rgba(var(--color-primary-rgb),0.02))', border: '1px solid rgba(var(--color-primary-rgb),0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUpIcon size={20} style={{ color: '#fff' }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  {subscription.plan} Plan
                  <span style={{ marginLeft: 10, padding: '2px 8px', borderRadius: 6, fontSize: 11, background: subscription.status === 'active' ? 'rgba(76,175,80,0.15)' : 'rgba(245,197,24,0.15)', color: subscription.status === 'active' ? '#4CAF50' : '#F5C518', fontWeight: 700, textTransform: 'uppercase' }}>
                    {subscription.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                  {formatCurrency(subscription.amount)}/month
                  {renewDate && ` · Renews ${formatDate(renewDate)}`}
                  {daysLeft !== null && ` · ${daysLeft} days left`}
                </div>
              </div>
            </div>
            <button
              onClick={() => navigate('/my-plan')}
              style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
            >
              Manage Plan
            </button>
          </div>
        </Card>
      )}

      {!subscription && !loading && (
        <Card style={{ padding: '18px 24px', textAlign: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>You don't have an active subscription yet.</p>
          <button onClick={() => navigate('/my-plan')} style={{ padding: '8px 20px', borderRadius: 8, background: 'var(--color-primary)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
            Browse Plans
          </button>
        </Card>
      )}

      {/* KPI Cards */}
      <div className={styles.kpiGrid}>
        <KpiCard title="Total Spent" value={formatCurrency(totalSpend)} icon={<DollarIcon size={20}/>} color="#4CAF50" loading={loading} />
        <KpiCard title="Total Invoices" value={invoiceTotal} icon={<FileIcon size={20}/>} color="#D4A800" loading={loading} />
        <KpiCard title="Pending Invoices" value={pendingInvoices} icon={<RefreshIcon size={20}/>} color="#FFB547" loading={loading} />
        <KpiCard title="Failed Payments" value={failedPayments} icon={<CreditCardIcon size={20}/>} color="#FF5A5A" loading={loading} />
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        {/* Spending Trend */}
        <Card className={styles.chartCardLg}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Spending Trend</h3>
            <span className={styles.chartBadge}>Paid payments</span>
          </div>
          {spendTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={spendTrend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4A800" stopOpacity={0.22}/>
                    <stop offset="95%" stopColor="#D4A800" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)"/>
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fontSize: 12, fill: 'var(--color-text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`}/>
                <Tooltip formatter={v => [`$${v.toFixed(2)}`, 'Spent']}/>
                <Area type="monotone" dataKey="amount" stroke="#D4A800" strokeWidth={2.5} fill="url(#spendGrad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No payment data yet
            </div>
          )}
        </Card>

        {/* Invoice Status Pie */}
        <Card className={styles.chartCardSm}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Invoice Status</h3>
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={76} paddingAngle={4} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]}/>
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v + ' invoices', n]}/>
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {pieData.map((item, i) => (
                  <div key={item.name} className={styles.pieLegendItem}>
                    <span className={styles.pieDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}/>
                    <span className={styles.pieName}>{item.name}</span>
                    <span className={styles.pieValue}>{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              No invoices yet
            </div>
          )}
        </Card>
      </div>

      {/* Recent Activity */}
      <div className={styles.activityRow}>
        {/* Recent Invoices */}
        <Card className={styles.activityCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Recent Invoices</h3>
            <button onClick={() => navigate('/my-invoices')} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          <div className={styles.table}>
            <div className={styles.tableHead}>
              <span>Invoice</span><span>Plan</span><span>Amount</span><span>Status</span>
            </div>
            {invoices.slice(0, 5).map((inv) => (
              <div key={inv.id} className={styles.tableRow}>
                <span className={styles.mono}>{inv.number}</span>
                <span className={styles.truncate} style={{ fontSize: 12 }}>{inv.planName || '—'}</span>
                <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                <Badge status={inv.status}/>
              </div>
            ))}
            {!loading && invoices.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>No invoices yet</div>
            )}
          </div>
        </Card>

        {/* Recent Payments */}
        <Card className={styles.activityCard}>
          <div className={styles.chartHeader}>
            <h3 className={styles.chartTitle}>Recent Payments</h3>
            <button onClick={() => navigate('/my-payments')} style={{ fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>View all →</button>
          </div>
          <div className={styles.paymentList}>
            {payments.slice(0, 5).map((pay) => (
              <div key={pay.id} className={styles.paymentItem}>
                <div className={styles.paymentLeft}>
                  <div className={styles.paymentAvatar} style={{ background: pay.status === 'paid' ? 'rgba(76,175,80,0.12)' : 'rgba(255,90,90,0.12)', color: pay.status === 'paid' ? '#4CAF50' : '#FF5A5A' }}>
                    {pay.status === 'paid' ? <CheckIcon size={14}/> : <CreditCardIcon size={14}/>}
                  </div>
                  <div>
                    <p className={styles.paymentName}>{pay.paymentMethod || 'Payment'}</p>
                    <p className={styles.paymentMeta}>{pay.paymentDate ? formatDate(pay.paymentDate) : '—'}</p>
                  </div>
                </div>
                <div className={styles.paymentRight}>
                  <span className={styles.paymentAmount}>{formatCurrency(pay.amount)}</span>
                  <Badge status={pay.status}/>
                </div>
              </div>
            ))}
            {!loading && payments.length === 0 && (
              <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 13, color: 'var(--color-text-secondary)' }}>No payments yet</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
