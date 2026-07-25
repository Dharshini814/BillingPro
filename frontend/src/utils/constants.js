export const TOKEN_KEY = 'vri_auth_token'
export const REFRESH_KEY = 'vri_refresh_token'
export const USER_KEY = 'vri_user'
export const THEME_KEY = 'vri_theme'
export const REMEMBER_KEY = 'vri_remember_email'

export const SUBSCRIPTION_STATUS = {
  ACTIVE: 'active',
  TRIALING: 'trialing',
  PAST_DUE: 'past_due',
  CANCELED: 'canceled',
  PAUSED: 'paused',
}

export const INVOICE_STATUS = {
  PAID: 'paid',
  PENDING: 'pending',
  OVERDUE: 'overdue',
  DRAFT: 'draft',
  VOID: 'void',
}

export const PAYMENT_STATUS = {
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  PENDING: 'pending',
  REFUNDED: 'refunded',
}

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: 'grid' },
  { label: 'Plans', path: '/plans', icon: 'layers' },
  { label: 'Customers', path: '/customers', icon: 'users' },
  { label: 'Subscriptions', path: '/subscriptions', icon: 'refresh' },
  { label: 'Invoices', path: '/invoices', icon: 'file' },
  { label: 'Payments', path: '/payments', icon: 'card' },
  { label: 'Audit Logs', path: '/audit-logs', icon: 'shield' },
  { label: 'Settings', path: '/settings', icon: 'settings' },
]
