// Deterministic mock dataset — lets the whole product be demoed/graded
// without a live backend. Swap VITE_USE_MOCK_API=false once the real
// API (see services/*.js) is available.

const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms))

export const plans = [
  { id: 'plan_starter', name: 'Starter', price: 29, interval: 'month', color: '#D4A800',
    features: ['Up to 500 customers', 'Basic analytics', 'Email support', '2 team seats'],
    subscribers: 184 },
  { id: 'plan_growth', name: 'Growth', price: 79, interval: 'month', color: '#F5C518',
    features: ['Up to 5,000 customers', 'Advanced analytics', 'Priority support', '10 team seats', 'Webhooks'],
    subscribers: 312 },
  { id: 'plan_scale', name: 'Scale', price: 199, interval: 'month', color: '#4CAF50',
    features: ['Unlimited customers', 'Custom reporting', 'Dedicated success manager', 'Unlimited seats', 'SSO & audit logs'],
    subscribers: 96 },
  { id: 'plan_enterprise', name: 'Enterprise', price: 499, interval: 'month', color: '#1B2430',
    features: ['Custom contracts', 'On-prem options', 'SLA guarantees', 'White-glove onboarding'],
    subscribers: 21 },
]

const names = ['Ava Thompson','Noah Patel','Liam Chen','Sophia Rossi','Mia Fernandes','Ethan Kim','Isabella Rao','Lucas Meyer',
  'Amara Okafor','Jack Nguyen','Priya Sharma','Oliver Schmidt','Emma Dubois','William Santos','Chloe Andersen','Arjun Verma',
  'Grace Lindqvist','Daniel Osei','Freya Larsen','Marcus Ade']
const companies = ['Northwind Labs','BluePeak Systems','Orbital Cloud','Faraday Works','Kestrel Analytics','Vantage Robotics',
  'Solace Digital','Ironclad Security','Meridian Data','Copperline Studio','Havenly','Trailhead SaaS','Loom & Co','Beacon AI',
  'Cascadia Tech','Anchorpoint','Fernwood','Glassbead Inc','Numeral','Skyloom']

function seededRandom(seed) {
  let value = seed
  return () => {
    value = (value * 9301 + 49297) % 233280
    return value / 233280
  }
}
const rand = seededRandom(42)

export const customers = names.map((name, i) => {
  const planIdx = Math.floor(rand() * plans.length)
  return {
    id: `cust_${1000 + i}`,
    name,
    company: companies[i],
    email: `${name.split(' ')[0].toLowerCase()}@${companies[i].toLowerCase().replace(/[^a-z]/g, '')}.com`,
    plan: plans[planIdx].name,
    planId: plans[planIdx].id,
    status: rand() > 0.15 ? 'active' : rand() > 0.5 ? 'trialing' : 'past_due',
    mrr: plans[planIdx].price,
    joined: new Date(2024, Math.floor(rand() * 12), Math.floor(rand() * 28) + 1).toISOString(),
    avatarColor: ['#D4A800', '#F5C518', '#4CAF50', '#FFB547'][i % 4],
  }
})

export const subscriptions = customers.map((c, i) => ({
  id: `sub_${2000 + i}`,
  customerId: c.id,
  customerName: c.name,
  company: c.company,
  plan: c.plan,
  planId: c.planId,
  status: c.status === 'past_due' ? 'past_due' : c.status === 'trialing' ? 'trialing' : (rand() > 0.92 ? 'canceled' : 'active'),
  amount: c.mrr,
  billingCycle: rand() > 0.7 ? 'annual' : 'monthly',
  nextBilling: new Date(2026, 6 + Math.floor(rand() * 3), Math.floor(rand() * 28) + 1).toISOString(),
  startedAt: c.joined,
}))

export const invoices = Array.from({ length: 40 }).map((_, i) => {
  const cust = customers[i % customers.length]
  const statusRoll = rand()
  const status = statusRoll > 0.75 ? 'paid' : statusRoll > 0.55 ? 'pending' : statusRoll > 0.4 ? 'overdue' : statusRoll > 0.15 ? 'paid' : 'draft'
  return {
    id: `inv_${3000 + i}`,
    number: `INV-${(3000 + i).toString().padStart(5, '0')}`,
    customerId: cust.id,
    customerName: cust.name,
    company: cust.company,
    amount: cust.mrr + Math.floor(rand() * 40),
    status,
    issuedAt: new Date(2026, Math.floor(rand() * 6), Math.floor(rand() * 28) + 1).toISOString(),
    dueAt: new Date(2026, Math.floor(rand() * 6) + 1, Math.floor(rand() * 28) + 1).toISOString(),
    lineItems: [
      { label: `${cust.plan} Plan — Monthly`, amount: cust.mrr },
      { label: 'Usage overage', amount: Math.floor(rand() * 40) },
    ],
  }
})

export const payments = invoices
  .filter((inv) => inv.status === 'paid' || rand() > 0.5)
  .map((inv, i) => {
    const roll = rand()
    return {
      id: `pay_${4000 + i}`,
      invoiceId: inv.id,
      invoiceNumber: inv.number,
      customerName: inv.customerName,
      amount: inv.amount,
      status: roll > 0.85 ? 'failed' : roll > 0.8 ? 'refunded' : roll > 0.7 ? 'pending' : 'succeeded',
      method: rand() > 0.5 ? 'Visa •••• 4242' : rand() > 0.5 ? 'Mastercard •••• 1881' : 'ACH Transfer',
      processedAt: inv.issuedAt,
    }
  })

const auditActions = ['created', 'updated', 'canceled', 'deleted', 'refunded', 'logged in', 'exported']
const auditEntities = ['Subscription', 'Customer', 'Invoice', 'Payment', 'Plan', 'User']
export const auditLogs = Array.from({ length: 60 }).map((_, i) => {
  const entity = auditEntities[Math.floor(rand() * auditEntities.length)]
  const action = auditActions[Math.floor(rand() * auditActions.length)]
  const actor = names[Math.floor(rand() * names.length)]
  return {
    id: `log_${5000 + i}`,
    entity,
    action,
    actor,
    description: `${actor} ${action} ${entity.toLowerCase()} #${1000 + Math.floor(rand() * 200)}`,
    timestamp: new Date(2026, 5, Math.floor(rand() * 30) + 1, Math.floor(rand() * 24), Math.floor(rand() * 60)).toISOString(),
  }
})

export const revenueTrend = Array.from({ length: 12 }).map((_, i) => ({
  month: new Date(2026, i, 1).toLocaleString('en-US', { month: 'short' }),
  revenue: Math.round(38000 + i * 3200 + Math.sin(i) * 2400),
  mrr: Math.round(31000 + i * 2600 + Math.cos(i) * 1800),
}))

export const subscriptionGrowth = Array.from({ length: 12 }).map((_, i) => ({
  month: new Date(2026, i, 1).toLocaleString('en-US', { month: 'short' }),
  active: Math.round(280 + i * 18 + Math.sin(i) * 10),
  churned: Math.round(8 + Math.sin(i + 1) * 4),
}))

export const paymentSuccessRate = Array.from({ length: 7 }).map((_, i) => ({
  day: new Date(2026, 5, 24 + i).toLocaleString('en-US', { weekday: 'short' }),
  success: Math.round(88 + Math.sin(i) * 6),
  failed: Math.round(4 + Math.cos(i) * 2),
}))

export const planDistribution = plans.map((p) => ({ name: p.name, value: p.subscribers, color: p.color }))

export const kpis = {
  totalRevenue: revenueTrend.reduce((sum, r) => sum + r.revenue, 0),
  activeSubscriptions: subscriptions.filter((s) => s.status === 'active').length,
  mrr: subscriptions.filter((s) => s.status === 'active').reduce((sum, s) => sum + s.amount, 0),
  failedPayments: payments.filter((p) => p.status === 'failed').length,
  customersCount: customers.length,
  pendingInvoices: invoices.filter((i) => i.status === 'pending' || i.status === 'overdue').length,
}

export { wait }

// ── User Management mock data ──
export const mockUsers = [
  { id: 'admin_1', name: 'Admin User',    email: 'admin@vaultly.io', role: 'admin', status: 'active', plan: '—',       lastLogin: new Date(2026,5,30).toISOString(), joined: new Date(2024,0,1).toISOString() },
  { id: 'user_1',  name: 'Alex Johnson',  email: 'user@vaultly.io',  role: 'user',  status: 'active', plan: 'Growth',  lastLogin: new Date(2026,5,29).toISOString(), joined: new Date(2024,2,15).toISOString() },
  ...customers.slice(0,10).map((c,i) => ({
    id: c.id, name: c.name, email: c.email, role: 'user', status: i === 3 ? 'inactive' : 'active',
    plan: c.plan, lastLogin: new Date(2026, 5, 20+i).toISOString(), joined: c.joined
  }))
]
