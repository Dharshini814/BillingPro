import { useEffect, useState } from 'react'
import { useLang } from '../hooks/useLang'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../hooks/useToast'
import { planService } from '../services/planService'
import { subscriptionService } from '../services/subscriptionService'
import { formatDate, formatCurrency } from '../utils/formatters'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import { CheckIcon, TrendingUpIcon } from '../components/common/Icons.jsx'
import styles from './MyPlan.module.css'

// ── Proration Preview Card ────────────────────────────────────────────────────
function ProrationPreview({ preview }) {
  if (!preview) return null
  const isCredit = preview.amountDue < 0
  return (
    <div className={styles.prorationCard}>
      <h4 className={styles.prorationTitle}>Plan Change Summary</h4>
      <div className={styles.prorationMeta}>
        <span>{preview.remainingDays} days remaining in billing cycle</span>
      </div>
      <div className={styles.prorationRows}>
        <div className={styles.prorationRow}>
          <span>Unused {preview.currentPlan?.name} Credit</span>
          <span className={styles.credit}>−{formatCurrency(preview.credit)}</span>
        </div>
        <div className={styles.prorationRow}>
          <span>{preview.newPlan?.name} Charge ({preview.remainingDays} days)</span>
          <span className={styles.charge}>+{formatCurrency(preview.charge)}</span>
        </div>
        <div className={[styles.prorationRow, styles.prorationTotal].join(' ')}>
          <strong>Amount Due</strong>
          <strong className={isCredit ? styles.credit : ''}>{formatCurrency(Math.abs(preview.amountDue))}{isCredit ? ' (Credit)' : ''}</strong>
        </div>
      </div>
      <p className={styles.prorationNote}>
        A proration invoice will be generated for the amount due upon confirmation.
      </p>
    </div>
  )
}

// ── Plan History Item ─────────────────────────────────────────────────────────
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
        <p className={styles.historyMeta}>{formatDate(entry.changedAt)} · Adjustment {formatCurrency(entry.amountDue)}</p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyPlan() {
  const { t } = useLang()
  const { user } = useAuth()
  const toast = useToast()

  const [plans, setPlans] = useState([])
  const [billing, setBilling] = useState('monthly')
  const [loading, setLoading] = useState(true)

  // Subscription state (from backend for user)
  const [subscription, setSubscription] = useState(null)
  const [subLoading, setSubLoading] = useState(true)

  // Plan change flow
  const [changingTo, setChangingTo] = useState(null)      // plan object user clicked
  const [step, setStep] = useState('confirm')              // 'confirm' | 'preview'
  const [preview, setPreview] = useState(null)
  const [previewing, setPreviewing] = useState(false)
  const [confirming, setConfirming] = useState(false)

  // Plan change history
  const [history, setHistory] = useState([])

  useEffect(() => {
    planService.list().then(p => { setPlans(p); setLoading(false) })
  }, [])

  // Load user's subscription from backend — scoped to this user by email match
  useEffect(() => {
    async function loadUserSub() {
      if (!user?.email) { setSubLoading(false); return }
      try {
        // Pass customer_email so backend only returns this user's subscriptions
        const res = await subscriptionService.list({ status: 'all', pageSize: 50, customer_email: user.email })
        const items = res.items || []
        const active = items.find(s => ['active', 'trial', 'trialing', 'past_due'].includes(s.status))
        if (active) setSubscription(active)
        else if (items.length > 0) setSubscription(items[0])
      } catch {
        // no subscription found
      } finally {
        setSubLoading(false)
      }
    }
    loadUserSub()
  }, [user?.email])

  const currentPlanName = subscription?.plan || user?.plan || 'Growth'
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
    if (plan.name === currentPlanName) return
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

  async function handleConfirmUpgrade() {
    if (!changingTo || !subscription) {
      // fallback: just mock the switch if no real subscription
      toast.push({ type: 'success', message: `Switched to ${changingTo?.name} plan!` })
      if (changingTo) {
        setHistory(h => [{ oldPlan: currentPlanName, newPlan: changingTo.name, changedAt: new Date().toISOString(), amountDue: preview?.amountDue || 0 }, ...h])
      }
      setChangingTo(null)
      return
    }
    setConfirming(true)
    try {
      const result = await subscriptionService.changePlan(subscription.id, changingTo.id)
      // Update local subscription
      setSubscription(prev => ({ ...prev, plan: changingTo.name, planId: changingTo.id, amount: changingTo.price }))
      // Add to history
      if (result?.proration) {
        setHistory(h => [{
          oldPlan: result.proration.oldPlanName,
          newPlan: result.proration.newPlanName,
          changedAt: new Date().toISOString(),
          amountDue: result.proration.amountDue,
        }, ...h])
      }
      toast.push({ type: 'success', message: `Plan changed to ${changingTo.name} successfully!` })
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
      </div>

      {/* Current plan banner */}
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
            const isCurrent = plan.name === currentPlanName
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
                  {isCurrent ? `✓ ${t('plans.currentPlan')}` : t('plans.getStarted')}
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

      {/* Plan Change Modal — Step 1: Confirm or Step 2: Preview Proration */}
      <Modal
        isOpen={!!changingTo}
        onClose={() => setChangingTo(null)}
        title={step === 'confirm' ? 'Confirm Plan Change' : 'Plan Change Summary'}
        width={460}
        footer={
          step === 'confirm' ? (
            <>
              <Button variant="ghost" onClick={() => setChangingTo(null)}>{t('common.cancel')}</Button>
              {subscription ? (
                <Button variant="primary" loading={previewing} onClick={handlePreviewProration}>
                  Preview Proration
                </Button>
              ) : (
                <Button variant="primary" loading={confirming} onClick={handleConfirmUpgrade}>
                  Switch to {changingTo?.name}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => { setStep('confirm'); setPreview(null) }}>Back</Button>
              <Button variant="primary" loading={confirming} onClick={handleConfirmUpgrade}>
                Confirm Upgrade
              </Button>
            </>
          )
        }
      >
        {step === 'confirm' && (
          <div className={styles.confirmBody}>
            <div className={styles.planChange}>
              <div className={styles.planChip} style={{ background: '#6B728018' }}>{currentPlanName}</div>
              <span className={styles.arrow}>→</span>
              <div className={styles.planChip} style={{ background: `${changingTo?.color}18`, color: changingTo?.color }}>
                {changingTo?.name}
              </div>
            </div>
            <div className={styles.changeSummary}>
              <div className={styles.changeSummaryRow}>
                <span>New monthly price</span>
                <strong>{formatCurrency(price(changingTo || { price: 0 }))}/mo</strong>
              </div>
              {subscription && (
                <p className={styles.prorateHint}>
                  Click "Preview Proration" to see the exact charge for the remaining days in your billing cycle.
                </p>
              )}
              {!subscription && (
                <p className={styles.prorateHint}>
                  Your new plan features will be available immediately after switching.
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
