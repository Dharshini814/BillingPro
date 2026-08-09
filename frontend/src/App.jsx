import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from './layouts/AppLayout.jsx'
import ProtectedRoute from './routes/ProtectedRoute.jsx'
import RequireAdmin from './routes/RequireAdmin.jsx'

import Landing from './pages/Landing.jsx'
import SignIn from './pages/SignIn.jsx'
import SignUp from './pages/SignUp.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Customers from './pages/Customers.jsx'
import Plans from './pages/Plans.jsx'
import Subscriptions from './pages/Subscriptions.jsx'
import Invoices from './pages/Invoices.jsx'
import AuditLogs from './pages/AuditLogs.jsx'
import Settings from './pages/Settings.jsx'
import UserManagement from './pages/UserManagement.jsx'
import MyPlan from './pages/MyPlan.jsx'
import Support from './pages/Support.jsx'
import MyInvoices from './pages/MyInvoices.jsx'
import MyPayments from './pages/MyPayments.jsx'
import MyWallet from './pages/MyWallet.jsx'
import PaymentDashboard from './pages/PaymentDashboard.jsx'
import FailedPayments from './pages/FailedPayments.jsx'

export default function App() {
  return (
    <Routes>

      {/* Public Routes */}
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
       
        {/* Common Routes */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />

        {/* Admin Routes */}
        <Route path="/plans" element={<RequireAdmin><Plans /></RequireAdmin>} />
        <Route path="/customers" element={<RequireAdmin><Customers /></RequireAdmin>} />
        <Route path="/subscriptions" element={<RequireAdmin><Subscriptions /></RequireAdmin>} />
        <Route path="/invoices" element={<RequireAdmin><Invoices /></RequireAdmin>} />
        <Route path="/audit-logs" element={<RequireAdmin><AuditLogs /></RequireAdmin>} />
        <Route path="/users" element={<RequireAdmin><UserManagement /></RequireAdmin>} />

        {/* Payments (was Payment Dashboard) */}
        <Route path="/payments" element={<RequireAdmin><PaymentDashboard /></RequireAdmin>} />

        {/* Task 4: Failed Payments Retry & Refund */}
        <Route path="/failed-payments" element={<RequireAdmin><FailedPayments /></RequireAdmin>} />

        {/* User Routes */}
        <Route path="/my-plan" element={<MyPlan />} />
        <Route path="/my-invoices" element={<MyInvoices />} />
        <Route path="/my-payments" element={<MyPayments />} />
        <Route path="/my-wallet" element={<MyWallet />} />
        <Route path="/support" element={<Support />} />
      </Route>

      {/* Catch All */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  )
}
