import { useEffect, useState, useCallback } from 'react'
import { useLang } from '../hooks/useLang'
import { useToast } from '../hooks/useToast'
import { formatDate, getInitials } from '../utils/formatters'
import api from '../services/api'
import Badge from '../components/common/Badge.jsx'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import Input from '../components/common/Input.jsx'
import SearchBar from '../components/common/SearchBar.jsx'
import Pagination from '../components/common/Pagination.jsx'
import Skeleton from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { PlusIcon, TrashIcon, UsersIcon } from '../components/common/Icons.jsx'
import styles from './UserManagement.module.css'

const PAGE_SIZE = 8

export default function UserManagement() {
  const { t } = useLang()
  const toast = useToast()
  const [users, setUsers] = useState([])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'user', status: 'active', password: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/users')
      setUsers(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.push({ type: 'error', message: 'Failed to load users' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = users.filter(u =>
    (u.full_name || u.name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  )
  const total = filtered.length
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  async function handleCreate() {
    if (!form.full_name || !form.email || !form.password) {
      toast.push({ type: 'error', message: 'Name, email and password are required.' })
      return
    }
    setSaving(true)
    try {
      await api.post('/users', form)
      toast.push({ type: 'success', message: `${form.full_name} added successfully.` })
      setModalOpen(false)
      setForm({ full_name: '', email: '', role: 'user', status: 'active', password: '' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.response?.data?.detail || err.message })
    } finally {
      setSaving(false)
    }
  }

  async function toggleStatus(u) {
    const newStatus = u.status === 'active' ? 'inactive' : 'active'
    try {
      await api.put(`/users/${u.id}`, { status: newStatus })
      toast.push({ type: 'success', message: 'User status updated.' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.message })
    }
  }

  async function toggleRole(u) {
    const newRole = u.role === 'admin' ? 'user' : 'admin'
    try {
      await api.put(`/users/${u.id}`, { role: newRole })
      toast.push({ type: 'success', message: 'User role updated.' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.message })
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/users/${id}`)
      setDeleteTarget(null)
      toast.push({ type: 'success', message: 'User removed.' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.message })
    }
  }

  const AVATAR_COLORS = ['#D4A800', '#4CAF50', '#FFB547', '#F5C518', '#FF5A5A']

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('users.title')}</h1>
          <p className={styles.subtitle}>{t('users.subtitle')} — {total} total</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <PlusIcon size={16} /> {t('users.newUser')}
        </Button>
      </div>

      {/* Stats row */}
      <div className={styles.statsRow}>
        {[
          { label: 'Total Users', value: users.length, color: '#D4A800' },
          { label: 'Admins', value: users.filter(u => u.role === 'admin').length, color: '#FFB547' },
          { label: 'Active', value: users.filter(u => u.status === 'active').length, color: '#4CAF50' },
          { label: 'Inactive', value: users.filter(u => u.status !== 'active').length, color: '#FF5A5A' },
        ].map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statValue} style={{ color: s.color }}>{s.value}</div>
            <div className={styles.statLabel}>{s.label}</div>
          </div>
        ))}
      </div>

      <SearchBar value={search} onChange={setSearch} placeholder="Search users by name or email…" />

      <div className={styles.tableCard}>
        <div className={styles.tableHead}>
          <span>User</span>
          <span>{t('users.role')}</span>
          <span>Status</span>
          <span>{t('users.lastLogin')}</span>
          <span>Actions</span>
        </div>

        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.tableRow}>
              {Array.from({ length: 5 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
            </div>
          ))
        ) : paged.length === 0 ? (
          <EmptyState icon={<UsersIcon size={26}/>} title="No users found" description="Create your first user above." />
        ) : paged.map((u, i) => (
          <div key={u.id} className={styles.tableRow}>
            <div className={styles.userCell}>
              <div className={styles.avatar} style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                {getInitials(u.full_name || u.email)}
              </div>
              <div>
                <p className={styles.userName}>{u.full_name || '—'}</p>
                <p className={styles.userEmail}>{u.email}</p>
              </div>
            </div>

            <span className={[styles.roleBadge, u.role === 'admin' ? styles.adminBadge : styles.userBadge].join(' ')}>
              {u.role === 'admin' ? '⚡ Admin' : '👤 User'}
            </span>

            <Badge status={u.status === 'active' ? 'active' : 'canceled'} label={u.status} />

            <span className={styles.date}>{u.created_at ? formatDate(u.created_at) : '—'}</span>

            <div className={styles.actions}>
              <button className={styles.actionBtn} title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                onClick={() => toggleRole(u)}>
                {u.role === 'admin' ? '👤' : '⚡'}
              </button>
              <button className={styles.actionBtn} title={u.status === 'active' ? 'Deactivate' : 'Activate'}
                onClick={() => toggleStatus(u)}>
                {u.status === 'active' ? '🔒' : '🔓'}
              </button>
              <button className={[styles.actionBtn, styles.deleteBtn].join(' ')} onClick={() => setDeleteTarget(u)} title="Delete">
                <TrashIcon size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />

      {/* Create user modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('users.newUser')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={saving} onClick={handleCreate}>{t('common.create')}</Button>
          </>
        }>
        <div className={styles.formGrid}>
          <Input label="Full Name" placeholder="Jane Smith" value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })} />
          <Input label="Email" type="email" placeholder="jane@company.com" value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="Password" type="password" placeholder="••••••••" value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })} />
          <div>
            <label className={styles.selectLabel}>{t('users.role')}</label>
            <select className={styles.select} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
              <option value="user">{t('users.user')}</option>
              <option value="admin">{t('users.admin')}</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remove User" width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => handleDelete(deleteTarget.id)}>Remove</Button>
          </>
        }>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          Remove <strong>{deleteTarget?.full_name || deleteTarget?.email}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  )
}
