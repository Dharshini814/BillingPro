import { useEffect, useState } from 'react'
import { planService } from '../services/planService'
import { useToast } from '../hooks/useToast'
import { formatCurrency } from '../utils/formatters'
import Button from '../components/common/Button.jsx'
import Modal from '../components/common/Modal.jsx'
import Input from '../components/common/Input.jsx'
import { SkeletonCard } from '../components/common/Skeleton.jsx'
import EmptyState from '../components/common/EmptyState.jsx'
import { PlusIcon, EditIcon, TrashIcon, CheckIcon, LayersIcon } from '../components/common/Icons.jsx'
import styles from './Plans.module.css'

const EMPTY_PLAN = { name: '', price: '', interval: 'month', features: '', color: '#D4A800' }

export default function Plans() {
  const toast = useToast()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editPlan, setEditPlan] = useState(null)
  const [form, setForm] = useState(EMPTY_PLAN)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState(null)

  async function load() {
    setLoading(true)
    try {
      setPlans(await planService.list())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function openCreate() { setForm(EMPTY_PLAN); setEditPlan(null); setModalOpen(true) }
  function openEdit(plan) {
    setForm({ ...plan, features: (plan.features || []).join('\n'), price: String(plan.price) })
    setEditPlan(plan)
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.name || !form.price) {
      toast.push({ type: 'error', message: 'Name and price are required.' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      }
      if (editPlan) {
        await planService.update(editPlan.id, payload)
        toast.push({ type: 'success', message: 'Plan updated successfully.' })
      } else {
        await planService.create(payload)
        toast.push({ type: 'success', message: 'Plan created successfully.' })
      }
      setModalOpen(false)
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.message })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    try {
      await planService.remove(id)
      setDeleteId(null)
      toast.push({ type: 'success', message: 'Plan deleted.' })
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err.message })
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Plans</h1>
          <p className={styles.subtitle}>Manage your subscription tiers and pricing</p>
        </div>
        <Button variant="primary" onClick={openCreate}>
          <PlusIcon size={16} /> New Plan
        </Button>
      </div>

      {loading ? (
        <div className={styles.grid}>
          {[1,2,3,4].map((n) => <SkeletonCard key={n} rows={4} />)}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState icon={<LayersIcon size={28} />} title="No plans yet" description="Create your first subscription plan to get started." action={<Button variant="primary" onClick={openCreate}><PlusIcon size={16}/> Create Plan</Button>} />
      ) : (
        <div className={styles.grid}>
          {plans.map((plan) => (
            <div key={plan.id} className={styles.planCard}>
              <div className={styles.planHeader} style={{ borderColor: plan.color }}>
                <span className={styles.planBadge} style={{ background: `${plan.color}18`, color: plan.color }}>{plan.interval === 'month' ? 'Monthly' : 'Annual'}</span>
                <h3 className={styles.planName}>{plan.name}</h3>
                <div className={styles.planPrice}>
                  <span className={styles.priceCurrency}>$</span>
                  <span className={styles.priceAmount}>{plan.price}</span>
                  <span className={styles.pricePer}>/{plan.interval}</span>
                </div>
                <p className={styles.planSubs}>{plan.subscribers ?? 0} subscribers</p>
              </div>
              <ul className={styles.featureList}>
                {(plan.features || []).map((f) => (
                  <li key={f} className={styles.featureItem}>
                    <CheckIcon size={14} style={{ color: plan.color, flexShrink: 0 }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.planActions}>
                <Button size="sm" onClick={() => openEdit(plan)}>
                  <EditIcon size={14} /> Edit
                </Button>
                <Button size="sm" variant="danger" onClick={() => setDeleteId(plan.id)}>
                  <TrashIcon size={14} /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editPlan ? 'Edit Plan' : 'Create New Plan'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>{editPlan ? 'Save Changes' : 'Create Plan'}</Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <Input label="Plan Name" placeholder="e.g. Growth" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <div className={styles.twoCol}>
            <Input label="Price (USD/month)" type="number" placeholder="79" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <div>
              <label className={styles.selectLabel}>Billing Interval</label>
              <select className={styles.select} value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value })}>
                <option value="month">Monthly</option>
                <option value="year">Annual</option>
              </select>
            </div>
          </div>
          <div>
            <label className={styles.selectLabel}>Accent Color</label>
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={styles.colorInput} />
          </div>
          <div>
            <label className={styles.selectLabel}>Features (one per line)</label>
            <textarea className={styles.textarea} rows={5} placeholder={"Up to 500 customers\nBasic analytics"} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} />
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Delete Plan" width={380}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="danger" onClick={() => handleDelete(deleteId)}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
          This plan will be permanently deleted. Existing subscribers won't be affected immediately, but no new subscriptions can be created under it.
        </p>
      </Modal>
    </div>
  )
}
