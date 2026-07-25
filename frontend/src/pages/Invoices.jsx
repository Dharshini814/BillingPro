import { useCallback, useEffect, useState, useRef } from 'react'
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

const STATUSES = ['all', 'paid', 'unpaid']

function InvoiceViewModal({ inv, onClose, onDownload }) {
  if (!inv) return null
  return (
    <Modal
      isOpen={!!inv}
      onClose={onClose}
      title={`Invoice ${inv.number}`}
      width={500}
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Invoice Number</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16 }}>{inv.number}</div>
          </div>
          <Badge status={inv.status} />
        </div>
        {[
          { label: 'Customer', value: inv.customerName || '—' },
          { label: 'Company', value: inv.company || '—' },
          { label: 'Plan', value: inv.planName || '—' },
          { label: 'Issue Date', value: formatDate(inv.issuedAt) },
          { label: 'Due Date', value: formatDate(inv.dueAt) },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{value}</span>
          </div>
        ))}
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
            placeholder="Search invoice #…"
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
                <span className={styles.planTag}>{inv.planName || '—'}</span>
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

      <InvoiceViewModal inv={viewing} onClose={() => setViewing(null)} onDownload={handleDownload} />
    </div>
  )
}
