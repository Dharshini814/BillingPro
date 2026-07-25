import { useCallback, useEffect, useState } from 'react'
import { customerService } from '../services/customerService'
import { useToast } from '../hooks/useToast'
import { useDebounce } from '../hooks/useDebounce'
import { formatDate, formatCurrency, getInitials } from '../utils/formatters'
import SearchBar from '../components/common/SearchBar.jsx'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Modal from '../components/common/Modal.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import { UsersIcon, TrashIcon, PlusIcon } from '../components/common/Icons.jsx'
import styles from './Customers.module.css'

const STATUS_OPTIONS = ['all', 'active', 'inactive']

// Countries with their default currency
const COUNTRY_CURRENCY_MAP = {
  "India": "INR", "United States": "USD", "United Kingdom": "GBP",
  "Germany": "EUR", "France": "EUR", "Netherlands": "EUR", "Italy": "EUR",
  "Spain": "EUR", "Canada": "CAD", "Australia": "AUD", "New Zealand": "NZD",
  "UAE": "AED", "Singapore": "SGD", "Japan": "JPY", "South Korea": "KRW",
  "Brazil": "BRL", "Mexico": "MXN", "South Africa": "ZAR", "China": "CNY",
  "Russia": "RUB", "Switzerland": "CHF", "Sweden": "SEK", "Norway": "NOK",
  "Denmark": "DKK", "Finland": "EUR", "Poland": "PLN", "Thailand": "THB",
  "Malaysia": "MYR", "Indonesia": "IDR", "Philippines": "PHP",
}

const EMPTY_FORM = {
  name: '', email: '', company: '', phone: '', address: '',
  status: 'Active', country: 'India', currency: 'INR'
}

const inp = {
  background: 'var(--color-bg)', border: '1.5px solid var(--color-border)',
  borderRadius: 10, padding: '9px 14px', fontSize: 14,
  color: 'var(--color-text)', boxShadow: 'var(--shadow-pressed)',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

export default function Customers() {
  const toast = useToast()
  const [items, setItems]         = useState([])
  const [total, setTotal]         = useState(0)
  const [page, setPage]           = useState(1)
  const [search, setSearch]       = useState('')
  const [status, setStatus]       = useState('all')
  const [loading, setLoading]     = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const debouncedSearch = useDebounce(search, 350)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await customerService.list({ search: debouncedSearch, status, page, pageSize: 8 })
      setItems(res?.items || [])
      setTotal(res?.total || 0)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load customers' })
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, status, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [debouncedSearch, status])

  async function handleDelete() {
    try {
      await customerService.remove(deleteTarget.id)
      toast.push({ type: 'success', message: `${deleteTarget.name} removed.` })
      setDeleteTarget(null)
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.response?.data?.detail || err.message })
    }
  }

  function setField(k, v) {
    setForm(f => {
      const next = { ...f, [k]: v }
      // auto-update currency when country changes
      if (k === 'country') {
        next.currency = COUNTRY_CURRENCY_MAP[v] || 'USD'
      }
      return next
    })
  }

  async function handleAddCustomer() {
    if (!form.name || !form.email) {
      toast.push({ type: 'error', message: 'Name and email are required.' })
      return
    }
    setSaving(true)
    try {
      await customerService.create(form)
      toast.push({ type: 'success', message: `${form.name} added successfully.` })
      setShowAdd(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.response?.data?.detail || 'Failed to add customer' })
    } finally {
      setSaving(false)
    }
  }

  const AVATAR_COLORS = ['#D4A800', '#F5C518', '#4CAF50', '#FFB547', '#FF5A5A']

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Customers</h1>
          <p className={styles.subtitle}>{total} total customers</p>
        </div>
        <Button variant="primary" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true) }}>
          <PlusIcon size={14} /> Add Customer
        </Button>
      </div>

      <div className={styles.filters}>
        <SearchBar value={search} onChange={setSearch} placeholder="Search customers…" className={styles.search} />
        <div className={styles.statusTabs}>
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              className={[styles.tab, status === s ? styles.tabActive : ''].join(' ')}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>Customer</span>
          <span>Company</span>
          <span>Phone</span>
          <span>Country</span>
          <span>Status</span>
          <span>Joined</span>
          <span></span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tableRow}>
              {Array.from({length:7}).map((_,j)=><Skeleton key={j} height={14} width="70%" />)}
            </div>
          ))
        ) : (items?.length || 0) === 0 ? (
          <EmptyState icon={<UsersIcon size={26}/>} title="No customers found" description="Add your first customer to get started." />
        ) : (
          items?.map((c, i) => (
            <div key={c.id} className={styles.tableRow}>
              <div className={styles.customerCell}>
                <div className={styles.avatar} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                  {getInitials(c.name)}
                </div>
                <div>
                  <p className={styles.custName}>{c.name}</p>
                  <p className={styles.custEmail}>{c.email}</p>
                </div>
              </div>
              <span className={styles.planTag}>{c.company || '—'}</span>
              <span className={styles.mrr}>{c.phone || '—'}</span>
              <span className={styles.countryCell}>
                {c.country || 'India'}
                <span className={styles.currency}>{c.currency || 'INR'}</span>
              </span>
              <Badge status={c.status?.toLowerCase()} />
              <span className={styles.date}>{formatDate(c.joined)}</span>
              <button className={styles.deleteBtn} onClick={() => setDeleteTarget(c)} title="Remove customer">
                <TrashIcon size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      {/* ── Add Customer Modal ── */}
      <Modal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Customer"
        width={500}
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={saving}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleAddCustomer}>Add Customer</Button>
          </>
        }
      >
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Full Name *</label>
              <input style={inp} value={form.name} onChange={e=>setField('name',e.target.value)} placeholder="Jane Doe" />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Email *</label>
              <input style={inp} type="email" value={form.email} onChange={e=>setField('email',e.target.value)} placeholder="jane@company.com" />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Company</label>
              <input style={inp} value={form.company} onChange={e=>setField('company',e.target.value)} placeholder="Acme Inc." />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Phone</label>
              <input style={inp} value={form.phone} onChange={e=>setField('phone',e.target.value)} placeholder="+91 98765 43210" />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
            <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Address</label>
            <input style={inp} value={form.address} onChange={e=>setField('address',e.target.value)} placeholder="123 Main Street, City" />
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Country</label>
              <select style={inp} value={form.country} onChange={e=>setField('country',e.target.value)}>
                {Object.keys(COUNTRY_CURRENCY_MAP).map(c=>(
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--color-text-secondary)', textTransform:'uppercase', letterSpacing:'0.05em' }}>Currency (auto)</label>
              <input style={{...inp, background:'rgba(var(--color-primary-rgb),0.04)', color:'var(--color-text-secondary)'}} value={form.currency} readOnly />
            </div>
          </div>

          <div style={{ background:'rgba(var(--color-primary-rgb),0.05)', borderRadius:10, padding:'10px 14px', fontSize:12, color:'var(--color-text-secondary)', borderLeft:'3px solid var(--color-primary)' }}>
            Tax will be auto-calculated based on country: <strong>India → GST 18%</strong>, USA → Sales Tax 10%, UK → VAT 20%, UAE → VAT 5%, etc.
          </div>
        </div>
      </Modal>

      {/* ── Delete Modal ── */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove Customer"
        width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete}>Remove</Button>
          </>
        }
      >
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Remove <strong>{deleteTarget?.name}</strong> from your customer list?
        </p>
      </Modal>
    </div>
  )
}
