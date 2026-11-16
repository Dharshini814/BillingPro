import { useEffect, useState } from 'react'
import api from '../../services/api'
import Card from '../common/Card'
import { DollarIcon, TrendingUpIcon, AlertIcon, CheckIcon, RefreshIcon } from '../common/Icons'
import { formatCurrency } from '../../utils/formatters'

export default function SimpleRevenueIntelligence() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get('/revenue/summary')
      setSummary(data)
    } catch (err) {
      console.error('Failed to load revenue data:', err)
      setError(err.response?.data?.detail || err.message || 'Failed to load revenue data')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Card style={{ padding: 48, textAlign: 'center' }}>
        <RefreshIcon size={48} style={{ color: '#3B82F6', margin: '0 auto 16px' }} />
        <p style={{ color: '#6B7280' }}>Loading revenue intelligence...</p>
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
              Error Loading Revenue Data
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
        <DollarIcon size={64} style={{ color: '#9CA3AF', margin: '0 auto 16px' }} />
        <p style={{ color: '#6B7280' }}>No revenue data available</p>
      </Card>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 280px), 1fr))', gap: 16 }}>
        <Card style={{ padding: 24, borderLeft: '4px solid #3B82F6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Current MRR</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {formatCurrency(summary.current_mrr || 0)}
              </p>
            </div>
            <DollarIcon size={40} style={{ color: '#3B82F6', opacity: 0.8 }} />
          </div>
          {summary.mrr_growth_rate !== undefined && (
            <div style={{ marginTop: 12, display: 'flex', alignItems: 'center' }}>
              <TrendingUpIcon 
                size={16} 
                style={{ 
                  color: summary.mrr_growth_rate >= 0 ? '#10B981' : '#EF4444',
                  marginRight: 4,
                  transform: summary.mrr_growth_rate < 0 ? 'scaleY(-1)' : 'none'
                }} 
              />
              <span style={{ 
                fontSize: 14, 
                fontWeight: 500,
                color: summary.mrr_growth_rate >= 0 ? '#10B981' : '#EF4444'
              }}>
                {summary.mrr_growth_rate.toFixed(1)}% MoM
              </span>
            </div>
          )}
        </Card>

        <Card style={{ padding: 24, borderLeft: '4px solid #10B981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Collection Rate</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {summary.collection_rate ? summary.collection_rate.toFixed(1) : '0.0'}%
              </p>
            </div>
            <CheckIcon size={40} style={{ color: '#10B981', opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Last 30 days</p>
          </div>
        </Card>

        <Card style={{ padding: 24, borderLeft: '4px solid #F59E0B' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Overdue Revenue</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {formatCurrency(summary.overdue_revenue || 0)}
              </p>
            </div>
            <AlertIcon size={40} style={{ color: '#F59E0B', opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Requires attention</p>
          </div>
        </Card>

        <Card style={{ padding: 24, borderLeft: '4px solid #8B5CF6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>Accounts Receivable</p>
              <p style={{ fontSize: 24, fontWeight: 700, color: '#111827', marginTop: 8 }}>
                {formatCurrency(summary.current_ar || 0)}
              </p>
            </div>
            <DollarIcon size={40} style={{ color: '#8B5CF6', opacity: 0.8 }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>Total outstanding</p>
          </div>
        </Card>
      </div>

      {/* Additional Metrics */}
      {summary.insights && summary.insights.length > 0 && (
        <Card style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Revenue Insights</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {summary.insights.slice(0, 5).map((insight, idx) => (
              <div 
                key={idx}
                style={{ 
                  display: 'flex',
                  alignItems: 'flex-start',
                  padding: 12,
                  backgroundColor: '#F9FAFB',
                  borderRadius: 8
                }}
              >
                <AlertIcon 
                  size={18} 
                  style={{ 
                    color: insight.type === 'alert' ? '#EF4444' : insight.type === 'warning' ? '#F59E0B' : '#3B82F6',
                    marginRight: 12,
                    marginTop: 2,
                    flexShrink: 0
                  }} 
                />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: 0 }}>
                    {insight.title || insight.message}
                  </p>
                  {insight.description && (
                    <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0 0' }}>
                      {insight.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
