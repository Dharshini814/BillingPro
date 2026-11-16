import { useCallback, useEffect, useState } from 'react'
import { invoiceService } from '../services/invoiceService'
import { useToast } from '../hooks/useToast'
import { formatCurrency, formatDate } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Pagination from '../components/common/Pagination.jsx'
import { CreditCardIcon, CheckIcon, AlertIcon, DownloadIcon, RefundIcon, EyeIcon } from '../components/common/Icons.jsx'
import styles from './PaymentDashboard.module.css'
import api from '../services/api.js'

const STATUSES = ['all', 'unpaid', 'paid', 'failed', 'refunded']

function resolvePaymentMethod(inv) {
  // Use the actual payment_method stored on the invoice/payment record
  if (inv.paymentMethod) return inv.paymentMethod
  if (inv.payment_method) return inv.payment_method
  // Fallback only for paid invoices with no recorded method
  return inv.status === 'paid' ? 'Card' : '—'
}

export default function PaymentDashboard() {
  const toast = useToast()
  const [invoices, setInvoices] = useState([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [status, setStatus]     = useState('all')
  const [loading, setLoading]   = useState(true)

  // Process payment modal
  const [processTarget, setProcessTarget] = useState(null)
  const [processing, setProcessing]       = useState(false)
  const [processResult, setProcessResult] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState('UPI')

  // Refund confirmation modal
  const [refundTarget, setRefundTarget] = useState(null)
  const [refunding, setRefunding]       = useState(false)

  // PDF download
  const [downloading, setDownloading] = useState(null)

  // Invoice view modal
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoiceService.list({ status, page, pageSize: 8 })
      if (res.items && res.items.length > 0) {
        console.log('Refunded invoice data:', JSON.stringify(res.items[0], null, 2))
        console.log('paymentMethod field:', res.items[0].paymentMethod)
      }
      setInvoices(res.items || [])
      setTotal(res.total || 0)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load invoices' })
    } finally {
      setLoading(false)
    }
  }, [status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status])

  async function handleProcess() {
    if (!processTarget) return
    setProcessing(true)
    setProcessResult(null)
    try {
      const { data } = await api.post('/payments/process', {
        invoice_id: processTarget.id,
        amount: processTarget.amount,
        payment_method: selectedMethod,
      })
      setProcessResult(data)
      toast.push({ type: data.success ? 'success' : 'error', message: data.message })
      load()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Payment processing failed'
      toast.push({ type: 'error', message: msg })
    } finally {
      setProcessing(false)
    }
  }

  async function handleRefund() {
    if (!refundTarget) return
    setRefunding(true)
    try {
      // Find payment associated with this invoice and refund it
      const paymentsRes = await api.get('/payments/', { params: { page: 1, pageSize: 100 } })
      const allPayments = paymentsRes.data?.items || []
      const payment = allPayments.find(p => p.invoiceId === refundTarget.id || p.invoice_id === refundTarget.id)

      if (payment) {
        await api.post(`/payments/${payment.id}/refund`)
      } else {
        // Fallback: update invoice status directly
        await api.put(`/invoices/${refundTarget.id}`, { status: 'refunded' })
      }

      toast.push({ type: 'success', message: `Refund issued for ${refundTarget.number}` })
      setRefundTarget(null)
      load()
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Refund failed'
      toast.push({ type: 'error', message: msg })
    } finally {
      setRefunding(false)
    }
  }

  async function handleDownloadPdf(inv) {
    setDownloading(inv.id)
    try {
      const response = await api.get(`/invoices/${inv.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${inv.number}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.push({ type: 'success', message: `${inv.number}.pdf downloaded` })
    } catch {
      toast.push({ type: 'error', message: 'PDF download failed' })
    } finally {
      setDownloading(null)
    }
  }

  function closeProcessModal() {
    setProcessTarget(null)
    setProcessResult(null)
    setSelectedMethod('UPI')
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Payments</h1>
          <p className={styles.subtitle}>{total} invoices</p>
        </div>
      </div>

      {/* Status Tabs */}
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

      {/* Table */}
      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Invoice</span>
          <span>Customer</span>
          <span>Amount</span>
          <span>Due Date</span>
          <span>Payment Method</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tableRow}>
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} height={14} width="80%" />
              ))}
            </div>
          ))
        ) : invoices.length === 0 ? (
          <EmptyState
            icon={<CreditCardIcon size={26} />}
            title="No invoices"
            description="No invoices match this filter."
          />
        ) : (
          invoices.map((inv) => (
            <div key={inv.id} className={styles.tableRow}>
              <span className={styles.mono}>{inv.number}</span>
              <span className={styles.custName}>{inv.customerName}</span>
              <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
              <span className={styles.date}>{formatDate(inv.dueAt)}</span>
              <span className={styles.payMethod}>
                {resolvePaymentMethod(inv)}
              </span>
              <Badge status={inv.status} />
              <div className={styles.actions}>
                {(inv.status === 'unpaid' || inv.status === 'failed') && (
                  <button
                    className={styles.payBtn}
                    onClick={() => { setProcessTarget(inv); setProcessResult(null) }}
                  >
                    <CreditCardIcon size={13} />
                    <span>Pay</span>
                  </button>
                )}
                {inv.status === 'paid' && (
                  <button
                    className={styles.refundBtn}
                    onClick={() => setRefundTarget(inv)}
                    title="Issue refund"
                  >
                    <RefundIcon size={13} />
                    <span>Refund</span>
                  </button>
                )}
                <button
                  className={styles.pdfBtn}
                  title="View invoice"
                  style={{ color: 'var(--color-primary)' }}
                  onClick={() => setViewing(inv)}
                >
                  <EyeIcon size={14} />
                </button>
                <button
                  className={styles.pdfBtn}
                  title="Download PDF"
                  disabled={downloading === inv.id}
                  onClick={() => handleDownloadPdf(inv)}
                >
                  <DownloadIcon size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      {/* Invoice View Modal */}
      <Modal
        isOpen={!!viewing}
        onClose={() => setViewing(null)}
        title={`Invoice ${viewing?.number || ''}`}
        width={480}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setViewing(null)}>Close</Button>
            <Button variant="primary" onClick={() => { handleDownloadPdf(viewing); }}>
              <DownloadIcon size={14} style={{ marginRight: 4 }} /> Download PDF
            </Button>
          </div>
        }
      >
        {viewing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Invoice Number</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>{viewing.number}</div>
              </div>
              <Badge status={viewing.status} />
            </div>
            {[
              { label: 'Customer', value: viewing.customerName || '—' },
              { label: 'Payment Method', value: resolvePaymentMethod(viewing) },
              { label: 'Due Date', value: formatDate(viewing.dueAt) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
              </div>
            ))}
            <div style={{ marginTop: 16, background: 'rgba(var(--color-primary-rgb),0.04)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700 }}>
                <span>Total</span>
                <span>{formatCurrency(viewing.amount)}</span>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Process Payment Modal */}
      <Modal
        isOpen={!!processTarget}
        onClose={closeProcessModal}
        title="Process Payment"
        width={460}
        footer={
          processResult ? (
            <Button variant="primary" onClick={closeProcessModal}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeProcessModal} disabled={processing}>Cancel</Button>
              <Button variant="primary" loading={processing} onClick={handleProcess}>
                Process Payment
              </Button>
            </>
          )
        }
      >
        {!processResult ? (
          <div className={styles.modalBody}>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>Invoice</span>
              <span className={styles.modalValue}>{processTarget?.number}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>Customer</span>
              <span className={styles.modalValue}>{processTarget?.customerName}</span>
            </div>
            <div className={styles.modalRow}>
              <span className={styles.modalLabel}>Amount</span>
              <span className={styles.modalValue}>{formatCurrency(processTarget?.amount)}</span>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginTop: 16 }}>
              <p className={styles.modalLabel} style={{ marginBottom: 10 }}>Payment Method</p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['UPI', 'Credit Card', 'Wallet'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setSelectedMethod(m)}
                    style={{
                      padding: '7px 16px',
                      borderRadius: 8,
                      border: selectedMethod === m
                        ? '2px solid var(--color-primary)'
                        : '1.5px solid var(--color-border)',
                      background: selectedMethod === m
                        ? 'rgba(var(--color-primary-rgb),0.08)'
                        : 'transparent',
                      color: selectedMethod === m ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      fontWeight: selectedMethod === m ? 700 : 500,
                      fontSize: 13,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {m === 'UPI' ? '📱 UPI' : m === 'Credit Card' ? '💳 Credit Card' : '💰 Wallet'}
                  </button>
                ))}
              </div>
            </div>

            <p className={styles.modalNote} style={{ marginTop: 14 }}>
              Confirm manual payment via <strong>{selectedMethod}</strong> for this invoice.
            </p>
          </div>
        ) : (
          <div className={styles.resultBox}>
            <div className={processResult.success ? styles.resultSuccess : styles.resultFail}>
              {processResult.success ? <CheckIcon size={32} /> : <AlertIcon size={32} />}
              <h3>{processResult.success ? 'Payment Successful' : 'Payment Failed'}</h3>
            </div>
            <div className={styles.resultDetails}>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Invoice</span>
                <span className={styles.modalValue}>{processTarget?.number}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Amount</span>
                <span className={styles.modalValue}>{formatCurrency(processResult.amount)}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Transaction ID</span>
                <span className={styles.monoSmall}>{processResult.transaction_id}</span>
              </div>
              <div className={styles.modalRow}>
                <span className={styles.modalLabel}>Invoice Status</span>
                <Badge status={processResult.invoice_status} />
              </div>
              {!processResult.success && (
                <p className={styles.retryNote}>
                  3 automatic retries have been scheduled (Day 1, Day 3, Day 7).
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Refund Confirmation Modal */}
      <Modal
        isOpen={!!refundTarget}
        onClose={() => setRefundTarget(null)}
        title="Confirm Refund"
        width={420}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRefundTarget(null)} disabled={refunding}>Cancel</Button>
            <Button variant="danger" loading={refunding} onClick={handleRefund}>Confirm Refund</Button>
          </>
        }
      >
        <div className={styles.confirmBody}>
          <div className={styles.confirmInfo}>
            <div>
              <div className={styles.confirmInfoLabel}>Invoice</div>
              <div className={styles.confirmInfoValue}>{refundTarget?.number}</div>
            </div>
            <div>
              <div className={styles.confirmInfoLabel}>Customer</div>
              <div className={styles.confirmInfoValue}>{refundTarget?.customerName}</div>
            </div>
            <div>
              <div className={styles.confirmInfoLabel}>Amount</div>
              <div className={styles.confirmInfoValue}>{formatCurrency(refundTarget?.amount)}</div>
            </div>
            <div>
              <div className={styles.confirmInfoLabel}>Payment Method</div>
              <div className={styles.confirmInfoValue}>
                {refundTarget ? resolvePaymentMethod(refundTarget) : '—'}
              </div>
            </div>
          </div>
          <p className={styles.confirmNote}>
            This will mark the payment as <strong>Refunded</strong> and create an audit log entry. This action cannot be undone.
          </p>
        </div>
      </Modal>
    </div>
  )
}
