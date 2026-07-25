import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLang } from '../hooks/useLang'
import { invoiceService } from '../services/invoiceService'
import { useToast } from '../hooks/useToast'
import { formatDate, formatCurrency } from '../utils/formatters'
import Badge from '../components/common/Badge.jsx'
import Modal from '../components/common/Modal.jsx'
import Button from '../components/common/Button.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { FileIcon, DownloadIcon, EyeIcon } from '../components/common/Icons.jsx'
import styles from './Invoices.module.css'

const STATUSES = ['all', 'paid', 'unpaid']

function InvoiceViewModal({ inv, onClose, onDownload }) {
  if (!inv) return null
  return (
    <Modal
      isOpen={!!inv}
      onClose={onClose}
      title={`Invoice ${inv.number}`}
      width={480}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          <Button variant="primary" onClick={() => onDownload(inv)}>
            <DownloadIcon size={14} style={{ marginRight: 4 }} /> Download PDF
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 4 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Invoice Number</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{inv.number}</div>
          </div>
          <Badge status={inv.status} />
        </div>

        {/* Details grid */}
        {[
          { label: 'Customer', value: inv.customerName || '—' },
          { label: 'Plan', value: inv.planName || '—' },
          { label: 'Issue Date', value: formatDate(inv.issuedAt) },
          { label: 'Due Date', value: formatDate(inv.dueAt) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 0', borderBottom: '1px solid var(--color-border)'
          }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
          </div>
        ))}

        {/* Amounts */}
        <div style={{ marginTop: 16, background: 'rgba(var(--color-primary-rgb),0.04)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Subtotal</span>
            <span>{formatCurrency(inv.subtotal ?? inv.amount)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span style={{ color: 'var(--color-text-secondary)' }}>Tax</span>
            <span>{formatCurrency(inv.taxAmount ?? 0)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, borderTop: '1px solid var(--color-border)', paddingTop: 8, marginTop: 4 }}>
            <span>Total</span>
            <span>{formatCurrency(inv.amount)}</span>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default function MyInvoices() {
  const { user } = useAuth()
  const { t } = useLang()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    try {
      const res = await invoiceService.list({
        status,
        page,
        pageSize: 8,
        customer_email: user.email
      })
      setItems(res.items)
      setTotal(res.total)
    } catch (err) {
      toast.push({ type: 'error', message: 'Failed to load invoices' })
    } finally { setLoading(false) }
  }, [status, page, user?.email])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status])

  async function handleDownload(inv) {
    toast.push({ type: 'info', message: `Opening ${inv.number} — use "Save as PDF" in the print dialog.` })
    try { await invoiceService.downloadPdf(inv.id) }
    catch (err) { toast.push({ type: 'error', message: err.message }) }
  }

  // Check if EyeIcon exists, fallback to a simple eye SVG
  const ViewIcon = EyeIcon || (({ size = 14 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ))

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('invoices.myInvoices')}</h1>
          <p className={styles.subtitle}>{total} invoices for {user?.company}</p>
        </div>
      </div>

      <div className={styles.statusTabs}>
        {STATUSES.map((s) => (
          <button key={s} className={[styles.tab, status === s ? styles.tabActive : ''].join(' ')} onClick={() => setStatus(s)}>
            {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr auto auto' }}>
          <span>{t('invoices.invoiceNo')}</span>
          <span>{t('invoices.amount')}</span>
          <span>{t('invoices.issued')}</span>
          <span>{t('invoices.due')}</span>
          <span>{t('invoices.status')}</span>
          <span>View</span>
          <span></span>
        </div>
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={styles.tableRow} style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr auto auto' }}>
                {Array.from({ length: 7 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : items.length === 0
          ? <EmptyState icon={<FileIcon size={26}/>} title="No invoices yet" description="Your invoices will appear here once generated." />
          : items.map((inv) => (
              <div key={inv.id} className={styles.tableRow} style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 1fr auto auto' }}>
                <span className={styles.mono}>{inv.number}</span>
                <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                <span className={styles.date}>{formatDate(inv.issuedAt)}</span>
                <span className={styles.date}>
                  {inv.status === 'paid' && inv.paidAt
                    ? formatDate(inv.paidAt)
                    : formatDate(inv.dueAt)}
                </span>
                <Badge status={inv.status} />
                <button
                  className={styles.downloadBtn}
                  onClick={() => setViewing(inv)}
                  title="View invoice"
                  style={{ color: 'var(--color-primary)' }}
                >
                  <ViewIcon size={15} />
                </button>
                <button className={styles.downloadBtn} onClick={() => handleDownload(inv)} title={t('invoices.download')}>
                  <DownloadIcon size={15} />
                </button>
              </div>
            ))
        }
      </div>
      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      <InvoiceViewModal
        inv={viewing}
        onClose={() => setViewing(null)}
        onDownload={handleDownload}
      />
    </div>
  )
}
