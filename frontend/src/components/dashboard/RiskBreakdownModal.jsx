import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Card from '../common/Card'
import api from '../../services/api'
import { AlertIcon, CheckIcon, DollarIcon } from '../common/Icons'

// Factor metadata (matches Backend/app/services/risk_scoring.py RiskConfig)
const FACTOR_METADATA = {
  consecutive_failures: {
    name: 'Consecutive Failures',
    weight: 35,
    icon: '🔄',
    description: 'Recent payment attempts that failed in a row',
    color: '#EF4444'
  },
  retry_exhaustion: {
    name: 'Retry Exhaustion',
    weight: 30,
    icon: '⚠️',
    description: 'Invoices where all retry attempts were exhausted',
    color: '#F59E0B'
  },
  overdue_duration: {
    name: 'Overdue Duration',
    weight: 20,
    icon: '📅',
    description: 'How many days invoices are past due',
    color: '#8B5CF6'
  },
  failure_frequency: {
    name: 'Failure Frequency',
    weight: 15,
    icon: '📊',
    description: 'Number of failed payments in recent time window',
    color: '#EC4899'
  }
}

// Risk category thresholds (from Backend/app/services/risk_scoring.py)
const RISK_THRESHOLDS = {
  low: { max: 30, color: '#10B981', label: 'Low Risk' },
  medium: { min: 31, max: 60, color: '#F59E0B', label: 'Medium Risk' },
  high: { min: 61, color: '#EF4444', label: 'High Risk' }
}

export default function RiskBreakdownModal({ 
  isOpen, 
  onClose, 
  riskData, 
  entityType, 
  entityId 
}) {
  const [loading, setLoading] = useState(false)
  const [fullData, setFullData] = useState(riskData)
  const [error, setError] = useState(null)

  useEffect(() => {
    // If we don't have full risk data, fetch it
    if (isOpen && entityType && entityId && (!riskData?.factor_scores || !riskData?.evidence)) {
      fetchFullRiskData()
    } else if (riskData) {
      setFullData(riskData)
    }
  }, [isOpen, entityType, entityId, riskData])

  async function fetchFullRiskData() {
    setLoading(true)
    setError(null)
    try {
      const endpoint = entityType === 'invoice' 
        ? `/risk/invoices/${entityId}`
        : entityType === 'payment'
        ? `/risk/payments/${entityId}`
        : `/risk/customers/${entityId}`
      
      const { data } = await api.get(endpoint)
      setFullData(data)
    } catch (err) {
      console.error('Failed to fetch risk details:', err)
      setError(err.response?.data?.detail || 'Failed to load risk breakdown')
    } finally {
      setLoading(false)
    }
  }

  if (!fullData && !loading) {
    return null
  }

  const riskScore = fullData?.risk_score || 0
  const riskCategory = fullData?.risk_category || 'unknown'
  const factorScores = fullData?.factor_scores || {}
  const evidence = fullData?.evidence || {}
  const recommendations = fullData?.recommendations || []
  
  // Calculate sum of factor scores for verification
  const calculatedTotal = Object.values(factorScores).reduce((sum, score) => sum + score, 0)
  const hasDiscrepancy = Math.abs(calculatedTotal - riskScore) > 0.1

  // Get category info
  const categoryInfo = RISK_THRESHOLDS[riskCategory] || { 
    color: '#94A3B8', 
    label: riskCategory 
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Risk Assessment Breakdown"
      width={680}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '4px solid #E5E7EB', 
            borderTopColor: '#3B82F6',
            borderRadius: '50%',
            margin: '0 auto 16px',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ color: '#6B7280' }}>Loading risk details...</p>
        </div>
      ) : error ? (
        <div style={{ 
          padding: 24, 
          backgroundColor: '#FEF2F2', 
          border: '1px solid #FECACA',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 12
        }}>
          <AlertIcon size={24} style={{ color: '#DC2626', flexShrink: 0 }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#7F1D1D', margin: 0 }}>
              Error Loading Risk Data
            </p>
            <p style={{ fontSize: 13, color: '#B91C1C', marginTop: 4 }}>{error}</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Overall Risk Score */}
          <div style={{ 
            padding: 24, 
            background: `linear-gradient(135deg, ${categoryInfo.color}15, ${categoryInfo.color}05)`,
            border: `2px solid ${categoryInfo.color}40`,
            borderRadius: 12
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginBottom: 8 }}>
                  OVERALL RISK SCORE
                </p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ 
                    fontSize: 48, 
                    fontWeight: 800, 
                    fontFamily: 'JetBrains Mono, monospace',
                    color: categoryInfo.color 
                  }}>
                    {riskScore.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 18, color: '#9CA3AF' }}>/100</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 16px',
                  borderRadius: 999,
                  fontSize: 14,
                  fontWeight: 700,
                  backgroundColor: `${categoryInfo.color}20`,
                  color: categoryInfo.color,
                  border: `2px solid ${categoryInfo.color}60`
                }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: categoryInfo.color
                  }} />
                  {categoryInfo.label}
                </div>
                <p style={{ fontSize: 12, color: '#6B7280', marginTop: 8 }}>
                  {riskCategory === 'low' && 'Score ≤ 30'}
                  {riskCategory === 'medium' && 'Score 31-60'}
                  {riskCategory === 'high' && 'Score > 60'}
                </p>
              </div>
            </div>
          </div>

          {/* Risk Factors Breakdown */}
          <div>
            <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' }}>
              Risk Factor Contributions
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(FACTOR_METADATA).map(([key, meta]) => {
                const score = factorScores[key] || 0
                const percentage = (score / meta.weight) * 100

                return (
                  <div 
                    key={key}
                    style={{ 
                      padding: 16,
                      backgroundColor: '#F9FAFB',
                      borderRadius: 10,
                      border: '1px solid #E5E7EB'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 18 }}>{meta.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>
                            {meta.name}
                          </span>
                          <span style={{ 
                            fontSize: 11, 
                            color: '#6B7280',
                            backgroundColor: '#E5E7EB',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontWeight: 600
                          }}>
                            Weight: {meta.weight}%
                          </span>
                        </div>
                        <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                          {meta.description}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right', minWidth: 80 }}>
                        <div style={{ 
                          fontSize: 20, 
                          fontWeight: 700, 
                          fontFamily: 'JetBrains Mono, monospace',
                          color: score > 0 ? meta.color : '#9CA3AF'
                        }}>
                          {score.toFixed(1)}
                        </div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                          {percentage.toFixed(0)}% of max
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div style={{ 
                      width: '100%', 
                      height: 6, 
                      backgroundColor: '#E5E7EB',
                      borderRadius: 999,
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${percentage}%`,
                        height: '100%',
                        backgroundColor: score > 0 ? meta.color : '#D1D5DB',
                        borderRadius: 999,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>

                    {/* Evidence details */}
                    {score > 0 && evidence[key] !== undefined && (
                      <div style={{ 
                        marginTop: 8, 
                        padding: 8,
                        backgroundColor: '#FFFFFF',
                        borderRadius: 6,
                        fontSize: 12,
                        color: '#4B5563'
                      }}>
                        {key === 'consecutive_failures' && (
                          <span>Found: {evidence.consecutive_failures} consecutive failed payment(s)</span>
                        )}
                        {key === 'retry_exhaustion' && (
                          <span>Found: {evidence.exhausted_retries} invoice(s) with exhausted retries</span>
                        )}
                        {key === 'overdue_duration' && (
                          <span>Maximum overdue: {evidence.overdue_days} day(s)</span>
                        )}
                        {key === 'failure_frequency' && (
                          <span>Recent failures: {evidence.recent_failures} in last 30 days</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Score Verification */}
          {hasDiscrepancy && (
            <div style={{ 
              padding: 12,
              backgroundColor: '#FEF3C7',
              border: '1px solid #FCD34D',
              borderRadius: 8,
              fontSize: 12,
              color: '#92400E'
            }}>
              <strong>Note:</strong> Sum of factors ({calculatedTotal.toFixed(1)}) differs from total score ({riskScore.toFixed(1)}) due to rounding in the risk calculation engine.
            </div>
          )}

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div>
              <h4 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: '#111827' }}>
                Recommendations
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recommendations.map((rec, idx) => (
                  <div 
                    key={idx}
                    style={{ 
                      display: 'flex',
                      alignItems: 'start',
                      gap: 10,
                      padding: 12,
                      backgroundColor: '#F0F9FF',
                      border: '1px solid #BAE6FD',
                      borderRadius: 8
                    }}
                  >
                    <span style={{ fontSize: 16, flexShrink: 0 }}>
                      {rec.includes('HIGH RISK') ? '🔴' : rec.includes('MEDIUM RISK') ? '⚠️' : '💡'}
                    </span>
                    <p style={{ fontSize: 13, color: '#1E40AF', margin: 0, lineHeight: 1.5 }}>
                      {rec}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data Quality Indicator */}
          {fullData?.data_quality && (
            <div style={{ 
              padding: 12,
              backgroundColor: '#F3F4F6',
              borderRadius: 8,
              fontSize: 12,
              color: '#6B7280',
              textAlign: 'center'
            }}>
              Data quality: <strong>{fullData.data_quality}</strong>
              {fullData.data_quality === 'limited' && ' — Risk assessment based on limited payment history'}
              {fullData.data_quality === 'insufficient' && ' — Very limited data available for risk assessment'}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Modal>
  )
}
