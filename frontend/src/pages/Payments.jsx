import { useCallback, useEffect, useState } from 'react'
import { paymentService } from '../services/paymentService'
import api from '../services/api.js'
import { useToast } from '../hooks/useToast'
import { formatDateTime, formatCurrency } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Modal from '../components/common/Modal.jsx'
import { CreditCardIcon, RefundIcon } from '../components/common/Icons.jsx'
import styles from './Payments.module.css'


const STATUSES = ['all', 'paid', 'failed', 'pending', 'refunded']


export default function Payments() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  // Refund state
  const [refundTarget, setRefundTarget] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [issuing, setIssuing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await paymentService.list({ status, page, pageSize: 8 })
      setItems(res.items)
      setTotal(res.total)
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status])


  function openRefundModal(pay) {
    setRefundTarget(pay)
    setRefundAmount(String(pay.amount || ''))
    setRefundReason('Customer requested refund')
  }

  async function handleRefund() {
    if (!refundTarget) return
    setIssuing(true)
    try {
      // Use real refund API (Task 4 backend)
      await api.post('/refunds', {
        invoice_id: refundTarget.invoiceId,
        refund_amount: parseFloat(refundAmount),
        reason: refundReason,
      })
      toast.push({ type: 'success', message: `Refund of ${formatCurrency(parseFloat(refundAmount))} issued successfully.` })
      setRefundTarget(null)
      load()
    } catch (err) {
      // Fallback to old method if invoiceId not available
      try {
        await paymentService.refund(refundTarget.id)
        toast.push({ type: 'success', message: `Refund issued for ${formatCurrency(refundTarget.amount)}.` })
        setRefundTarget(null)
        load()
      } catch (err2) {
        toast.push({ type: 'error', message: err?.response?.data?.detail || err2.message || 'Refund failed' })
      }
    } finally {
      setIssuing(false)
    }
  }


  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Payments</h1>
          <p className={styles.subtitle}>{total} transactions</p>
        </div>
      </div>

      <div className={styles.statusTabs}>
        {STATUSES.map((s) => (
          <button
            key={s}
            className={[styles.tab, status === s ? styles.tabActive : ''].join(' ')}
            onClick={() => setStatus(s)}
          >
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Payment ID</span>
          <span>Customer</span>
          <span>Method</span>
          <span>Amount</span>
          <span>Date</span>
          <span>Status</span>
          <span></span>
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
            icon={<CreditCardIcon size={26} />}
            title="No payments"
            description="No transactions match this filter."
          />
        ) : (
          items.map((pay) => (
            <div key={pay.id} className={styles.tableRow}>
              <span className={styles.mono}>{pay.id}</span>
              <span className={styles.custName}>{pay.customer}</span>
              <span className={styles.method}>{pay.paymentMethod}</span>
              <span className={styles.amount}>{formatCurrency(pay.amount)}</span>
              <span className={styles.date}>
                {pay.paymentDate ? formatDateTime(pay.paymentDate) : '—'}
              </span>
              <Badge status={pay.status} />
              {pay.status === 'paid' ? (
                <button
                  className={styles.refundBtn}
                  onClick={() => openRefundModal(pay)}
                  title="Issue refund"
                >
                  <RefundIcon size={15} />
                </button>
              ) : (
                <span />
              )}
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      {/* Refund Modal */}
      <Modal
        isOpen={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Issue Refund"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundTarget(null)} disabled={issuing}>Cancel</Button>
            <Button variant="danger" loading={issuing} onClick={handleRefund}>Issue Refund</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(var(--color-primary-rgb),0.05)', borderRadius: 12, padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Customer</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{refundTarget?.customer}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Paid Amount</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{formatCurrency(refundTarget?.amount)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund Amount</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--color-text)', boxShadow: 'var(--shadow-pressed)', outline: 'none' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</label>
            <input
              type="text"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--color-text)', boxShadow: 'var(--shadow-pressed)', outline: 'none' }}
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
