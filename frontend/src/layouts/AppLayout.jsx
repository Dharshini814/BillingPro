import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import { useLang } from '../hooks/useLang'
import { getInitials } from '../utils/formatters'
import LanguageSwitcher from '../components/common/LanguageSwitcher.jsx'
import NotificationPanel from '../components/common/NotificationPanel.jsx'
import {
  GridIcon, LayersIcon, UsersIcon, RefreshIcon, FileIcon,
  CreditCardIcon, ShieldIcon, SettingsIcon, LogOutIcon,
  SunIcon, MoonIcon, BellIcon, MenuIcon, ChevronLeftIcon, UserIcon, AlertIcon
} from '../components/common/Icons.jsx'
import styles from './AppLayout.module.css'

const ADMIN_NAV = [
  { key: 'dashboard', path: '/dashboard',    Icon: GridIcon },
  { key: 'plans',     path: '/plans',         Icon: LayersIcon },
  { key: 'users',     path: '/users',         Icon: UserIcon },
  { key: 'customers', path: '/customers',     Icon: UsersIcon },
  { key: 'subscriptions', path: '/subscriptions', Icon: RefreshIcon },
  { key: 'invoices',  path: '/invoices',      Icon: FileIcon },
  { key: 'payments',  path: '/payments',      Icon: CreditCardIcon },
  { key: 'failedPayments',   path: '/failed-payments',   Icon: AlertIcon },
  { key: 'auditLogs', path: '/audit-logs',    Icon: ShieldIcon },
  { key: 'settings',  path: '/settings',      Icon: SettingsIcon },
]

const USER_NAV = [
  { key: 'dashboard',    path: '/dashboard',         Icon: GridIcon },
  { key: 'myPlan',       path: '/my-plan',            Icon: LayersIcon },
  { key: 'myInvoices',   path: '/my-invoices',        Icon: FileIcon },
  { key: 'myPayments',   path: '/my-payments',        Icon: CreditCardIcon },
  { key: 'support',      path: '/support',            Icon: ShieldIcon },
  { key: 'settings',     path: '/settings',           Icon: SettingsIcon },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { t } = useLang()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)

  // Keep a CSS variable on <html> so the Modal overlay can offset correctly
  useEffect(() => {
    const offset = collapsed ? 'var(--sidebar-width-collapsed)' : 'var(--sidebar-width)'
    document.documentElement.style.setProperty('--modal-sidebar-offset', offset)
  }, [collapsed])
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)

  const isAdmin = user?.role === 'admin'
  const NAV = isAdmin ? ADMIN_NAV : USER_NAV

  function handleLogout() { logout(); navigate('/signin') }

  return (
    <div className={[styles.shell, collapsed ? styles.collapsed : ''].join(' ')}>
      {mobileOpen && <div className={styles.mobileOverlay} onClick={() => setMobileOpen(false)} />}

      {/* ── Sidebar ── */}
      <aside className={[styles.sidebar, mobileOpen ? styles.mobileVisible : ''].join(' ')}>
        <div className={styles.sidebarInner}>

          {/* Brand */}
          <div className={styles.brand}>
            <div className={styles.logoMark}>V</div>
            {!collapsed && (
              <div>
                <span className={styles.logoText}>Vaultly</span>
                {isAdmin && <span className={styles.roleTag}>Admin</span>}
              </div>
            )}
          </div>

          {/* Nav */}
          <nav className={styles.nav}>
            {NAV.map(({ key, path, Icon }) => (
              <NavLink
                key={path}
                to={path}
                className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? t(`nav.${key}`) : undefined}
              >
                <Icon size={18} className={styles.navIcon} />
                {!collapsed && <span className={styles.navLabel}>{t(`nav.${key}`)}</span>}
              </NavLink>
            ))}
          </nav>

          {/* User footer */}
          <div className={styles.userSection}>
            <div className={styles.avatar} style={{ background: isAdmin ? 'var(--color-primary)' : '#4CAF50' }}>
              {getInitials(user?.name || 'U')}
            </div>
            {!collapsed && (
              <div className={styles.userInfo}>
                <p className={styles.userName}>{user?.name}</p>
                <p className={styles.userRole}>{isAdmin ? t('common.admin') : t('common.user')}</p>
              </div>
            )}
            <button className={styles.logoutBtn} onClick={handleLogout} title={t('auth.signOut')}>
              <LogOutIcon size={16} />
            </button>
          </div>
        </div>

        <button className={styles.collapseBtn} onClick={() => setCollapsed(c => !c)}>
          <ChevronLeftIcon size={16} style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s' }} />
        </button>
      </aside>

      {/* ── Main ── */}
      <div className={styles.main}>
        <header className={styles.topbar}>
          <button className={styles.mobileMenuBtn} onClick={() => setMobileOpen(true)}>
            <MenuIcon size={20} />
          </button>

          <div className={styles.topbarRight}>
            <LanguageSwitcher />
            <button className={styles.iconBtn} onClick={toggleTheme} aria-label="Toggle theme">
              {theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}
            </button>
            <div className={styles.notifWrap}>
              <button className={styles.iconBtn} onClick={() => setNotifOpen(o => !o)} aria-label="Notifications">
                <BellIcon size={18} />
                <span className={styles.notifDot} />
              </button>
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} isAdmin={isAdmin} />
            </div>
            <div className={styles.topbarAvatar} onClick={() => navigate('/settings')}
              style={{ background: isAdmin ? 'linear-gradient(135deg,#D4A800,#F5C518)' : 'linear-gradient(135deg,#4CAF50,#81C784)' }}>
              {getInitials(user?.name || 'U')}
            </div>
          </div>
        </header>

        <main className={styles.content}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
