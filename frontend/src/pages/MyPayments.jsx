import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../hooks/useLang'
import { paymentService } from '../services/paymentService'
import { invoiceService } from '../services/invoiceService'
import { formatDate, formatCurrency } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Modal from '../components/common/Modal.jsx'
import Button from '../components/common/Button.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Pagination from '../components/common/Pagination.jsx'
import { CreditCardIcon, EyeIcon, DownloadIcon, CheckIcon, ShieldIcon } from '../components/common/Icons.jsx'
import api from '../services/api.js'
import styles from './Payments.module.css'

const STATUS_TABS = ['all', 'unpaid', 'paid', 'failed', 'refunded']

// ─── View Modal ───────────────────────────────────────────────────────────────
function PaymentViewModal({ pay, onClose, onDownload }) {
  if (!pay) return null
  return (
    <Modal
      isOpen={!!pay}
      onClose={onClose}
      title={`Payment #${pay.id}`}
      width={460}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {pay.invoiceId && (
            <Button variant="primary" onClick={() => onDownload(pay)}>
              <DownloadIcon size={14} style={{ marginRight: 4 }} /> Download Invoice
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>Payment #{pay.id}</div>
          <Badge status={pay.status} />
        </div>
        {[
          { label: 'Invoice', value: pay.invoiceNumber || (pay.invoiceId ? `#${pay.invoiceId}` : '—') },
          { label: 'Method', value: pay.paymentMethod || '—' },
          { label: 'Amount', value: formatCurrency(pay.amount) },
          { label: 'Due Date', value: pay.dueDate ? formatDate(pay.dueDate) : '—' },
          { label: 'Paid Date', value: pay.paymentDate ? formatDate(pay.paymentDate) : '—' },
          { label: 'Reference', value: pay.paymentReference || '—' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Refund Request Modal ─────────────────────────────────────────────────────
function RefundModal({ pay, onClose, onConfirm, processing, reason, onReasonChange }) {
  if (!pay) return null
  return (
    <Modal
      isOpen={!!pay}
      onClose={onClose}
      title="Request Refund"
      width={440}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button variant="primary" loading={processing} onClick={onConfirm}
            style={{ background: 'linear-gradient(135deg,#9c27b0,#ba68c8)' }}>
            Submit Refund Request
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '12px 16px', background: 'rgba(156,39,176,0.06)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, border: '1px solid rgba(156,39,176,0.18)' }}>
          💜 Your refund request will be reviewed by our team. You'll be notified once it's approved and processed.
        </div>
        {[
          { label: 'Invoice', value: pay.invoiceNumber || `#${pay.invoiceId}` },
          { label: 'Amount Paid', value: formatCurrency(pay.amount) },
          { label: 'Method', value: pay.paymentMethod || 'Card' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{value}</span>
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Reason for Refund
          </label>
          <input
            value={reason}
            onChange={e => onReasonChange(e.target.value)}
            placeholder="e.g. Service not as expected, accidental purchase…"
            style={{
              width: '100%', boxSizing: 'border-box', padding: '10px 14px',
              borderRadius: 10, border: '1.5px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text)',
              fontSize: 14, outline: 'none', boxShadow: 'var(--shadow-pressed)'
            }}
          />
        </div>
      </div>
    </Modal>
  )
}

// ─── Pay Confirm Modal ────────────────────────────────────────────────────────
function PayConfirmModal({ pay, onClose, onConfirm, paying, selectedMethod, setSelectedMethod }) {
  if (!pay) return null
  return (
    <Modal isOpen={!!pay} onClose={onClose} title="Confirm Payment" width={440}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose} disabled={paying}>Cancel</Button>
          <Button variant="primary" loading={paying} onClick={onConfirm}>
            <CreditCardIcon size={14} style={{ marginRight: 6 }} />
            Pay {formatCurrency(pay.amount)}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'rgba(var(--color-primary-rgb),0.06)', borderRadius: 12 }}>
          <ShieldIcon size={20} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            Your payment is processed securely.
          </span>
        </div>
        {[
          { label: 'Invoice', value: pay.invoiceNumber || `#${pay.invoiceId}` },
          { label: 'Amount Due', value: formatCurrency(pay.amount) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{value}</span>
          </div>
        ))}

        {/* Payment Method Selector */}
        <div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10, fontWeight: 600 }}>
            Payment Method
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'UPI', icon: '📱', label: 'UPI' },
              { id: 'Credit Card', icon: '💳', label: 'Credit Card' },
              { id: 'Wallet', icon: '💰', label: 'Wallet' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMethod(m.id)}
                style={{
                  flex: 1,
                  padding: '9px 8px',
                  borderRadius: 10,
                  border: selectedMethod === m.id
                    ? '2px solid var(--color-primary)'
                    : '1.5px solid var(--color-border)',
                  background: selectedMethod === m.id
                    ? 'rgba(var(--color-primary-rgb),0.08)'
                    : 'transparent',
                  color: selectedMethod === m.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                  fontWeight: selectedMethod === m.id ? 700 : 500,
                  fontSize: 12,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 20 }}>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}

function PayResultModal({ result, onClose }) {
  if (!result) return null
  const success = result.success
  return (
    <Modal isOpen={!!result} onClose={onClose} title={success ? 'Payment Successful' : 'Payment Failed'} width={420}
      footer={<Button variant="primary" onClick={onClose} style={{ width: '100%' }}>Done</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0 4px' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {success ? <CheckIcon size={30} style={{ color: '#22c55e' }} /> : <span style={{ fontSize: 28 }}>✕</span>}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {success ? `${formatCurrency(result.amount)} paid` : 'Payment could not be processed'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {success
              ? <span>Payment successful! Your subscription is now <strong>active</strong>.{result.walletApplied > 0 && <> Wallet credit of <strong>{formatCurrency(result.walletApplied)}</strong> was applied.</>}</span>
              : 'Payment was declined. Please try again.'}
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PAYABLE_STATUSES = ['pending', 'unpaid', 'failed']
const COLS = '1.2fr 1.6fr 1.1fr 1.2fr 1.4fr 1fr 120px'

export default function MyPayments() {
  const { user } = useAuth()
  const { t } = useLang()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [paying, setPaying] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState('UPI')
  const [refunding, setRefunding] = useState(null)
  const [refundProcessing, setRefundProcessing] = useState(false)
  const [refundReason, setRefundReason] = useState('')

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    try {
      const res = await paymentService.list({
        pageSize: 8,
        page,
        customer_email: user.email,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {})
      })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user?.email, page, statusFilter])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [statusFilter])

  async function handleDownload(pay) {
    if (!pay.invoiceId) return
    try { await invoiceService.downloadPdf(pay.invoiceId, `INV-${pay.invoiceId}`) } catch { }
  }

  async function handlePayConfirm() {
    if (!paying) return
    setProcessing(true)
    try {
      // Use the dedicated pay endpoint which applies wallet credit and activates subscription
      const { data } = await api.post(`/invoices/${paying.invoiceId}/pay`, { payment_method: selectedMethod })
      setPaying(null)
      setResult({ success: true, amount: data.amount, walletApplied: data.walletApplied, message: data.message })
      load()
    } catch {
      // Fallback to payment process
      try {
        const res = await paymentService.process({ invoice_id: paying.invoiceId, amount: paying.amount })
        setPaying(null)
        setResult(res)
        load()
      } catch {
        setPaying(null)
        setResult({ success: false, amount: paying?.amount })
      }
    } finally {
      setProcessing(false)
    }
  }

  async function handleRefundConfirm() {
    if (!refunding) return
    setRefundProcessing(true)
    try {
      await api.post('/refunds/request', {
        invoice_id: refunding.invoiceId,
        reason: refundReason || 'Customer requested refund',
      })
      setRefunding(null)
      setRefundReason('')
      toast.push({ type: 'success', message: '✅ Refund request submitted. Awaiting admin approval.' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Failed to submit refund request' })
      setRefunding(null)
    } finally {
      setRefundProcessing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Payments</h1>
          <p className={styles.subtitle}>{total} invoice{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className={styles.statusTabs}>
        {STATUS_TABS.map(s => (
          <button key={s} className={[styles.tab, statusFilter === s ? styles.tabActive : ''].join(' ')}
            style={{ cursor: 'pointer' }} onClick={() => setStatusFilter(s)}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: COLS }}>
          <span>INVOICE</span>
          <span>CUSTOMER</span>
          <span>AMOUNT</span>
          <span>DUE DATE</span>
          <span>PAYMENT METHOD</span>
          <span>STATUS</span>
          <span>ACTIONS</span>
        </div>

        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
                {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : items.length === 0
          ? <EmptyState icon={<CreditCardIcon size={26}/>} title="No payments yet" description="Your payment history will appear here." />
          : items.map((pay) => (
              <div key={pay.id} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
                <span className={styles.mono}>{pay.invoiceNumber || (pay.invoiceId ? `INV-${String(pay.invoiceId).padStart(5,'0')}` : `#${pay.id}`)}</span>
                <span className={styles.custName}>{pay.customer || user?.full_name || user?.name || '—'}</span>
                <span className={styles.amount}>{formatCurrency(pay.amount)}</span>
                <span className={styles.date}>{pay.dueDate ? formatDate(pay.dueDate) : (pay.paymentDate ? formatDate(pay.paymentDate) : '—')}</span>
                <span className={styles.method}>{pay.paymentMethod || '—'}</span>
                <Badge status={pay.status} />
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Refund button for paid payments */}
                  {(pay.status === 'paid' || pay.paymentStatus === 'paid') && pay.invoiceId && (
                    <button
                      onClick={() => setRefunding(pay)}
                      style={{
                        background: 'none', border: '1px solid var(--color-border)',
                        cursor: 'pointer', color: 'var(--color-text-secondary)',
                        padding: '3px 8px', borderRadius: 6, fontSize: 11,
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3
                      }}
                      title="Request Refund"
                    >
                      ↩ Refund
                    </button>
                  )}
                  {/* Pay Now for unpaid/pending/failed */}
                  {(PAYABLE_STATUSES.includes(pay.status) || PAYABLE_STATUSES.includes(pay.paymentStatus)) && pay.invoiceId && (
                    <button
                      onClick={() => setPaying(pay)}
                      style={{
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                        border: 'none', cursor: 'pointer', color: '#fff',
                        padding: '4px 10px', borderRadius: 6, fontSize: 11,
                        fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      <CreditCardIcon size={11} /> Pay
                    </button>
                  )}
                  <button onClick={() => setViewing(pay)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                    <EyeIcon size={15} />
                  </button>
                  <button onClick={() => handleDownload(pay)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}>
                    <DownloadIcon size={15} />
                  </button>
                </div>
              </div>
            ))
        }
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      <PaymentViewModal pay={viewing} onClose={() => setViewing(null)} onDownload={handleDownload} />
      <PayConfirmModal pay={paying} onClose={() => { setPaying(null); setSelectedMethod('UPI') }} onConfirm={handlePayConfirm} paying={processing} selectedMethod={selectedMethod} setSelectedMethod={setSelectedMethod} />
      <PayResultModal result={result} onClose={() => setResult(null)} />
      <RefundModal pay={refunding} onClose={() => { setRefunding(null); setRefundReason('') }} onConfirm={handleRefundConfirm} processing={refundProcessing} reason={refundReason} onReasonChange={setRefundReason} />
    </div>
  )
}
