import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function RequireAdmin({ children }) {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}
