import { useCallback, useEffect, useState, useRef } from 'react'
import api from '../services/api'
import { invoiceService } from '../services/invoiceService'
import { useToast } from '../hooks/useToast'
import { formatDate, formatCurrency } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { FileIcon, DownloadIcon, EyeIcon } from '../components/common/Icons.jsx'
import styles from './Invoices.module.css'

const STATUSES = ['all', 'paid', 'unpaid', 'draft', 'failed', 'refunded']

function InvoiceViewModal({ inv, onClose, onDownload, onPaymentSuccess }) {
  const [tab, setTab]         = useState('details')
  const [paying, setPaying]   = useState(false)
  const [paid, setPaid]       = useState(false)
  const [payError, setPayError] = useState('')
  if (!inv) return null

  const upiId     = 'vaultly@upi'
  const amount    = (inv.amount || 0).toFixed(2)
  const note      = encodeURIComponent(`Payment for ${inv.number}`)
  const name      = encodeURIComponent('Vaultly')
  const upiString = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`
  const qrUrl     = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`

  const canPay = ['unpaid', 'draft', 'failed'].includes(inv.status?.toLowerCase()) && !paid

  async function handleUpiConfirm() {
    setPaying(true)
    setPayError('')
    try {
      const { data } = await api.post('/payments/process', {
        invoice_id:     inv.id,
        amount:         inv.amount,
        payment_method: 'upi',
      })
      if (data.success) {
        setPaid(true)
        onPaymentSuccess && onPaymentSuccess()
      } else {
        setPayError('Payment could not be confirmed. Please try again.')
      }
    } catch (err) {
      setPayError(err?.response?.data?.detail || 'Payment confirmation failed.')
    } finally {
      setPaying(false)
    }
  }

  const tabBtn = (key, label) => (
    <button
      key={key}
      onClick={() => setTab(key)}
      style={{
        padding: '7px 18px', border: 'none', borderRadius: 99,
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        background: tab === key ? '#D4A800' : 'transparent',
        color: tab === key ? '#fff' : 'var(--color-text-secondary)',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )

  return (
    <Modal
      isOpen={!!inv}
      onClose={onClose}
      title={`Invoice ${inv.number}`}
      width={520}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => onDownload(inv)}>
            <DownloadIcon size={14} style={{ marginRight: 4 }} /> Download PDF
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, background: 'var(--color-bg)',
        boxShadow: 'var(--shadow-pressed)', borderRadius: 99,
        padding: 4, marginBottom: 20, width: 'fit-content',
      }}>
        {tabBtn('details', '📄 Details')}
        {(canPay || paid) && tabBtn('qr', '📱 Pay via QR')}
      </div>

      {/* ── Details Tab ── */}
      {tab === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Invoice Number</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>{inv.number}</div>
            </div>
            <Badge status={paid ? 'paid' : inv.status} />
          </div>
          {[
            { label: 'Customer',   value: inv.customerName || '—' },
            { label: 'Company',    value: inv.company      || '—' },
            { label: 'Plan',       value: inv.planName     || '—' },
            { label: 'Issue Date', value: formatDate(inv.issuedAt) },
            { label: 'Due Date',   value: formatDate(inv.dueAt) },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
            </div>
          ))}
          {inv.notes && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(76,175,80,0.07)', borderRadius: 10, fontSize: 12, color: '#4CAF50', lineHeight: 1.6, border: '1px solid rgba(76,175,80,0.2)' }}>
              💡 {inv.notes}
            </div>
          )}
          <div style={{ marginTop: 16, background: 'rgba(var(--color-primary-rgb),0.04)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
              <span>{formatCurrency(inv.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Tax</span>
              <span>{formatCurrency(inv.taxAmount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 4 }}>
              <span>Total</span>
              <span>{formatCurrency(inv.amount)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── QR Payment Tab ── */}
      {tab === 'qr' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '8px 0 12px' }}>

          {paid ? (
            /* ── Success State ── */
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(76,175,80,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✅</div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 800, fontSize: 18, margin: '0 0 6px', color: '#4CAF50' }}>Payment Confirmed!</p>
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
                  {formatCurrency(inv.amount)} paid via <strong>UPI</strong>.<br/>Invoice {inv.number} is now marked as <strong>Paid</strong>.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Amount banner */}
              <div style={{
                background: 'rgba(212,168,0,0.10)', border: '1.5px solid rgba(212,168,0,0.3)',
                borderRadius: 14, padding: '14px 32px', textAlign: 'center', width: '100%', boxSizing: 'border-box',
              }}>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Amount Due</p>
                <p style={{ fontSize: 28, fontWeight: 900, color: '#D4A800', margin: 0 }}>{formatCurrency(inv.amount)}</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{inv.number} · {inv.customerName}</p>
              </div>

              {/* QR Code */}
              <div style={{ padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
                <img src={qrUrl} alt="UPI Payment QR" width={200} height={200} style={{ display: 'block', borderRadius: 8 }} />
              </div>

              <div style={{ textAlign: 'center', maxWidth: 320 }}>
                <p style={{ fontWeight: 700, fontSize: 14, margin: '0 0 6px' }}>Scan to Pay via UPI</p>
                <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', margin: 0, lineHeight: 1.6 }}>
                  Open GPay, PhonePe, Paytm, or BHIM and scan this QR to pay <strong>{formatCurrency(inv.amount)}</strong>.
                </p>
              </div>

              {/* UPI ID copy */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--color-bg)', boxShadow: 'var(--shadow-pressed)',
                borderRadius: 99, padding: '8px 16px', fontSize: 13,
              }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>UPI ID:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{upiId}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(upiId)}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#D4A800', fontWeight: 700, fontSize: 12, padding: 0 }}
                >
                  Copy
                </button>
              </div>

              {/* Confirm button */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={handleUpiConfirm}
                  disabled={paying}
                  style={{
                    width: '100%', padding: '13px', border: 'none', borderRadius: 12,
                    background: paying ? '#ccc' : '#4CAF50', color: '#fff',
                    fontWeight: 700, fontSize: 15, cursor: paying ? 'not-allowed' : 'pointer',
                    transition: 'background 0.2s',
                  }}
                >
                  {paying ? 'Confirming…' : "✅ I've Paid — Confirm Payment"}
                </button>
                {payError && (
                  <p style={{ fontSize: 12, color: '#FF5A5A', textAlign: 'center', margin: 0 }}>{payError}</p>
                )}
                <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
                  Click after completing the UPI payment. This will mark the invoice as <strong>Paid</strong> and record the method as <strong>UPI</strong>.
                </p>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

export default function Invoices() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [viewing, setViewing] = useState(null)
  const searchTimeout = useRef(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await invoiceService.list({ status, search, dateFrom, dateTo, page, pageSize: 8 })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.push({ type: 'error', message: 'Failed to load invoices' })
    } finally {
      setLoading(false)
    }
  }, [status, search, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status, search, dateFrom, dateTo])

  function handleSearchChange(e) {
    const val = e.target.value
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => setSearch(val), 350)
  }

  async function handleGenerate() {
    setGenerating(true)
    try {
      const res = await invoiceService.generate()
      toast.push({ type: 'success', message: res.message || 'Invoices generated.' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Failed to generate invoices.' })
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownload(inv) {
    toast.push({ type: 'info', message: `Downloading ${inv.number}.pdf …` })
    try {
      const result = await invoiceService.downloadPdf(inv.id, inv.number)
      if (result?.fallback) {
        toast.push({ type: 'info', message: `${inv.number} opened – use "Save as PDF" in the print dialog.` })
      } else {
        toast.push({ type: 'success', message: `${inv.number}.pdf downloaded.` })
      }
    } catch (err) {
      toast.push({ type: 'error', message: err.message || 'Could not download invoice.' })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Invoices</h1>
          <p className={styles.subtitle}>{total} invoices</p>
        </div>
        <Button variant="primary" loading={generating} onClick={handleGenerate}>
          Generate Invoices
        </Button>
      </div>

      {/* Filters row */}
      <div className={styles.filtersRow}>
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

        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            placeholder="Search invoice # or customer…"
            onChange={handleSearchChange}
          />
        </div>

        <div className={styles.dateWrap}>
          <input
            type="date"
            className={styles.dateInput}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            title="From date"
          />
          <span className={styles.dateSep}>→</span>
          <input
            type="date"
            className={styles.dateInput}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            title="To date"
          />
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Invoice #</span>
          <span>Customer</span>
          <span>Plan</span>
          <span>Subtotal</span>
          <span>Tax</span>
          <span>Total</span>
          <span>Issued</span>
          <span>Status</span>
          <span></span>
          <span></span>
        </div>

        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.tableRow}>
                {Array.from({ length: 10 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : items.length === 0
          ? <EmptyState icon={<FileIcon size={26} />} title="No invoices" description="No invoices match this filter." />
          : items.map((inv) => (
              <div key={inv.id} className={styles.tableRow}>
                <span className={styles.mono}>{inv.number}</span>
                <div>
                  <p className={styles.custName}>{inv.customerName}</p>
                  <p className={styles.custSub}>{inv.company}</p>
                </div>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span className={styles.planTag}>{inv.planName || '—'}</span>
                  {inv.invoiceType && inv.invoiceType !== 'regular' && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
                      background: inv.invoiceType === 'prorated_downgrade' ? 'rgba(76,175,80,0.12)' : 'rgba(212,168,0,0.12)',
                      color: inv.invoiceType === 'prorated_downgrade' ? '#4CAF50' : '#D4A800',
                      width: 'fit-content'
                    }}>
                      {inv.invoiceType === 'prorated_downgrade' ? 'Prorated ↓' : 'Prorated ↑'}
                    </span>
                  )}
                </span>
                <span className={styles.amount}>{formatCurrency(inv.subtotal)}</span>
                <span className={styles.amount}>{formatCurrency(inv.taxAmount)}</span>
                <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                <span className={styles.date}>{formatDate(inv.issuedAt)}</span>
                <Badge status={inv.status} />
                <button className={styles.downloadBtn} onClick={() => setViewing(inv)} title="View invoice" style={{ color: 'var(--color-primary)' }}>
                  <EyeIcon size={15} />
                </button>
                <button className={styles.downloadBtn} onClick={() => handleDownload(inv)} title="Download PDF">
                  <DownloadIcon size={15} />
                </button>
              </div>
            ))
        }
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      <InvoiceViewModal inv={viewing} onClose={() => setViewing(null)} onDownload={handleDownload} onPaymentSuccess={() => { setViewing(null); load() }} />
    </div>
  )
}
