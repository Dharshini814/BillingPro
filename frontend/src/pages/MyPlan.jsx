import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../hooks/useLang'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { planService } from '../services/planService'
import { subscriptionService } from '../services/subscriptionService'
import api from '../services/api'
import { formatDate, formatCurrency } from '../utils/formatters'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import { CheckIcon, TrendingUpIcon } from '../components/common/Icons.jsx'
import styles from './MyPlan.module.css'

// ── Wallet Badge ──────────────────────────────────────────────────────────────
function WalletBadge({ balance }) {
  if (!balance || balance <= 0) return null
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '6px 14px', borderRadius: 20,
      background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)',
      fontSize: 13, fontWeight: 700, color: '#4CAF50'
    }}>
      💰 Wallet Credit: {formatCurrency(balance)}
    </div>
  )
}

// ── Proration Preview Card ────────────────────────────────────────────────────
function ProrationPreview({ preview }) {
  if (!preview) return null
  const isDowngrade = preview.isDowngrade
  return (
    <div className={styles.prorationCard}>
      <h4 className={styles.prorationTitle}>Plan Change Summary</h4>
      <div className={styles.prorationMeta}>
        <span>{preview.remainingDays} days remaining in billing cycle</span>
      </div>
      <div className={styles.prorationRows}>
        <div className={styles.prorationRow}>
          <span>Unused {preview.currentPlan?.name} credit</span>
          <span className={styles.credit}>−{formatCurrency(preview.credit)}</span>
        </div>
        <div className={styles.prorationRow}>
          <span>{preview.newPlan?.name} charge ({preview.remainingDays} days)</span>
          <span className={styles.charge}>+{formatCurrency(preview.charge)}</span>
        </div>

        {!isDowngrade && preview.walletApplied > 0 && (
          <div className={styles.prorationRow}>
            <span>Wallet credit applied</span>
            <span className={styles.credit}>−{formatCurrency(preview.walletApplied)}</span>
          </div>
        )}

        <div className={[styles.prorationRow, styles.prorationTotal].join(' ')}>
          <strong>{isDowngrade ? 'Credit to Wallet' : 'Amount Due'}</strong>
          <strong className={isDowngrade ? styles.credit : ''}>
            {isDowngrade
              ? `+${formatCurrency(preview.walletCreditAdded)} (added to wallet)`
              : formatCurrency(preview.amountDue)
            }
          </strong>
        </div>
      </div>

      {isDowngrade ? (
        <p className={styles.prorationNote} style={{ color: '#4CAF50' }}>
          ✅ {formatCurrency(preview.walletCreditAdded)} will be added to your wallet. Use it on your next upgrade!
        </p>
      ) : preview.amountDue === 0 ? (
        <p className={styles.prorationNote} style={{ color: '#4CAF50' }}>
          ✅ Your wallet balance fully covers this upgrade — no charge!
        </p>
      ) : (
        <p className={styles.prorationNote}>
          Invoice will be generated. Go to <strong>My Invoices</strong> to pay when ready.
          {preview.walletApplied > 0 && ` Wallet credit of ${formatCurrency(preview.walletApplied)} will be applied on payment!`}
        </p>
      )}
    </div>
  )
}

// ── Plan History Row ──────────────────────────────────────────────────────────
function PlanHistoryRow({ entry }) {
  return (
    <div className={styles.historyRow}>
      <div className={styles.historyDot} />
      <div className={styles.historyBody}>
        <p className={styles.historyTitle}>
          <span className={styles.historyFrom}>{entry.oldPlan}</span>
          <span className={styles.historyArrow}>→</span>
          <span className={styles.historyTo}>{entry.newPlan}</span>
        </p>
        <p className={styles.historyMeta}>
          {formatDate(entry.changedAt)}
          {entry.amountDue > 0 && ` · Charged ${formatCurrency(entry.amountDue)}`}
          {entry.walletCreditAdded > 0 && ` · +${formatCurrency(entry.walletCreditAdded)} to wallet`}
          {entry.walletApplied > 0 && ` · ${formatCurrency(entry.walletApplied)} from wallet`}
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyPlan() {
  const { t } = useLang()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()

  const [plans, setPlans] = useState([])
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState(true)

  const [subscription, setSubscription] = useState(null)
  const [subLoading, setSubLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)

  const [changingTo, setChangingTo] = useState(null)
  const [step, setStep] = useState('confirm')
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const [history, setHistory] = useState([])

  useEffect(() => {
    planService.list().then(p => { setPlans(p); setLoading(false) })
  }, [])

  // Load plan-change history from the API so it survives page refreshes
  const loadHistory = useCallback(async (subId) => {
    if (!subId) return
    try {
      const { data } = await api.get(`/subscriptions/${subId}/history`)
      // Map backend audit-log shape → the shape PlanHistoryRow expects
      const entries = (data.changes || [])
        .filter(c => c.action === 'plan_changed' || c.action === 'plan_change')
        .map(c => {
          // Backend stores old_value/new_value as JSON dicts:
          // old_value: { plan_id, plan_name, amount }
          // new_value: { plan_id, plan_name, amount, credit, charge, amount_due, ... }
          const oldV = c.old_value || {}
          const newV = c.new_value || {}
          const oldPlan = (typeof oldV === 'object' ? oldV.plan_name : null)
            || (typeof oldV === 'string' ? oldV : null)
            || 'Previous Plan'
          const newPlan = (typeof newV === 'object' ? newV.plan_name : null)
            || (typeof newV === 'string' ? newV : null)
            || 'New Plan'
          return {
            oldPlan,
            newPlan,
            changedAt: c.date,
            amountDue: (typeof newV === 'object' ? newV.amount_due : 0) || 0,
            walletCreditAdded: (typeof newV === 'object' ? newV.wallet_credit_added : 0) || 0,
            walletApplied: (typeof newV === 'object' ? newV.wallet_applied : 0) || 0,
          }
        })
      setHistory(entries)
    } catch {
      // history is non-critical — fail silently
    }
  }, [])

  const loadUserSub = useCallback(async () => {
    if (!user?.email) { setSubLoading(false); return }
    try {
      const res = await subscriptionService.list({ status: 'all', pageSize: 50, customer_email: user.email })
      const items = res.items || []
      const active = items.find(s => ['active', 'trial', 'trialing', 'past_due'].includes(s.status))
      if (active) {
        setSubscription(active)
        // Load wallet balance from subscription response or fetch separately
        if (active.walletBalance !== undefined) {
          setWalletBalance(active.walletBalance)
        } else {
          try {
            const { data } = await api.get(`/subscriptions/wallet/${encodeURIComponent(user.email)}`)
            setWalletBalance(data.walletBalance || 0)
          } catch { }
        }
      } else if (items.length > 0) {
        setSubscription(items[0])
      }
    } catch {
      // no subscription
    } finally {
      setSubLoading(false)
    }
  }, [user?.email])

  useEffect(() => { loadUserSub() }, [loadUserSub])

  // Once we have a subscription ID, fetch its change history from the API
  useEffect(() => {
    if (subscription?.id) loadHistory(subscription.id)
  }, [subscription?.id, loadHistory])

  const currentPlanName = subscription?.plan || null
  const renewDate = subscription?.nextBilling
    ? new Date(subscription.nextBilling)
    : new Date(Date.now() + 1000 * 60 * 60 * 24 * 18)
  const daysLeft = Math.max(0, Math.ceil((renewDate - Date.now()) / (1000 * 60 * 60 * 24)))

  const usageData = [
    { label: 'API Calls', used: 3240, total: 5000, color: '#D4A800' },
    { label: 'Team Seats', used: 3, total: 10, color: '#4CAF50' },
    { label: 'Storage (GB)', used: 4.2, total: 20, color: '#FFB547' },
  ]

  function handleSelect(plan) {
    if (subscription && plan.name === subscription.plan) return
    setChangingTo(plan)
    setStep('confirm')
    setPreview(null)
  }

  async function handlePreviewProration() {
    if (!changingTo || !subscription) return
    setPreviewing(true)
    try {
      const data = await subscriptionService.previewPlanChange(subscription.id, changingTo.id)
      setPreview(data)
      setStep('preview')
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Failed to calculate proration.' })
    } finally {
      setPreviewing(false)
    }
  }

  // ── NEW SUBSCRIPTION FLOW ────────────────────────────────────────────────────
  async function handleNewSubscription() {
    if (!changingTo || !user?.email) return
    setConfirming(true)
    try {
      // Resolve customer by email
      let customer
      try {
        const { data } = await api.get(`/customers/by-email/${encodeURIComponent(user.email)}`)
        customer = data
      } catch {
        customer = null
      }
      if (!customer) {
        toast.push({ type: 'error', message: 'Account setup incomplete. Please sign out and sign in again.' })
        return
      }

      // Create subscription — backend auto-generates invoice AND marks it paid
      const result = await subscriptionService.create({
        customerId: customer.id,
        planId: changingTo.id,
        status: 'active',
        amount: changingTo.price,
        billingCycle: 'monthly',
        startDate: new Date().toISOString().split('T')[0],
      })

      setSubscription(result)
      if (result.walletBalance !== undefined) setWalletBalance(result.walletBalance)

      toast.push({
        type: 'success',
        message: `🎉 Subscribed to ${changingTo.name}! An invoice has been generated — go to My Invoices to complete payment.`
      })

      setChangingTo(null)
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Failed to subscribe. Please try again.' })
    } finally {
      setConfirming(false)
    }
  }

  // ── PLAN CHANGE FLOW (existing subscription) ─────────────────────────────────
  async function handleConfirmUpgrade() {
    if (!changingTo || !subscription) {
      await handleNewSubscription()
      return
    }
    setConfirming(true)
    try {
      const result = await subscriptionService.changePlan(subscription.id, changingTo.id)
      setSubscription(prev => ({ ...prev, plan: changingTo.name, planId: changingTo.id, amount: changingTo.price }))

      const p = result?.proration || {}
      const newWallet = p.walletBalanceAfter !== undefined ? p.walletBalanceAfter : walletBalance
      setWalletBalance(newWallet)

      // Optimistically prepend for immediate feedback; then sync from API
      setHistory(h => [{
        oldPlan: p.oldPlanName || currentPlanName,
        newPlan: p.newPlanName || changingTo.name,
        changedAt: new Date().toISOString(),
        amountDue: p.amountDue || 0,
        walletCreditAdded: p.walletCreditAdded || 0,
        walletApplied: p.walletApplied || 0,
      }, ...h])
      // Reload from API after a short delay so the audit log is committed
      setTimeout(() => loadHistory(subscription?.id), 800)

      if (p.isDowngrade) {
        toast.push({
          type: 'success',
          message: `Plan changed to ${changingTo.name}. ${formatCurrency(p.walletCreditAdded)} added to your wallet! 💰`
        })
      } else if (p.amountDue === 0) {
        toast.push({ type: 'success', message: `Plan changed to ${changingTo.name}! Wallet covered the full cost. 🎉` })
      } else {
        const saved = p.walletApplied > 0 ? ` (Wallet saved ${formatCurrency(p.walletApplied)})` : ''
        toast.push({ type: 'success', message: `Plan changed to ${changingTo.name}! Invoice generated — go to My Invoices to pay.${saved}` })
      }

      setChangingTo(null)
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Plan change failed.' })
    } finally {
      setConfirming(false)
    }
  }

  const price = (plan) => billing === 'annual' ? Math.round(plan.price * 0.8) : plan.price

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('plans.choosePlan')}</h1>
          <p className={styles.subtitle}>{t('plans.choosePlanSubtitle')}</p>
        </div>
        <WalletBadge balance={walletBalance} />
      </div>

      {/* Current plan banner */}
      {subscription && (
        <div className={styles.currentBanner}>
          <div className={styles.bannerLeft}>
            <TrendingUpIcon size={20} style={{ color: '#D4A800' }} />
            <div>
              <p className={styles.bannerTitle}>
                {t('subscriptions.currentPlan')}: <strong>{currentPlanName}</strong>
              </p>
              <p className={styles.bannerSub}>
                {t('subscriptions.renewsOn')} {formatDate(renewDate)} · {daysLeft} {t('subscriptions.daysLeft')}
              </p>
            </div>
          </div>
          <div className={styles.usageRow}>
            {usageData.map(u => (
              <div key={u.label} className={styles.usageItem}>
                <div className={styles.usageLabel}>{u.label}</div>
                <div className={styles.usageBar}>
                  <div className={styles.usageFill} style={{ width: `${(u.used / u.total) * 100}%`, background: u.color }} />
                </div>
                <div className={styles.usageVal}>{u.used.toLocaleString()} / {u.total.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trial / unpaid invoice notice */}
      {subscription && subscription.status === 'trial' && (
        <div style={{
          padding: '14px 20px', borderRadius: 12,
          background: 'rgba(245,197,24,0.1)', border: '1.5px solid rgba(245,197,24,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <strong style={{ color: '#D4A800', fontSize: 14 }}>⏳ Trial Period Active</strong>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '3px 0 0' }}>
              Your invoice is unpaid. Pay within {daysLeft} days to keep your subscription active.
              {walletBalance > 0 && ` 💰 Wallet credit of ${formatCurrency(walletBalance)} will be auto-applied.`}
            </p>
          </div>
          <button
            onClick={() => navigate('/my-invoices')}
            style={{ padding: '8px 18px', borderRadius: 8, background: '#D4A800', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
          >
            Pay Invoice →
          </button>
        </div>
      )}

      {/* No subscription notice */}
      {!subLoading && !subscription && (
        <div className={styles.currentBanner} style={{ justifyContent: 'center' }}>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            You don't have an active subscription yet. Choose a plan below to get started.
          </p>
        </div>
      )}

      {/* Billing toggle */}
      <div className={styles.billingToggle}>
        <button className={[styles.toggleBtn, billing === 'monthly' ? styles.toggleActive : ''].join(' ')}
          onClick={() => setBilling('monthly')}>{t('plans.monthlyBilling')}</button>
        <button className={[styles.toggleBtn, billing === 'annual' ? styles.toggleActive : ''].join(' ')}
          onClick={() => setBilling('annual')}>
          {t('plans.annualBilling')}
          <span className={styles.saveBadge}>{t('plans.savePercent')}</span>
        </button>
      </div>

      {/* Plan cards */}
      {loading ? (
        <div className={styles.grid}>
          {[1, 2, 3, 4].map(n => <div key={n} className={styles.skeletonCard} />)}
        </div>
      ) : (
        <div className={styles.grid}>
          {plans.map((plan) => {
            const isCurrent = subscription && plan.name === subscription.plan
            const isPopular = plan.name === 'Growth'
            return (
              <div key={plan.id}
                className={[styles.planCard, isCurrent ? styles.currentCard : '', isPopular ? styles.popularCard : ''].join(' ')}
                style={{ '--plan-color': plan.color }}>
                {isPopular && <div className={styles.popularBadge}>{t('plans.mostPopular')}</div>}
                {isCurrent && <div className={styles.currentBadge}>{t('plans.currentPlan')}</div>}

                <div className={styles.planTop} style={{ borderTopColor: plan.color }}>
                  <h3 className={styles.planName}>{plan.name}</h3>
                  <div className={styles.planPrice}>
                    <span className={styles.currency}>$</span>
                    <span className={styles.amount}>{price(plan)}</span>
                    <span className={styles.per}>{t('plans.perMonth')}</span>
                  </div>
                  {billing === 'annual' && (
                    <p className={styles.annualNote}>{t('plans.billedAnnually')} ${price(plan) * 12}/yr</p>
                  )}
                </div>

                <ul className={styles.features}>
                  {(plan.features || []).map(f => (
                    <li key={f} className={styles.feature}>
                      <CheckIcon size={14} style={{ color: plan.color, flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={isCurrent ? 'ghost' : 'primary'}
                  full
                  onClick={() => handleSelect(plan)}
                  style={!isCurrent ? { background: `linear-gradient(135deg, ${plan.color}, ${plan.color}cc)` } : {}}
                >
                  {isCurrent ? `✓ ${t('plans.currentPlan')}` : subscription ? t('plans.getStarted') : 'Subscribe'}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {/* Plan Change History */}
      {history.length > 0 && (
        <div className={styles.historySection}>
          <h3 className={styles.historyHeading}>Previous Plan Changes</h3>
          <div className={styles.historyList}>
            {history.map((entry, i) => (
              <PlanHistoryRow key={i} entry={entry} />
            ))}
          </div>
        </div>
      )}

      {/* Plan Change / Subscribe Modal */}
      <Modal
        isOpen={!!changingTo}
        onClose={() => setChangingTo(null)}
        title={
          !subscription
            ? `Subscribe to ${changingTo?.name}`
            : step === 'confirm' ? 'Confirm Plan Change' : 'Plan Change Summary'
        }
        width={480}
        footer={
          step === 'confirm' ? (
            <>
              <Button variant="ghost" onClick={() => setChangingTo(null)}>{t('common.cancel')}</Button>
              {subscription ? (
                <Button variant="primary" loading={previewing} onClick={handlePreviewProration}>
                  Preview Proration
                </Button>
              ) : (
                <Button variant="primary" loading={confirming} onClick={handleNewSubscription}>
                  Subscribe
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setStep('confirm'); setPreview(null) }}>Back</Button>
              <Button variant="primary" loading={confirming} onClick={handleConfirmUpgrade}>
                {preview?.isDowngrade ? 'Confirm Downgrade' : 'Confirm Upgrade'}
              </Button>
            </>
          )
        }
      >
        {step === 'confirm' && (
          <div className={styles.confirmBody}>
            <div className={styles.planChange}>
              {subscription && (
                <>
                  <div className={styles.planChip} style={{ background: '#6B728018' }}>{currentPlanName}</div>
                  <span className={styles.arrow}>→</span>
                </>
              )}
              <div className={styles.planChip} style={{ background: `${changingTo?.color}18`, color: changingTo?.color }}>
                {changingTo?.name}
              </div>
            </div>
            <div className={styles.changeSummary}>
              <div className={styles.changeSummaryRow}>
                <span>Monthly price</span>
                <strong>{formatCurrency(price(changingTo || { price: 0 }))}/mo</strong>
              </div>
              {walletBalance > 0 && (
                <div className={styles.changeSummaryRow} style={{ color: '#4CAF50' }}>
                  <span>💰 Wallet balance</span>
                  <strong>{formatCurrency(walletBalance)}</strong>
                </div>
              )}
              {subscription ? (
                <p className={styles.prorateHint}>
                  Click "Preview Proration" to see the exact charge (or credit) for the remaining days in your billing cycle.
                </p>
              ) : (
                <p className={styles.prorateHint}>
                  An invoice will be generated with a 7-day trial window. Head to <strong>My Invoices</strong> to complete payment.
                  {walletBalance > 0 && ` Your wallet balance of ${formatCurrency(walletBalance)} will be auto-applied.`}
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className={styles.confirmBody}>
            <div className={styles.planChange}>
              <div className={styles.planChip} style={{ background: '#6B728018' }}>{currentPlanName}</div>
              <span className={styles.arrow}>→</span>
              <div className={styles.planChip} style={{ background: `${changingTo?.color}18`, color: changingTo?.color }}>
                {changingTo?.name}
              </div>
            </div>
            <ProrationPreview preview={preview} />
          </div>
        )}
      </Modal>
    </div>
  )
}
