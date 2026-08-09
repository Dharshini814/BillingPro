import { useCallback, useEffect, useRef, useState } from 'react'
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
import { FileIcon, DownloadIcon, EyeIcon, CreditCardIcon, CheckIcon } from '../components/common/Icons.jsx'
import api from '../services/api.js'
import styles from './Invoices.module.css'

const STATUSES = ['all', 'paid', 'unpaid', 'draft', 'failed', 'refunded']
const PAYMENT_METHODS = [
  { id: 'upi',    label: 'UPI',            icon: '📱', desc: 'Google Pay, PhonePe, Paytm, BHIM' },
  { id: 'card',   label: 'Credit / Debit Card', icon: '💳', desc: 'Visa, Mastercard, RuPay, Amex' },
  { id: 'wallet', label: 'Wallet',         icon: '💰', desc: 'Use your Vaultly wallet credits (from plan downgrades)' },
  { id: 'qr',     label: 'Scan QR',        icon: '⬛', desc: 'Scan with any UPI-enabled app' },
]

// ── QR SVG (mock) ───────────────────────────────────────────────────────────
function QRCode({ value, size = 160 }) {
  // Deterministic checkerboard-style QR visual from the value string
  const cells = 21
  const cell = size / cells
  const hash = [...(value || 'qr')].reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
  const bits = []
  for (let r = 0; r < cells; r++) {
    for (let c2 = 0; c2 < cells; c2++) {
      const edge = r < 2 || r > cells - 3 || c2 < 2 || c2 > cells - 3
      const finder = (r < 8 && c2 < 8) || (r < 8 && c2 > cells - 9) || (r > cells - 9 && c2 < 8)
      const val = finder ? ((r + c2) % 2 === 0) : edge ? false : ((hash ^ (r * 31 + c2 * 17)) & 1) === 1
      if (val) bits.push({ r, c: c2 })
    }
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', borderRadius: 8, background: '#fff' }}>
      {bits.map(({ r, c }, i) => (
        <rect key={i} x={c * cell} y={r * cell} width={cell} height={cell} fill="#1a1a2e" />
      ))}
    </svg>
  )
}

// ── Invoice View Modal ────────────────────────────────────────────────────────
function InvoiceViewModal({ inv, onClose, onDownload, onPay }) {
  if (!inv) return null
  const canPay = ['unpaid', 'pending', 'failed'].includes(inv.status)
  return (
    <Modal
      isOpen={!!inv}
      onClose={onClose}
      title={`Invoice ${inv.number}`}
      width={480}
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {canPay && (
            <Button variant="primary" onClick={() => { onClose(); onPay(inv) }}
              style={{ background: 'linear-gradient(135deg,#D4A800,#F5C518)' }}>
              <CreditCardIcon size={14} style={{ marginRight: 4 }} /> Pay Now
            </Button>
          )}
          <Button variant="primary" onClick={() => onDownload(inv)}>
            <DownloadIcon size={14} style={{ marginRight: 4 }} /> Download PDF
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0, paddingBottom: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Invoice Number</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 15 }}>{inv.number}</div>
          </div>
          <Badge status={inv.status} />
        </div>
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
        {inv.notes && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(76,175,80,0.07)', borderRadius: 10, fontSize: 12, color: '#4CAF50', lineHeight: 1.6, border: '1px solid rgba(76,175,80,0.2)' }}>
            💡 {inv.notes}
          </div>
        )}
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

// ── Payment Modal ─────────────────────────────────────────────────────────────
function PaymentModal({ inv, onClose, onSuccess }) {
  const [step, setStep] = useState('select')   // 'select' | 'upi' | 'card' | 'wallet' | 'qr' | 'processing' | 'result'
  const [method, setMethod] = useState(null)
  const [result, setResult] = useState(null)
  const [processing, setProcessing] = useState(false)

  // UPI fields
  const [upiId, setUpiId] = useState('')
  // Card fields
  const [cardNum, setCardNum] = useState('')
  const [cardName, setCardName] = useState('')
  const [cardExp, setCardExp] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  // Wallet
  const [walletApp, setWalletApp] = useState('paytm')

  const toast = useToast()

  if (!inv) return null

  const WALLETS = [
    { id: 'paytm', label: 'Paytm Wallet' },
    { id: 'amazon', label: 'Amazon Pay' },
    { id: 'mobikwik', label: 'MobiKwik' },
    { id: 'freecharge', label: 'FreeCharge' },
  ]

  function reset() {
    setStep('select'); setMethod(null); setResult(null)
    setUpiId(''); setCardNum(''); setCardName(''); setCardExp(''); setCardCvv('')
  }

  function handleClose() { reset(); onClose() }

  async function submitPayment(paymentMethod) {
    setStep('processing')
    setProcessing(true)
    try {
      // First try the dedicated invoice pay endpoint (applies wallet credit + activates subscription)
      let data
      try {
        const r = await api.post(`/invoices/${inv.id}/pay`, { payment_method: paymentMethod })
        data = r.data
      } catch {
        // Fallback to generic process endpoint
        const r = await api.post('/payments/process', {
          invoice_id: inv.id,
          amount: inv.amount,
          payment_method: paymentMethod,
        })
        data = r.data
      }
      setResult({ success: data.success !== false, amount: inv.amount, method: paymentMethod, ref: data.payment_reference || data.transaction_id })
    } catch {
      setResult({ success: false, amount: inv.amount, method: paymentMethod })
    } finally {
      setProcessing(false)
      setStep('result')
    }
  }

  // ── Step: Select method ──
  if (step === 'select') {
    return (
      <Modal isOpen={!!inv} onClose={handleClose} title="Choose Payment Method" width={460}
        footer={<Button variant="ghost" onClick={handleClose}>Cancel</Button>}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Invoice</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>{inv.number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', marginBottom: 20 }}>
            <span style={{ fontWeight: 700 }}>Amount Due</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#D4A800' }}>{formatCurrency(inv.amount)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PAYMENT_METHODS.map(m => (
            <button key={m.id} onClick={() => { setMethod(m.id); setStep(m.id) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 18px', borderRadius: 12,
                background: 'var(--color-bg)',
                border: '1.5px solid var(--color-border)',
                cursor: 'pointer', transition: 'all 0.15s', textAlign: 'left',
                boxShadow: 'var(--shadow-pressed)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4A800'; e.currentTarget.style.background = 'rgba(212,168,0,0.04)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg)' }}
            >
              <span style={{ fontSize: 28 }}>{m.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)' }}>{m.label}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>{m.desc}</div>
              </div>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          <span>🔒</span> 256-bit SSL encrypted · Payments are 100% secure
        </div>
      </Modal>
    )
  }

  // ── Step: UPI ──
  if (step === 'upi') {
    return (
      <Modal isOpen={!!inv} onClose={handleClose} title="Pay via UPI" width={420}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setStep('select')}>← Back</Button>
            <Button variant="primary" onClick={() => submitPayment('upi')} disabled={!upiId.includes('@')}
              style={{ background: 'linear-gradient(135deg,#D4A800,#F5C518)', flex: 1 }}>
              Pay {formatCurrency(inv.amount)}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ padding: '14px 18px', background: 'rgba(212,168,0,0.07)', borderRadius: 12, border: '1px solid rgba(212,168,0,0.2)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Amount</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#D4A800' }}>{formatCurrency(inv.amount)}</div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 6 }}>
              UPI ID
            </label>
            <input
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi (e.g. 9876543210@okaxis)"
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none', boxShadow: 'var(--shadow-pressed)' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {['GPay', 'PhonePe', 'Paytm', 'BHIM'].map(app => (
              <button key={app}
                onClick={() => {
                  // Prefill a mock UPI id for demo
                  setUpiId(`user@${app.toLowerCase().replace('pay','pay')}`)
                }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', cursor: 'pointer', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}
              >
                {app}
              </button>
            ))}
          </div>
        </div>
      </Modal>
    )
  }

  // ── Step: Card ──
  if (step === 'card') {
    const fmt = v => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
    const fmtExp = v => v.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2')
    const valid = cardNum.replace(/\s/g, '').length === 16 && cardName.length > 2 && cardExp.length === 5 && cardCvv.length >= 3
    return (
      <Modal isOpen={!!inv} onClose={handleClose} title="Pay with Card" width={460}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setStep('select')}>← Back</Button>
            <Button variant="primary" disabled={!valid} onClick={() => submitPayment('card')}
              style={{ background: 'linear-gradient(135deg,#D4A800,#F5C518)', flex: 1 }}>
              Pay {formatCurrency(inv.amount)}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: '12px 16px', background: 'rgba(212,168,0,0.07)', borderRadius: 10, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Total</span>
            <span style={{ fontWeight: 800, color: '#D4A800', fontSize: 16 }}>{formatCurrency(inv.amount)}</span>
          </div>
          {/* Card number */}
          <div>
            <label style={lbl}>Card Number</label>
            <input value={cardNum} onChange={e => setCardNum(fmt(e.target.value))}
              placeholder="1234 5678 9012 3456" maxLength={19}
              style={inp} />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {['VISA', 'MC', 'RuPay', 'AMEX'].map(b => (
                <span key={b} style={{ fontSize: 10, padding: '2px 7px', border: '1px solid var(--color-border)', borderRadius: 4, color: 'var(--color-text-secondary)', fontWeight: 700 }}>{b}</span>
              ))}
            </div>
          </div>
          {/* Cardholder */}
          <div>
            <label style={lbl}>Cardholder Name</label>
            <input value={cardName} onChange={e => setCardName(e.target.value)}
              placeholder="Name on card" style={inp} />
          </div>
          {/* Exp + CVV */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={lbl}>Expiry (MM/YY)</label>
              <input value={cardExp} onChange={e => setCardExp(fmtExp(e.target.value))}
                placeholder="MM/YY" maxLength={5} style={inp} />
            </div>
            <div>
              <label style={lbl}>CVV</label>
              <input value={cardCvv} onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="•••" type="password" maxLength={4} style={inp} />
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
            🔒 Your card info is encrypted and never stored
          </div>
        </div>
      </Modal>
    )
  }

  // ── Step: Wallet ──
  if (step === 'wallet') {
    const walletBalance = inv.walletBalance || 0
    const walletCoversAll = walletBalance >= inv.amount
    return (
      <Modal isOpen={!!inv} onClose={handleClose} title="Pay via Vaultly Wallet" width={420}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setStep('select')}>← Back</Button>
            <Button variant="primary" onClick={() => submitPayment('Wallet')}
              style={{ background: 'linear-gradient(135deg,#4CAF50,#66BB6A)', flex: 1 }}
              disabled={walletBalance <= 0}>
              {walletCoversAll ? `Pay ${formatCurrency(inv.amount)} from Wallet` : `Apply Wallet + Pay Balance`}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Wallet Balance Card */}
          <div style={{
            padding: '16px 20px', borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(76,175,80,0.12), rgba(76,175,80,0.04))',
            border: '1.5px solid rgba(76,175,80,0.25)',
          }}>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              💰 Vaultly Wallet Balance
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#4CAF50' }}>
              {formatCurrency(walletBalance)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
              {walletBalance > 0
                ? 'Credits earned from plan downgrades'
                : 'No wallet credits available. Downgrade a plan to earn credits.'}
            </div>
          </div>

          {/* Amount breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Invoice Amount</span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(inv.amount)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
              <span style={{ fontSize: 13, color: '#4CAF50' }}>Wallet Credit Applied</span>
              <span style={{ fontWeight: 700, color: '#4CAF50' }}>−{formatCurrency(Math.min(walletBalance, inv.amount))}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ fontSize: 14, fontWeight: 700 }}>Amount Due</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: walletCoversAll ? '#4CAF50' : '#D4A800' }}>
                {walletCoversAll ? '₹0.00 🎉' : formatCurrency(Math.max(0, inv.amount - walletBalance))}
              </span>
            </div>
          </div>

          {walletBalance <= 0 && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,90,90,0.07)', border: '1px solid rgba(255,90,90,0.2)', fontSize: 13, color: '#FF5A5A' }}>
              ⚠️ No wallet credits available. Please choose another payment method.
            </div>
          )}
        </div>
      </Modal>
    )
  }

  // ── Step: QR ──
  if (step === 'qr') {
    return (
      <Modal isOpen={!!inv} onClose={handleClose} title="Scan to Pay" width={380}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => setStep('select')}>← Back</Button>
            <Button variant="primary" onClick={() => submitPayment('upi_qr')}
              style={{ background: 'linear-gradient(135deg,#D4A800,#F5C518)', flex: 1 }}>
              I've Paid
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ padding: '12px 20px', background: 'rgba(212,168,0,0.07)', borderRadius: 10, display: 'flex', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Amount</span>
            <span style={{ fontWeight: 800, color: '#D4A800', fontSize: 16 }}>{formatCurrency(inv.amount)}</span>
          </div>
          <div style={{ padding: 16, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.12)', display: 'inline-block' }}>
            <QRCode value={`upi://pay?pa=vaultly@axis&am=${inv.amount}&tn=${inv.number}`} size={180} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Scan with any UPI app</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              Google Pay · PhonePe · Paytm · BHIM · Any UPI app
            </div>
            <div style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12, padding: '4px 10px', background: 'rgba(var(--color-primary-rgb),0.08)', borderRadius: 6, display: 'inline-block' }}>
              vaultly@axis · Ref: {inv.number}
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>After payment, click "I've Paid" to confirm</div>
        </div>
      </Modal>
    )
  }

  // ── Step: Processing ──
  if (step === 'processing') {
    return (
      <Modal isOpen={!!inv} onClose={() => {}} title="Processing Payment…" width={380} footer={null}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '24px 0' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(212,168,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, animation: 'spin 1s linear infinite' }}>
            ⏳
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Processing {formatCurrency(inv.amount)}</div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Please do not close this window…</div>
          </div>
        </div>
      </Modal>
    )
  }

  // ── Step: Result ──
  if (step === 'result' && result) {
    return (
      <Modal isOpen={!!inv} onClose={() => { onSuccess && onSuccess(result); handleClose() }}
        title={result.success ? 'Payment Successful' : 'Payment Failed'} width={420}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            {!result.success && (
              <Button variant="ghost" onClick={() => setStep('select')} style={{ flex: 1 }}>Try Again</Button>
            )}
            <Button variant="primary" onClick={() => { onSuccess && onSuccess(result); handleClose() }}
              style={{ flex: 1, background: result.success ? 'linear-gradient(135deg,#22c55e,#16a34a)' : undefined }}>
              {result.success ? 'Done' : 'Close'}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '8px 0 4px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, background: result.success ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' }}>
            {result.success ? '✅' : '❌'}
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 8, color: result.success ? '#22c55e' : 'var(--color-error)' }}>
              {result.success ? `${formatCurrency(result.amount)} Paid!` : 'Payment Declined'}
            </div>
            {result.success ? (
              <>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                  Your invoice has been marked <strong>paid</strong> and your subscription is <strong>active</strong>.
                </div>
                {result.ref && (
                  <div style={{ marginTop: 10, fontFamily: 'monospace', fontSize: 12, padding: '4px 10px', background: 'rgba(var(--color-primary-rgb),0.08)', borderRadius: 6, display: 'inline-block' }}>
                    Ref: {result.ref}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                Your payment could not be processed. Please check your details and try again.
              </div>
            )}
          </div>
        </div>
      </Modal>
    )
  }

  return null
}

// shared input style used in Card form
const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: 5 }
const inp = { width: '100%', boxSizing: 'border-box', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--color-border)', background: 'var(--color-bg)', color: 'var(--color-text)', fontSize: 14, outline: 'none', boxShadow: 'var(--shadow-pressed)' }

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function MyInvoices() {
  const { user } = useAuth()
  const { t } = useLang()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [paying, setPaying] = useState(null)
  const [refunding, setRefunding] = useState(null)
  const [refundReason, setRefundReason] = useState('')
  const [requestingRefund, setRequestingRefund] = useState(false)

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)
    try {
      const res = await invoiceService.list({
        status, page, pageSize: 8, search, dateFrom, dateTo,
        customer_email: user.email
      })
      setItems(res.items)
      setTotal(res.total)
    } catch {
      toast.push({ type: 'error', message: 'Failed to load invoices' })
    } finally { setLoading(false) }
  }, [status, page, search, dateFrom, dateTo, user?.email])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [status, search, dateFrom, dateTo])

  async function handleDownload(inv) {
    toast.push({ type: 'info', message: `Opening ${inv.number} — use "Save as PDF" in the print dialog.` })
    try { await invoiceService.downloadPdf(inv.id) }
    catch (err) { toast.push({ type: 'error', message: err.message }) }
  }

  async function handleRequestRefund() {
    if (!refunding) return
    setRequestingRefund(true)
    try {
      await api.post('/refunds/request', {
        invoice_id: refunding.id,
        reason: refundReason || 'Customer requested refund',
      })
      toast.push({ type: 'success', message: '✅ Refund request submitted. Awaiting admin approval.' })
      setRefunding(null)
      setRefundReason('')
      load()
    } catch (err) {
      toast.push({ type: 'error', message: err?.response?.data?.detail || 'Failed to submit refund request' })
    } finally {
      setRequestingRefund(false)
    }
  }

  function handlePaymentSuccess(result) {
    if (result?.success) {
      toast.push({ type: 'success', message: '🎉 Payment successful! Invoice marked as paid.' })
      load()
    }
  }

  const COLS = '1.3fr 1.4fr 1.2fr 1fr 0.8fr 1fr 1.1fr 1fr 44px 44px 90px'

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Invoices</h1>
          <p className={styles.subtitle}>{total} invoice{total !== 1 ? 's' : ''}{user?.company ? ` for ${user.company}` : ''}</p>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.filtersRow}>
        <div className={styles.statusTabs}>
          {STATUSES.map((s) => (
            <button key={s} className={[styles.tab, status === s ? styles.tabActive : ''].join(' ')} onClick={() => setStatus(s)}>
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.searchWrap}>
          <input
            className={styles.searchInput}
            placeholder="Search invoice # or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.dateWrap}>
          <input type="date" className={styles.dateInput} value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className={styles.dateSep}>→</span>
          <input type="date" className={styles.dateInput} value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHead} style={{ gridTemplateColumns: COLS }}>
          <span>INVOICE #</span>
          <span>CUSTOMER</span>
          <span>PLAN</span>
          <span>SUBTOTAL</span>
          <span>TAX</span>
          <span>TOTAL</span>
          <span>ISSUED</span>
          <span>STATUS</span>
          <span></span>
          <span></span>
          <span>REFUND</span>
        </div>
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
                {Array.from({ length: 10 }).map((_, j) => <Skeleton key={j} height={14} width="80%" />)}
              </div>
            ))
          : items.length === 0
          ? <EmptyState icon={<FileIcon size={26}/>} title="No invoices yet" description="Your invoices will appear here once a subscription is activated." />
          : items.map((inv) => {
              const canPay = ['unpaid', 'pending', 'failed'].includes(inv.status)
              return (
                <div key={inv.id} className={styles.tableRow} style={{ gridTemplateColumns: COLS }}>
                  <span className={styles.mono}>{inv.number}</span>
                  <div>
                    <div className={styles.custName}>{inv.customerName || user?.full_name || user?.name || '—'}</div>
                    {inv.company && <div className={styles.custSub}>{inv.company}</div>}
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
                  <span className={styles.amount}>{formatCurrency(inv.subtotal ?? inv.amount)}</span>
                  <span className={styles.amount}>{formatCurrency(inv.taxAmount ?? 0)}</span>
                  <span className={styles.amount}>{formatCurrency(inv.amount)}</span>
                  <span className={styles.date}>{formatDate(inv.issuedAt)}</span>
                  <Badge status={inv.status} />
                  <button
                    className={styles.downloadBtn}
                    onClick={() => setViewing(inv)}
                    title="View invoice"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    <EyeIcon size={15} />
                  </button>
                  <button
                    className={styles.downloadBtn}
                    onClick={() => canPay ? setPaying(inv) : handleDownload(inv)}
                    title={canPay ? 'Pay now' : 'Download PDF'}
                    style={{ color: canPay ? '#D4A800' : 'var(--color-text-secondary)' }}
                  >
                    {canPay ? <CreditCardIcon size={15} /> : <DownloadIcon size={15} />}
                  </button>
                  {inv.status === 'paid' ? (
                    <button
                      onClick={() => { setRefunding(inv); setRefundReason('') }}
                      title="Request refund"
                      style={{
                        padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 700,
                        background: 'rgba(156,39,176,0.10)', color: '#9c27b0',
                        border: '1px solid rgba(156,39,176,0.25)', cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Refund
                    </button>
                  ) : (
                    <span style={{ width: 60 }} />
                  )}
                </div>
              )
            })
        }
      </div>
      <Pagination page={page} pageSize={8} total={total} onChange={setPage} />

      <InvoiceViewModal
        inv={viewing}
        onClose={() => setViewing(null)}
        onDownload={handleDownload}
        onPay={(inv) => { setViewing(null); setPaying(inv) }}
      />

      <PaymentModal
        inv={paying}
        onClose={() => setPaying(null)}
        onSuccess={handlePaymentSuccess}
      />

      <Modal
        isOpen={!!refunding}
        onClose={() => { setRefunding(null); setRefundReason('') }}
        title="Request Refund"
        width={440}
        footer={
          <div style={{ display: 'flex', gap: 8 }}>
            <Button variant="ghost" onClick={() => { setRefunding(null); setRefundReason('') }} disabled={requestingRefund}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={requestingRefund}
              onClick={handleRequestRefund}
              style={{ background: 'linear-gradient(135deg,#9c27b0,#ba68c8)' }}
            >
              Submit Refund Request
            </Button>
          </div>
        }
      >
        {refunding && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ padding: '12px 16px', background: 'rgba(156,39,176,0.06)', borderRadius: 10, border: '1px solid rgba(156,39,176,0.18)', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
              💜 Your refund request will be reviewed by our team. You'll be notified once it's processed.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Invoice</div>
                <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace' }}>{refunding.number}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Amount Paid</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#9c27b0' }}>{formatCurrency(refunding.amount)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Reason for Refund
              </label>
              <input
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                placeholder="e.g. Service not as expected, accidental purchase…"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '10px 14px',
                  borderRadius: 10, border: '1.5px solid var(--color-border)',
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontSize: 14, outline: 'none', boxShadow: 'var(--shadow-pressed)'
                }}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
