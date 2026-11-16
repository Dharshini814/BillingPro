import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import api from '../../services/api'
import Card from '../common/Card'
import Badge from '../common/Badge'
import Button from '../common/Button'
import { AlertIcon, CheckIcon, DollarIcon, RefreshIcon } from '../common/Icons'
import { formatCurrency, formatDate } from '../../utils/formatters'
import styles from './RiskDashboard.module.css'

const RISK_COLORS = {
  high: '#EF4444',
  medium: '#F59E0B',
  low: '#10B981',
  unknown: '#94A3B8'
}

const RISK_LABELS = {
  high: 'High Risk',
  medium: 'Medium Risk',
  low: 'Low Risk'
}

function RiskBadge({ category }) {
  const color = RISK_COLORS[category] || RISK_COLORS.unknown
  const label = RISK_LABELS[category] || category
  
  return (
    <Badge
      text={label}
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}40`
      }}
    />
  )
}

function RiskScoreBar({ score }) {
  const getColor = (score) => {
    if (score <= 30) return RISK_COLORS.low
    if (score <= 60) return RISK_COLORS.medium
    return RISK_COLORS.high
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1,
        height: 8,
        background: '#E5E7EB',
        borderRadius: 4,
        overflow: 'hidden'
      }}>
        <div
          style={{
            width: `${Math.min(score, 100)}%`,
            height: '100%',
            background: getColor(score),
            transition: 'width 0.3s ease'
          }}
        />
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, color: getColor(score), minWidth: 35 }}>
        {score.toFixed(0)}
      </span>
    </div>
  )
}

export default function RiskDashboard() {
  const [summary, setSummary] = useState(null)
  const [failedPayments, setFailedPayments] = useState([])
  const [overdueInvoices, setOverdueInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview') // overview, failed, overdue

  useEffect(() => {
    loadRiskData()
  }, [])

  async function loadRiskData() {
    setLoading(true)
    try {
      // Load risk summary
      const summaryRes = await api.get('/risk/summary')
      setSummary(summaryRes.data)

      // Load failed payments (top 10 by risk)
      const failedRes = await api.get('/risk/failed-payments', {
        params: { limit: 10, days_back: 30 }
      })
      setFailedPayments(failedRes.data.items || [])

      // Load overdue invoices (top 10)
      const overdueRes = await api.get('/risk/overdue-invoices', {
        params: { limit: 10 }
      })
      setOverdueInvoices(overdueRes.data.items || [])
    } catch (error) {
      console.error('Failed to load risk data:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading || !summary) {
    return (
      <div style={{ padding: 24 }}>
        <h2 style={{ marginBottom: 24 }}>Payment Risk Intelligence</h2>
        <div style={{ textAlign: 'center', padding: 48, color: '#94A3B8' }}>
          Loading risk data...
        </div>
      </div>
    )
  }

  // Prepare risk distribution chart data
  const riskDistData = Object.entries(summary.risk_distribution)
    .filter(([key]) => key !== 'unknown')
    .map(([key, value]) => ({
      name: RISK_LABELS[key] || key,
      value,
      color: RISK_COLORS[key]
    }))

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>Payment Risk Intelligence</h2>
        <Button onClick={loadRiskData} variant="secondary" size="sm">
          <RefreshIcon size={16} />
          Refresh
        </Button>
      </div>

      {/* Overview Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16, marginBottom: 24 }}>
        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ padding: 8, borderRadius: 8, background: '#EF444415' }}>
                <AlertIcon color="#EF4444" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Failed Payments (30d)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.failures.last_30_days}</div>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ padding: 8, borderRadius: 8, background: '#F59E0B15' }}>
                <DollarIcon color="#F59E0B" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Overdue Amount</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>
                  {formatCurrency(summary.overdue.total_amount)}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
              {summary.overdue.count} overdue invoices
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ padding: 8, borderRadius: 8, background: '#10B98115' }}>
                <CheckIcon color="#10B981" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Success Rate (30d)</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.success_rate.last_30_days}%</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
              {summary.success_rate.successful} / {summary.success_rate.total_attempts} payments
            </div>
          </div>
        </Card>

        <Card>
          <div style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ padding: 8, borderRadius: 8, background: '#EF444415' }}>
                <AlertIcon color="#EF4444" size={20} />
              </div>
              <div>
                <div style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Exhausted Retries</div>
                <div style={{ fontSize: 24, fontWeight: 700 }}>{summary.retries.exhausted_count}</div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Risk Distribution Chart */}
      {riskDistData.length > 0 && (
        <Card style={{ marginBottom: 24 }}>
          <div style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Risk Distribution</h3>
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              <ResponsiveContainer width="40%" height={200}>
                <PieChart>
                  <Pie
                    data={riskDistData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                  >
                    {riskDistData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {riskDistData.map((item) => (
                  <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                      <span style={{ fontSize: 14 }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ marginBottom: 16, borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {['overview', 'failed', 'overdue'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '12px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid #D4A800' : '2px solid transparent',
                color: activeTab === tab ? '#D4A800' : '#64748B',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 14,
                textTransform: 'capitalize'
              }}
            >
              {tab === 'overview' ? 'Recent Failed Payments' : tab === 'failed' ? 'All Failed' : 'Overdue Invoices'}
            </button>
          ))}
        </div>
      </div>

      {/* Failed Payments Table */}
      {(activeTab === 'overview' || activeTab === 'failed') && (
        <Card>
          <div style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>
              {activeTab === 'overview' ? 'Top 10 Failed Payments by Risk' : 'Failed Payments'}
            </h3>
            {failedPayments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                No failed payments in the last 30 days
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Customer
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Invoice
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Amount
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Risk Score
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Risk Category
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Retry Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedPayments.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{item.customer.name}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>{item.customer.email}</div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontSize: 13 }}>{item.invoice.invoice_number}</div>
                          {item.invoice.overdue_days > 0 && (
                            <div style={{ fontSize: 11, color: '#EF4444' }}>
                              {item.invoice.overdue_days} days overdue
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(item.payment.amount)}
                        </td>
                        <td style={{ padding: '12px 8px', minWidth: 180 }}>
                          <RiskScoreBar score={item.risk_assessment.risk_score} />
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <RiskBadge category={item.risk_assessment.risk_category} />
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {item.retry_status.exhausted ? (
                            <Badge text="Exhausted" variant="danger" />
                          ) : item.retry_status.next_retry_date ? (
                            <Badge
                              text={`Retry: ${formatDate(item.retry_status.next_retry_date)}`}
                              variant="warning"
                            />
                          ) : (
                            <Badge text="No Retries" variant="secondary" />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Overdue Invoices Table */}
      {activeTab === 'overdue' && (
        <Card>
          <div style={{ padding: 24 }}>
            <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Overdue Invoices</h3>
            {overdueInvoices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#94A3B8' }}>
                No overdue invoices found
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E5E7EB' }}>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Customer
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Invoice
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Amount
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Days Overdue
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Risk Score
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Risk Category
                      </th>
                      <th style={{ padding: '12px 8px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748B' }}>
                        Payment Attempts
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {overdueInvoices.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>{item.customer.name}</div>
                          <div style={{ fontSize: 12, color: '#64748B' }}>{item.customer.email}</div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div style={{ fontSize: 13 }}>{item.invoice.invoice_number}</div>
                          <div style={{ fontSize: 11, color: '#64748B' }}>
                            Due: {formatDate(item.invoice.due_date)}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>
                          {formatCurrency(item.invoice.total_amount)}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <Badge
                            text={`${item.invoice.overdue_days} days`}
                            variant={item.invoice.overdue_days > 30 ? 'danger' : 'warning'}
                          />
                        </td>
                        <td style={{ padding: '12px 8px', minWidth: 180 }}>
                          <RiskScoreBar score={item.risk_assessment.risk_score} />
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <RiskBadge category={item.risk_assessment.risk_category} />
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 14, fontWeight: 500 }}>
                            {item.retry_status.total_attempts}
                          </div>
                          {item.retry_status.exhausted && (
                            <div style={{ fontSize: 11, color: '#EF4444' }}>All retries exhausted</div>
                          )}
                          {item.retry_status.scheduled_retries > 0 && (
                            <div style={{ fontSize: 11, color: '#F59E0B' }}>
                              {item.retry_status.scheduled_retries} pending
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
