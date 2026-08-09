import { useCallback, useEffect, useState } from 'react'
import { subscriptionService } from '../services/subscriptionService'
import { planService } from '../services/planService'
import { useToast } from '../hooks/useToast'
import { formatDate, formatCurrency } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Modal from '../components/common/Modal.jsx'
import api from '../services/api.js'
import { RefreshIcon, XIcon, CheckIcon, LayersIcon } from '../components/common/Icons.jsx'
import styles from './Subscriptions.module.css'

const STATUSES = ['all', 'active', 'trialing', 'past_due', 'canceled']

// ─── Full Proration Summary Card (upgrade + downgrade + wallet) ───────────────
function ProrationSummary({ preview }) {
  if (!preview) return null
  const isDowngrade = preview.isDowngrade
  return (
    <div className={styles.prorationCard}>
      <h4 className={styles.prorationTitle}>
        {isDowngrade ? 'Plan Downgrade Summary' : 'Plan Upgrade Summary'}
      </h4>
      <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8 }}>
        {preview.remainingDays} days remaining in billing cycle
      </p>
      <div className={styles.prorationRows}>
        <div className={styles.prorationRow}>
          <span>Unused {preview.currentPlan?.name} credit</span>
          <span className={styles.credit}>−{formatCurrency(preview.credit)}</span>
        </div>
        <div className={styles.prorationRow}>
          <span>{preview.newPlan?.name} charge ({preview.remainingDays} days)</span>
          <span className={styles.charge}>+{formatCurrency(preview.charge)}</span>
        </div>

        {/* Wallet credit applied (upgrades only) */}
        {!isDowngrade && preview.walletApplied > 0 && (
          <div className={styles.prorationRow}>
            <span>💰 Wallet credit applied</span>
            <span className={styles.credit}>−{formatCurrency(preview.walletApplied)}</span>
          </div>
        )}

        <div className={[styles.prorationRow, styles.prorationTotal].join(' ')}>
          <strong>{isDowngrade ? 'Credit Added to Wallet' : 'Amount Due'}</strong>
          <strong className={isDowngrade ? styles.credit : ''}>
            {isDowngrade
              ? `+${formatCurrency(preview.walletCreditAdded)}`
              : formatCurrency(preview.amountDue)}
          </strong>
        </div>
      </div>

      <p className={styles.prorationNote}>
        {isDowngrade
          ? `${formatCurrency(preview.walletCreditAdded)} will be added to the customer's wallet.`
          : preview.amountDue === 0
            ? '✅ Wallet balance fully covers this upgrade — no charge.'
            : `A proration invoice of ${formatCurrency(preview.amountDue)} will be created.${
                preview.walletApplied > 0 ? ` Wallet saved ${formatCurrency(preview.walletApplied)}.` : ''
              }`
        }
      </p>
    </div>
  )
}

// ─── Subscription History Modal ───────────────────────────────────────────────
function HistoryModal({ sub, onClose }) {
  const [loading, setLoading] = useState(true)
  const [historyData, setHistoryData] = useState(null)

  useEffect(() => {
    api.get(`/subscriptions/${sub.id}/history`)
      .then(({ data }) => setHistoryData(data))
      .catch(() => setHistoryData({ changes: [], current_plan: sub.plan, current_status: sub.status }))
      .finally(() => setLoading(false))
  }, [sub.id, sub.plan, sub.status])

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Plan History — ${sub.customerName}`}
      width={520}
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {loading ? (
        <div style={{ padding: '20px 0' }}>
          {[1, 2, 3].map(n => <Skeleton key={n} height={48} style={{ marginBottom: 8 }} />)}
        </div>
      ) : (
        <div>
          {/* Summary row */}
          <div style={{
            display: 'flex', gap: 16, marginBottom: 20,
            padding: '10px 14px', borderRadius: 8,
            background: 'var(--color-surface-secondary, rgba(255,255,255,0.04))',
            fontSize: 13
          }}>
            <span><strong>Current Plan:</strong> {historyData?.current_plan || sub.plan}</span>
            <span><strong>Status:</strong> {historyData?.current_status || sub.status}</span>
            <span><strong>Changes:</strong> {historyData?.total_changes || 0}</span>
          </div>

          {/* Change timeline */}
          {(!historyData?.changes || historyData.changes.length === 0) ? (
            <EmptyState
              icon={<RefreshIcon size={22} />}
              title="No plan changes"
              description="No plan changes have been recorded for this subscription."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historyData.changes.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--color-border, rgba(255,255,255,0.08))'
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: entry.action === 'plan_changed' ? '#4CAF50' : '#5B7CFA'
                  }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {(() => {
                        const oldV = entry.old_value || {}
                        const newV = entry.new_value || {}
                        const oldPlan = (typeof oldV === 'object' ? oldV.plan_name : null) || String(oldV || '')
                        const newPlan = (typeof newV === 'object' ? newV.plan_name : null) || String(newV || '')
                        if (oldPlan && newPlan && oldPlan !== newPlan) return `${oldPlan} → ${newPlan}`
                        if (newPlan) return newPlan
                        return entry.action || entry.description || 'Plan change'
                      })()}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {entry.date ? formatDate(entry.date) : '—'}
                      {entry.performed_by && ` · by ${entry.performed_by}`}
                    </p>
                    {entry.description && (
                      <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        {entry.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

// ─── Plan Change Modal ────────────────────────────────────────────────────────
function ChangePlanModal({ sub, plans, onClose, onSuccess }) {
  const toast = useToast()
  const [selectedPlanId, setSelectedPlanId] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [step, setStep] = useState('select') // 'select' | 'preview'

  async function handlePreview() {
    if (!selectedPlanId) return
    setPreviewing(true)
    try {
      const data = await subscriptionService.previewPlanChange(sub.id, selectedPlanId)
      setPreview(data)
      setStep('preview')
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Failed to calculate proration.' })
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    try {
      await subscriptionService.changePlan(sub.id, selectedPlanId)
      toast.push({ type: 'success', message: 'Plan changed successfully.' })
      onSuccess()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Plan change failed.' })
    } finally {
      setConfirming(false)
    }
  }

  // Use == (loose equality) to handle int vs string mismatch between backend plan IDs
  // eslint-disable-next-line eqeqeq
  const availablePlans = plans.filter((p) => p.id != sub.planId)
  // eslint-disable-next-line eqeqeq
  const selectedPlan = plans.find((p) => p.id == selectedPlanId)

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Change Plan"
      width={500}
      footer={
        step === 'select' ? (
          <>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={previewing}
              onClick={handlePreview}
              disabled={!selectedPlanId}
            >
              Preview Proration
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => { setStep('select'); setPreview(null) }}>Back</Button>
            <Button variant="primary" loading={confirming} onClick={handleConfirm}>
              {preview?.isDowngrade ? 'Confirm Downgrade' : 'Confirm Upgrade'}
            </Button>
          </>
        )
      }
    >
      {step === 'select' && (
        <div className={styles.planChangeBody}>
          {/* Current Plan */}
          <div className={styles.currentPlanBlock}>
            <p className={styles.planChangeLabel}>Current Plan</p>
            <div className={styles.currentPlanCard}>
              <strong>{sub.plan}</strong>
              <span>{formatCurrency(sub.amount)}/month</span>
            </div>
          </div>

          {/* Select new plan */}
          <div>
            <p className={styles.planChangeLabel}>Select New Plan</p>
            <div className={styles.planOptions}>
              {availablePlans.map((plan) => (
                <label
                  key={plan.id}
                  className={[
                    styles.planOption,
                    selectedPlanId === plan.id ? styles.planOptionSelected : '',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="newPlan"
                    value={plan.id}
                    checked={selectedPlanId === plan.id}
                    onChange={() => setSelectedPlanId(typeof plan.id === 'number' ? plan.id : Number(plan.id) || plan.id)}
                    className={styles.planRadio}
                  />
                  <div className={styles.planOptionInfo}>
                    <span className={styles.planOptionName}>{plan.name}</span>
                    <span className={styles.planOptionPrice}>{formatCurrency(plan.price)}/month</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className={styles.planChangeBody}>
          <ProrationSummary preview={preview} />
        </div>
      )}
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Subscriptions() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState([])
  const [actionTarget, setActionTarget] = useState(null)   // { sub, action: 'active' | 'canceled' }
  const [changePlanTarget, setChangePlanTarget] = useState(null)  // sub
  const [historyTarget, setHistoryTarget] = useState(null)  // sub

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await subscriptionService.list({ status, page, pageSize: 8 })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.push({ type: 'error', message: 'Failed to load subscriptions' })
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status])

  useEffect(() => {
    planService.list().then(setPlans).catch(() => {})
  }, [])

  async function handleAction(sub, newStatus) {
    try {
      await subscriptionService.updateStatus(sub.id, newStatus)
      toast.push({
        type: 'success',
        message: newStatus === 'canceled' ? 'Subscription canceled.' : 'Subscription reactivated.',
      })
      setActionTarget(null)
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.message })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Subscriptions</h1>
          <p className={styles.subtitle}>{total} subscriptions found</p>
        </div>
      </div>

      <div className={styles.statusTabs}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={[styles.tab, status === s ? styles.tabActive : ''].join(' ')}
            onClick={() => setStatus(s)}
          >
            {s === 'all' ? 'All' : s === 'past_due' ? 'Past Due' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>ID</span>
          <span>Customer</span>
          <span>Plan</span>
          <span>Amount</span>
          <span>Next Billing</span>
          <span>Status</span>
          <span>Actions</span>
          <span>History</span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tableRow}>
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} height={14} width="80%" />
              ))}
            </div>
          ))
        ) : items.length === 0 ? (
          <EmptyState
            icon={<RefreshIcon size={26} />}
            title="No subscriptions"
            description="No subscriptions match the current filter."
          />
        ) : (
          items.map((sub) => (
            <div key={sub.id} className={styles.tableRow}>
              <span className={styles.mono}>{sub.id}</span>

              <div>
                <p className={styles.custName}>{sub.customerName}</p>
                <p className={styles.custSub}>{sub.company}</p>
              </div>

              <span className={styles.planTag}>{sub.plan}</span>

              <span className={styles.amount}>{formatCurrency(sub.amount)}</span>

              <span className={styles.date}>{formatDate(sub.nextBilling)}</span>

              <Badge status={sub.status} />

              <div className={styles.actions}>
                {sub.status === 'active' && (
                  <button
                    className={styles.iconBtn}
                    title="Change Plan"
                    onClick={() => setChangePlanTarget(sub)}
                  >
                    <LayersIcon size={13} />
                    <span>Change Plan</span>
                  </button>
                )}
                {sub.status === 'canceled' ? (
                  <button
                    className={styles.iconBtn}
                    title="Reactivate"
                    onClick={() => setActionTarget({ sub, action: 'active' })}
                  >
                    <CheckIcon size={13} />
                    <span>Reactivate</span>
                  </button>
                ) : (
                  <button
                    className={[styles.iconBtn, styles.iconBtnDanger].join(' ')}
                    title="Cancel"
                    onClick={() => setActionTarget({ sub, action: 'canceled' })}
                  >
                    <XIcon size={13} />
                    <span>Cancel</span>
                  </button>
                )}
              </div>

              {/* History button — new column */}
              <div>
                <button
                  className={styles.iconBtn}
                  title="View Plan Change History"
                  onClick={() => setHistoryTarget(sub)}
                >
                  <RefreshIcon size={13} />
                  <span>History</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      {/* Cancel / Reactivate modal */}
      <Modal
        isOpen={!!actionTarget}
        onClose={() => setActionTarget(null)}
        title={actionTarget?.action === 'canceled' ? 'Cancel Subscription' : 'Reactivate Subscription'}
        width={400}
        footer={
          <>
            <Button variant="ghost" onClick={() => setActionTarget(null)}>Back</Button>
            <Button
              variant={actionTarget?.action === 'canceled' ? 'danger' : 'primary'}
              onClick={() => handleAction(actionTarget.sub, actionTarget.action)}
            >
              {actionTarget?.action === 'canceled' ? 'Cancel Subscription' : 'Reactivate'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--color-text-secondary)' }}>
          {actionTarget?.action === 'canceled'
            ? `Cancel the subscription for ${actionTarget?.sub?.customerName}?`
            : `Reactivate the subscription for ${actionTarget?.sub?.customerName}?`}
        </p>
      </Modal>

      {/* Change Plan modal */}
      {changePlanTarget && (
        <ChangePlanModal
          sub={changePlanTarget}
          plans={plans}
          onClose={() => setChangePlanTarget(null)}
          onSuccess={() => { setChangePlanTarget(null); load() }}
        />
      )}

      {/* Subscription History modal */}
      {historyTarget && (
        <HistoryModal
          sub={historyTarget}
          onClose={() => setHistoryTarget(null)}
        />
      )}
    </div>
  )
}
