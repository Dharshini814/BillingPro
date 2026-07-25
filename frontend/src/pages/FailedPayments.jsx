import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Pagination from '../components/common/Pagination.jsx'
import { AlertIcon, RefreshIcon, RefundIcon, EyeIcon, DownloadIcon } from '../components/common/Icons.jsx'
import { invoiceService } from '../services/invoiceService'
import styles from './FailedPayments.module.css'
import api from '../services/api.js'

const TABS = ['retries', 'refunds']

// Shared invoice view modal
function InvoiceViewModal({ inv, onClose, onDownload }) {
  if (!inv) return null
  return (
    <Modal isOpen={!!inv} onClose={onClose} title={`Invoice ${inv.invoiceNumber || inv.number || ''}`} width={460}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => onDownload(inv)}><DownloadIcon size={14} style={{ marginRight: 4 }} />Download PDF</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Invoice</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{inv.invoiceNumber || inv.number}</div>
          </div>
          <Badge status={inv.invoiceStatus || inv.status} />
        </div>
        {[
          { label: 'Customer', value: inv.customerName || '—' },
          { label: 'Amount', value: formatCurrency(inv.amount || inv.paidAmount) },
          { label: 'Date', value: formatDate(inv.scheduledDate || inv.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
        {inv.refundAmount && (
          <div style={{ marginTop: 14, background: 'rgba(156,39,176,0.05)', borderRadius: 10, padding: '12px 14px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Refund Amount</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#9c27b0' }}>{formatCurrency(inv.refundAmount)}</span>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default function FailedPayments() {
  const toast = useToast()
  const [tab, setTab] = useState('retries')
  const [viewing, setViewing] = useState(null)

  // ── Retry Queue ──
  const [retries, setRetries]         = useState([])
  const [retryTotal, setRetryTotal]   = useState(0)
  const [retryPage, setRetryPage]     = useState(1)
  const [retryLoading, setRetryLoading] = useState(true)
  const [running, setRunning]         = useState(false)

  // ── Refunds ──
  const [refunds, setRefunds]           = useState([])
  const [refundTotal, setRefundTotal]   = useState(0)
  const [refundPage, setRefundPage]     = useState(1)
  const [refundLoading, setRefundLoading] = useState(true)

  // ── Refund Modal ──
  const [refundTarget, setRefundTarget] = useState(null)
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [issuing, setIssuing]           = useState(false)

  const loadRetries = useCallback(async () => {
    setRetryLoading(true)
    try {
      const { data } = await api.get('/payment-retries/', {
        params: { status: 'all', page: retryPage, pageSize: 20 }
      })
      setRetries(data.items || [])
      setRetryTotal(data.total || 0)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load retry queue' })
    } finally {
      setRetryLoading(false)
    }
  }, [retryPage])

  const loadRefunds = useCallback(async () => {
    setRefundLoading(true)
    try {
      const { data } = await api.get('/refunds', {
        params: { page: refundPage, pageSize: 20 }
      })
      setRefunds(data.items || [])
      setRefundTotal(data.total || 0)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load refund history' })
    } finally {
      setRefundLoading(false)
    }
  }, [refundPage])

  useEffect(() => { loadRetries() }, [loadRetries])
  useEffect(() => { loadRefunds() }, [loadRefunds])

  async function handleRunRetries() {
    setRunning(true)
    try {
      const { data } = await api.post('/payment-retries/run')
      toast.push({ type: 'success', message: `Processed ${data.processed} due retries` })
      loadRetries()
      loadRefunds()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Retry run failed' })
    } finally {
      setRunning(false)
    }
  }

  function openRefundModal(retry) {
    setRefundTarget(retry)
    setRefundAmount(String(retry.amount || ''))
    setRefundReason('Customer requested refund')
  }

  async function handleIssueRefund() {
    if (!refundTarget) return
    setIssuing(true)
    try {
      await api.post('/refunds', {
        invoice_id: refundTarget.invoiceId,
        refund_amount: parseFloat(refundAmount),
        reason: refundReason
      })
      toast.push({ type: 'success', message: 'Refund issued successfully' })
      setRefundTarget(null)
      loadRetries()
      loadRefunds()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Refund failed' })
    } finally {
      setIssuing(false)
    }
  }

  async function handleDownloadInvoice(row) {
    const invoiceId = row.invoiceId || row.id
    const invoiceNum = row.invoiceNumber || row.number || `INV-${invoiceId}`
    try {
      toast.push({ type: 'info', message: `Downloading ${invoiceNum}.pdf …` })
      await invoiceService.downloadPdf(invoiceId, invoiceNum)
    } catch {
      toast.push({ type: 'error', message: 'PDF download failed' })
    }
  }

  const attemptLabel = (n) =>
    n === 1 ? 'Attempt 1 (Day 1)' : n === 2 ? 'Attempt 2 (Day 3)' : 'Attempt 3 (Day 7)'

  const inp = {
    background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14,
    color: 'var(--color-text)', boxShadow: 'var(--shadow-pressed)',
    outline: 'none', width: '100%', boxSizing: 'border-box'
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Failed Payments</h1>
          <p className={styles.subtitle}>Retry queue &amp; refund management</p>
        </div>
        {tab === 'retries' && (
          <Button variant="primary" loading={running} onClick={handleRunRetries}>
            <RefreshIcon size={14} />
            Run Due Retries
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        {TABS.map((t) => (
          <button
            key={t}
            className={[styles.tabBtn, tab === t ? styles.tabBtnActive : ''].join(' ')}
            onClick={() => setTab(t)}
          >
            {t === 'retries' ? 'Failed Payment Queue' : 'Refund History'}
          </button>
        ))}
      </div>

      {/* ── Retry Queue ── */}
      {tab === 'retries' && (
        <>
          <div className={styles.tableCard}>
            <div className={styles.retryHead}>
              <span>Customer</span>
              <span>Invoice</span>
              <span>Amount</span>
              <span>Attempt</span>
              <span>Scheduled</span>
              <span>Invoice Status</span>
              <span>Retry Status</span>
              <span>Action</span>
              <span></span>
            </div>

            {retryLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={styles.retryRow}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <Skeleton key={j} height={13} width="80%" />
                  ))}
                </div>
              ))
            ) : retries.length === 0 ? (
              <EmptyState
                icon={<AlertIcon size={26} />}
                title="No failed payments"
                description="All payments are up to date."
              />
            ) : (
              retries.map((r) => (
                <div key={r.id} className={styles.retryRow}>
                  <span className={styles.custName}>{r.customerName}</span>
                  <span className={styles.mono}>{r.invoiceNumber}</span>
                  <span className={styles.amount}>{formatCurrency(r.amount)}</span>
                  <span className={styles.attempt}>{attemptLabel(r.attemptNumber)}</span>
                  <span className={styles.dateCell}>{formatDate(r.scheduledDate)}</span>
                  <Badge status={r.invoiceStatus} />
                  <Badge status={r.status} />
                  <div className={styles.actionCell}>
                    {r.invoiceStatus === 'paid' ? (
                      <button className={styles.refundBtn} onClick={() => openRefundModal(r)}>
                        <RefundIcon size={13} /> Refund
                      </button>
                    ) : (
                      <span className={styles.noAction}>—</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className={styles.iconBtn} title="View" onClick={() => setViewing(r)} style={{ color: 'var(--color-primary)' }}>
                      <EyeIcon size={14} />
                    </button>
                    <button className={styles.iconBtn} title="Download PDF" onClick={() => handleDownloadInvoice(r)}>
                      <DownloadIcon size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination page={retryPage} pageSize={20} total={retryTotal} onChange={setRetryPage} />
        </>
      )}

      {/* ── Refund History ── */}
      {tab === 'refunds' && (
        <>
          <div className={styles.tableCard}>
            <div className={styles.refundHead}>
              <span>Reference</span>
              <span>Customer</span>
              <span>Invoice</span>
              <span>Paid Amount</span>
              <span>Refund Amount</span>
              <span>Status</span>
              <span>Date</span>
              <span></span>
            </div>

            {refundLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={styles.refundRow}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <Skeleton key={j} height={13} width="80%" />
                  ))}
                </div>
              ))
            ) : refunds.length === 0 ? (
              <EmptyState
                icon={<RefundIcon size={26} />}
                title="No refunds yet"
                description="No refunds have been issued."
              />
            ) : (
              refunds.map((r) => (
                <div key={r.id} className={styles.refundRow}>
                  <span className={styles.refCode}>{r.refundReference}</span>
                  <span className={styles.custName}>{r.customerName}</span>
                  <span className={styles.mono}>{r.invoiceNumber}</span>
                  <span className={styles.amount}>{formatCurrency(r.paidAmount)}</span>
                  <span className={styles.refAmount}>{formatCurrency(r.refundAmount)}</span>
                  <Badge status={r.status} />
                  <span className={styles.dateCell}>{formatDate(r.createdAt)}</span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button className={styles.iconBtn} title="View" onClick={() => setViewing(r)} style={{ color: 'var(--color-primary)' }}>
                      <EyeIcon size={14} />
                    </button>
                    <button className={styles.iconBtn} title="Download PDF" onClick={() => handleDownloadInvoice(r)}>
                      <DownloadIcon size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination page={refundPage} pageSize={20} total={refundTotal} onChange={setRefundPage} />
        </>
      )}

      {/* ── Invoice View Modal ── */}
      <InvoiceViewModal inv={viewing} onClose={() => setViewing(null)} onDownload={handleDownloadInvoice} />

      {/* ── Refund Modal ── */}
      <Modal
        isOpen={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Issue Refund"
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundTarget(null)} disabled={issuing}>Cancel</Button>
            <Button variant="danger" loading={issuing} onClick={handleIssueRefund}>Issue Refund</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: 'rgba(var(--color-primary-rgb),0.04)', borderRadius: 12, padding: '14px 16px' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Customer</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{refundTarget?.customerName}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Invoice</div>
              <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{refundTarget?.invoiceNumber}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Paid Amount</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(refundTarget?.amount)}</div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Refund Amount</label>
            <input style={inp} type="number" min="0" step="0.01" value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</label>
            <input style={inp} type="text" value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
