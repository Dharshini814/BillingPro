import { createContext, useCallback, useMemo, useState } from 'react'
import ToastStack from '../components/common/Toast.jsx'

export const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    ({ type = 'info', message, duration = 4000 }) => {
      const id = ++idCounter
      setToasts((prev) => [...prev, { id, type, message }])
      if (duration) {
        setTimeout(() => dismiss(id), duration)
      }
    },
    [dismiss]
  )

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}
