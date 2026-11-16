import { useEffect, useState } from 'react'
import api from '../../services/api'
import Card from '../common/Card'
import Button from '../common/Button'
import { AlertIcon, CheckIcon, DollarIcon, RefreshIcon } from '../common/Icons'
import { formatCurrency, formatDate } from '../../utils/formatters'
import RiskBreakdownModal from './RiskBreakdownModal'

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

function RiskBadge({ category, onClick }) {
  if (!category || category === 'unknown') {
    return <span style={{ fontSize: 13, color: '#94A3B8' }}>N/A</span>
  }
  
  const color = RISK_COLORS[category] || RISK_COLORS.unknown
  const label = RISK_LABELS[category] || category
  
  return (
    <span 
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 12px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}40`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s',
        userSelect: 'none'
      }}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-1px)'
          e.currentTarget.style.boxShadow = `0 2px 8px ${color}40`
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }
      }}
      title={onClick ? 'Click to view risk breakdown' : undefined}
    >
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: color
      }} />
      {label}
    </span>
  )
}

export default function SimpleRiskDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedRisk, setSelectedRisk] = useState(null)
  const [summary, setSummary] = useState(null)
  const [failedPayments, setFailedPayments] = useState([])
  const [overdueInvoices, setOverdueInvoices] = useState([])

  function openRiskBreakdown(riskData, entityType, entityId) {
    setSelectedRisk({ ...riskData, entityType, entityId })
    setModalOpen(true)
  }

  function closeRiskBreakdown() {
    setModalOpen(false)
    setSelectedRisk(null)
  }

  useEffect(() => {
    loadRiskData()
  }, [])

  async function loadRiskData() {
    setLoading(true)
    setError(null)
    try {
      // Load risk summary
      const summaryRes = await api.get('/risk/summary')
      setSummary(summaryRes.data)

      // Load failed payments
      try {
        const failedRes = await api.get('/risk/failed-payments', {
          params: { limit: 10, days_back: 30 }
        })
        setFailedPayments(failedRes.data.items || [])
      } catch (err) {
        console.warn('Failed to load failed payments:', err)
      }

      // Load overdue invoices
      try {
        const overdueRes = await api.get('/risk/overdue-invoices', {
          params: { limit: 10 }
        })
        setOverdueInvoices(overdueRes.data.items || [])
      } catch (err) {
        console.warn('Failed to load overdue invoices:', err)
      }
    } catch (err) {
      console.error('Failed to load risk data:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to load risk data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card style={{ padding: 48, textAlign: 'center' }}>
        <RefreshIcon size={48} style={{ color: '#3B82F6', margin: '0 auto 16px' }} />
        <p style={{ color: '#6B7280' }}>Loading payment risk intelligence...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card style={{ padding: 24, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <AlertIcon size={24} style={{ color: '#DC2626', marginRight: 12 }} />
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: '#7F1D1D', margin: 0 }}>
              Error Loading Risk Data
            </h3>
            <p style={{ color: '#B91C1C', marginTop: 8 }}>{error}</p>
          </div>
        </div>
      </Card>
    )
  }

  if (!summary) {
    return (
      <Card style={{ padding: 48, textAlign: 'center' }}>
        <AlertIcon size={64} style={{ color: '#9CA3AF', margin: '0 auto 16px' }} />
        <p style={{ color: '#6B7280' }}>No risk data available</p>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Payment Risk Intelligence</h2>
        <Button onClick={loadRiskData} variant="secondary" size="sm">
          <RefreshIcon size={16} />
          Refresh
        </Button>
      </div>

      {/* Summary Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', gap: 16 }}>
        <Card style={{ padding: 20, backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 13, color: '#DC2626', fontWeight: 500 }}>High Risk</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#7F1D1D', marginTop: 8 }}>
                {summary.risk_distribution?.high || 0}
              </p>
            </div>
            <AlertIcon size={32} style={{ color: '#DC2626', opacity: 0.6 }} />
          </div>
        </Card>

        <Card style={{ padding: 20, backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 13, color: '#D97706', fontWeight: 500 }}>Medium Risk</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#92400E', marginTop: 8 }}>
                {summary.risk_distribution?.medium || 0}
              </p>
            </div>
            <AlertIcon size={32} style={{ color: '#F59E0B', opacity: 0.6 }} />
          </div>
        </Card>

        <Card style={{ padding: 20, backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 13, color: '#059669', fontWeight: 500 }}>Low Risk</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#065F46', marginTop: 8 }}>
                {summary.risk_distribution?.low || 0}
              </p>
            </div>
            <CheckIcon size={32} style={{ color: '#10B981', opacity: 0.6 }} />
          </div>
        </Card>

        <Card style={{ padding: 20, backgroundColor: '#EFF6FF', border: '1px solid #DBEAFE' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 13, color: '#2563EB', fontWeight: 500 }}>Total Failed</p>
              <p style={{ fontSize: 28, fontWeight: 700, color: '#1E40AF', marginTop: 8 }}>
                {summary.failures?.total ?? 0}
              </p>
            </div>
            <DollarIcon size={32} style={{ color: '#3B82F6', opacity: 0.6 }} />
          </div>
        </Card>
      </div>

      {/* Failed Payments Table */}
      {failedPayments.length > 0 && (
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Recent Failed Payments</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Payment ID
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Customer
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Amount
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Risk Score
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Category
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {failedPayments.map((item) => (
                  <tr key={item.payment?.id || item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 8px', fontSize: 14 }}>#{item.payment?.id || item.id}</td>
                    <td style={{ padding: '12px 8px', fontSize: 14 }}>{item.customer?.name || 'N/A'}</td>
                    <td style={{ padding: '12px 8px', fontSize: 14, fontWeight: 500 }}>
                      {formatCurrency(item.payment?.amount || item.amount || 0)}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: 14 }}>
                      <span 
                        onClick={() => item.risk_assessment && openRiskBreakdown(
                          item.risk_assessment,
                          'payment',
                          item.payment?.id || item.id
                        )}
                        style={{ 
                          cursor: item.risk_assessment ? 'pointer' : 'default',
                          textDecoration: item.risk_assessment ? 'underline' : 'none',
                          textDecorationStyle: 'dotted',
                          color: item.risk_assessment ? '#3B82F6' : 'inherit'
                        }}
                        title={item.risk_assessment ? 'Click to view risk breakdown' : undefined}
                      >
                        {item.risk_assessment?.risk_score ? item.risk_assessment.risk_score.toFixed(0) : 'N/A'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <RiskBadge 
                        category={item.risk_assessment?.risk_category || item.risk_category}
                        onClick={() => item.risk_assessment && openRiskBreakdown(
                          item.risk_assessment,
                          'payment',
                          item.payment?.id || item.id
                        )}
                      />
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: 14, color: '#6B7280' }}>
                      {item.payment?.failed_at ? formatDate(item.payment.failed_at) : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Overdue Invoices */}
      {overdueInvoices.length > 0 && (
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Overdue Invoices</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #E5E7EB' }}>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Invoice
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Customer
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Amount
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Days Overdue
                  </th>
                  <th style={{ padding: '12px 8px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    Risk
                  </th>
                </tr>
              </thead>
              <tbody>
                {overdueInvoices.map((item) => (
                  <tr key={item.invoice?.id || item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '12px 8px', fontSize: 14 }}>{item.invoice?.invoice_number || `#${item.invoice?.id || item.id}`}</td>
                    <td style={{ padding: '12px 8px', fontSize: 14 }}>{item.customer?.name || 'N/A'}</td>
                    <td style={{ padding: '12px 8px', fontSize: 14, fontWeight: 500 }}>
                      {formatCurrency(item.invoice?.total_amount || item.total_amount || 0)}
                    </td>
                    <td style={{ padding: '12px 8px', fontSize: 14, color: '#EF4444' }}>
                      {item.invoice?.overdue_days || item.days_overdue || item.overdue_days || 0} days
                    </td>
                    <td style={{ padding: '12px 8px' }}>
                      <RiskBadge 
                        category={item.risk_assessment?.risk_category || item.risk_category}
                        onClick={() => item.risk_assessment && openRiskBreakdown(
                          item.risk_assessment,
                          'invoice',
                          item.invoice?.id || item.id
                        )}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Risk Breakdown Modal */}
      {selectedRisk && (
        <RiskBreakdownModal
          isOpen={modalOpen}
          onClose={closeRiskBreakdown}
          riskData={selectedRisk}
          entityType={selectedRisk.entityType}
          entityId={selectedRisk.entityId}
        />
      )}

      {failedPayments.length === 0 && overdueInvoices.length === 0 && (
        <Card style={{ padding: 48, textAlign: 'center' }}>
          <CheckIcon size={64} style={{ color: '#10B981', margin: '0 auto 16px' }} />
          <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>All Clear!</p>
          <p style={{ color: '#6B7280', marginTop: 8 }}>No high-risk payments or overdue invoices at this time.</p>
        </Card>
      )}
    </div>
  )
}
