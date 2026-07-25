import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import { authService } from '../services/authService'
import { registerUnauthorizedHandler } from '../services/api'
import { useToast } from '../hooks/useToast'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getStoredUser())
  const [initializing, setInitializing] = useState(true)
  const toast = useToast()

  useEffect(() => {
    const token = authService.getToken()
    if (token && authService.isTokenExpired(token)) {
      authService.logout()
      setUser(null)
    }
    setInitializing(false)
  }, [])

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      authService.logout()
      setUser(null)
      toast?.push({ type: 'error', message: 'Your session expired. Please sign in again.' })
    })
  }, [toast])

  const signIn = useCallback(async (credentials) => {
    // authService.signIn throws a proper Error on failure
    const { user: signedInUser } = await authService.signIn(credentials)
    setUser(signedInUser)
    return signedInUser
  }, [])

  const signUp = useCallback(async (payload) => {
    // signUp only creates the account — it does NOT log the user in automatically.
    // Caller should redirect to sign-in after success.
    await authService.signUp(payload)
  }, [])

  const logout = useCallback(() => {
    authService.logout()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, isAuthenticated: !!user, initializing, signIn, signUp, logout }),
    [user, initializing, signIn, signUp, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
