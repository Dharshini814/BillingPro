import { useCallback, useEffect, useState } from 'react'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Pagination from '../components/common/Pagination.jsx'
import { AlertIcon, RefreshIcon, RefundIcon, EyeIcon, DownloadIcon, CheckIcon } from '../components/common/Icons.jsx'
import { invoiceService } from '../services/invoiceService'
import styles from './FailedPayments.module.css'
import api from '../services/api.js'

const TABS = ['retries', 'requests', 'refunds']

// ── Invoice view modal ────────────────────────────────────────────────────────
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

// ── Approve/Reject confirmation modal ────────────────────────────────────────
function ApprovalModal({ refund, action, onClose, onConfirm, processing }) {
  if (!refund) return null
  const isApprove = action === 'approve'
  return (
    <Modal
      isOpen={!!refund}
      onClose={onClose}
      title={isApprove ? 'Approve Refund Request' : 'Reject Refund Request'}
      width={440}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose} disabled={processing}>Cancel</Button>
          <Button
            variant={isApprove ? 'primary' : 'danger'}
            loading={processing}
            onClick={onConfirm}
            style={isApprove ? { background: 'linear-gradient(135deg,#4CAF50,#66BB6A)' } : {}}
          >
            {isApprove ? '✓ Approve & Process Refund' : '✗ Reject Request'}
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ padding: '12px 16px', background: isApprove ? 'rgba(76,175,80,0.07)' : 'rgba(255,90,90,0.07)', borderRadius: 10, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, border: `1px solid ${isApprove ? 'rgba(76,175,80,0.2)' : 'rgba(255,90,90,0.2)'}` }}>
          {isApprove
            ? '✅ Approving this request will immediately process the refund and mark the invoice as refunded.'
            : '⚠️ Rejecting this request will notify the user that their refund was not approved. No funds will be moved.'}
        </div>
        {[
          { label: 'Customer', value: refund.customerName },
          { label: 'Invoice', value: refund.invoiceNumber },
          { label: 'Paid Amount', value: formatCurrency(refund.paidAmount) },
          { label: 'Refund Amount', value: formatCurrency(refund.refundAmount) },
          { label: 'Reason', value: refund.reason || '—' },
          { label: 'Requested', value: formatDate(refund.createdAt) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{label}</span>
            <span style={{ fontWeight: 700, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>
    </Modal>
  )
}

export default function FailedPayments() {
  const toast = useToast()
  const [tab, setTab] = useState('retries')
  const [viewing, setViewing] = useState(null)

  // ── Retry Queue ──
  const [retries, setRetries]               = useState([])
  const [retryTotal, setRetryTotal]         = useState(0)
  const [retryPage, setRetryPage]           = useState(1)
  const [retryLoading, setRetryLoading]     = useState(true)
  const [running, setRunning]               = useState(false)

  // ── Pending Refund Requests ──
  const [requests, setRequests]             = useState([])
  const [requestsTotal, setRequestsTotal]   = useState(0)
  const [requestsPage, setRequestsPage]     = useState(1)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [approvalTarget, setApprovalTarget] = useState(null)   // { refund, action }
  const [approving, setApproving]           = useState(false)

  // ── Refund History ──
  const [refunds, setRefunds]               = useState([])
  const [refundTotal, setRefundTotal]       = useState(0)
  const [refundPage, setRefundPage]         = useState(1)
  const [refundLoading, setRefundLoading]   = useState(true)

  // ── Admin-issue refund modal ──
  const [refundTarget, setRefundTarget]     = useState(null)
  const [refundAmount, setRefundAmount]     = useState('')
  const [refundReason, setRefundReason]     = useState('')
  const [issuing, setIssuing]               = useState(false)

  const loadRetries = useCallback(async () => {
    setRetryLoading(true)
    try {
      const { data } = await api.get('/payment-retries/', { params: { page: retryPage, pageSize: 20 } })
      console.log('Payment Retries API Response:', data)
      console.log('Retries items:', data.items, 'Total:', data.total)
      setRetries(data.items || [])
      setRetryTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to load retries:', err)
      toast.push({ type: 'error', message: 'Failed to load failed payments' })
    } finally { setRetryLoading(false) }
  }, [retryPage, toast])

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true)
    try {
      const { data } = await api.get('/refunds', { params: { page: requestsPage, pageSize: 20, status: 'pending_approval' } })
      console.log('Refund Requests API Response:', data)
      console.log('Requests items:', data.items, 'Total:', data.total)
      setRequests(data.items || [])
      setRequestsTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to load requests:', err)
      toast.push({ type: 'error', message: 'Failed to load refund requests' })
    } finally { setRequestsLoading(false) }
  }, [requestsPage, toast])

  const loadRefunds = useCallback(async () => {
    setRefundLoading(true)
    try {
      const { data } = await api.get('/refunds', { params: { page: refundPage, pageSize: 20 } })
      console.log('Refunds API Response:', data)
      console.log('Refunds items:', data.items, 'Total:', data.total)
      setRefunds(data.items || [])
      setRefundTotal(data.total || 0)
    } catch (err) {
      console.error('Failed to load refunds:', err)
      toast.push({ type: 'error', message: 'Failed to load refund history' })
    } finally { setRefundLoading(false) }
  }, [refundPage, toast])

  useEffect(() => { loadRetries() }, [loadRetries])
  useEffect(() => { loadRequests() }, [loadRequests])
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
    } finally { setRunning(false) }
  }

  async function handleApprovalConfirm() {
    if (!approvalTarget) return
    const { refund, action } = approvalTarget
    setApproving(true)
    try {
      await api.patch(`/refunds/${refund.id}/${action}`)
      toast.push({
        type: 'success',
        message: action === 'approve'
          ? `Refund ${refund.refundReference} approved and processed`
          : `Refund request ${refund.refundReference} rejected`
      })
      setApprovalTarget(null)
      loadRequests()
      loadRefunds()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Action failed' })
    } finally { setApproving(false) }
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
    } finally { setIssuing(false) }
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

  const pendingCount = requestsTotal

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Failed Payments</h1>
          <p className={styles.subtitle}>Retry queue, refund requests &amp; refund history</p>
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
            style={{ position: 'relative' }}
          >
            {t === 'retries' ? 'Failed Payment Queue'
              : t === 'requests' ? 'Refund Requests'
              : 'Refund History'}
            {t === 'requests' && pendingCount > 0 && (
              <span style={{
                marginLeft: 7, background: '#FF5A5A', color: '#fff',
                borderRadius: 10, fontSize: 10, fontWeight: 800,
                padding: '1px 7px', verticalAlign: 'middle', lineHeight: 1.6
              }}>
                {pendingCount}
              </span>
            )}
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
                  {Array.from({ length: 8 }).map((_, j) => <Skeleton key={j} height={13} width="80%" />)}
                </div>
              ))
            ) : retries.length === 0 ? (
              <EmptyState icon={<AlertIcon size={26} />} title="No failed payments" description="All payments are up to date." />
            ) : (
              retries.map((r) => (
                <div key={r.id} className={styles.retryRow}>
                  <span className={styles.custName}>{r.customerName || '—'}</span>
                  <span className={styles.mono}>{r.invoiceNumber || r.invoiceId || '—'}</span>
                  <span className={styles.amount}>{formatCurrency(r.amount)}</span>
                  <span className={styles.attempt}>{r.attemptNumber > 0 ? attemptLabel(r.attemptNumber) : 'No retry'}</span>
                  <span className={styles.dateCell}>{r.scheduledDate ? formatDate(r.scheduledDate) : '—'}</span>
                  <Badge status={r.invoiceStatus || 'failed'} />
                  <Badge status={r.status} />
                  <div className={styles.actionCell}>
                    {r.status === 'pending' ? (
                      <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                        Scheduled
                      </span>
                    ) : r.invoiceStatus === 'paid' || r.status === 'success' ? (
                      <button
                        onClick={() => openRefundModal(r)}
                        style={{
                          padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                          background: 'rgba(156,39,176,0.10)', color: '#9c27b0',
                          border: '1px solid rgba(156,39,176,0.25)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4
                        }}
                      >
                        <RefundIcon size={12} /> Issue Refund
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

      {/* ── Pending Refund Requests ── */}
      {tab === 'requests' && (
        <>
          <div className={styles.tableCard}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.4fr',
              padding: '10px 16px', gap: 12,
              borderBottom: '1px solid var(--color-border)',
              fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.05em'
            }}>
              <span>Reference</span>
              <span>Customer</span>
              <span>Invoice</span>
              <span>Paid Amt</span>
              <span>Refund Amt</span>
              <span>Requested</span>
              <span>Actions</span>
            </div>

            {requestsLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.4fr', padding: '12px 16px', gap: 12 }}>
                  {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} height={13} width="80%" />)}
                </div>
              ))
            ) : requests.length === 0 ? (
              <EmptyState
                icon={<RefundIcon size={26} />}
                title="No pending refund requests"
                description="User refund requests awaiting your approval will appear here."
              />
            ) : (
              requests.map((r) => (
                <div key={r.id} style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr 1.4fr',
                  padding: '12px 16px', gap: 12,
                  alignItems: 'center',
                  borderBottom: '1px solid var(--color-border)',
                  background: 'rgba(255,165,0,0.03)'
                }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>
                    {r.refundReference}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{r.customerName}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.invoiceNumber}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(r.paidAmount)}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#9c27b0' }}>{formatCurrency(r.refundAmount)}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{formatDate(r.createdAt)}</span>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button
                      onClick={() => setApprovalTarget({ refund: r, action: 'approve' })}
                      style={{
                        padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: 'rgba(76,175,80,0.12)', color: '#4CAF50',
                        border: '1px solid rgba(76,175,80,0.3)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => setApprovalTarget({ refund: r, action: 'reject' })}
                      style={{
                        padding: '5px 12px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: 'rgba(255,90,90,0.1)', color: '#FF5A5A',
                        border: '1px solid rgba(255,90,90,0.25)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 4
                      }}
                    >
                      ✗ Reject
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Pagination page={requestsPage} pageSize={20} total={requestsTotal} onChange={setRequestsPage} />
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
                  {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} height={13} width="80%" />)}
                </div>
              ))
            ) : refunds.length === 0 ? (
              <EmptyState icon={<RefundIcon size={26} />} title="No refunds yet" description="No refunds have been issued." />
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

      {/* ── Modals ── */}
      <InvoiceViewModal inv={viewing} onClose={() => setViewing(null)} onDownload={handleDownloadInvoice} />

      <ApprovalModal
        refund={approvalTarget?.refund}
        action={approvalTarget?.action}
        onClose={() => setApprovalTarget(null)}
        onConfirm={handleApprovalConfirm}
        processing={approving}
      />

      {/* Admin direct-issue refund modal */}
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
