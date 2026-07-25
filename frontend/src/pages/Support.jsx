import { useState } from 'react'
import { useLang } from '../hooks/useLang'
import { useToast } from '../hooks/useToast'
import Button from '../components/common/Button.jsx'
import Card from '../components/common/Card.jsx'
import Badge from '../components/common/Badge.jsx'
import Modal from '../components/common/Modal.jsx'
import Input from '../components/common/Input.jsx'
import { PlusIcon } from '../components/common/Icons.jsx'
import styles from './Support.module.css'

const FAQS = [
  { q: 'How do I upgrade my plan?', a: 'Go to My Plan page, select your desired plan and click Get Started. Your billing is prorated automatically.' },
  { q: 'When will I be charged?', a: 'You are billed on the same date every month (or year if on annual). Your next billing date is shown on the My Plan page.' },
  { q: 'Can I cancel anytime?', a: 'Yes. You can cancel from My Plan page at any time. You retain access until the end of your billing period.' },
  { q: 'How do I download my invoices?', a: 'Go to My Invoices, find the invoice and click the download icon. A PDF will open in a new window.' },
  { q: 'What payment methods are accepted?', a: 'Visa, Mastercard, American Express, and ACH bank transfers are supported.' },
]

const MOCK_TICKETS = [
  { id: 'TKT-001', subject: 'Payment failed twice this month', priority: 'high',   status: 'open',     created: '2026-06-28' },
  { id: 'TKT-002', subject: 'Invoice PDF not loading',          priority: 'medium', status: 'resolved', created: '2026-06-20' },
]

export default function Support() {
  const { t } = useLang()
  const toast = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState(null)
  const [form, setForm] = useState({ subject: '', message: '', priority: 'medium' })
  const [tickets, setTickets] = useState(MOCK_TICKETS)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    if (!form.subject || !form.message) { toast.push({ type: 'error', message: 'Please fill in all fields.' }); return }
    setSubmitting(true)
    await new Promise(r => setTimeout(r, 700))
    const newTicket = { id: `TKT-00${tickets.length + 1}`, subject: form.subject, priority: form.priority, status: 'open', created: new Date().toISOString().split('T')[0] }
    setTickets(prev => [newTicket, ...prev])
    toast.push({ type: 'success', message: 'Support ticket submitted! We\'ll respond within 24 hours.' })
    setModalOpen(false)
    setForm({ subject: '', message: '', priority: 'medium' })
    setSubmitting(false)
  }

  const PRIORITY_COLORS = { high: 'error', medium: 'warning', low: 'primary' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>{t('support.title')}</h1>
          <p className={styles.subtitle}>{t('support.subtitle')}</p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <PlusIcon size={16} /> {t('support.newTicket')}
        </Button>
      </div>

      <div className={styles.grid}>
        {/* My Tickets */}
        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>My Tickets</h2>
          {tickets.length === 0 ? (
            <p className={styles.empty}>No tickets yet. Create one if you need help.</p>
          ) : (
            <div className={styles.ticketList}>
              {tickets.map(tk => (
                <div key={tk.id} className={styles.ticket}>
                  <div className={styles.ticketTop}>
                    <span className={styles.ticketId}>{tk.id}</span>
                    <Badge status={tk.status === 'open' ? 'active' : 'paid'} label={tk.status} />
                  </div>
                  <p className={styles.ticketSubject}>{tk.subject}</p>
                  <div className={styles.ticketMeta}>
                    <Badge variant={PRIORITY_COLORS[tk.priority]} label={`${tk.priority} priority`} />
                    <span className={styles.ticketDate}>{tk.created}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* FAQ */}
        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>{t('support.faq')}</h2>
          <div className={styles.faqList}>
            {FAQS.map((faq, i) => (
              <div key={i} className={styles.faqItem}>
                <button className={styles.faqQ} onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span>{faq.q}</span>
                  <span className={styles.faqIcon}>{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && <p className={styles.faqA}>{faq.a}</p>}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Contact cards */}
      <div className={styles.contactRow}>
        {[
          { icon: '📧', title: 'Email Support', desc: 'billing@vaultly.io', note: 'Response within 24 hrs' },
          { icon: '💬', title: 'Live Chat', desc: 'Available Mon–Fri', note: '9 AM – 6 PM IST' },
          { icon: '📖', title: 'Documentation', desc: 'docs.vaultly.io', note: 'Guides & API reference' },
        ].map(c => (
          <div key={c.title} className={styles.contactCard}>
            <span className={styles.contactIcon}>{c.icon}</span>
            <h3 className={styles.contactTitle}>{c.title}</h3>
            <p className={styles.contactDesc}>{c.desc}</p>
            <p className={styles.contactNote}>{c.note}</p>
          </div>
        ))}
      </div>

      {/* New ticket modal */}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={t('support.newTicket')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" loading={submitting} onClick={handleSubmit}>{t('support.submit')}</Button>
          </>
        }>
        <div className={styles.formGrid}>
          <Input label={t('support.ticketSubject')} placeholder="Describe the issue briefly" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          <div>
            <label className={styles.selectLabel}>{t('ticketPriority', 'Priority')}</label>
            <select className={styles.select} value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className={styles.selectLabel}>{t('support.ticketMessage')}</label>
            <textarea className={styles.textarea} rows={5} placeholder="Please describe your issue in detail…" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  )
}
