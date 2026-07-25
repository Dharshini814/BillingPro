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
import styles from './Payments.module.css'

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
          { label: 'Method', value: ['paid','refunded'].includes(pay.status) ? (pay.paymentMethod || 'Card') : '—' },
          { label: 'Amount', value: formatCurrency(pay.amount) },
          { label: 'Date', value: pay.paymentDate ? formatDate(pay.paymentDate) : pay.createdAt ? formatDate(pay.createdAt) : '—' },
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

// ─── Pay Confirm Modal ────────────────────────────────────────────────────────
function PayConfirmModal({ pay, onClose, onConfirm, paying }) {
  if (!pay) return null
  return (
    <Modal
      isOpen={!!pay}
      onClose={onClose}
      title="Confirm Payment"
      width={420}
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
            Your payment is processed securely. Once confirmed, your invoice will be generated automatically.
          </span>
        </div>
        {[
          { label: 'Payment ID', value: `#${pay.id}` },
          { label: 'Amount Due', value: formatCurrency(pay.amount) },
          { label: 'Method', value: 'Card' },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{value}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ─── Payment Result Modal ─────────────────────────────────────────────────────
function PayResultModal({ result, onClose }) {
  if (!result) return null
  const success = result.success
  return (
    <Modal
      isOpen={!!result}
      onClose={onClose}
      title={success ? 'Payment Successful' : 'Payment Failed'}
      width={420}
      footer={
        <Button variant="primary" onClick={onClose} style={{ width: '100%' }}>
          Done
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0 4px' }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          {success
            ? <CheckIcon size={30} style={{ color: '#22c55e' }} />
            : <span style={{ fontSize: 28 }}>✕</span>
          }
        </div>

        {/* Message */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>
            {success ? `${formatCurrency(result.amount)} paid` : 'Payment could not be processed'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
            {success
              ? 'Your payment was successful. Your invoice has been generated and is now available in My Invoices.'
              : 'The payment was declined. Please check your card details or try again. Retries have been scheduled automatically.'}
          </div>
        </div>

        {/* Details */}
        {success && (
          <div style={{ width: '100%', background: 'rgba(var(--color-primary-rgb),0.04)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Transaction ID', value: result.transaction_id },
              { label: 'Reference', value: result.payment_reference },
              { label: 'Status', value: 'Paid' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{label}</span>
                <span style={{ fontWeight: 600, fontFamily: label === 'Status' ? undefined : 'monospace' }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const PAYABLE_STATUSES = ['pending', 'unpaid', 'failed']

export default function MyPayments() {
  const { user } = useAuth()
  const { t } = useLang()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [paying, setPaying] = useState(null)      // payment being confirmed
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState(null)      // result modal data

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    try {
      const res = await paymentService.list({
        pageSize: 8,
        page,
        customer_email: user.email
      })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user?.email, page])

  useEffect(() => { load() }, [load])

  async function handleDownload(pay) {
    if (!pay.invoiceId) return
    try {
      await invoiceService.downloadPdf(pay.invoiceId, `INV-${pay.invoiceId}`)
    } catch {
      // silent
    }
  }

  async function handlePayConfirm() {
    if (!paying) return
    setProcessing(true)
    try {
      const res = await paymentService.process({
        invoice_id: paying.invoiceId,
        amount: paying.amount
      })
      setPaying(null)
      setResult(res)
      load() // refresh list so status updates
    } catch (err) {
      setPaying(null)
      setResult({ success: false, amount: paying.amount, transaction_id: '—', payment_reference: '—' })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('payments.myPayments')}</h1>
          <p className={styles.subtitle}>Payment history for {user?.company || user?.email}</p>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={[styles.tableHead, styles.userTableHead].join(' ')}>
          <span>{t('payments.paymentId')}</span>
          <span>{t('payments.method')}</span>
          <span>{t('invoices.amount')}</span>
          <span>{t('payments.date')}</span>
          <span>{t('customers.status')}</span>
          <span></span>
        </div>

        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={[styles.tableRow, styles.userTableRow].join(' ')}>
                {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : items.length === 0
          ? <EmptyState icon={<CreditCardIcon size={26}/>} title="No payments yet" description="Your payment history will appear here." />
          : items.map((pay) => (
              <div key={pay.id} className={[styles.tableRow, styles.userTableRow].join(' ')}>
                <span className={styles.mono}>{pay.id}</span>
                <span className={styles.method}>
                  {['paid', 'refunded'].includes(pay.status) ? (pay.paymentMethod || 'Card') : '—'}
                </span>
                <span className={styles.amount}>{formatCurrency(pay.amount)}</span>
                <span className={styles.date}>
                  {pay.paymentDate
                    ? formatDate(pay.paymentDate)
                    : pay.createdAt
                    ? formatDate(pay.createdAt)
                    : '—'}
                </span>
                <Badge status={pay.status} />
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  {/* Pay Now — only for unpaid/pending/failed */}
                  {PAYABLE_STATUSES.includes(pay.status) && pay.invoiceId && (
                    <button
                      onClick={() => setPaying(pay)}
                      title="Pay Now"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                        border: 'none', cursor: 'pointer', color: '#fff',
                        padding: '4px 10px', borderRadius: 6, fontSize: 11,
                        fontWeight: 700, letterSpacing: 0.3, display: 'flex',
                        alignItems: 'center', gap: 4, whiteSpace: 'nowrap'
                      }}
                    >
                      <CreditCardIcon size={11} /> Pay Now
                    </button>
                  )}
                  <button
                    onClick={() => setViewing(pay)}
                    title="View"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-primary)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}
                  >
                    <EyeIcon size={15} />
                  </button>
                  <button
                    onClick={() => handleDownload(pay)}
                    title="Download Invoice"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center' }}
                  >
                    <DownloadIcon size={15} />
                  </button>
                </div>
              </div>
            ))
        }
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      <PaymentViewModal pay={viewing} onClose={() => setViewing(null)} onDownload={handleDownload} />
      <PayConfirmModal pay={paying} onClose={() => setPaying(null)} onConfirm={handlePayConfirm} paying={processing} />
      <PayResultModal result={result} onClose={() => setResult(null)} />
    </div>
  )
}
