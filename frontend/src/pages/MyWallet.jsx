import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { invoiceService } from '../services/invoiceService'
import { formatDate, formatCurrency } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Modal from '../components/common/Modal.jsx'
import Button from '../components/common/Button.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Pagination from '../components/common/Pagination.jsx'
import api from '../services/api.js'
import styles from './Payments.module.css'

const COLS = '1.2fr 1.4fr 1.1fr 1.1fr 1.2fr 1fr 120px'

// ── Refund Request Modal ─────────────────────────────────────────────────────
function RefundRequestModal({ inv, onClose, onConfirm, processing }) {
  if (!inv) return null
  return (
    <Modal isOpen={!!inv} onClose={onClose} title="Request Refund" width={440}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button variant="primary" loading={processing} onClick={onConfirm}
            style={{ background: 'linear-gradient(135deg,#FF5A5A,#ff8080)' }}>
            Submit Request
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '12px 16px', background: 'rgba(255,165,0,0.08)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, border: '1px solid rgba(255,165,0,0.2)' }}>
          ⏳ Your refund request will be reviewed by an admin. Once approved, a prorated refund will be credited to your original payment method.
        </div>
        {[
          { label: 'Invoice', value: inv.number },
          { label: 'Plan', value: inv.planName || '—' },
          { label: 'Total Paid', value: formatCurrency(inv.amount) },
          { label: 'Issued', value: formatDate(inv.issuedAt) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

// ── Wallet Balance Hero Card ─────────────────────────────────────────────────
function WalletCard({ balance, transactions, loading }) {
  return (
    <div style={{
      borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(76,175,80,0.12) 0%, rgba(76,175,80,0.04) 100%)',
      border: '1.5px solid rgba(76,175,80,0.25)',
      padding: '24px 28px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            💰 Wallet Balance
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#4CAF50', letterSpacing: '-0.5px' }}>
            {formatCurrency(balance)}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            {balance > 0
              ? '✅ This credit will be auto-applied on your next plan upgrade.'
              : 'Downgrade a plan to earn wallet credits.'}
          </div>
        </div>
        <div style={{
          padding: '10px 18px', borderRadius: 10,
          background: balance > 0 ? 'rgba(76,175,80,0.15)' : 'rgba(0,0,0,0.05)',
          border: '1px solid rgba(76,175,80,0.2)',
          fontSize: 13, fontWeight: 600, color: balance > 0 ? '#4CAF50' : 'var(--color-text-secondary)'
        }}>
          {balance > 0 ? 'Available to use' : 'No balance yet'}
        </div>
      </div>

      <div style={{ marginTop: 20, borderTop: '1px solid rgba(76,175,80,0.15)', paddingTop: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--color-text-primary)' }}>
          Wallet Transaction History
        </div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2].map(i => <Skeleton key={i} height={36} width="100%" />)}
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', padding: '8px 0' }}>
            No wallet transactions yet. Downgrade a plan to earn credits.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transactions.map((tx, i) => (
              <div key={tx.id ?? i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', borderRadius: 10,
                background: tx.type === 'credit' ? 'rgba(76,175,80,0.08)' : 'rgba(255,90,90,0.06)',
                border: `1px solid ${tx.type === 'credit' ? 'rgba(76,175,80,0.15)' : 'rgba(255,90,90,0.12)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 16 }}>{tx.type === 'credit' ? '⬆️' : '⬇️'}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {tx.description}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                      {tx.date ? formatDate(tx.date) : '—'}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: tx.type === 'credit' ? '#4CAF50' : '#FF5A5A' }}>
                  {tx.type === 'credit' ? '+' : '−'}{formatCurrency(tx.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Refund status badge helper ───────────────────────────────────────────────
function RefundStatusChip({ status }) {
  const map = {
    pending_approval: { bg: 'rgba(255,165,0,0.12)', color: '#F59E0B', label: 'Pending Approval' },
    completed:        { bg: 'rgba(76,175,80,0.12)',  color: '#4CAF50', label: 'Completed' },
    rejected:         { bg: 'rgba(255,90,90,0.12)',  color: '#FF5A5A', label: 'Rejected' },
    failed:           { bg: 'rgba(255,90,90,0.12)',  color: '#FF5A5A', label: 'Failed' },
  }
  const s = map[status] || map.completed
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color
    }}>
      {s.label}
    </span>
  )
}

export default function MyWallet() {
  const { user } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [refundInv, setRefundInv] = useState(null)
  const [processing, setProcessing] = useState(false)
  const [requestError, setRequestError] = useState('')
  const [refunds, setRefunds] = useState([])
  const [refundTotal, setRefundTotal] = useState(0)
  const [refundPage, setRefundPage] = useState(1)
  const [refundLoading, setRefundLoading] = useState(true)
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletTxns, setWalletTxns] = useState([])
  const [walletTxLoading, setWalletTxLoading] = useState(true)
  // Track which invoice IDs already have a pending request
  const [pendingInvoiceIds, setPendingInvoiceIds] = useState(new Set())

  useEffect(() => {
    if (!user?.email) return
    setWalletTxLoading(true)
    api.get(`/subscriptions/wallet/${encodeURIComponent(user.email)}/transactions`)
      .then(({ data }) => {
        setWalletBalance(data.walletBalance || 0)
        setWalletTxns(data.transactions || [])
      })
      .catch(() => {
        api.get(`/subscriptions/wallet/${encodeURIComponent(user.email)}`)
          .then(({ data }) => setWalletBalance(data.walletBalance || 0))
          .catch(() => {})
      })
      .finally(() => setWalletTxLoading(false))
  }, [user?.email])

  const loadInvoices = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    try {
      const res = await invoiceService.list({ pageSize: 8, page, status: 'paid', customer_email: user.email })
      setInvoices(res.items)
      setTotal(res.total)
    } catch { } finally { setLoading(false) }
  }, [user?.email, page])

  const loadRefunds = useCallback(async () => {
    if (!user?.email) return
    setRefundLoading(true)
    try {
      const { data } = await api.get('/refunds', { params: { pageSize: 8, page: refundPage, customer_email: user.email } })
      const items = data.items || []
      setRefunds(items)
      setRefundTotal(data.total || items.length)
      // Track pending invoice IDs so the button shows "Pending"
      const pending = new Set(
        items.filter(r => r.status === 'pending_approval').map(r => r.invoiceId)
      )
      setPendingInvoiceIds(pending)
    } catch { } finally { setRefundLoading(false) }
  }, [user?.email, refundPage])

  useEffect(() => { loadInvoices() }, [loadInvoices])
  useEffect(() => { loadRefunds() }, [loadRefunds])

  async function handleRefundRequest() {
    if (!refundInv) return
    setProcessing(true)
    setRequestError('')
    try {
      await api.post('/refunds/request', { invoice_id: refundInv.id })
      setRefundInv(null)
      loadInvoices()
      loadRefunds()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Failed to submit refund request'
      setRequestError(msg)
    } finally { setProcessing(false) }
  }

  function openRefundModal(inv) {
    setRequestError('')
    setRefundInv(inv)
  }

  const totalRefunded = refunds
    .filter(r => r.status === 'completed')
    .reduce((s, r) => s + (r.refundAmount || r.amount || 0), 0)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Wallet & Refunds</h1>
          <p className={styles.subtitle}>Your wallet credits from plan downgrades, and refund history</p>
        </div>
        {totalRefunded > 0 && (
          <div style={{ padding: '10px 18px', borderRadius: 10, background: 'rgba(var(--color-primary-rgb),0.08)', border: '1px solid rgba(var(--color-primary-rgb),0.2)', fontSize: 14, fontWeight: 700, color: 'var(--color-primary)' }}>
            Total Refunded: {formatCurrency(totalRefunded)}
          </div>
        )}
      </div>

      {/* ── Wallet Hero ── */}
      <WalletCard balance={walletBalance} transactions={walletTxns} loading={walletTxLoading} />

      {/* Paid Invoices — eligible for refund request */}
      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>Paid Invoices</div>
      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: COLS }}>
          <span>INVOICE #</span>
          <span>PLAN</span>
          <span>SUBTOTAL</span>
          <span>TAX</span>
          <span>TOTAL</span>
          <span>ISSUED</span>
          <span>ACTION</span>
        </div>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
                {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : invoices.length === 0
          ? <EmptyState icon={null} title="No paid invoices" description="Paid invoices eligible for refund will appear here." />
          : invoices.map(inv => {
              const isPending = pendingInvoiceIds.has(inv.id)
              return (
                <div key={inv.id} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
                  <span className={styles.mono}>{inv.number}</span>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{inv.planName || '—'}</span>
                  <span className={styles.amount}>{formatCurrency(inv.subtotal ?? inv.amount)}</span>
                  <span className={styles.amount}>{formatCurrency(inv.taxAmount ?? 0)}</span>
                  <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                  <span className={styles.date}>{formatDate(inv.issuedAt)}</span>
                  {isPending ? (
                    <span style={{
                      padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                      background: 'rgba(255,165,0,0.12)', color: '#F59E0B',
                      display: 'inline-flex', alignItems: 'center', gap: 4
                    }}>
                      ⏳ Pending
                    </span>
                  ) : (
                    <button
                      onClick={() => openRefundModal(inv)}
                      style={{
                        background: 'none', border: '1px solid var(--color-border)',
                        cursor: 'pointer', color: 'var(--color-text-secondary)',
                        padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      ↩ Request Refund
                    </button>
                  )}
                </div>
              )
            })
        }
      </div>
      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      {/* Refund History */}
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>Refund History</div>
      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: '1.2fr 1.4fr 1.2fr 1.2fr 1fr 1.2fr' }}>
          <span>REFUND ID</span>
          <span>INVOICE</span>
          <span>AMOUNT</span>
          <span>REASON</span>
          <span>DATE</span>
          <span>STATUS</span>
        </div>
        {refundLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className={styles.tableRow} style={{ gridTemplateColumns: '1.2fr 1.4fr 1.2fr 1.2fr 1fr 1.2fr' }}>
                {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : refunds.length === 0
          ? <EmptyState icon={null} title="No refunds yet" description="Your refund requests will appear here." />
          : refunds.map(r => (
              <div key={r.id} className={styles.tableRow} style={{ gridTemplateColumns: '1.2fr 1.4fr 1.2fr 1.2fr 1fr 1.2fr' }}>
                <span className={styles.mono}>#{r.id}</span>
                <span className={styles.mono}>{r.invoiceNumber || (r.invoiceId ? `INV-${String(r.invoiceId).padStart(5,'0')}` : '—')}</span>
                <span className={styles.amount}>{formatCurrency(r.refundAmount || r.amount || 0)}</span>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{r.reason || 'Customer request'}</span>
                <span className={styles.date}>{r.createdAt ? formatDate(r.createdAt) : '—'}</span>
                <RefundStatusChip status={r.status} />
              </div>
            ))
        }
      </div>
      <Pagination page={refundPage} pageSize={8} total={refundTotal} onChange={setRefundPage} />

      {/* Refund Request Modal */}
      <Modal isOpen={!!refundInv} onClose={() => setRefundInv(null)} title="Request Refund" width={440}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setRefundInv(null)} disabled={processing}>Cancel</Button>
            <Button variant="primary" loading={processing} onClick={handleRefundRequest}
              style={{ background: 'linear-gradient(135deg,#FF5A5A,#ff8080)' }}>
              Submit Request
            </Button>
          </div>
        }
      >
        {refundInv && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(255,165,0,0.08)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, border: '1px solid rgba(255,165,0,0.2)' }}>
              ⏳ Your refund request will be reviewed by an admin. Once approved, a prorated refund based on unused days will be credited to your original payment method.
            </div>
            {requestError && (
              <div style={{ padding: '10px 14px', background: 'rgba(255,90,90,0.1)', borderRadius: 8, fontSize: 13, color: '#FF5A5A', border: '1px solid rgba(255,90,90,0.25)' }}>
                ⚠️ {requestError}
              </div>
            )}
            {[
              { label: 'Invoice', value: refundInv.number },
              { label: 'Plan', value: refundInv.planName || '—' },
              { label: 'Total Paid', value: formatCurrency(refundInv.amount) },
              { label: 'Issued', value: formatDate(refundInv.issuedAt) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}
